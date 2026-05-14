import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { generalLimiter } from "../middleware/rateLimiter.js";
import {
  createPaymentBatch,
  approveBatch,
  processPayment,
  getPaymentStatus,
  simulateFunding,
} from "../controllers/paymentController.js";

const router = Router();

// All payment routes require authentication
router.use(authMiddleware);
router.use(generalLimiter);

router.post("/batches", createPaymentBatch);
router.post("/batches/:id/approve", approveBatch);
router.post("/process", processPayment);
router.get("/status/:id", getPaymentStatus);
router.post("/simulate-funding", simulateFunding);

export default router;
