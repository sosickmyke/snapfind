import {
  PrismaClient,
  UserRole,
  UserStatus,
  EventStatus,
  PaymentGateway,
  PaymentStatus,
  PhotoStatus,
  NotificationType,
} from "@prisma/client";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const password = await bcrypt.hash("password123", 10);
  const adminPassword = await bcrypt.hash("admin123", 10);

  /**
   * USERS (UPSERT = no duplicate errors)
   */
  const [attendee, organizer, photographer, admin] = await Promise.all([
    prisma.user.upsert({
      where: { email: "attendee@example.com" },
      update: {},
      create: {
        name: "John Attendee",
        email: "attendee@example.com",
        phone: "+2348012345678",
        passwordHash: password,
        role: UserRole.attendee,
        status: UserStatus.active,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=John`,
      },
    }),

    prisma.user.upsert({
      where: { email: "organizer@example.com" },
      update: {},
      create: {
        name: "Sarah Organizer",
        email: "organizer@example.com",
        phone: "+2348023456789",
        passwordHash: password,
        role: UserRole.organizer,
        status: UserStatus.active,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah`,
      },
    }),

    prisma.user.upsert({
      where: { email: "photographer@example.com" },
      update: {},
      create: {
        name: "Mike Photographer",
        email: "photographer@example.com",
        phone: "+2348034567890",
        passwordHash: password,
        role: UserRole.photographer,
        status: UserStatus.active,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Mike`,
      },
    }),

    prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        name: "Admin User",
        email: "admin@example.com",
        phone: "+2348045678901",
        passwordHash: adminPassword,
        role: UserRole.admin,
        status: UserStatus.active,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Admin`,
      },
    }),
  ]);

  /**
   * EVENTS
   */
  const event1 = await prisma.event.upsert({
    where: { eventCode: "WED-JM-2024" },
    update: {},
    create: {
      organizerId: organizer.id,
      title: "Wedding Celebration: John & Mary",
      description: "Join us for the beautiful wedding ceremony and reception.",
      venue: "Eko Hotel & Suites, Lagos",
      date: new Date("2024-02-15T14:00:00Z"),
      bannerUrl:
        "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
      price: 5000,
      eventCode: "WED-JM-2024",
      status: EventStatus.published,
    },
  });

  const event2 = await prisma.event.upsert({
    where: { eventCode: "CGN-2024" },
    update: {},
    create: {
      organizerId: organizer.id,
      title: "Corporate Gala Night 2024",
      description: "Annual corporate gala dinner with awards ceremony.",
      venue: "Landmark Centre, Victoria Island",
      date: new Date("2024-03-20T18:00:00Z"),
      bannerUrl:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800",
      price: 10000,
      eventCode: "CGN-2024",
      status: EventStatus.published,
    },
  });

  /**
   * PHOTOS
   */
  await prisma.eventPhoto.createMany({
    data: [
      {
        eventId: event1.id,
        uploaderId: photographer.id,
        imageUrl:
          "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1519741497674-611481863552?w=200",
        status: PhotoStatus.delivered,
      },
      {
        eventId: event1.id,
        uploaderId: photographer.id,
        imageUrl:
          "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=200",
        status: PhotoStatus.delivered,
      },
    ],
  });

  /**
   * PAYMENT
   */
  await prisma.payment.upsert({
    where: { reference: "PAY-123456789" },
    update: {},
    create: {
      userId: attendee.id,
      eventId: event1.id,
      amount: 5000,
      currency: "NGN",
      reference: "PAY-123456789",
      gateway: PaymentGateway.paystack,
      status: PaymentStatus.completed,
      paidAt: new Date("2024-01-10T10:05:00Z"),
    },
  });

  /**
   * NOTIFICATION
   */
  await prisma.notification.create({
    data: {
      userId: attendee.id,
      title: "Photos Ready!",
      message: "Your photos from Wedding Celebration are now available.",
      type: NotificationType.success,
      read: false,
    },
  });

  console.log("✅ Database seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });