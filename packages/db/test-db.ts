import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const queries = await prisma.aIQuery.findMany();
  console.log("Found queries:", queries.length);
  if (queries.length > 0) {
    console.log("Sample query userId:", queries[0].userId, "orgId:", queries[0].orgId);
  }
}
main().finally(() => prisma.$disconnect());
