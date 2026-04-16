import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/tables
router.get('/', async (req: AuthRequest, res: Response) => {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: req.user!.restaurantId },
    orderBy: [{ area: 'asc' }, { number: 'asc' }],
    include: {
      orders: {
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        include: { items: true, bill: true },
        take: 1,
      },
    },
  });
  res.json(tables);
});

// POST /api/tables
router.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { number, label, seatCapacity, area, posX, posY } = req.body;
  const table = await prisma.restaurantTable.create({
    data: { number, label, seatCapacity, area, posX, posY, restaurantId: req.user!.restaurantId },
  });
  res.status(201).json(table);
});

// PATCH /api/tables/:id
router.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.restaurantTable.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Table not found' });

  const table = await prisma.restaurantTable.update({
    where: { id: existing.id },
    data: req.body,
  });
  res.json(table);
});

// PATCH /api/tables/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const valid = ['AVAILABLE', 'OCCUPIED', 'RESERVED'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = await prisma.restaurantTable.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Table not found' });

  const table = await prisma.restaurantTable.update({
    where: { id: existing.id },
    data: { status },
  });
  res.json(table);
});

// DELETE /api/tables/:id
router.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.restaurantTable.findFirst({
    where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Table not found' });

  await prisma.restaurantTable.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
