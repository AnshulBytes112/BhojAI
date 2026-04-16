import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/inventory
router.get('/', async (req: AuthRequest, res: Response) => {
  const { lowStock } = req.query;
  const items = await prisma.inventoryItem.findMany({
    where: {
      restaurantId: req.user!.restaurantId,
      ...(lowStock === 'true' && {
        AND: [
          { minThreshold: { not: null } },
          // quantity <= minThreshold (handled in map below)
        ],
      }),
    },
    orderBy: { name: 'asc' },
  });

  const result = lowStock === 'true'
    ? items.filter((i) => i.minThreshold !== null && i.quantity <= i.minThreshold)
    : items;

  res.json(result);
});

// POST /api/inventory
router.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name, sku, quantity, unit, minThreshold, costPrice } = req.body;
  const item = await prisma.inventoryItem.create({
    data: { name, sku, quantity, unit, minThreshold, costPrice, restaurantId: req.user!.restaurantId },
  });
  res.status(201).json(item);
});

// PATCH /api/inventory/:id
router.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.inventoryItem.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const item = await prisma.inventoryItem.update({
    where: { id: existing.id },
    data: req.body,
  });
  res.json(item);
});

// PATCH /api/inventory/:id/adjust  - Add or reduce stock
router.patch('/:id/adjust', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { adjustment, reason } = req.body; // positive = restock, negative = consumption
  const item = await prisma.inventoryItem.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
  });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const updated = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: { quantity: { increment: adjustment } },
  });

  // Check low stock alert
  const isLowStock = updated.minThreshold !== null && updated.quantity <= updated.minThreshold;

  res.json({ item: updated, isLowStock, reason });
});

// DELETE /api/inventory/:id
router.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.inventoryItem.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  await prisma.inventoryItem.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
