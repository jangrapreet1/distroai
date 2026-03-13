import { PrismaClient } from './packages/db/index.ts';
const prisma = new PrismaClient();
async function run() {
  const org = await prisma.organization.findFirst();
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ORD -00003 ' },
    include: { items: true }
  });

  const dto = {
    customerId: order.customerId,
    invoiceDate: new Date().toISOString(),
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unit: item.unit,
      price: Number(item.price),
    })),
    notes: `Auto-generated for Order ${order.orderNumber}`
  };

  try {
    const customer = await prisma.customer.findFirst({ where: { id: dto.customerId, orgId: org.id } });
    if (!customer) throw new Error('Customer not found');

    const sameState = true;
    let subtotal = 0, discountAmount = 0, taxableAmount = 0;
    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0, cessAmount = 0;

    const itemsData = await Promise.all(dto.items.map(async (item) => {
        const product = await prisma.product.findFirst({ where: { id: item.productId, orgId: org.id } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        const lineTotal = item.price * item.quantity;
        const disc = (item as any).discount ?? 0;
        const taxable = lineTotal - disc;
        
        const gstRate = product.gstRate;
        const gstAmount = (taxable * gstRate) / 100;
        const gst = { cgstRate: gstRate / 2, sgstRate: gstRate / 2, igstRate: 0, cgstAmount: gstAmount / 2, sgstAmount: gstAmount / 2, igstAmount: 0 };
        
        const cessAmt = (taxable * (product.cessRate ?? 0)) / 100;
        const total = taxable + gst.cgstAmount + gst.sgstAmount + gst.igstAmount + cessAmt;

        subtotal += lineTotal;
        discountAmount += disc;
        taxableAmount += taxable;
        cgstAmount += gst.cgstAmount;
        sgstAmount += gst.sgstAmount;
        igstAmount += gst.igstAmount;
        cessAmount += cessAmt;

        return {
            productId: item.productId, description: product.name,
            hsnCode: item.hsnCode ?? product.hsnCode, quantity: item.quantity,
            unit: item.unit, price: item.price, discount: disc, taxableAmt: taxable,
            gstRate: product.gstRate, ...gst, cessRate: product.cessRate ?? 0, totalAmount: total,
        };
    }));

    const totalAmount = taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount;
    const count = await prisma.invoice.count({ where: { orgId: org.id } });
    const invoiceNumber = `INV-2026-${String(count + 1).padStart(5, '0')}`;
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
            data: {
                orgId: org.id, invoiceNumber, customerId: dto.customerId,
                invoiceDate: new Date(dto.invoiceDate), dueDate, notes: dto.notes,
                subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, cessAmount,
                totalAmount, balanceAmount: totalAmount,
                items: { create: itemsData },
            },
            include: { items: true, customer: { select: { name: true } } },
        });
        await tx.customer.update({ where: { id: dto.customerId }, data: { outstandingAmount: { increment: totalAmount } } });
        return inv;
    });

    console.log("Success!", invoice.invoiceNumber);
  } catch(e) {
    console.error("Failed:", e);
  } finally {
    await prisma.$disconnect()
  }
}
run();
