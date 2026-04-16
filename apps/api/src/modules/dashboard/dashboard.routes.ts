import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/summary  - Sales summary for a date range
router.get('/summary', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query;
  const restaurantId = req.user!.restaurantId;

  const start = from ? new Date(String(from)) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = to ? new Date(String(to)) : new Date(new Date().setHours(23, 59, 59, 999));

  const [orders, bills, payments] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: start, lte: end } },
      include: { bill: { include: { payments: true } } },
    }),
    prisma.bill.findMany({
      where: { order: { restaurantId }, createdAt: { gte: start, lte: end } },
      include: { payments: true },
    }),
    prisma.payment.findMany({
      where: { bill: { order: { restaurantId } }, createdAt: { gte: start, lte: end } },
    }),
  ]);

  const totalRevenue = bills
    .filter((b) => b.isPaid)
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;
  const avgOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

  // Payment method breakdown
  const paymentBreakdown = payments.reduce((acc: Record<string, number>, p) => {
    acc[p.method] = (acc[p.method] || 0) + p.amount;
    return acc;
  }, {});

  // Low stock items
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: { restaurantId },
  }).then((items) =>
    items.filter((i) => i.minThreshold !== null && i.quantity <= i.minThreshold)
  );

  res.json({
    period: { from: start, to: end },
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    completedOrders,
    cancelledOrders,
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    paymentBreakdown,
    lowStockCount: lowStockItems.length,
    lowStockItems,
  });
});

// GET /api/dashboard/top-items  - Best selling menu items
router.get('/top-items', async (req: AuthRequest, res: Response) => {
  const { from, to, limit } = req.query;
  const restaurantId = req.user!.restaurantId;
  const start = from ? new Date(String(from)) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = to ? new Date(String(to)) : new Date();
  const take = Number(limit) || 10;

  const orderItems = await prisma.orderItem.findMany({
    where: { order: { restaurantId, createdAt: { gte: start, lte: end } } },
    include: { menuItem: { select: { name: true, price: true, dietaryLabel: true } } },
  });

  const itemMap: Record<string, { name: string; count: number; revenue: number; dietaryLabel: string | null }> = {};
  for (const item of orderItems) {
    if (!itemMap[item.menuItemId]) {
      itemMap[item.menuItemId] = {
        name: item.menuItem.name,
        count: 0,
        revenue: 0,
        dietaryLabel: item.menuItem.dietaryLabel,
      };
    }
    itemMap[item.menuItemId].count += item.quantity;
    itemMap[item.menuItemId].revenue += item.quantity * item.priceAtOrder;
  }

  const sorted = Object.entries(itemMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, take);

  res.json(sorted);
});

// GET /api/dashboard/hourly  - Hourly sales for today
router.get('/hourly', async (req: AuthRequest, res: Response) => {
  const restaurantId = req.user!.restaurantId;
  const start = new Date(new Date().setHours(0, 0, 0, 0));
  const end = new Date(new Date().setHours(23, 59, 59, 999));

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: start, lte: end } },
    include: { bill: true },
  });

  const hourly: Record<number, { orders: number; revenue: number }> = {};
  for (let h = 0; h < 24; h++) hourly[h] = { orders: 0, revenue: 0 };

  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours();
    hourly[hour].orders += 1;
    if (order.bill?.isPaid) hourly[hour].revenue += order.bill.totalAmount;
  }

  res.json(
    Object.entries(hourly).map(([hour, data]) => ({ hour: Number(hour), ...data }))
  );
});

export default router;
