import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import authRoutes from "./routes/auth";
import eventRoutes from "./routes/events";
import paymentRoutes from "./routes/payments";
import photoRoutes from "./routes/photos";
import userRoutes from "./routes/users";
import adminRoutes from "./routes/admin";

dotenv.config();

const app = express();

/**
 * Prisma singleton (prevents multiple connections on Render hot restarts)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * __dirname fix (ESM-safe for Render)
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Middleware
 */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/**
 * Static uploads
 */
app.use("/uploads", express.static(join(__dirname, "../uploads")));

/**
 * Health checks
 */
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "SnapFind API is running",
    environment: process.env.NODE_ENV,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Routes
 */
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

/**
 * Error handler (safe typing)
 */
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("ERROR:", err);

    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
    });
  }
);

/**
 * Server start
 */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`SnapFind API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

/**
 * Graceful shutdown (important for Render)
 */
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});