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

    async getStorefrontInfo(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId, isActive: true },
            select: { id: true, name: true, logoUrl: true, phone: true, email: true, address: true, city: true, state: true }
        });
        if (!org) throw new NotFoundException('Storefront not found or inactive');
        return org;
    }

    async getCatalog(orgId: string, customerId?: string) {
        // Fetch active products
        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true },
            select: { id: true, name: true, category: true, brand: true, imageUrl: true, description: true, mrp: true, sellingPrice: true, unit: true, minStockLevel: true }
        });

        // If customer is logged in (B2B), they get wholesale price (sellingPrice). Public gets MRP.
        return products.map(p => ({
            ...p,
            price: customerId ? (p.sellingPrice || p.mrp) : p.mrp,
            originalPrice: p.mrp,
            isB2B: !!customerId
        }));
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
            // Auto-create individual customer
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

        // Create the order
        const totalAmount = data.items.reduce((acc: number, item: any) => acc + (item.quantity * item.price), 0);

        // Get a default warehouse
        const warehouse = await this.prisma.warehouse.findFirst({ where: { orgId } });
        if (!warehouse) throw new BadRequestException('Organization has no warehouses configured');

        const order = await this.prisma.order.create({
            data: {
                orgId,
                orderNumber: `PORTAL-${Date.now()}`,
                customerId: orderCustomerId,
                warehouseId: warehouse.id,
                totalAmount,
                netAmount: totalAmount,
                status: 'CONFIRMED', // Paid orders / B2B orders go straight to confirmed
                source: OrderSource.PORTAL,
                deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // Next 2 days
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

        // Fetch recent orders as ledger entries
        const orders = await this.prisma.order.findMany({
            where: { customerId, orgId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true, source: true }
        });

        // Fetch recent payments and invoices if we wanted a true double-entry ledger, 
        // but for B2B Retailer simplicity, showing recent orders and current outstanding balance is enough.

        return {
            outstandingAmount: customer.outstandingAmount,
            creditLimit: customer.creditLimit,
            recentOrders: orders
        };
    }
}
