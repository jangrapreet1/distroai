import subprocess

# Run a test inside distroai_api container to execute queryStream directly
test_script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const org = await prisma.organization.findFirst();
  const user = await prisma.user.findFirst({ where: { orgId: org.id } });
  console.log('Testing with org:', org.name, 'user:', user.email);

  // Import AiService compiled dist
  const { AiService } = require('./dist/apps/api/src/ai/ai.service.js');
  const aiService = new AiService(prisma, null, null, null);

  console.log('Sending queryStream: "Which products will stock out this week?"');
  let output = '';
  for await (const chunk of aiService.queryStream(org.id, user.id, 'Which products will stock out this week?')) {
    const parsed = JSON.parse(chunk.data);
    if (parsed.token) {
      process.stdout.write(parsed.token);
      output += parsed.token;
    }
  }
  console.log('\\n--- Stream Finished successfully! Total length:', output.length);
}

run().catch(console.error).finally(() => prisma.$disconnect());
"""

proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_api node -"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=test_script)
print("STDOUT:\n", stdout)
print("STDERR:\n", stderr)
