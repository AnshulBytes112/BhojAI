import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/menu/categories
router.get('/categories', async (req: AuthRequest, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { restaurantId: req.user!.restaurantId },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: 'asc' },
        include: { modifierGroups: { include: { options: true } } },
      },
    },
  });
  res.json(categories);
});

// POST /api/menu/categories
router.post('/categories', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name, sortOrder } = req.body;
  const category = await prisma.category.create({
    data: { name, sortOrder, restaurantId: req.user!.restaurantId },
  });
  res.status(201).json(category);
});

// GET /api/menu/items
router.get('/items', async (req: AuthRequest, res: Response) => {
  const { categoryId, available } = req.query;
  const items = await prisma.menuItem.findMany({
    where: {
      category: { restaurantId: req.user!.restaurantId },
      ...(categoryId && { categoryId: String(categoryId) }),
      ...(available !== undefined && { isAvailable: available === 'true' }),
    },
    orderBy: { sortOrder: 'asc' },
    include: { modifierGroups: { include: { options: true } } },
  });
  res.json(items);
});

// POST /api/menu/items
router.post('/items', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name, description, price, imageUrl, categoryId, dietaryLabel, prepTime, aiTags, taxRate, hsnCode } = req.body;
  const item = await prisma.menuItem.create({
    data: { name, description, price, imageUrl, categoryId, dietaryLabel, prepTime, aiTags, taxRate, hsnCode },
    include: { modifierGroups: { include: { options: true } } },
  });
  res.status(201).json(item);
});

// PATCH /api/menu/items/:id
router.patch('/items/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const item = await prisma.menuItem.update({
    where: { id },
    data: req.body,
    include: { modifierGroups: { include: { options: true } } },
  });
  res.json(item);
});

// DELETE /api/menu/items/:id
router.delete('/items/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  await prisma.menuItem.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// PATCH /api/menu/items/:id/toggle  (quick toggle availability)
router.patch('/items/:id/toggle', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const item = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const updated = await prisma.menuItem.update({
    where: { id: req.params.id },
    data: { isAvailable: !item.isAvailable },
  });
  res.json(updated);
});

// POST /api/menu/items/:id/modifiers  - Add modifier group
router.post('/items/:menuItemId/modifiers', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name, isRequired, minSelect, maxSelect, options } = req.body;
  const group = await prisma.modifierGroup.create({
    data: {
      name,
      isRequired,
      minSelect,
      maxSelect,
      menuItemId: req.params.menuItemId,
      options: { create: options || [] },
    },
    include: { options: true },
  });
  res.status(201).json(group);
});

export default router;
