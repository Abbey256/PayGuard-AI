import { Router } from "express";
import { verificationLimiter } from "../middleware/rateLimiter.js";
import { validateToken, submitVerification } from "../controllers/verifyController.js";

const router = Router();

// Public — no authMiddleware on any route in this file.
// Router is mounted at /api/verify in index.js.

// GET /api/verify/:token — validate a one-time verification token
router.get("/:token", validateToken);

// POST /api/verify/submit — submit liveness result (rate-limited)
router.post("/submit", verificationLimiter, submitVerification);

export default router;
