import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/bills  - List bills for restaurant
router.get('/', async (req: AuthRequest, res: Response) => {
  const { orderId, isPaid } = req.query;
  const where: Record<string, unknown> = { order: { restaurantId: req.user!.restaurantId } };
  if (orderId) where.orderId = String(orderId);
  if (isPaid === 'true') where.isPaid = true;
  if (isPaid === 'false') where.isPaid = false;



  const bills = await prisma.bill.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { id: true, orderNumber: true, customerName: true, table: { select: { number: true } } } },
      payments: true,
      childBills: { select: { id: true, totalAmount: true, isPaid: true } },
    },
    take: 50,
  });

  res.json(bills);
});

// GET /api/bills/debug - System-wide debug info
router.get('/debug', async (req: AuthRequest, res: Response) => {
  const allBills = await prisma.bill.count();
  const resBills = await prisma.bill.count({
    where: { order: { restaurantId: req.user!.restaurantId } }
  });
  const unpaidResBills = await prisma.bill.count({
    where: { isPaid: false, order: { restaurantId: req.user!.restaurantId } }
  });
  
  res.json({
    totalBillsInSystem: allBills,
    billsForCurrentRestaurant: resBills,
    unpaidBillsForCurrentRestaurant: unpaidResBills,
    currentRestaurantId: req.user!.restaurantId
  });
});


// GET /api/bills/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const bill = await prisma.bill.findFirst({
    where: { id: req.params.id, order: { restaurantId: req.user!.restaurantId } },
    include: {
      order: {
        include: {
          items: {
            include: { menuItem: true, assignedBill: { select: { id: true } } },
          },
          table: true,
        },
      },
      payments: true,
      parentBill: { select: { id: true, billNumber: true } },
      childBills: true,
    },
  });
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  res.json(bill);
});

// POST /api/bills/:id/split
// Splits a bill into child bills by reassigning order items.
// Request: { splits: [{ billName?: string, itemIds: [string] }, ...] }
router.post('/:id/split', async (req: AuthRequest, res: Response) => {
  try {
    const { splits } = req.body;
    if (!Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({ error: 'Must provide at least 2 splits' });
    }

    const parentBill = await prisma.bill.findFirst({
      where: { id: req.params.id, order: { restaurantId: req.user!.restaurantId } },
      include: { order: { include: { items: true, restaurant: true } }, payments: true, childBills: true },
    });
    if (!parentBill) return res.status(404).json({ error: 'Bill not found' });
    if (parentBill.childBills.length > 0) {
      return res.status(400).json({ error: 'Bill is already split' });
    }
    if (parentBill.isPaid) {
      return res.status(400).json({ error: 'Cannot split a paid bill' });
    }

    // Collect all items to allocate
    const allItemIds = new Set<string>();
    for (const split of splits) {
      if (!Array.isArray(split.itemIds) || split.itemIds.length === 0) {
        return res.status(400).json({ error: 'Each split must have at least one itemId' });
      }
      split.itemIds.forEach((id: string) => allItemIds.add(id));
    }

    const actualItemIds = parentBill.order.items.map((oi) => oi.id);
    for (const itemId of allItemIds) {
      if (!actualItemIds.includes(itemId)) {
        return res.status(400).json({ error: `Item ${itemId} not found in order` });
      }
    }

    // Create child bills for each split
    const childBillIds: string[] = [];
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const splitItems = parentBill.order.items.filter((oi) => split.itemIds.includes(oi.id));

      const subTotal = splitItems.reduce((sum, oi) => sum + oi.quantity * (oi.priceAtOrder + oi.modifierTotal), 0);
      const taxRate = parentBill.order.restaurant.taxRate / 100;
      const taxAmount = parseFloat(((subTotal - (parentBill.discountAmount || 0)) * taxRate).toFixed(2));
      const serviceCharge = parseFloat(
        ((subTotal - (parentBill.discountAmount || 0)) * (parentBill.order.restaurant.serviceChargeRate / 100)).toFixed(2)
      );
      const rawTotal = subTotal - (parentBill.discountAmount || 0) + taxAmount + serviceCharge;
      const roundOff = parseFloat((Math.round(rawTotal) - rawTotal).toFixed(2));
      const totalAmount = Math.round(rawTotal);

      const childBill = await prisma.bill.create({
        data: {
          orderId: parentBill.orderId,
          subTotal,
          taxAmount,
          discountAmount: parentBill.discountAmount || 0,
          discountNote: parentBill.discountNote,
          serviceCharge,
          totalAmount,
          roundOff,
          billNumber: `${parentBill.billNumber}-SPLIT${i + 1}`,
          splitType: 'SPLIT',
          parentBillId: parentBill.id,
          isPaid: false,
        },
      });

      // Assign items to this split bill
      await prisma.orderItem.updateMany({
        where: { id: { in: split.itemIds } },
        data: { assignedBillId: childBill.id },
      });

      childBillIds.push(childBill.id);
    }

    // Mark parent as split
    await prisma.bill.update({
      where: { id: parentBill.id },
      data: { splitStatus: 'SPLIT' },
    });

    await prisma.auditLog.create({
      data: {
        action: 'BILL_SPLIT',
        description: `Bill split into ${splits.length} child bills`,
        orderId: parentBill.orderId,
        userId: req.user!.id,
      },
    });

    res.status(201).json({
      parentBillId: parentBill.id,
      childBillIds,
      message: `Split into ${splits.length} bills`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to split bill' });
  }
});

// POST /api/bills/:id/merge
// Merges child bills back with parent or merges multiple bills into one.
// Request: { billIds: [string] } - bill IDs to merge
router.post('/:id/merge', async (req: AuthRequest, res: Response) => {
  try {
    const targetBillId = req.params.id;
    const { billIds } = req.body;

    if (!Array.isArray(billIds) || billIds.length === 0) {
      return res.status(400).json({ error: 'billIds array is required' });
    }

    // Fetch all bills
    const bills = await prisma.bill.findMany({
      where: {
        id: { in: [targetBillId, ...billIds] },
        order: { restaurantId: req.user!.restaurantId },
      },
      include: {
        order: { include: { items: true, restaurant: true } },
        payments: true,
        childBills: true,
        parentBill: true,
      },
    });

    if (bills.length === 0) return res.status(404).json({ error: 'No bills found' });

    // Check all bills belong to same order
    const orderIds = new Set(bills.map((b) => b.orderId));
    if (orderIds.size > 1) {
      return res.status(400).json({ error: 'All bills must belong to the same order' });
    }

    // Check none are paid
    if (bills.some((b) => b.isPaid)) {
      return res.status(400).json({ error: 'Cannot merge paid bills' });
    }

    const targetBill = bills.find((b) => b.id === targetBillId);
    if (!targetBill) return res.status(404).json({ error: 'Target bill not found' });

    // Reassign all items from other bills to target bill
    const otherBillIds = billIds.filter((id) => id !== targetBillId);
    await prisma.orderItem.updateMany({
      where: { assignedBillId: { in: otherBillIds } },
      data: { assignedBillId: targetBillId },
    });

    // Delete other bills
    await prisma.bill.deleteMany({
      where: { id: { in: otherBillIds } },
    });

    // Recalculate totals for target bill
    const order = targetBill.order;
    const allItems = order.items.filter((oi) => oi.assignedBillId === targetBillId || oi.assignedBillId === null);
    const subTotal = allItems.reduce((sum, oi) => sum + oi.quantity * (oi.priceAtOrder + oi.modifierTotal), 0);
    const taxRate = order.restaurant.taxRate / 100;
    const taxAmount = parseFloat(((subTotal - (targetBill.discountAmount || 0)) * taxRate).toFixed(2));
    const serviceCharge = parseFloat(
      ((subTotal - (targetBill.discountAmount || 0)) * (order.restaurant.serviceChargeRate / 100)).toFixed(2)
    );
    const rawTotal = subTotal - (targetBill.discountAmount || 0) + taxAmount + serviceCharge;
    const roundOff = parseFloat((Math.round(rawTotal) - rawTotal).toFixed(2));
    const totalAmount = Math.round(rawTotal);

    const mergedBill = await prisma.bill.update({
      where: { id: targetBillId },
      data: {
        subTotal,
        taxAmount,
        serviceCharge,
        totalAmount,
        roundOff,
        splitStatus: 'ACTIVE',
        parentBillId: null,
      },
      include: { order: { select: { id: true } }, payments: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'BILL_MERGED',
        description: `Merged ${otherBillIds.length} bill(s) into bill ${targetBillId}`,
        orderId: order.id,
        userId: req.user!.id,
      },
    });

    res.json({
      mergedBill,
      message: `Merged ${otherBillIds.length} bill(s)`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to merge bills' });
  }
});

// POST /api/bills/:id/reprint
// Reprints a bill (useful for POS counters with multiple printers)
router.post('/:id/reprint', async (req: AuthRequest, res: Response) => {
  const bill = await prisma.bill.findFirst({
    where: { id: req.params.id, order: { restaurantId: req.user!.restaurantId } },
    include: {
      order: {
        include: {
          items: { include: { menuItem: true } },
          waiter: { select: { name: true } },
          table: true,
        },
      },
      payments: true,
    },
  });
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  await prisma.auditLog.create({
    data: {
      action: 'BILL_REPRINTED',
      description: `Bill ${bill.billNumber} reprinted`,
      orderId: bill.orderId,
      userId: req.user!.id,
    },
  });

  res.json({
    bill,
    printFormat: 'thermal',
    printedAt: new Date().toISOString(),
  });
});

// POST /api/bills/:id/email-bill
// Sends bill via email (useful for take-away/delivery)
router.post('/:id/email-bill', async (req: AuthRequest, res: Response) => {
  const { customerEmail } = req.body;
  if (!customerEmail) return res.status(400).json({ error: 'customerEmail is required' });

  const bill = await prisma.bill.findFirst({
    where: { id: req.params.id, order: { restaurantId: req.user!.restaurantId } },
    include: { order: { select: { id: true, customerName: true } } },
  });
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  // TODO: Integrate email service (SendGrid, Mailgun, etc.)
  await prisma.auditLog.create({
    data: {
      action: 'BILL_EMAILED',
      description: `Bill emailed to ${customerEmail}`,
      orderId: bill.orderId,
      userId: req.user!.id,
    },
  });

  res.json({
    message: `Bill ${bill.billNumber} sent to ${customerEmail}`,
    billId: bill.id,
  });
});

export default router;
