import { PrismaClient } from './packages/db/index.ts';
async function run() {
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst();
  const user = await prisma.user.findFirst({ where: { email: 'owner@acmetraders.in' } });
  const cust = await prisma.customer.findFirst({ where: { name: 'Sri Sai Kirana Store' } });
  const wh = await prisma.warehouse.findFirst();
  const product = await prisma.product.findFirst();

  const count = await prisma.order.count({ where: { orgId: org.id } });
  const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

  const order = await prisma.order.create({
    data: {
      orgId: org.id,
      orderNumber,
      customerId: cust.id,
      warehouseId: wh.id,
      status: 'CONFIRMED',
      totalAmount: 100,
      netAmount: 100,
      balanceAmount: 100,
      items: {
        create: [{
          productId: product.id,
          quantity: 1,
          unit: 'Pieces',
          price: 100,
          totalAmount: 100,
          taxRate: 18,
          taxAmount: 18
        }]
      }
    }
  });
  console.log("Created order:", order.id);

  // Now we need to test the dispatch API
  const tokenRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@acmetraders.in', password: 'password123' })
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.data.accessToken;

  const dispatchRes = await fetch(`http://localhost:3001/api/v1/orders/${order.id}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ vehicleNumber: 'KA01AB1234' })
  });
  const dispatchData = await dispatchRes.json();
  console.log("Dispatch Result:", JSON.stringify(dispatchData, null, 2));
}
run();
