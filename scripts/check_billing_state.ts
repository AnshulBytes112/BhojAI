
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const lastOrder = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { bill: { include: { payments: true } } }
  });

  if (!lastOrder) {
    console.log('No orders found');
    return;
  }

  console.log('Order:', {
    id: lastOrder.id,
    status: lastOrder.status,
    billPaid: lastOrder.bill?.isPaid,
    billTotal: lastOrder.bill?.totalAmount,
    totalPaid: lastOrder.bill?.payments.reduce((s, p) => s + p.amount, 0)
  });

  const allPending = await prisma.bill.count({ where: { isPaid: false } });
  console.log('Total Pending Bills:', allPending);
}

check();
