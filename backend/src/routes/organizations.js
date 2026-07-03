import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { setupOrganization, getMyOrganization } from "../controllers/organizationController.js";

const router = Router();

// Protected — adminId extracted from JWT, not from request body
router.post("/setup", authMiddleware, setupOrganization);

// Protected — get current org details (including squad sub account id)
router.get("/me", authMiddleware, getMyOrganization);

export default router;
