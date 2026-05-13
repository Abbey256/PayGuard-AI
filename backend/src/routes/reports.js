import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { generalLimiter } from "../middleware/rateLimiter.js";
import { getAuditLog, generateReport, getReportHistory } from "../controllers/reportController.js";

const router = Router();

// All report routes require authentication
router.use(authMiddleware);
router.use(generalLimiter);

router.get("/audit-log", getAuditLog);
router.post("/generate", generateReport);
router.get("/history", getReportHistory);

export default router;
