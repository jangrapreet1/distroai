const path = require('path');

async function fixBalances() {
  let db;
  try {
    db = require(path.join(__dirname, '../packages/db/dist/index.js'));
  } catch (e) {
    db = require(path.join(__dirname, '../packages/db/src/index.js'));
  }
  const prisma = db.prisma || db.default || new db.PrismaClient();

  const orgId = 'cmudvyiyk0013du0j6qbd3222';
  const supplierId = 'cmvske63k001e9jdap1a1vyi8';

  // Trim supplier name if it has trailing spaces
  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      name: 'Ronak',
      outstandingBalance: 40116,
    },
  });

  // Also trim vendorName in expenses
  await prisma.expense.updateMany({
    where: { orgId, vendorName: { contains: 'Ronak', mode: 'insensitive' } },
    data: { vendorName: 'Ronak' },
  });

  const updated = await prisma.supplier.findUnique({ where: { id: supplierId } });
  console.log('Supplier updated:', updated.name, 'outstandingBalance:', updated.outstandingBalance);

  await prisma.$disconnect();
}

fixBalances();
