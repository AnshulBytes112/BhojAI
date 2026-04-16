import prisma from '../../lib/prisma';

interface OrderWithItems {
  id: string;
  restaurant: {
    taxRate: number;
    serviceChargeRate: number;
  };
  items: Array<{
    quantity: number;
    priceAtOrder: number;
    modifierTotal: number;
  }>;
}

export async function generateBill(
  order: OrderWithItems,
  discountAmount = 0,
  discountNote?: string,
  splitType?: string
) {
  const subTotal = order.items.reduce((sum, item) => {
    return sum + item.quantity * (item.priceAtOrder + item.modifierTotal);
  }, 0);

  const taxRate = order.restaurant.taxRate / 100;
  const taxAmount = parseFloat(((subTotal - discountAmount) * taxRate).toFixed(2));
  const serviceCharge = parseFloat(
    ((subTotal - discountAmount) * (order.restaurant.serviceChargeRate / 100)).toFixed(2)
  );

  const rawTotal = subTotal - discountAmount + taxAmount + serviceCharge;
  const roundOff = parseFloat((Math.round(rawTotal) - rawTotal).toFixed(2));
  const totalAmount = Math.round(rawTotal);

  // Generate bill number: INV-YYYYMMDD-XXXXX
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.bill.count();
  const billNumber = `INV-${today}-${String(count + 1).padStart(5, '0')}`;

  const bill = await prisma.bill.create({
    data: {
      orderId: order.id,
      subTotal,
      taxAmount,
      discountAmount,
      discountNote,
      serviceCharge,
      totalAmount,
      roundOff,
      billNumber,
      splitType,
      isPaid: false,
    },
  });

  return bill;
}
