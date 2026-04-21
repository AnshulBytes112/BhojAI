import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting bill reconciliation...');
  
  // Find orders that should have a bill but don't
  const ordersWithoutBills = await prisma.order.findMany({
    where: {
      bill: null,
      status: { not: 'CANCELLED' }
    },
    include: {
      items: true,
      restaurant: true
    }
  });

  console.log(`Found ${ordersWithoutBills.length} orders without bills.`);

  for (const order of ordersWithoutBills) {
    if (order.items.length === 0) {
      console.log(`Skipping order ${order.orderNumber} (no items)`);
      continue;
    }

    console.log(`Generating bill for order ${order.orderNumber}...`);
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await prisma.bill.count();
      const billNumber = `INV-${today}-${String(count + 1).padStart(5, '0')}`;

      const subTotal = order.items.reduce((sum, item) => sum + item.quantity * item.priceAtOrder, 0);
      const taxRate = order.restaurant?.taxRate || 5;
      const taxAmount = subTotal * (taxRate / 100);
      const serviceCharge = order.restaurant?.serviceChargeRate ? subTotal * (order.restaurant.serviceChargeRate / 100) : 0;
      const totalAmount = subTotal + taxAmount + serviceCharge;

      await prisma.bill.create({
        data: {
          orderId: order.id,
          subTotal,
          taxAmount,
          serviceCharge,
          totalAmount,
          billNumber,
          isPaid: false
        }
      });
      console.log(`Successfully generated bill for ${order.orderNumber}`);
    } catch (err) {
      console.error(`Failed to generate bill for ${order.orderNumber}:`, err);
    }
  }

  console.log('Reconciliation complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
