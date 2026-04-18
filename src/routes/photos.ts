import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { detectFaces, findBestMatch } from '../utils/faceRecognition';
import sharp from 'sharp';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Upload selfie
router.post('/selfie', authenticate, upload.single('selfie'), async (req: any, res) => {
  try {
    const { eventId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const imageUrl = `/uploads/selfies/${req.file.filename}`;

    let descriptor: number[] | undefined = undefined;
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
        descriptor: descriptor ?? undefined
      },
      create: {
        userId: req.user.id,
        eventId,
        imageUrl,
        descriptor: descriptor ?? undefined
      }
    });

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

// Upload event photos
router.post('/upload', authenticate, authorize('photographer', 'admin'), upload.array('photos', 50), async (req: any, res) => {
  try {
    const { eventId } = req.body;
    if (!req.files || (req.files as any[]).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedPhotos = [];

    for (const file of files) {
      const thumbnailFilename = `thumb_${file.filename}`;
      const photoPath = path.join(__dirname, '../../uploads/photos', file.filename);
      const thumbPath = path.join(__dirname, '../../uploads/thumbnails', thumbnailFilename);

      await sharp(photoPath)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      const faces = await detectFaces(photoPath);
      const descriptorData: number[][] = faces.map(f => f.descriptor);

      const photo = await prisma.eventPhoto.create({
        data: {
          eventId,
          uploaderId: req.user.id,
          imageUrl: `/uploads/photos/${file.filename}`,
          thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
          descriptorData: descriptorData.length > 0 ? descriptorData : undefined,
          status: descriptorData.length > 0 ? 'processing' : 'unmatched'
        }
      });

      uploadedPhotos.push(photo);

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

// Match logic
async function matchPhotoToUsers(photoId: string, eventId: string, photoDescriptors: number[][]) {
  try {
    const selfies = await prisma.selfie.findMany({
      where: { eventId },
      include: { user: true }
    });

    for (const selfie of selfies) {
      if (!selfie.descriptor) continue;

      const selfieDescriptor = selfie.descriptor as number[];
      const { matched, confidence } = findBestMatch(photoDescriptors, selfieDescriptor);

      if (matched) {
        await prisma.faceMatch.create({
          data: {
            photoId,
            userId: selfie.userId,
            confidenceScore: confidence,
            matchStatus: 'confirmed'
          }
        });

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

    const matchCount = await prisma.faceMatch.count({ where: { photoId } });

    await prisma.eventPhoto.update({
      where: { id: photoId },
      data: { status: matchCount > 0 ? 'matched' : 'unmatched' }
    });

  } catch (error) {
    console.error('Face matching error:', error);
  }
}

export default router;