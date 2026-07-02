import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generalLimiter } from "./src/middleware/rateLimiter.js";
import { errorHandler } from "./src/middleware/errorHandler.js";

// Routes
import organizationRoutes from "./src/routes/organizations.js";
import paymentRoutes from "./src/routes/payments.js";
import verificationRoutes from "./src/routes/verification.js";
import verifyRoutes from "./src/routes/verify.js";
import employeeRoutes from "./src/routes/employeeRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());

// Trust proxy — required when deployed behind a reverse proxy (Railway, Render, etc.)
// Fixes: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR from express-rate-limit
app.set("trust proxy", 1);

// CORS — restrict to the configured frontend URL in production
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" })); // 10 MB allows base64 snapshots
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting (all routes) ────────────────────────────────────────────────
app.use(generalLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/organizations", organizationRoutes);
app.use("/api/payments",      paymentRoutes);
app.use("/api/verification",  verificationRoutes); // POST /api/verification/send
app.use("/api/verify",        verifyRoutes);       // GET  /api/verify/:token  POST /api/verify/submit
app.use("/api/employees",     employeeRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "PayGuard AI Backend is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global error handler (must be last) ────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PayGuard AI Backend running on port ${PORT}`);
  console.log(`👉 Health: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
});
