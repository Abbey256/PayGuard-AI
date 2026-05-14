import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { setupOrganization, getMyOrganization } from "../controllers/organizationController.js";

const router = Router();

// Public — called right after Supabase signUp (no auth token yet at that moment,
// so we keep setup public but validate adminId in the controller)
router.post("/setup", setupOrganization);

// Protected — get current org details (including squad sub account id)
router.get("/me", authMiddleware, getMyOrganization);

export default router;
