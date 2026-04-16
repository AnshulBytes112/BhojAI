import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { generateBill } from './billing.service';

const router = Router();
router.use(authenticate);

// GET /api/orders  - list orders for this restaurant
router.get('/', async (req: AuthRequest, res: Response) => {
  const { status, tableId, date } = req.query;
  const where: Record<string, unknown> = { restaurantId: req.user!.restaurantId };
  if (status) where['status'] = String(status);
  if (tableId) where['tableId'] = String(tableId);
  if (date) {
    const start = new Date(String(date));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where['createdAt'] = { gte: start, lt: end };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      table: true,
      waiter: { select: { name: true } },
      items: { include: { menuItem: true } },
      bill: true,
    },
    take: 50,
  });
  res.json(orders);
});

// GET /api/orders/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    include: {
      table: true,
      waiter: { select: { name: true, username: true } },
      items: { include: { menuItem: { include: { modifierGroups: { include: { options: true } } } } } },
      bill: { include: { payments: true } },
      kots: { include: { items: true } },
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// POST /api/orders  - Create new order
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, type, customerName, customerPhone, guestCount, notes, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }

    if (items.some((item: { quantity: number }) => !item.quantity || item.quantity <= 0)) {
      return res.status(400).json({ error: 'All items must have quantity greater than 0' });
    }

    if (tableId && type === 'DINE_IN') {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: tableId, restaurantId: req.user!.restaurantId },
      });
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
    }

    // Fetch menu items for pricing
    const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        category: { restaurantId: req.user!.restaurantId },
        isAvailable: true,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'One or more menu items are invalid or unavailable' });
    }

    const menuMap = Object.fromEntries(menuItems.map((m) => [m.id, m]));

    const order = await prisma.order.create({
      data: {
        type: type || 'DINE_IN',
        tableId,
        customerName,
        customerPhone,
        guestCount,
        notes,
        waiterId: req.user!.id,
        restaurantId: req.user!.restaurantId,
        status: 'PENDING',
        items: {
          create: items.map((item: {
            menuItemId: string;
            quantity: number;
            notes?: string;
            selectedModifiers?: string;
            modifierTotal?: number;
          }) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceAtOrder: menuMap[item.menuItemId]?.price || 0,
            notes: item.notes,
            selectedModifiers: item.selectedModifiers,
            modifierTotal: item.modifierTotal || 0,
          })),
        },
      },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    // Update table status if dine-in
    if (tableId && type === 'DINE_IN') {
      await prisma.restaurantTable.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    // Create KOT automatically
    await prisma.kOT.create({
      data: {
        orderId: order.id,
        station: 'KITCHEN',
        status: 'PENDING',
        items: {
          create: items.map((item: { menuItemId: string; quantity: number; notes?: string }) => ({
            name: menuMap[item.menuItemId]?.name || 'Unknown',
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'ORDER_CREATED',
        description: `Order created with ${items.length} item(s)`,
        orderId: order.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH /api/orders/:id/items  - Add items to existing order
router.patch('/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (items.some((item: { quantity: number }) => !item.quantity || item.quantity <= 0)) {
      return res.status(400).json({ error: 'All items must have quantity greater than 0' });
    }

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot modify a closed order' });
    }

    const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        category: { restaurantId: req.user!.restaurantId },
        isAvailable: true,
      },
    });
    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'One or more menu items are invalid or unavailable' });
    }

    const menuMap = Object.fromEntries(menuItems.map((m) => [m.id, m]));

    await prisma.orderItem.createMany({
      data: items.map((item: { menuItemId: string; quantity: number; notes?: string; selectedModifiers?: string; modifierTotal?: number }) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtOrder: menuMap[item.menuItemId]?.price || 0,
        notes: item.notes,
        selectedModifiers: item.selectedModifiers,
        modifierTotal: item.modifierTotal || 0,
      })),
    });

    // New KOT for added items
    await prisma.kOT.create({
      data: {
        orderId: order.id,
        station: 'KITCHEN',
        status: 'PENDING',
        items: {
          create: items.map((item: { menuItemId: string; quantity: number; notes?: string }) => ({
            name: menuMap[item.menuItemId]?.name || 'Unknown',
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ORDER_ITEMS_ADDED',
        description: `Added ${items.length} item(s) to order`,
        orderId: order.id,
        userId: req.user!.id,
      },
    });

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { menuItem: true } }, bill: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['PENDING', 'KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const existingOrder = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
  });
  if (!existingOrder) return res.status(404).json({ error: 'Order not found' });

  const order = await prisma.order.update({
    where: { id: existingOrder.id },
    data: { status },
  });

  // Free table if completed/cancelled
  if ((status === 'COMPLETED' || status === 'CANCELLED') && order.tableId) {
    await prisma.restaurantTable.update({
      where: { id: order.tableId },
      data: { status: 'AVAILABLE' },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'ORDER_STATUS_CHANGED',
      description: `Order status changed to ${status}`,
      orderId: order.id,
      userId: req.user!.id,
    },
  });

  res.json(order);
});

// POST /api/orders/:id/bill  - Generate bill
router.post('/:id/bill', async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        items: { include: { menuItem: true } },
        restaurant: true,
        bill: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.bill) return res.json(order.bill); // Return existing bill

    const { discountAmount, discountNote, splitType } = req.body;
    const bill = await generateBill(order, discountAmount, discountNote, splitType);

    await prisma.auditLog.create({
      data: {
        action: 'BILL_GENERATED',
        description: `Bill generated for order. Total: ${bill.totalAmount}`,
        orderId: order.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate bill' });
  }
});

// POST /api/orders/:id/payment  - Accept payment
router.post('/:id/payment', async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method, transactionId } = req.body;
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }
    if (!method || typeof method !== 'string') {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { bill: { include: { payments: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.bill) return res.status(400).json({ error: 'Generate bill first' });

    const alreadyPaid = order.bill.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = parseFloat((order.bill.totalAmount - alreadyPaid).toFixed(2));
    if (remaining <= 0) {
      return res.status(400).json({ error: 'Bill is already fully paid' });
    }
    if (paymentAmount > remaining) {
      return res.status(400).json({ error: `Payment exceeds due amount. Remaining: ${remaining}` });
    }

    const payment = await prisma.payment.create({
      data: {
        billId: order.bill.id,
        amount: paymentAmount,
        method,
        transactionId,
        status: 'SUCCESS',
      },
    });

    // Check if fully paid
    const totalPaid = [...order.bill.payments, payment].reduce((s, p) => s + p.amount, 0);
    if (totalPaid >= order.bill.totalAmount - 0.01) {
      await prisma.bill.update({ where: { id: order.bill.id }, data: { isPaid: true } });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });
      if (order.tableId) {
        await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_RECEIVED',
        description: `Payment of ₹${paymentAmount} via ${method}`,
        orderId: order.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// GET /api/orders/:id/audit-logs - Track all bill/order edits for fraud control
router.get('/:id/audit-logs', async (req: AuthRequest, res: Response) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const logs = await prisma.auditLog.findMany({
    where: { orderId: order.id },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(logs);
});

export default router;
