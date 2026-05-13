import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { generalLimiter } from "../middleware/rateLimiter.js";
import { uploadStaff, getStaff, updateStaff } from "../controllers/staffController.js";

const router = Router();

// All staff routes require authentication
router.use(authMiddleware);
router.use(generalLimiter);

router.post("/upload", uploadStaff);
router.get("/", getStaff);
router.put("/:id", updateStaff);

export default router;
