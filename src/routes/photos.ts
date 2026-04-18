import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { detectFaces, findBestMatch } from '../utils/faceRecognition';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Upload selfie
router.post('/selfie', authenticate, upload.single('selfie'), async (req: any, res) => {
  try {
    const { eventId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const imageUrl = `/uploads/selfies/${req.file.filename}`;

    // Detect face and get descriptor
    let descriptor = null;
    const filePath = path.join(__dirname, '../../uploads', 'selfies', req.file.filename);
    const faces = await detectFaces(filePath);
    if (faces.length > 0) {
      descriptor = faces[0].descriptor;
    }

    const selfie = await prisma.selfie.upsert({
      where: {
        userId_eventId: {
          userId: req.user.id,
          eventId
        }
      },
      update: {
        imageUrl,
        descriptor: descriptor ? JSON.stringify(descriptor) : null
      },
      create: {
        userId: req.user.id,
        eventId,
        imageUrl,
        descriptor: descriptor ? JSON.stringify(descriptor) : null
      }
    });

    // Update registration
    await prisma.registration.update({
      where: {
        userId_eventId: {
          userId: req.user.id,
          eventId
        }
      },
      data: { selfieStatus: 'uploaded' }
    });

    res.json({ selfie, facesDetected: faces.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload event photos (photographer)
router.post('/upload', authenticate, authorize('photographer', 'admin'), upload.array('photos', 50), async (req: any, res) => {
  try {
    const { eventId } = req.body;
    if (!req.files || (req.files as any[]).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedPhotos = [];

    for (const file of files) {
      // Create thumbnail
      const thumbnailFilename = `thumb_${file.filename}`;
      const photoPath = path.join(__dirname, '../../uploads/photos', file.filename);
      const thumbPath = path.join(__dirname, '../../uploads/thumbnails', thumbnailFilename);

      await sharp(photoPath)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      // Detect faces
      const faces = await detectFaces(photoPath);
      const descriptorData = faces.map(f => f.descriptor);

      const photo = await prisma.eventPhoto.create({
        data: {
          eventId,
          uploaderId: req.user.id,
          imageUrl: `/uploads/photos/${file.filename}`,
          thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
          descriptorData: descriptorData.length > 0 ? JSON.stringify(descriptorData) : null,
          status: descriptorData.length > 0 ? 'processing' : 'unmatched'
        }
      });

      uploadedPhotos.push(photo);

      // Auto-match faces
      if (descriptorData.length > 0) {
        await matchPhotoToUsers(photo.id, eventId, descriptorData);
      }
    }

    res.json({
      uploaded: uploadedPhotos.length,
      photos: uploadedPhotos
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Run face matching on a photo
async function matchPhotoToUsers(photoId: string, eventId: string, photoDescriptors: number[][]) {
  try {
    // Get all selfies for this event
    const selfies = await prisma.selfie.findMany({
      where: { eventId },
      include: { user: true }
    });

    for (const selfie of selfies) {
      if (!selfie.descriptor) continue;

      const selfieDescriptor = JSON.parse(selfie.descriptor as string);
      const { matched, confidence } = findBestMatch(photoDescriptors, selfieDescriptor);

      if (matched) {
        // Create face match
        await prisma.faceMatch.create({
          data: {
            photoId,
            userId: selfie.userId,
            confidenceScore: confidence,
            matchStatus: 'confirmed'
          }
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId: selfie.userId,
            eventId,
            title: 'New Photo Available',
            message: 'A new photo from the event has been matched to you.',
            type: 'success'
          }
        });
      }
    }

    // Update photo status
    const matchCount = await prisma.faceMatch.count({ where: { photoId } });
    await prisma.eventPhoto.update({
      where: { id: photoId },
      data: { status: matchCount > 0 ? 'matched' : 'unmatched' }
    });
  } catch (error) {
    console.error('Face matching error:', error);
  }
}

// Get my photos (attendee gallery)
router.get('/my-gallery', authenticate, async (req: any, res) => {
  try {
    // Get all face matches for this user
    const matches = await prisma.faceMatch.findMany({
      where: {
        userId: req.user.id,
        matchStatus: 'confirmed'
      },
      include: {
        photo: {
          include: {
            event: {
              select: { id: true, title: true, date: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const photos = matches.map((m : any)=> m.photo);
    res.json(photos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get event photos (for organizer/photographer)
router.get('/event/:eventId', authenticate, async (req: any, res) => {
  try {
    const { status } = req.query;
    const where: any = { eventId: req.params.eventId };
    if (status) where.status = status;

    const photos = await prisma.eventPhoto.findMany({
      where,
      include: {
        uploader: {
          select: { id: true, name: true }
        },
        faceMatches: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    res.json(photos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get unmatched photos (admin review)
router.get('/unmatched', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const photos = await prisma.eventPhoto.findMany({
      where: { status: 'unmatched' },
      include: {
        event: { select: { id: true, title: true } }
      }
    });
    res.json(photos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual tag photo (admin)
router.post('/:id/tag', authenticate, authorize('admin'), async (req: any, res) => {
  try {
    const { userId, confidence } = req.body;

    const match = await prisma.faceMatch.create({
      data: {
        photoId: req.params.id,
        userId,
        confidenceScore: confidence || 1.0,
        matchStatus: 'confirmed'
      }
    });

    await prisma.eventPhoto.update({
      where: { id: req.params.id },
      data: { status: 'matched' }
    });

    res.json(match);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete photo
router.delete('/:id', authenticate, authorize('photographer', 'admin'), async (req, res) => {
  try {
    await prisma.eventPhoto.delete({ where: { id: req.params.id } });
    res.json({ message: 'Photo deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
