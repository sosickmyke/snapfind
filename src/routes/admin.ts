import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get dashboard stats
router.get('/stats', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const [
      totalUsers,
      totalEvents,
      totalPhotos,
      totalPayments,
      totalRevenue,
      pendingPhotos,
      matchedPhotos,
      unmatchedPhotos
    ] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.eventPhoto.count(),
      prisma.payment.count({ where: { status: 'completed' } }),
      prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true }
      }),
      prisma.eventPhoto.count({ where: { status: 'processing' } }),
      prisma.eventPhoto.count({ where: { status: 'matched' } }),
      prisma.eventPhoto.count({ where: { status: 'unmatched' } })
    ]);

    res.json({
      totalUsers,
      totalEvents,
      totalPhotos,
      totalPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingPhotos,
      matchedPhotos,
      unmatchedPhotos
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const where: any = {};

    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update user status
router.patch('/users/:id/status', authenticate, authorize('admin'), async (req: any, res) => {
  try {
    const { status } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events
router.get('/events', authenticate, authorize('admin'), async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        organizer: { select: { id: true, name: true } },
        photographer: { select: { id: true, name: true } },
        _count: {
          select: { registrations: true, photos: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all payments
router.get('/payments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get photo processing stats
router.get('/photo-stats', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as count
      FROM event_photos
      GROUP BY status
    `;
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
