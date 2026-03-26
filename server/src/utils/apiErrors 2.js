/**
 * Standardized API error classes for PlumbPro Inventory.
 * All errors carry a machine-readable `code` and map to an HTTP status.
 */

export class AppError extends Error {
  constructor(message, code, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = undefined) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message, details = undefined) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}
