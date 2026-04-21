/**
 * BhojAI Restaurant OS - Main API Server
 * Better than Petpooja. AI-enabled. Offline-first.
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import 'dotenv/config';

import authRoutes from './modules/auth/auth.routes';
import menuRoutes from './modules/menu/menu.routes';
import ordersRoutes from './modules/pos/orders.routes';
import kotsRoutes from './modules/pos/kots.routes';
import tablesRoutes from './modules/pos/tables.routes';
import billsRoutes from './modules/pos/bills.routes';
import paymentsRoutes from './modules/pos/payments.routes';
import promotionsRoutes from './modules/pos/promotions.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import aiRoutes from './modules/ai/ai.routes';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    message: 'BhojAI Restaurant OS API is running',
    docsHint: 'Use /api/health for health and /api/* for resources',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'BhojAI Restaurant OS API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/kots', kotsRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Export app for serverless use
export default app;

// Start server only if not in serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const port = process.env.PORT || 3334;
  const server = app.listen(port, () => {
    console.log(`\n🍽️  BhojAI Restaurant OS API`);
    console.log(`📡 Listening at http://localhost:${port}/api`);
    console.log(`🏥 Health: http://localhost:${port}/api/health\n`);
  });
  server.on('error', console.error);
}
