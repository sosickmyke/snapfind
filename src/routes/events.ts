import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Create event (organizer only)
router.post('/', authenticate, authorize('organizer', 'admin'), async (req: any, res) => {
  try {
    const { title, description, venue, date, endDate, price, maxAttendees } = req.body;

    const eventCode = `${title.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${new Date().getFullYear()}`;

    const event = await prisma.event.create({
      data: {
        organizerId: req.user.id,
        title,
        description,
        venue,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        price: Math.round(price * 100), // Convert to kobo
        eventCode,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
        status: 'published'
      }
    });

    res.status(201).json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events (public)
router.get('/', async (req, res) => {
  try {
    const { status, organizer } = req.query;
    const where: any = {};
    
    if (status) where.status = status;
    if (organizer) where.organizerId = organizer;

    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: {
          select: { id: true, name: true, email: true }
        },
        photographer: {
          select: { id: true, name: true }
        },
        _count: {
          select: { registrations: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get event by code (public)
router.get('/code/:code', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { eventCode: req.params.code },
      include: {
        organizer: {
          select: { id: true, name: true }
        },
        _count: {
          select: { registrations: true }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        organizer: {
          select: { id: true, name: true, email: true }
        },
        photographer: {
          select: { id: true, name: true }
        },
        _count: {
          select: { registrations: true, photos: true }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign photographer
router.patch('/:id/photographer', authenticate, authorize('organizer', 'admin'), async (req: any, res) => {
  try {
    const { photographerId } = req.body;
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { photographerId }
    });
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update event
router.patch('/:id', authenticate, authorize('organizer', 'admin'), async (req: any, res) => {
  try {
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete event
router.delete('/:id', authenticate, authorize('organizer', 'admin'), async (req: any, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
