import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { generalLimiter } from "../middleware/rateLimiter.js";
import {
  createPaymentBatch,
  approveBatch,
  processPayment,
  getPaymentStatus,
  simulateFunding,
  getWalletTransactions,
  logBalanceView
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
router.get("/transactions", getWalletTransactions);
router.post("/log-balance-view", logBalanceView);


export default router;
