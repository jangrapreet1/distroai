import subprocess

script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
  const updated = await prisma.customer.update({
    where: { id: 'cmvyv7ugj000dmyduk9jcs7wh' },
    data: {
      phone: '9350995075',
      contactPerson: 'Sandeep jakhar',
      altPhone: '8529456719',
      whatsappNumber: '9350995075'
    }
  });
  console.log('Updated customer:', updated.name, 'phone:', updated.phone, 'altPhone:', updated.altPhone);
}
update().catch(console.error).finally(() => prisma.$disconnect());
"""

proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_api node -"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=script)
print("STDOUT:", stdout)
print("STDERR:", stderr)
