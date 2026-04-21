
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const lastOrder = await prisma.order.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { bill: { include: { payments: true } } }
    });

    if (!lastOrder) {
      console.log('No orders found');
      return;
    }

    console.log('Order Details:');
    console.log(JSON.stringify({
      id: lastOrder.id,
      status: lastOrder.status,
      bill: lastOrder.bill ? {
        id: lastOrder.bill.id,
        isPaid: lastOrder.bill.isPaid,
        totalAmount: lastOrder.bill.totalAmount,
        payments: lastOrder.bill.payments.map(p => ({ amount: p.amount, method: p.method }))
      } : 'No Bill'
    }, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
