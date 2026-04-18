import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { initializePaystack, verifyPaystack, initializeFlutterwave, verifyFlutterwave } from '../utils/payments';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Initialize payment
router.post('/initialize', authenticate, async (req: any, res) => {
  try {
    const { eventId, gateway } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check if already registered
    const existingReg = await prisma.registration.findUnique({
      where: {
        userId_eventId: {
          userId: req.user.id,
          eventId
        }
      }
    });

    if (existingReg?.paymentStatus === 'completed') {
      return res.status(400).json({ error: 'Already paid for this event' });
    }

    const reference = `SF-${uuidv4()}`;

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        eventId,
        amount: event.price,
        reference,
        gateway
      }
    });

    // Create/update registration
    await prisma.registration.upsert({
      where: {
        userId_eventId: {
          userId: req.user.id,
          eventId
        }
      },
      update: {},
      create: {
        userId: req.user.id,
        eventId,
        paymentStatus: 'pending'
      }
    });

    let paymentData;
    if (gateway === 'paystack') {
      paymentData = await initializePaystack(req.user.email, event.price, reference, {
        eventId,
        userId: req.user.id
      });
    } else {
      paymentData = await initializeFlutterwave(req.user.email, event.price / 100, reference, req.user.phone);
    }

    res.json({
      reference,
      authorization_url: paymentData.authorization_url || paymentData.link
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify payment
router.get('/verify', authenticate, async (req: any, res) => {
  try {
    const { reference, transaction_id, gateway } = req.query;

    let verificationData;
    if (gateway === 'flutterwave' && transaction_id) {
      verificationData = await verifyFlutterwave(transaction_id as string);
    } else {
      verificationData = await verifyPaystack(reference as string);
    }

    const isSuccessful = verificationData.status === 'success';

    // Update payment
    await prisma.payment.update({
      where: { reference: reference as string },
      data: {
        status: isSuccessful ? 'completed' : 'failed',
        paidAt: isSuccessful ? new Date() : null,
        metadata: verificationData
      }
    });

    // Update registration
    const payment = await prisma.payment.findUnique({
      where: { reference: reference as string }
    });

    if (payment) {
      await prisma.registration.update({
        where: {
          userId_eventId: {
            userId: payment.userId,
            eventId: payment.eventId
          }
        },
        data: {
          paymentStatus: isSuccessful ? 'completed' : 'pending'
        }
      });

      // Create notification
      if (isSuccessful) {
        await prisma.notification.create({
          data: {
            userId: payment.userId,
            eventId: payment.eventId,
            title: 'Payment Successful',
            message: `Your payment of NGN ${payment.amount / 100} was successful.`,
            type: 'success'
          }
        });
      }
    }

    res.json({
      status: isSuccessful ? 'success' : 'failed',
      reference,
      amount: verificationData.amount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's payments
router.get('/my-payments', authenticate, async (req: any, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      include: {
        event: {
          select: { id: true, title: true, date: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get event payments (organizer)
router.get('/event/:eventId', authenticate, async (req: any, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { eventId: req.params.eventId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
