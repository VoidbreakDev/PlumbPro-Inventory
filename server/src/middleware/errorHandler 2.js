/**
 * Global Express error handler.
 * All errors must conform to: { error: string, code: string, details?: any }
 */

import { AppError } from '../utils/apiErrors.js';

export function errorHandler(err, req, res, next) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Known application error
  if (err instanceof AppError) {
    const body = { error: err.message, code: err.code };
    if (err.details !== undefined) body.details = err.details;
    if (isDevelopment) body.stack = err.stack;
    return res.status(err.statusCode).json(body);
  }

  // Express validation errors (express-validator result passed as thrown error)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body', code: 'PARSE_ERROR' });
  }

  // JWT / auth errors bubbled from middleware
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_ERROR' });
  }

  // Postgres constraint violations
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with that value already exists', code: 'CONFLICT' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Referenced record does not exist', code: 'CONFLICT' });
  }

  // Unhandled / unexpected errors
  console.error('[Unhandled Error]', err);
  const body = { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  if (isDevelopment) body.stack = err.stack;
  return res.status(500).json(body);
}

export default errorHandler;
