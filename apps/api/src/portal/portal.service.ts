import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { OrderSource, CustomerType } from '@distroai/db';
import { PLAN_LIMITS, PlanName } from '../common/config/plan-limits.config';

import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PortalService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private ordersService: OrdersService
    ) { }

    async getStorefrontInfo(orgIdOrSlug: string) {
        const org = await this.prisma.organization.findFirst({
            where: {
                isActive: true,
                OR: [
                    { id: orgIdOrSlug },
                    { slug: orgIdOrSlug }
                ]
            },
            select: { id: true, plan: true, name: true, logoUrl: true, phone: true, email: true, address: true, city: true, state: true, slug: true, businessType: true }
        });
        if (!org) throw new NotFoundException('Storefront not found or inactive');

        if (!PLAN_LIMITS[org.plan as PlanName].features.customerPortal) {
            throw new HttpException(
                {
                    code: 'PLAN_LIMIT_REACHED',
                    feature: 'customerPortal',
                    message: 'B2B Customer Portal is only available on the Starter plan and above.',
                },
                HttpStatus.PAYMENT_REQUIRED
            );
        }

        return org;
    }

    async getCatalog(orgId: string, customerId?: string) {
        // Resolve customer type for tiered pricing
        let customerType: string | null = null;
        if (customerId) {
            const customer = await this.prisma.customer.findUnique({
                where: { id: customerId },
                select: { type: true }
            });
            customerType = customer?.type ?? null;
        }

        // Fetch active products with their current inventory
        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true },
            select: {
                id: true, name: true, category: true, brand: true, imageUrl: true, imageUrls: true,
                description: true, mrp: true, sellingPrice: true, purchasePrice: true, unit: true, minStockLevel: true,
                inventories: {
                    select: { quantity: true, reservedQty: true }
                }
            }
        });

        // Type-aware pricing:
        //   WHOLESALER   → purchasePrice (deepest wholesale)
        //   RETAILER     → sellingPrice  (standard trade price)
        //   INSTITUTION  → sellingPrice  (same as retailer)
        //   Guest/INDIVIDUAL → mrp       (retail price)
        return products.map(p => {
            const totalStock = p.inventories.reduce((sum, inv) => sum + (inv.quantity - inv.reservedQty), 0);

            let price = p.mrp;
            if (customerType === 'WHOLESALER') {
                price = p.purchasePrice || p.sellingPrice || p.mrp;
            } else if (customerType === 'RETAILER' || customerType === 'INSTITUTION') {
                price = p.sellingPrice || p.mrp;
            }

            return {
                id: p.id,
                name: p.name,
                category: p.category,
                brand: p.brand,
                imageUrl: p.imageUrl,
                imageUrls: p.imageUrls,
                description: p.description,
                unit: p.unit,
                minStockLevel: p.minStockLevel,
                price,
                originalPrice: p.mrp,
                isB2B: !!customerId,
                customerType: customerType || 'GUEST',
                stock: totalStock,
                inStock: totalStock > 0
            };
        });
    }

    async requestOTP(orgId: string, phone: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { orgId, phone, isActive: true }
        });

        if (!customer) {
            throw new NotFoundException('No registered retailer found with this phone number. Please contact the distributor to set up your account.');
        }

        // In production, integrate MSG91 or Twilio here.
        // For development, we auto-generate 1234.
        const otp = '1234';

        return { success: true, message: 'OTP sent successfully (Use 1234 for testing)' };
    }

    async verifyOTP(orgId: string, phone: string, otp: string) {
        if (otp !== '1234') {
            throw new UnauthorizedException('Invalid OTP');
        }

        const customer = await this.prisma.customer.findFirst({
            where: { orgId, phone, isActive: true }
        });

        if (!customer) throw new NotFoundException('Customer not found');

        const payload = { sub: customer.id, orgId: customer.orgId, type: 'portal' };
        const token = this.jwtService.sign(payload);

        return {
            token,
            customer: {
                id: customer.id,
                name: customer.name,
                type: customer.type,
                outstandingAmount: customer.outstandingAmount,
                creditLimit: customer.creditLimit
            }
        };
    }

    async placeOrder(orgId: string, customerId: string | null, data: any) {
        // B2C (Public) buys as INDIVIDUAL. B2B buys under their Customer ID.
        let orderCustomerId = customerId;

        if (!orderCustomerId) {
            // It's a B2C Guest order. We need their details to create an INDIVIDUAL customer record.
            if (!data.guestName || !data.guestPhone) {
                throw new BadRequestException('Guest orders require name and phone number');
            }
            // Find existing customer by phone first to avoid duplicates
            const existingCust = await this.prisma.customer.findFirst({
                where: { orgId, phone: data.guestPhone, isActive: true },
            });
            if (existingCust) {
                orderCustomerId = existingCust.id;
            } else {
                const newCust = await this.prisma.customer.create({
                    data: {
                        orgId,
                        name: data.guestName,
                        phone: data.guestPhone,
                        type: CustomerType.INDIVIDUAL,
                        isActive: true,
                        fullAddress: data.guestAddress || '',
                    }
                });
                orderCustomerId = newCust.id;
            }
        }

        // Delegate entire creation, tax calculation, and pricing logic to central orders service
        const draftOrder = await this.ordersService.create(orgId, {
            customerId: orderCustomerId,
            source: OrderSource.PORTAL,
            items: data.items,
        }, 'SYSTEM_PORTAL');

        // Note: For paymentMethod === 'ONLINE', we might hold off confirming until payment succeeds, 
        // but since RazorPay implies B2B mostly goes through LEDGER or standard deferred terms, 
        // we'll confirm immediately to match previous logic and trigger the Invoice + WhatsApp.
        await this.ordersService.confirm(orgId, draftOrder.id, 'SYSTEM_PORTAL');

        // Closed-loop UTM tracking: if the order originated from a marketing ad, stamp it
        if (data.utmCampaignId) {
            await this.prisma.order.update({
                where: { id: draftOrder.id },
                data: { utmCampaignId: data.utmCampaignId },
            });
        }

        return await this.prisma.order.findUnique({ where: { id: draftOrder.id } });
    }

    async getLedger(orgId: string, customerId: string) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId, orgId }
        });
        if (!customer) throw new NotFoundException('Customer not found');

        const orders = await this.prisma.order.findMany({
            where: { customerId, orgId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true, source: true }
        });

        return {
            outstandingAmount: customer.outstandingAmount,
            creditLimit: customer.creditLimit,
            recentOrders: orders
        };
    }

    async getOrders(orgId: string, customerId: string) {
        const orders = await this.prisma.order.findMany({
            where: { customerId, orgId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                netAmount: true,
                status: true,
                source: true,
                deliveryDate: true,
                createdAt: true,
                items: {
                    select: { id: true, productId: true }
                }
            }
        });

        return orders.map(o => ({
            ...o,
            itemCount: o.items.length,
            items: undefined
        }));
    }

    async getOrderDetail(orgId: string, customerId: string, orderId: string) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, orgId, customerId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, imageUrl: true, category: true, unit: true, sku: true }
                        }
                    }
                },
                statusHistory: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!order) throw new NotFoundException('Order not found');
        return order;
    }

    async getReorderItems(orgId: string, customerId: string, orderId: string) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, orgId, customerId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, imageUrl: true, category: true, sellingPrice: true, mrp: true, unit: true, isActive: true }
                        }
                    }
                }
            }
        });

        if (!order) throw new NotFoundException('Order not found');

        // Return only active products with current pricing
        return order.items
            .filter(item => item.product.isActive)
            .map(item => ({
                productId: item.product.id,
                name: item.product.name,
                imageUrl: item.product.imageUrl,
                category: item.product.category,
                price: item.product.sellingPrice || item.product.mrp,
                originalPrice: item.product.mrp,
                unit: item.product.unit,
                quantity: item.quantity
            }));
    }
}

