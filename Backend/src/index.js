import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
import { protect, authorize } from "./middleware/auth.js";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // ── Start ─────────────────────────────────────────────────────────────────
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () =>
      console.log(`🚀 RAHI Server + Socket.IO → http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });
