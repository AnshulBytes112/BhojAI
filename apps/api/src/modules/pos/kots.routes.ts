import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY'] as const;

// GET /api/kots?station=KITCHEN&status=PENDING
router.get('/', async (req: AuthRequest, res: Response) => {
  const { station, status } = req.query;

  const where: Record<string, unknown> = {
    order: { restaurantId: req.user!.restaurantId },
  };

  if (station && String(station).trim()) {
    where['station'] = String(station);
  }

  if (status && String(status).trim()) {
    where['status'] = String(status);
  }

  const kots = await prisma.kOT.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          table: { select: { id: true, number: true, label: true } },
        },
      },
    },
    take: 200,
  });

  res.json(kots);
});

// PATCH /api/kots/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid KOT status' });
  }

  const existing = await prisma.kOT.findFirst({
    where: {
      id: req.params.id,
      order: { restaurantId: req.user!.restaurantId },
    },
    include: {
      order: { select: { id: true } },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'KOT not found' });
  }

  const kot = await prisma.kOT.update({
    where: { id: existing.id },
    data: { status },
  });

  // Keep order status aligned with kitchen progress.
  if (status === 'IN_PROGRESS') {
    await prisma.order.update({
      where: { id: existing.order.id },
      data: { status: 'KITCHEN' },
    });
  }

  if (status === 'READY') {
    const pendingOrInProgress = await prisma.kOT.count({
      where: {
        orderId: existing.order.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    if (pendingOrInProgress === 0) {
      await prisma.order.update({
        where: { id: existing.order.id },
        data: { status: 'READY' },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: 'KOT_STATUS_CHANGED',
      description: `KOT ${existing.id.slice(0, 8)} moved to ${status}`,
      orderId: existing.order.id,
      userId: req.user!.id,
    },
  });

  res.json(kot);
});

export default router;
