import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { authenticate, AuthRequest, authorizeRoles } from '../../middleware/auth';
import { requirePermission, Permission } from '../../middleware/rbac';
import { UserRole } from '../../lib/rbac';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bhojai_secret';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, pin } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Optional waiter 2FA: for WAITER users with configured PIN, require PIN after password.
    if (user.role === 'WAITER' && user.pin && !pin) {
      return res.status(401).json({ error: 'PIN required for waiter login' });
    }

    if (user.role === 'WAITER' && user.pin && pin !== user.pin) {
      return res.status(401).json({ error: 'Invalid second factor' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/pin-login  (quick PIN for POS terminals)
router.post('/pin-login', async (req: Request, res: Response) => {
  try {
    const { username, pin, restaurantId } = req.body;
    if (!pin || (!username && !restaurantId)) {
      return res.status(400).json({ error: 'PIN and username or restaurantId required' });
    }

    const user = username
      ? await prisma.user.findFirst({
          where: {
            username,
            pin,
          },
        })
      : await prisma.user.findFirst({
          where: {
            pin,
            restaurantId,
          },
        });

    if (!user) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        restaurantId: user.restaurantId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        restaurantId: true,
        restaurant: { select: { name: true, theme: true } },
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register-staff (admin/manager only)
router.post('/register-staff', 
  authenticate, 
  requirePermission(Permission.CREATE_USER),
  async (req: AuthRequest, res: Response) => {
  try {
    const { name, username, password, role, pin } = req.body;
    
    // Validate role
    if (role && !Object.values(UserRole).includes(role as UserRole)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        availableRoles: Object.values(UserRole)
      });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role: (role as UserRole) || UserRole.WAITER,
        pin,
        restaurantId: req.user!.restaurantId,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
