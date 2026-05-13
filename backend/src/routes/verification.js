import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { verificationLimiter } from "../middleware/rateLimiter.js";
import {
  initiateVerification,
  submitVerification,
  getVerificationStatus,
} from "../controllers/verificationController.js";

const router = Router();

// All verification routes require authentication
router.use(authMiddleware);

router.post("/initiate", verificationLimiter, initiateVerification);
router.post("/submit", verificationLimiter, submitVerification);
router.get("/status/:id", getVerificationStatus);

export default router;
