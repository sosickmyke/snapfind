import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  /**
   * USERS
   */
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: "1",
        name: "John Attendee",
        email: "attendee@example.com",
        phone: "+2348012345678",
        role: "attendee",
        status: "active",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
        password: await bcrypt.hash("password123", 10),
        createdAt: new Date("2024-01-15T10:00:00Z"),
      },
    }),

    prisma.user.create({
      data: {
        id: "2",
        name: "Sarah Organizer",
        email: "organizer@example.com",
        phone: "+2348023456789",
        role: "organizer",
        status: "active",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        password: await bcrypt.hash("password123", 10),
        createdAt: new Date("2024-01-10T08:00:00Z"),
      },
    }),

    prisma.user.create({
      data: {
        id: "3",
        name: "Mike Photographer",
        email: "photographer@example.com",
        phone: "+2348034567890",
        role: "photographer",
        status: "active",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
        password: await bcrypt.hash("password123", 10),
        createdAt: new Date("2024-01-12T09:00:00Z"),
      },
    }),

    prisma.user.create({
      data: {
        id: "4",
        name: "Admin User",
        email: "admin@example.com",
        phone: "+2348045678901",
        role: "admin",
        status: "active",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
        password: await bcrypt.hash("admin123", 10),
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    }),
  ]);

  /**
   * EVENTS
   */
  const events = await Promise.all([
    prisma.event.create({
      data: {
        id: "1",
        organizerId: "2",
        title: "Wedding Celebration: John & Mary",
        description: "Join us for the beautiful wedding ceremony and reception.",
        venue: "Eko Hotel & Suites, Lagos",
        date: new Date("2024-02-15T14:00:00Z"),
        banner: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
        price: 5000,
        eventCode: "WED-JM-2024",
        status: "published",
        registeredCount: 150,
      },
    }),

    prisma.event.create({
      data: {
        id: "2",
        organizerId: "2",
        title: "Corporate Gala Night 2024",
        description: "Annual corporate gala dinner with awards ceremony.",
        venue: "Landmark Centre, Victoria Island",
        date: new Date("2024-03-20T18:00:00Z"),
        banner: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800",
        price: 10000,
        eventCode: "CGN-2024",
        status: "published",
        registeredCount: 300,
      },
    }),

    prisma.event.create({
      data: {
        id: "3",
        organizerId: "2",
        title: "Birthday Bash: 50th Anniversary",
        description: "Celebrating 50 years of life, love, and laughter!",
        venue: "The Civic Centre, Lagos",
        date: new Date("2024-04-10T16:00:00Z"),
        banner: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800",
        price: 3000,
        eventCode: "BDAY-50-2024",
        status: "ongoing",
        registeredCount: 80,
      },
    }),
  ]);

  /**
   * PHOTOS
   */
  await prisma.photo.createMany({
    data: [
      {
        id: "1",
        eventId: "1",
        imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
        thumbnailUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?w=200",
        status: "delivered",
        uploadedAt: new Date("2024-02-15T16:00:00Z"),
      },
      {
        id: "2",
        eventId: "1",
        imageUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800",
        thumbnailUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=200",
        status: "delivered",
        uploadedAt: new Date("2024-02-15T17:00:00Z"),
      },
    ],
  });

  /**
   * PAYMENTS
   */
  await prisma.payment.createMany({
    data: [
      {
        id: "1",
        userId: "1",
        eventId: "1",
        amount: 5000,
        currency: "NGN",
        reference: "PAY-123456789",
        gateway: "paystack",
        status: "completed",
        paidAt: new Date("2024-01-10T10:05:00Z"),
      },
    ],
  });

  /**
   * NOTIFICATIONS
   */
  await prisma.notification.createMany({
    data: [
      {
        id: "1",
        userId: "1",
        title: "Photos Ready!",
        message: "Your photos from Wedding Celebration are now available.",
        type: "success",
        read: false,
      },
    ],
  });

  console.log("Database seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });