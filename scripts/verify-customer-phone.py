import subprocess

script = """
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomer() {
  const c = await prisma.customer.findUnique({ where: { id: 'cmvyv7ugj000dmyduk9jcs7wh' } });
  console.log('Customer data in DB:', {
    name: c.name,
    contactPerson: c.contactPerson,
    phone: c.phone,
    altPhone: c.altPhone,
    whatsappNumber: c.whatsappNumber
  });
}
checkCustomer().catch(console.error).finally(() => prisma.$disconnect());
"""

proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_api node -"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=script)
print("STDOUT:\n", stdout)
print("STDERR:\n", stderr)
