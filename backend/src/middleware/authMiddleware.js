import jwt from "jsonwebtoken";

/**
 * Verify JWT token from Authorization header
 * Attaches decoded user data to req.user
 */
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.slice(7);

    // In production, verify against Supabase JWT secret
    // For now, just decode and attach to req
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      aud: decoded.aud,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
}

export default authMiddleware;
