import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js"; // Changed to named import
import authRoutes from "./routes/auth.routes.js";
import workerRoutes from "./routes/worker.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import usersRoutes from "./routes/users.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the public/uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log("✅ Database connected successfully");
    // Health Check
    app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

    // Routes
    app.use("/api/auth", authRoutes);
    app.use("/api/worker-profiles", workerRoutes);
    app.use("/api/bookings", bookingRoutes);
    app.use("/api/users", usersRoutes);
    app.use("/api/service_categories", serviceRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/notifications", notificationRoutes);

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("❌ Failed to start server due to DB connection error:", err.message);
    console.error("Full error:", err);
    process.exit(1);
  });
