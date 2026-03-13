import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';
import { InvoicesService } from './apps/api/src/invoices/invoices.service';
import { PrismaClient } from './packages/db/index.ts';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const invoicesService = app.get(InvoicesService);
  const prisma = new PrismaClient();
  
  const org = await prisma.organization.findFirst();
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ORD -00003 ' },
    include: { items: true }
  });

  try {
    const res = await invoicesService.create(org.id, {
        customerId: order.customerId,
        invoiceDate: new Date().toISOString(),
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          price: Number(item.price),
        })),
        notes: `Auto-generated for Order ${order.orderNumber}`,
    });
    console.log("Success!", res);
  } catch (err) {
    console.error("Error creating invoice:", err);
  }
  await app.close();
}
bootstrap();
