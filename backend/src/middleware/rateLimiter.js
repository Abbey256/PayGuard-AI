import rateLimit from "express-rate-limit";

/**
 * General rate limiter: 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for verification: 10 requests per 15 minutes
 */
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many verification attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth rate limiter: 5 attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  generalLimiter,
  verificationLimiter,
  authLimiter,
};
