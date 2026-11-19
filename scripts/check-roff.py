import subprocess

script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.product.findMany({
    where: { OR: [{ name: { contains: 'Roff', mode: 'insensitive' } }, { sku: { contains: 'Roff', mode: 'insensitive' } }] },
    select: { id: true, name: true, sku: true, purchasePrice: true, sellingPrice: true, mrp: true }
  });
  console.log('Roff products:', JSON.stringify(products, null, 2));
}
run().finally(() => prisma.$disconnect());
"""

proc = subprocess.Popen(['ssh', 'root@2.31.109.248', 'docker exec -i distroai_api node -'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=script)
print('STDOUT:\n', stdout)
print('STDERR:\n', stderr)
