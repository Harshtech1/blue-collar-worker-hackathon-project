import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import path from "path";

import { connectDB, getDb } from "./config/db.js";
import { initSocket, getIO } from "./socket.js";
import authRoutes from "./routes/auth.routes.js";
import workerRoutes from "./routes/worker.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import usersRoutes from "./routes/users.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import thekedarRoutes from "./routes/thekedar.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import { getInvestorAnalytics } from "./controllers/admin.analytics.js";
import { protect, authorize } from "./middleware/auth.js";
import {
  isConfiguredAdminEmail,
  validateAdminCredentials,
} from "./utils/adminAuth.js";
import { appendStatusHistory } from "./utils/bookingWorkflow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

const isDbOfflineError = (err) => err?.message?.includes("Database not initialized");

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

if (!allowedOrigins.includes("http://localhost:5174")) {
  allowedOrigins.push("http://localhost:5174");
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true);
  },
  credentials: true,
}));

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`);
  });
  next();
});

connectDB()
  .then((database) => {
    const dbReady = Boolean(database);
    console.log(dbReady ? "Database connected successfully" : "Database offline demo mode enabled");

    app.get("/", (_req, res) => {
      res.json({ message: "RAHI Backend API is running successfully." });
    });

    app.get("/api/health", (_req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date(),
        socketio: "active",
        database: dbReady ? "connected" : "offline-demo",
        deployment: {
          provider: process.env.RENDER ? "render" : "local-or-custom",
          service: process.env.RENDER_SERVICE_NAME || null,
          commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
          branch: process.env.RENDER_GIT_BRANCH || process.env.GIT_BRANCH || null,
        },
      });
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/worker-profiles", workerRoutes);
    app.use("/api/bookings", bookingRoutes);
    app.use("/api/users", usersRoutes);
    app.use("/api/service_categories", serviceRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/thekedar", thekedarRoutes);
    app.use("/api/payments", paymentRoutes);
    app.use("/api/analytics", analyticsRoutes);

    app.get("/api/admin/customers", protect, authorize("admin"), async (_req, res) => {
      try {
        const db = getDb();
        const users = await db.collection("users").aggregate([
          { $match: { role: "customer" } },
          { $project: { password: 0, otp: 0, otpExpires: 0 } },
          { $addFields: { name: "$full_name" } },
          { $sort: { createdAt: -1 } },
        ]).toArray();
        res.json({ data: users });
      } catch (err) {
        console.error(err);
        if (isDbOfflineError(err)) {
          return res.json({ data: [], warning: "Database is offline in local demo mode." });
        }
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/admin/bookings", protect, authorize("admin"), async (_req, res) => {
      try {
        const db = getDb();
        const bookings = await db.collection("bookings").aggregate([
          { $addFields: { service: "$serviceName", total_price: "$amount" } },
          { $sort: { createdAt: -1 } },
          { $limit: 200 },
        ]).toArray();
        res.json({ data: bookings });
      } catch (err) {
        console.error(err);
        if (isDbOfflineError(err)) {
          return res.json({ data: [], warning: "Database is offline in local demo mode." });
        }
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/admin/workers", protect, authorize("admin"), async (_req, res) => {
      try {
        const db = getDb();
        const workers = await db.collection("worker_profiles").aggregate([
          { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userData" } },
          { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              name: "$userData.full_name",
              phone: "$userData.phone",
              email: "$userData.email",
              profession: "$bio",
              isAvailable: { $eq: ["$status", "online"] },
            },
          },
          { $sort: { createdAt: -1 } },
        ]).toArray();

        const mappedWorkers = workers.map((worker) => {
          const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
          const ratingScore = clamp01((Number(worker.rating) || 4.2) / 5);
          const acceptanceRate = clamp01(worker.acceptance_rate ?? worker.acceptanceRate ?? 0.75);
          const punctualityRate = clamp01(worker.punctuality_rate ?? worker.punctualityRate ?? 0.78);
          const cancellationRate = clamp01(worker.cancellation_rate ?? worker.cancellationRate ?? 0.08);
          const completedJobs = Number(worker.completed_jobs_count ?? worker.completedJobs ?? worker.jobsCompleted ?? 0);
          const reliabilityScore = clamp01(
            (0.45 * punctualityRate)
              + (0.35 * (1 - cancellationRate))
              + 0.1
              + Math.min(0.2, completedJobs / 250),
          );
          const logisticsScore = Math.round(
            ((0.4 * ratingScore) + (0.3 * acceptanceRate) + (0.3 * reliabilityScore)) * 100,
          );

          return {
            ...worker,
            status: worker.verificationStatus?.aadhaar === "verified" ? "verified" : "pending",
            logisticsScore,
            acceptanceRate: Math.round(acceptanceRate * 100),
            reliabilityScore: Math.round(reliabilityScore * 100),
            completedJobs,
          };
        });

        res.json({ data: mappedWorkers });
      } catch (err) {
        console.error(err);
        if (isDbOfflineError(err)) {
          return res.json({ data: [], warning: "Database is offline in local demo mode." });
        }
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/admin/heatmap", protect, authorize("admin"), async (_req, res) => {
      try {
        const db = getDb();
        const heatmap = await db.collection("bookings").aggregate([
          { $match: { location: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: {
                lat: { $arrayElemAt: ["$location.coordinates", 1] },
                lng: { $arrayElemAt: ["$location.coordinates", 0] },
                service: "$serviceName",
                status: "$status",
              },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              location: {
                type: "Point",
                coordinates: ["$_id.lng", "$_id.lat"],
              },
              service: "$_id.service",
              status: "$_id.status",
              count: 1,
            },
          },
          { $limit: 100 },
        ]).toArray();
        res.json({ data: heatmap });
      } catch (err) {
        console.error(err);
        if (isDbOfflineError(err)) {
          return res.json({ data: [], warning: "Database is offline in local demo mode." });
        }
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/admin/investor-analytics", protect, authorize("admin"), getInvestorAnalytics);

    app.post("/api/auth/admin-login", async (req, res) => {
      const { email, password } = req.body;
      const { ADMIN_PASSWORD } = process.env;

      if (!isConfiguredAdminEmail(email) && !process.env.ADMIN_EMAIL && !process.env.ADMIN_EMAILS) {
        return res.status(500).json({ message: "Admin credentials not configured on server" });
      }

      if (!ADMIN_PASSWORD) {
        return res.status(500).json({ message: "Admin credentials not configured on server" });
      }

      if (!validateAdminCredentials({ email, password })) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const token = jwt.sign(
        { role: "admin", email },
        process.env.JWT_SECRET || "changeme",
        { expiresIn: "4h" },
      );

      res.json({ token, role: "admin" });
    });

    app.post("/api/auth/admin-forgot-password", async (req, res) => {
      const { email } = req.body;
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const genericMessage = "If this email is authorized, a recovery request has been sent to the RAHI owner.";

      if (!normalizedEmail) {
        return res.status(400).json({ message: "Admin email is required" });
      }

      if (!isConfiguredAdminEmail(normalizedEmail)) {
        return res.json({ message: genericMessage });
      }

      try {
        const hasSmtpConfig = process.env.SMTP_HOST
          && process.env.SMTP_PORT
          && process.env.SMTP_EMAIL
          && process.env.SMTP_PASSWORD;

        if (hasSmtpConfig) {
          const nodemailer = (await import("nodemailer")).default;
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: Number(process.env.SMTP_PORT) === 465,
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000,
            auth: {
              user: process.env.SMTP_EMAIL,
              pass: process.env.SMTP_PASSWORD,
            },
          });

          await Promise.race([
            transporter.sendMail({
              from: `"RAHI Admin Security" <${process.env.SMTP_EMAIL}>`,
              to: process.env.SMTP_EMAIL,
              subject: "RAHI admin password recovery request",
              text: [
                "A password recovery request was submitted for the RAHI admin portal.",
                `Admin email: ${normalizedEmail}`,
                `Requested at: ${new Date().toISOString()}`,
                "For security, rotate ADMIN_PASSWORD in the backend .env instead of sharing the current password.",
              ].join("\n"),
            }),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("SMTP recovery email timed out")), 6000);
            }),
          ]);
        } else {
          console.warn(`[Admin Recovery] SMTP is not configured. Recovery requested for ${normalizedEmail}.`);
        }

        return res.json({ message: genericMessage });
      } catch (err) {
        console.error("[Admin Recovery]", err.message);
        return res.json({ message: genericMessage });
      }
    });

    app.post("/api/worker/profile/aadhaar", protect, authorize("worker"), async (req, res) => {
      try {
        const multer = (await import("multer")).default;
        const fs = await import("fs");
        const { ObjectId } = await import("mongodb");
        const uploadDir = path.join(__dirname, "../public/uploads/aadhaar");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const storage = multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, uploadDir),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `aadhaar-${req.user._id}-${Date.now()}${ext}`);
          },
        });

        const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single("file");

        upload(req, res, async (err) => {
          if (err) return res.status(400).json({ message: `Upload error: ${err.message}` });
          if (!req.file) return res.status(400).json({ message: "No file provided" });

          const fileUrl = `/uploads/aadhaar/${req.file.filename}`;
          const db = getDb();
          await db.collection("worker_profiles").updateOne(
            { user: new ObjectId(req.user._id) },
            { $set: { aadhaar_url: fileUrl, is_verified: true, updatedAt: new Date() } },
          );

          res.json({ success: true, url: fileUrl, message: "Aadhaar uploaded successfully" });
        });
      } catch (err) {
        console.error("[aadhaar upload]", err);
        res.status(500).json({ message: "Server error during upload" });
      }
    });

    app.use((err, _req, res, _next) => {
      console.error("[GLOBAL ERROR]:", err.stack);
      res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    });

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`RAHI server listening on http://0.0.0.0:${PORT}`);
    });

    const BOOKING_TIMEOUT_MS = 15 * 60 * 1000;
    const CHECK_INTERVAL_MS = 2 * 60 * 1000;

    if (!dbReady) {
      console.warn("[Timeout Job] Skipped because database is offline in local demo mode.");
      return;
    }

    setInterval(async () => {
      try {
        const db = getDb();
        const cutoff = new Date(Date.now() - BOOKING_TIMEOUT_MS);
        const stale = await db.collection("bookings").find({
          status: "pending",
          worker_user_id: null,
          createdAt: { $lt: cutoff },
        }).toArray();

        if (stale.length === 0) return;

        const updates = stale.map((booking) => ({
          ...booking,
          statusHistory: appendStatusHistory(booking.statusHistory, "cancelled", "system"),
        }));

        for (const booking of updates) {
          await db.collection("bookings").updateOne(
            { _id: booking._id },
            {
              $set: {
                status: "cancelled",
                cancelReason: "timeout",
                updatedAt: new Date(),
                statusHistory: booking.statusHistory,
              },
            },
          );
        }

        const io = getIO();
        if (io) {
          for (const booking of stale) {
            if (booking.customer_user_id) {
              io.to(booking.customer_user_id.toString()).emit("booking_cancelled", {
                bookingId: booking._id.toString(),
                reason: "timeout",
                message: "No workers were available. Your booking has been cancelled.",
              });
            }
          }
        }
      } catch (err) {
        console.error("[Timeout Job] Error:", err.message);
      }
    }, CHECK_INTERVAL_MS);
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });
