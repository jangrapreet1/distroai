import { PrismaClient } from './packages/db/index.ts';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';
import { OrdersService } from './apps/api/src/orders/orders.service';
import { InvoicesService } from './apps/api/src/invoices/invoices.service';

const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING INVOICE DEBUG TEST ---');

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No org found');

    const customer = await prisma.customer.findFirst();
    if (!customer) throw new Error('No customer found');

    const warehouse = await prisma.warehouse.findFirst();
    if (!warehouse) throw new Error('No warehouse found');

    const product = await prisma.product.findFirst();
    if (!product) throw new Error('No product found');

    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found');

    const count = await prisma.order.count({ where: { orgId: org.id } });
    const orderNumber = `ORD-TEST-${count + 1}`;

    // 1. Create Order
    const order = await prisma.order.create({
        data: {
            orgId: org.id,
            orderNumber,
            customerId: customer.id,
            warehouseId: warehouse.id,
            status: 'CONFIRMED', // Start at confirmed
            totalAmount: 500,
            netAmount: 500,
            balanceAmount: 500,
            items: {
                create: [{
                    productId: product.id,
                    quantity: 2,
                    unit: 'Pieces',
                    price: 250,
                    totalAmount: 500,
                    taxRate: 18,
                    taxAmount: 90
                }]
            }
        },
        include: { items: true }
    });
    console.log(`Created dummy confirmed order: ${order.id}`);

    // 2. Boot up Nest application context
    console.log('Booting Nest app context...');
    const app = await NestFactory.createApplicationContext(AppModule);

    const ordersService = app.get(OrdersService);
    const invoicesService = app.get(InvoicesService);

    console.log('Dispatching order through OrdersService...');
    try {
        const result = await ordersService.dispatch(org.id, order.id, { vehicleNumber: 'DEBUG-123' }, user.id);
        console.log('Dispatch result:', result);
    } catch (err) {
        console.error('FAILED TO DISPATCH:', err);
    }

    // 3. Check if invoice was created
    const invoices = await prisma.invoice.findMany({ where: { orgId: org.id }, include: { items: true } });
    console.log(`Total invoices in DB: ${invoices.length}`);
    if (invoices.length > 0) {
        console.log('Latest invoice:', invoices[invoices.length - 1]);
    }

    const updatedCust = await prisma.customer.findUnique({ where: { id: customer.id } });
    console.log(`Customer outstanding: ${updatedCust?.outstandingAmount}`);

    await app.close();
    await prisma.$disconnect();
}

main().catch(err => {
    console.error('FATAL SCRIPT ERROR:', err);
    process.exit(1);
});
