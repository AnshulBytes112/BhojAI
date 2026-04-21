import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DEBUG BILLS ---');
  const bills = await prisma.bill.findMany({
    include: {
      order: {
        select: {
          id: true,
          restaurantId: true,
          orderNumber: true,
          customerName: true
        }
      }
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${bills.length} recent bills:`);
  bills.forEach((b, i) => {
    console.log(`[${i}] ID: ${b.id}, isPaid: ${b.isPaid}, Order: ${b.order.orderNumber}, ResID: ${b.order.restaurantId}`);
  });

  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });
  console.log('\nRestaurants in DB:');
  restaurants.forEach(r => console.log(`- ${r.name} (${r.id})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
