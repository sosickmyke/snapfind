import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get my profile
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        lastLogin: true
      }
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.patch('/me', authenticate, async (req: any, res) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true
      }
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get my events (attendee registrations)
router.get('/my-events', authenticate, async (req: any, res) => {
  try {
    const registrations = await prisma.registration.findMany({
      where: { userId: req.user.id },
      include: {
        event: {
          include: {
            organizer: {
              select: { id: true, name: true }
            },
            _count: {
              select: { registrations: true }
            }
          }
        }
      },
      orderBy: { registeredAt: 'desc' }
    });
    res.json(registrations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get my notifications
router.get('/notifications', authenticate, async (req: any, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      include: {
        event: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticate, async (req: any, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });
    res.json({ message: 'Marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get photographer's assigned events
router.get('/photographer-events', authenticate, async (req: any, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { photographerId: req.user.id },
      include: {
        organizer: {
          select: { id: true, name: true }
        },
        _count: {
          select: { photos: true, registrations: true }
        }
      }
    });
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
