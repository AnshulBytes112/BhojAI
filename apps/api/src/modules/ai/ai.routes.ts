import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/ai/upsell?menuItemIds=id1,id2
// Returns AI upsell suggestions based on current cart items
router.get('/upsell', async (req: AuthRequest, res: Response) => {
  const { menuItemIds } = req.query;
  const restaurantId = req.user!.restaurantId;

  if (!menuItemIds) return res.json({ suggestions: [] });

  const ids = String(menuItemIds).split(',');

  // Get aiTags for current cart items
  const cartItems = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, aiTags: true },
  });

  const tags = cartItems
    .flatMap((i) => (i.aiTags || '').split(','))
    .filter(Boolean)
    .map((t) => t.trim());

  // Find co-purchased items (items with matching tags, NOT already in cart)
  const suggestions = await prisma.menuItem.findMany({
    where: {
      category: { restaurantId },
      isAvailable: true,
      id: { notIn: ids },
      aiTags: { not: null },
    },
    take: 20,
  });

  // Score suggestions by tag overlap
  const scored = suggestions
    .map((item) => {
      const itemTags = (item.aiTags || '').split(',').map((t) => t.trim());
      const overlap = itemTags.filter((t) => tags.includes(t)).length;
      return { ...item, score: overlap };
    })
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // If no tag-based suggestions, return popular items
  if (scored.length === 0) {
    const popular = await prisma.menuItem.findMany({
      where: { category: { restaurantId }, isAvailable: true, id: { notIn: ids } },
      orderBy: { sortOrder: 'asc' },
      take: 3,
    });
    return res.json({ suggestions: popular, source: 'popular' });
  }

  res.json({ suggestions: scored, source: 'ai_tags' });
});

// GET /api/ai/insights  - Sales-based AI insights
router.get('/insights', async (req: AuthRequest, res: Response) => {
  const restaurantId = req.user!.restaurantId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orderItems, totalOrders] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { restaurantId, createdAt: { gte: thirtyDaysAgo } } },
      include: { menuItem: { select: { name: true, price: true, aiTags: true } } },
    }),
    prisma.order.count({ where: { restaurantId, createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  // Calculate item sales frequency
  const itemStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const oi of orderItems) {
    if (!itemStats[oi.menuItemId]) {
      itemStats[oi.menuItemId] = { name: oi.menuItem.name, count: 0, revenue: 0 };
    }
    itemStats[oi.menuItemId].count += oi.quantity;
    itemStats[oi.menuItemId].revenue += oi.quantity * oi.priceAtOrder;
  }

  const stats = Object.entries(itemStats).map(([id, data]) => ({ id, ...data }));
  const avgCount = stats.reduce((s, i) => s + i.count, 0) / (stats.length || 1);

  const slowItems = stats.filter((i) => i.count < avgCount * 0.3);
  const hotItems = stats.filter((i) => i.count > avgCount * 2).slice(0, 5);

  const insights = [
    ...hotItems.map((i) => ({
      type: 'HOT_ITEM',
      message: `🔥 "${i.name}" is a bestseller! Consider featuring it on the POS home screen.`,
      data: i,
    })),
    ...slowItems.slice(0, 3).map((i) => ({
      type: 'SLOW_ITEM',
      message: `📉 "${i.name}" has low sales. Consider a discount or combo.`,
      data: i,
    })),
    totalOrders > 0
      ? {
          type: 'SUMMARY',
          message: `📊 ${totalOrders} orders in last 30 days. Avg ${(orderItems.length / totalOrders).toFixed(1)} items/order.`,
          data: { totalOrders },
        }
      : null,
  ].filter(Boolean);

  // Store snapshot
  await prisma.aIInsight.create({
    data: {
      restaurantId,
      type: 'SNAPSHOT',
      data: JSON.stringify({ hotItems: hotItems.slice(0, 3), slowItems: slowItems.slice(0, 3) }),
    },
  });

  res.json({ insights, generatedAt: new Date() });
});

// POST /api/ai/combo-suggest  - Suggest combos for a given item
router.post('/combo-suggest', async (req: AuthRequest, res: Response) => {
  const { menuItemId } = req.body;
  const restaurantId = req.user!.restaurantId;

  // Find all orders containing this item
  const ordersWithItem = await prisma.orderItem.findMany({
    where: { menuItemId, order: { restaurantId } },
    select: { orderId: true },
    take: 100,
  });
  const orderIds = ordersWithItem.map((o) => o.orderId);

  if (orderIds.length === 0) {
    return res.json({ combos: [], message: 'Not enough data yet' });
  }

  // Find other items frequently ordered with this item
  const coOrdered = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds }, menuItemId: { not: menuItemId } },
    include: { menuItem: { select: { id: true, name: true, price: true } } },
  });

  const freq: Record<string, { name: string; price: number; count: number }> = {};
  for (const oi of coOrdered) {
    if (!freq[oi.menuItemId]) {
      freq[oi.menuItemId] = { name: oi.menuItem.name, price: oi.menuItem.price, count: 0 };
    }
    freq[oi.menuItemId].count++;
  }

  const combos = Object.entries(freq)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({ combos, basedOnOrders: orderIds.length });
});

export default router;
