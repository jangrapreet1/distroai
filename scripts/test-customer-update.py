import subprocess

script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const c = await prisma.customer.findUnique({ where: { id: 'cmvyv7ugj000dmyduk9jcs7wh' } });
  console.log('Current customer:', c.name, 'phone:', c.phone, 'altPhone:', c.altPhone);
}
test().catch(console.error).finally(() => prisma.$disconnect());
"""

proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_api node -"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=script)
print("STDOUT:", stdout)
print("STDERR:", stderr)
