import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

// GET /api/inventory
router.get('/', async (req: AuthRequest, res: Response) => {
  const lowStock = req.query.lowStock === 'true';
  const search = String(req.query.search || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
  const shouldPaginate = req.query.page !== undefined || req.query.pageSize !== undefined || !!search;

  const items = await prisma.inventoryItem.findMany({
    where: {
      restaurantId: req.user!.restaurantId,
      ...(lowStock && {
        AND: [
          { minThreshold: { not: null } },
          // quantity <= minThreshold (handled in map below)
        ],
      }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
        ],
      }),
    },
    orderBy: { name: 'asc' },
  });

  const result = lowStock
    ? items.filter((i) => i.minThreshold !== null && i.quantity <= i.minThreshold)
    : items;

  if (!shouldPaginate) {
    return res.json(result);
  }

  const total = result.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = result.slice(start, start + pageSize);

  return res.json({
    items: paged,
    total,
    page: safePage,
    pageSize,
    totalPages,
  });
});

// GET /api/inventory/export.csv
router.get('/export.csv', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const lowStock = req.query.lowStock === 'true';
  const search = String(req.query.search || '').trim();

  const items = await prisma.inventoryItem.findMany({
    where: {
      restaurantId: req.user!.restaurantId,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
        ],
      }),
      ...(lowStock && {
        AND: [{ minThreshold: { not: null } }],
      }),
    },
    orderBy: { name: 'asc' },
  });

  const filtered = lowStock
    ? items.filter((i) => i.minThreshold !== null && i.quantity <= i.minThreshold)
    : items;

  const header = ['Name', 'SKU', 'Quantity', 'Unit', 'MinThreshold', 'CostPrice', 'StockValue'];
  const rows = filtered.map((item) => {
    const value = Number(item.quantity || 0) * Number(item.costPrice || 0);
    return [
      item.name,
      item.sku || '',
      item.quantity,
      item.unit,
      item.minThreshold ?? '',
      item.costPrice ?? '',
      value.toFixed(2),
    ];
  });

  const csv = [header, ...rows]
    .map((line) => line.map(escapeCsvCell).join(','))
    .join('\n');

  const dateTag = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=inventory-${dateTag}.csv`);
  return res.status(200).send(csv);
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
