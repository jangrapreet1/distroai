import { PrismaClient } from './packages/db/index.ts';
async function main() {
  console.log("Starting...");
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst();
  const order = await prisma.order.findFirst({ where: { status: 'DISPATCHED' }, include: { items: true } });
  
  console.log("Found order", order?.id);
  if (!order) return;

  try {
     console.log("Executing map...");
     const itemsData = await Promise.all(order.items.map(async (item) => {
       const product = await prisma.product.findFirst({ where: { id: item.productId }});
       console.log("Found product", product?.id);
       return { productId: item.productId, qty: item.quantity, price: Number(item.price) };
     }));
     console.log("Mapped items!", itemsData);
  } catch(e) {
     console.error("Map error", e);
  }
}
main().catch(console.error).finally(() => process.exit(0));
