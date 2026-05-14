import "dotenv/config";
import express from "express";
import cors from "cors";

// Routes
import organizationRoutes from "./src/routes/organizations.js";
import paymentRoutes from "./src/routes/payments.js";
import verificationRoutes from "./src/routes/verification.js"; // POST /send route
import verifyRoutes from "./src/routes/verify.js";             // GET /:token, POST /submit
import employeeRoutes from "./src/routes/employeeRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/organizations", organizationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/verification", verificationRoutes); // handles /api/verification/send
app.use("/api/verify", verifyRoutes);             // handles /api/verify/:token & /submit
app.use("/api/employees", employeeRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "PayGuard AI Backend is running" });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ 
    success: false, 
    message: err.message || "Internal Server Error" 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 PayGuard AI Backend running on port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/health`);
});