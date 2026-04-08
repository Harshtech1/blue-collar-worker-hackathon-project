import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";
import { createServer } from "http";

import { connectDB, getDb } from "./config/db.js";
import { ObjectId } from "mongodb";
import { initSocket } from "./socket.js";          // ← singleton, no circular dep
import authRoutes from "./routes/auth.routes.js";
import workerRoutes from "./routes/worker.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import usersRoutes from "./routes/users.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import thekedarRoutes from "./routes/thekedar.routes.js";
import jwt from "jsonwebtoken";
import { protect, authorize } from "./middleware/auth.js";

import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });


const app = express();

// ─── HTTP server + Socket.IO (no circular dep — socket singleton) ─────────────
const httpServer = createServer(app);
initSocket(httpServer);   // binds io to the singleton; routes can call getIO()

// ─── Core middleware ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());
// Also allow 5174 in case Vite picks a different port
if (!allowedOrigins.includes("http://localhost:5174")) allowedOrigins.push("http://localhost:5174");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // be permissive in dev
  },
  credentials: true,
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// ─── DB + Routes ──────────────────────────────────────────────────────────────
connectDB()
  .then(() => {
    console.log("✅ Database connected successfully");

    // Root route to fix Render health checks and UptimeRobot 404
    app.get("/", (req, res) => res.json({ message: "RAHI Backend API is running successfully." }));

    // Health
    app.get("/api/health", (req, res) =>
      res.json({ status: "ok", timestamp: new Date(), socketio: "active" })
    );

    // Core routes
    app.use("/api/auth", authRoutes);
    app.use("/api/worker-profiles", workerRoutes);
    app.use("/api/bookings", bookingRoutes);
    app.use("/api/users", usersRoutes);
    app.use("/api/service_categories", serviceRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/thekedar", thekedarRoutes);

    // ── Global Error Handler ───────────────────────────────────────────────────
    app.use((err, req, res, next) => {
      console.error("[GLOBAL ERROR]:", err.stack);
      res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    });

    // ── ADMIN ROUTES (Priority 3 fix) ─────────────────────────────────────────
    app.get("/api/admin/customers", protect, authorize("admin"), async (req, res) => {
      try {
        const db = getDb();
        const users = await db
          .collection("users")
          .aggregate([
            { $match: { role: "customer" } },
            { $project: { password: 0, otp: 0, otpExpires: 0 } },
            { $addFields: { name: "$full_name" } },
            { $sort: { createdAt: -1 } }
          ])
          .toArray();
        res.json({ data: users });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/admin/bookings", protect, authorize("admin"), async (req, res) => {
      try {
        const db = getDb();
        const bookings = await db
          .collection("bookings")
          .aggregate([
            { $addFields: { service: "$serviceName", total_price: "$amount" } },
            { $sort: { createdAt: -1 } },
            { $limit: 200 }
          ])
          .toArray();
        res.json({ data: bookings });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/admin/workers", protect, authorize("admin"), async (req, res) => {
      try {
        const db = getDb();
        const workers = await db
          .collection("worker_profiles")
          .aggregate([
            { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userData" } },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
            {
              $addFields: {
                name: "$userData.full_name",
                phone: "$userData.phone",
                email: "$userData.email",
                profession: "$bio",
                isAvailable: { $eq: ["$status", "online"] }
              }
            },
            { $sort: { createdAt: -1 } }
          ])
          .toArray();
        
        // Ensure status field translates verificationStatus if it exists, otherwise fall back
        const mappedWorkers = workers.map(w => ({
          ...w,
          status: w.verificationStatus?.aadhaar === 'verified' ? 'verified' : 'pending'
        }));

        res.json({ data: mappedWorkers });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // ── ADMIN HEATMAP (Job Hotspots) ───────────────────────────────────────────────
    app.get("/api/admin/heatmap", protect, authorize("admin"), async (req, res) => {
      try {
        const db = getDb();
        const heatmap = await db
          .collection("bookings")
          .aggregate([
            { $match: { location: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: {
                  lat: { $arrayElemAt: ["$location.coordinates", 1] },
                  lng: { $arrayElemAt: ["$location.coordinates", 0] },
                  service: "$serviceName",
                  status: "$status"
                },
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                location: {
                  type: "Point",
                  coordinates: ["$_id.lng", "$_id.lat"]
                },
                service: "$_id.service",
                status: "$_id.status",
                count: 1
              }
            },
            { $limit: 100 }
          ])
          .toArray();
        res.json({ data: heatmap });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // ── ADMIN LOGIN (Priority 1 fix — server-side credential check) ───────────
    app.post("/api/auth/admin-login", async (req, res) => {
      const { email, password } = req.body;
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return res.status(500).json({ message: "Admin credentials not configured on server" });
      }
      if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const token = jwt.sign(
        { role: "admin", email },
        process.env.JWT_SECRET || "changeme",
        { expiresIn: "4h" }
      );
      res.json({ token, role: "admin" });
    });

    // ── PAYMENT INITIATION (Priority 5 fix) ────────────────────────────────────
    app.post("/api/payments/initiate", protect, async (req, res) => {
      try {
        const { bookingId, amount, method = "upi" } = req.body;
        if (!amount) return res.status(400).json({ message: "Amount is required" });

        const db = getDb();
        const transactionId = `RAHI-${Date.now()}-${Math.random()
          .toString(36).slice(2, 8).toUpperCase()}`;

        await db.collection("payments").insertOne({
          bookingId: bookingId || null,
          userId: req.user._id,
          amount: Number(amount),
          method,
          status: "completed",
          transactionId,
          createdAt: new Date(),
        });

        if (bookingId) {
          let objId;
          try { objId = new ObjectId(bookingId); } catch (_) { /* skip */ }
          if (objId) {
            await db.collection("bookings").updateOne(
              { _id: objId },
              { $set: { paymentStatus: "paid", status: "confirmed", updatedAt: new Date() } }
            );
            // Notify the worker that payment arrived
            const booking = await db.collection("bookings").findOne({ _id: objId });
            
            // Update worker profile total earnings here
            if (booking && booking.worker_earning) {
              const workerProfileColl = db.collection("worker_profiles");
              if (booking.worker) {
                await workerProfileColl.updateOne(
                  { _id: booking.worker },
                  { $inc: { total_earnings: booking.worker_earning, completed_jobs_count: 1 }, $set: { updatedAt: new Date() } }
                );
              } else if (booking.worker_user_id) {
                let wUserObjId;
                try { wUserObjId = new ObjectId(booking.worker_user_id); } catch (_) { }
                if (wUserObjId) {
                   await workerProfileColl.updateOne(
                     { user: wUserObjId },
                     { $inc: { total_earnings: booking.worker_earning, completed_jobs_count: 1 }, $set: { updatedAt: new Date() } }
                   );
                }
              }
            }
            const { getIO } = await import("./socket.js");
            const io = getIO();
            if (io && booking?.worker_user_id) {
              io.to(booking.worker_user_id.toString()).emit("payment_received", {
                bookingId, transactionId, amount,
              });
            }
          }
        }

        res.json({ success: true, transactionId, amount, status: "completed" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Payment processing failed" });
      }
    });

    // ── BOOKING STATUS UPDATE (Socket.IO → Customer) ──────────────────────────
    app.patch("/api/bookings/:id/status", protect, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const ALLOWED = ["accepted", "declined", "in_progress", "completed", "cancelled"];
        if (!ALLOWED.includes(status)) {
          return res.status(400).json({
            message: `Invalid status. Allowed: ${ALLOWED.join(", ")}`,
          });
        }

        let objId;
        try { objId = new ObjectId(id); } catch (_) {
          return res.status(400).json({ message: "Invalid booking ID" });
        }

        const db = getDb();
        const booking = await db.collection("bookings").findOneAndUpdate(
          { _id: objId },
          { $set: { status, updatedAt: new Date() } },
          { returnDocument: "after" }
        );

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        // Emit to customer's socket room
        const { getIO } = await import("./socket.js");
        const io = getIO();
        if (io) {
          const customerRoom = booking.customer_user_id?.toString();
          if (customerRoom) {
            io.to(customerRoom).emit("booking_updated", {
              bookingId: id, status, updatedAt: new Date(),
            });
          }
          // Also confirm back to the worker
          io.to(req.user._id.toString()).emit("booking_updated", {
            bookingId: id, status, updatedAt: new Date(),
          });
        }

        res.json({ success: true, booking });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // ── AADHAAR VERIFICATION UPLOAD ───────────────────────────────────────────
    // POST /api/worker/profile/aadhaar   (multipart/form-data, field: "file")
    app.post('/api/worker/profile/aadhaar', protect, authorize('worker'), async (req, res) => {
      try {
        const multer = (await import('multer')).default;
        const fs = await import('fs');
        const uploadDir = path.join(__dirname, '../public/uploads/aadhaar');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const storage = multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, uploadDir),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `aadhaar-${req.user._id}-${Date.now()}${ext}`);
          },
        });
        const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single('file');

        upload(req, res, async (err) => {
          if (err) return res.status(400).json({ message: `Upload error: ${err.message}` });
          if (!req.file) return res.status(400).json({ message: 'No file provided' });

          const fileUrl = `/uploads/aadhaar/${req.file.filename}`;
          const db = getDb();
          await db.collection('worker_profiles').updateOne(
            { user: new ObjectId(req.user._id) },
            { $set: { aadhaar_url: fileUrl, is_verified: true, updatedAt: new Date() } }
          );

          res.json({ success: true, url: fileUrl, message: 'Aadhaar uploaded successfully' });
        });
      } catch (err) {
        console.error('[aadhaar upload]', err);
        res.status(500).json({ message: 'Server error during upload' });
      }
    });

    // ── Start ─────────────────────────────────────────────────────────────────

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, '0.0.0.0', () =>
      console.log(`🚀 RAHI Server + Socket.IO → http://0.0.0.0:${PORT}`)
    );

    // ── Booking Timeout Job — Auto-cancel stale pending bookings ──────────────
    // Runs every 2 minutes; cancels bookings pending for > 15 minutes
    const BOOKING_TIMEOUT_MS = 15 * 60 * 1000;   // 15 minutes
    const CHECK_INTERVAL_MS  =  2 * 60 * 1000;   //  2 minutes

    setInterval(async () => {
      try {
        const db = getDb();
        const cutoff = new Date(Date.now() - BOOKING_TIMEOUT_MS);

        const stale = await db.collection('bookings').find({
          status: 'pending',
          worker_user_id: null,
          createdAt: { $lt: cutoff },
        }).toArray();

        if (stale.length === 0) return;

        const ids = stale.map(b => b._id);
        await db.collection('bookings').updateMany(
          { _id: { $in: ids } },
          { $set: { status: 'cancelled', cancelReason: 'timeout', updatedAt: new Date() } }
        );
        console.log(`⏰ [Timeout Job] Auto-cancelled ${stale.length} stale pending booking(s)`);

        // Notify customers via socket
        const { getIO } = await import('./socket.js');
        const io = getIO();
        if (io) {
          for (const booking of stale) {
            if (booking.customer_user_id) {
              io.to(booking.customer_user_id.toString()).emit('booking_cancelled', {
                bookingId: booking._id.toString(),
                reason: 'timeout',
                message: 'No workers were available. Your booking has been cancelled.',
              });
            }
          }
        }
      } catch (err) {
        console.error('⏰ [Timeout Job] Error:', err.message);
      }
    }, CHECK_INTERVAL_MS);
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });

