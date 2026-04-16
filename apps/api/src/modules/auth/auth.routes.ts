import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { authenticate, AuthRequest } from '../../middleware/auth';

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
    const { pin, restaurantId } = req.body;
    if (!pin || !restaurantId) {
      return res.status(400).json({ error: 'PIN and restaurantId required' });
    }

    const user = await prisma.user.findFirst({
      where: { pin, restaurantId },
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

// POST /api/auth/register-staff (admin only)
router.post('/register-staff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, username, password, role, pin } = req.body;
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden' });
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
        role: role || 'WAITER',
        pin,
        restaurantId: req.user!.restaurantId,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
