const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const bills = await prisma.bill.findMany({
    include: { payments: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.dir(bills, { depth: null });
}
main().catch(console.error).finally(()=>prisma.$disconnect());
