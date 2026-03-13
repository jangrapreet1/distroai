const { PrismaClient } = require('./packages/db/dist/index.js');
async function run() {
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst();
  const cust = await prisma.customer.findFirst();
  const wh = await prisma.warehouse.findFirst();
  const product = await prisma.product.findFirst();

  const count = await prisma.order.count({ where: { orgId: org.id } });
  const orderNumber = `ORD-TEST-${count + 1}`;

  const order = await prisma.order.create({
    data: {
      orgId: org.id, orderNumber, customerId: cust.id, warehouseId: wh.id, status: 'CONFIRMED',
      totalAmount: 100, netAmount: 100, balanceAmount: 100,
      items: { create: [{ productId: product.id, quantity: 1, unit: 'Pieces', price: 100, totalAmount: 100, taxRate: 18, taxAmount: 18 }] }
    }
  });

  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@acmetraders.in', password: 'password123' })
  });
  const { data: { accessToken } } = await loginRes.json();
  
  const dispatchRes = await fetch(`http://localhost:3001/api/v1/orders/${order.id}/dispatch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify({ vehicleNumber: 'KA01AB1234' })
  });
  console.log('Status:', dispatchRes.status, await dispatchRes.text());
}
run();
