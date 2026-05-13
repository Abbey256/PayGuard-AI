/**
 * Global error handler middleware
 * Logs errors and returns consistent JSON response
 */
export function errorHandler(err, req, res, next) {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}

export default errorHandler;
