import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { OrderSource, CustomerType } from '@distroai/db';

@Injectable()
export class PortalService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
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
            select: { id: true, name: true, logoUrl: true, phone: true, email: true, address: true, city: true, state: true, slug: true }
        });
        if (!org) throw new NotFoundException('Storefront not found or inactive');
        return org;
    }

    async getCatalog(orgId: string, customerId?: string) {
        // Fetch active products with their current inventory
        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true },
            select: {
                id: true, name: true, category: true, brand: true, imageUrl: true, imageUrls: true,
                description: true, mrp: true, sellingPrice: true, unit: true, minStockLevel: true,
                inventories: {
                    select: { quantity: true, reservedQty: true }
                }
            }
        });

        // If customer is logged in (B2B), they get wholesale price (sellingPrice). Public gets MRP.
        return products.map(p => {
            const totalStock = p.inventories.reduce((sum, inv) => sum + (inv.quantity - inv.reservedQty), 0);
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
                price: customerId ? (p.sellingPrice || p.mrp) : p.mrp,
                originalPrice: p.mrp,
                isB2B: !!customerId,
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

        // Get a default warehouse
        const warehouse = await this.prisma.warehouse.findFirst({ where: { orgId } });
        if (!warehouse) throw new BadRequestException('Organization has no warehouses configured');

        // ── Stock Availability Check ──
        // Validate that every item has sufficient inventory BEFORE creating the order.
        // This prevents negative inventory and maintains data integrity.
        const shortages: { productName: string; requested: number; available: number }[] = [];

        for (const item of data.items) {
            const inv = await this.prisma.inventory.findFirst({
                where: { productId: item.productId, warehouseId: warehouse.id },
                include: { product: { select: { name: true } } },
            });
            const available = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
            if (available < item.quantity) {
                shortages.push({
                    productName: (inv as any)?.product?.name ?? item.productId,
                    requested: item.quantity,
                    available: Math.max(0, available),
                });
            }
        }

        if (shortages.length > 0) {
            const msg = shortages.map(s =>
                `${s.productName}: requested ${s.requested}, only ${s.available} available`
            ).join('; ');
            throw new BadRequestException(`Insufficient stock: ${msg}`);
        }

        // Create the order
        const totalAmount = data.items.reduce((acc: number, item: any) => acc + (item.quantity * item.price), 0);

        const order = await this.prisma.$transaction(async (tx: any) => {
            const created = await tx.order.create({
                data: {
                    orgId,
                    orderNumber: `PORTAL-${Date.now()}`,
                    customerId: orderCustomerId,
                    warehouseId: warehouse.id,
                    totalAmount,
                    netAmount: totalAmount,
                    status: 'CONFIRMED',
                    source: OrderSource.PORTAL,
                    deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
                    items: {
                        create: data.items.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unit: 'UNIT',
                            price: item.price,
                            totalAmount: item.quantity * item.price,
                        }))
                    }
                },
                include: { customer: true }
            });

            // Reserve inventory for confirmed orders (matches OrdersService.confirm behavior)
            for (const item of data.items) {
                await tx.inventory.updateMany({
                    where: { productId: item.productId, warehouseId: warehouse.id },
                    data: { reservedQty: { increment: item.quantity } },
                });
            }

            return created;
        });

        // If it was a B2B "Add to Ledger" order, we should increase their outstanding
        if (customerId && data.paymentMethod === 'LEDGER') {
            await this.prisma.customer.update({
                where: { id: customerId },
                data: { outstandingAmount: { increment: totalAmount } }
            });
        }

        return order;
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
                    select: { id: true }
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

