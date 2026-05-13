import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { login, logout, refreshToken } from "../controllers/authController.js";

const router = Router();

// Public auth routes with rate limiting
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.post("/refresh-token", authLimiter, refreshToken);

// Protected routes
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
