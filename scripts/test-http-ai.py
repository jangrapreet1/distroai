import subprocess

script = """
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testHttp() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user in database');
    return;
  }
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, email: user.email }, secret, { expiresIn: '1h' });
  console.log('Generated token for user:', user.email, 'orgId:', user.orgId);

  // Call http://localhost:3000/api/v1/ai/query/stream
  const http = require('http');
  const postData = JSON.stringify({ query: 'Which products will stock out this week?' });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/v1/ai/query/stream',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': 'Bearer ' + token
    }
  }, (res) => {
    console.log('HTTP Status:', res.statusCode);
    res.setEncoding('utf8');
    let chunks = 0;
    res.on('data', (chunk) => {
      chunks++;
      process.stdout.write(chunk);
    });
    res.on('end', () => {
      console.log('\\n[Stream Completed! Total chunks: ' + chunks + ']');
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

testHttp().catch(console.error);
"""

proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_api node -"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=script)
print("STDOUT:\n", stdout)
print("STDERR:\n", stderr)
