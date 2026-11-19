import subprocess

script = """
const jwt = require('jsonwebtoken');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPatch() {
  const c = await prisma.customer.findUnique({ where: { id: 'cmvyv7ugj000dmyduk9jcs7wh' } });
  const user = await prisma.user.findFirst({ where: { orgId: c.orgId } });
  const token = jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const patchData = JSON.stringify({
    name: 'Sandeep jakhar',
    phone: '9350995075',
    contactPerson: 'Sandeep jakhar',
    altPhone: '8529456719',
    whatsappNumber: '9350995075'
  });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/v1/customers/cmvyv7ugj000dmyduk9jcs7wh',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(patchData),
      'Authorization': 'Bearer ' + token
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('PATCH Status:', res.statusCode, 'Body:', data.slice(0, 150));
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
  });

  req.write(patchData);
  req.end();
}

testPatch().catch(console.error);
"""

proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_api node -"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=script)
print("STDOUT:\n", stdout)
print("STDERR:\n", stderr)
