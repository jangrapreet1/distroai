const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    const cust = await prisma.customer.findFirst({ where: { orgId: org.id } });
    if (!cust) continue;
    
    // Find or create a dummy order
    let returnOrder = await prisma.order.findFirst({ where: { orgId: org.id } });
    if(!returnOrder) continue;

    // Find or create a dummy invoice
    let inv = await prisma.invoice.findFirst({ where: { orgId: org.id } });
    if(!inv) continue;
    
    const cnCount = await prisma.creditNote.count({ where: { orgId: org.id } });
    const cn = await prisma.creditNote.create({
      data: {
        organization: { connect: { id: org.id } },
        customer: { connect: { id: cust.id } },
        creditNoteNumber: `CN-TEST-${cnCount + Date.now() % 1000}`,
        invoice: { connect: { id: inv.id } },
        returnOrder: { connect: { id: returnOrder.id } },
        creditNoteDate: new Date(),
        originalInvoiceDate: new Date(),
        reason: 'Dummy Note for Testing UI',
        totalAmount: 123.45,
        status: 'ISSUED'
      }
    }).catch(e => console.log('Failed', e.message));
    
    if (cn) console.log("Created note for", org.name, cn.id);
  }
}
run();
