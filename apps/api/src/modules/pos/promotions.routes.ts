import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/promotions
router.get('/', async (req: AuthRequest, res: Response) => {
  const promotions = await prisma.promotionRule.findMany({
    where: { restaurantId: req.user!.restaurantId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      appliesToMenuItem: { select: { id: true, name: true } },
    },
  });

  res.json(promotions);
});

// POST /api/promotions
router.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const {
    name,
    description,
    type,
    value,
    minOrderAmount,
    maxDiscountAmount,
    isActive,
    priority,
    startsAt,
    endsAt,
    appliesToMenuItemId,
  } = req.body;

  if (!name || !type || !Number.isFinite(Number(value)) || Number(value) < 0) {
    return res.status(400).json({ error: 'name, type and non-negative value are required' });
  }

  if (appliesToMenuItemId) {
    const item = await prisma.menuItem.findFirst({
      where: { id: appliesToMenuItemId, category: { restaurantId: req.user!.restaurantId } },
      select: { id: true },
    });
    if (!item) return res.status(404).json({ error: 'Target menu item not found' });
  }

  const promotion = await prisma.promotionRule.create({
    data: {
      name,
      description,
      type,
      value: Number(value),
      minOrderAmount: minOrderAmount !== undefined ? Number(minOrderAmount) : null,
      maxDiscountAmount: maxDiscountAmount !== undefined ? Number(maxDiscountAmount) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      priority: priority !== undefined ? Number(priority) : 0,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      appliesToMenuItemId: appliesToMenuItemId || null,
      restaurantId: req.user!.restaurantId,
    },
  });

  res.status(201).json(promotion);
});

// PATCH /api/promotions/:id
router.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.promotionRule.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Promotion not found' });

  if (req.body.appliesToMenuItemId) {
    const item = await prisma.menuItem.findFirst({
      where: { id: req.body.appliesToMenuItemId, category: { restaurantId: req.user!.restaurantId } },
      select: { id: true },
    });
    if (!item) return res.status(404).json({ error: 'Target menu item not found' });
  }

  const patch: Record<string, unknown> = { ...req.body };
  if (patch.value !== undefined) patch.value = Number(patch.value);
  if (patch.minOrderAmount !== undefined) patch.minOrderAmount = Number(patch.minOrderAmount);
  if (patch.maxDiscountAmount !== undefined) patch.maxDiscountAmount = Number(patch.maxDiscountAmount);
  if (patch.priority !== undefined) patch.priority = Number(patch.priority);
  if (patch.startsAt !== undefined) patch.startsAt = patch.startsAt ? new Date(String(patch.startsAt)) : null;
  if (patch.endsAt !== undefined) patch.endsAt = patch.endsAt ? new Date(String(patch.endsAt)) : null;

  const promotion = await prisma.promotionRule.update({
    where: { id: existing.id },
    data: patch,
  });

  res.json(promotion);
});

// DELETE /api/promotions/:id
router.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.promotionRule.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Promotion not found' });

  await prisma.promotionRule.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
