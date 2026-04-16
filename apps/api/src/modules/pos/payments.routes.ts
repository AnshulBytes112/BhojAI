import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// POST /api/payments
// Accepts payment using orderId so clients can call a top-level payments endpoint.
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, amount, method, transactionId } = req.body;
    const paymentAmount = Number(amount);

    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }
    if (!method || typeof method !== 'string') {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: req.user!.restaurantId },
      include: { bill: { include: { payments: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.bill) return res.status(400).json({ error: 'Generate bill first' });

    const alreadyPaid = order.bill.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = parseFloat((order.bill.totalAmount - alreadyPaid).toFixed(2));
    if (remaining <= 0) return res.status(400).json({ error: 'Bill is already fully paid' });
    if (paymentAmount > remaining) {
      return res.status(400).json({ error: `Payment exceeds due amount. Remaining: ${remaining}` });
    }

    const payment = await prisma.payment.create({
      data: {
        billId: order.bill.id,
        amount: paymentAmount,
        method,
        transactionId,
        status: 'SUCCESS',
      },
    });

    const totalPaid = [...order.bill.payments, payment].reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid >= order.bill.totalAmount - 0.01) {
      await prisma.bill.update({ where: { id: order.bill.id }, data: { isPaid: true } });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });
      if (order.tableId) {
        await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_RECEIVED',
        description: `Payment of ₹${paymentAmount} via ${method} (api/payments)`,
        orderId: order.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json({
      paymentTransaction: payment,
      remainingAfterPayment: parseFloat((Math.max(order.bill.totalAmount - totalPaid, 0)).toFixed(2)),
    });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

export default router;
