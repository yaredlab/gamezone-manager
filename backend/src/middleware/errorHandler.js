/**
 * src/middleware/errorHandler.js
 * Centralized Express error handler.
 * Returns consistent JSON error shapes across all routes.
 */

export function errorHandler(err, _req, res, _next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Conflict',
      message: `A record with that ${err.meta?.target?.join(', ') || 'value'} already exists.`,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not Found', message: 'Record not found.' });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[error]', err);
  }

  res.status(status).json({ error: status === 500 ? 'Internal Server Error' : 'Error', message });
}

/**
 * Wraps an async route handler so thrown errors are forwarded to errorHandler.
 * @param {Function} fn
 * @returns {Function}
 */
export const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
