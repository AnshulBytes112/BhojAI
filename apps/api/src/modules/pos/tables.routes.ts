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
  try {
    console.log('[POST /tables] User:', req.user);
    console.log('[POST /tables] Body:', req.body);
    
    const { number, label, seatCapacity, area, posX, posY } = req.body;
    
    // Validate required fields
    if (!number) {
      return res.status(400).json({ error: 'Table number is required' });
    }
    
    // Validate restaurantId
    if (!req.user?.restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID not found in user context' });
    }
    
    // Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
    });
    
    if (!restaurant) {
      return res.status(400).json({ error: 'Restaurant not found' });
    }
    
    console.log('[POST /tables] Creating table with:', { number, label, seatCapacity, area, restaurantId: req.user.restaurantId });
    
    const table = await prisma.restaurantTable.create({
      data: { 
        number, 
        label, 
        seatCapacity, 
        area: area || 'MAIN_HALL', 
        posX, 
        posY, 
        restaurantId: req.user.restaurantId 
      },
    });
    
    console.log('[POST /tables] Table created:', table);
    res.status(201).json(table);
  } catch (error: any) {
    console.error('[POST /tables] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create table' });
  }
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
