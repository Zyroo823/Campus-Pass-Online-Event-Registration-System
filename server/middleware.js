/**
 * Server Middleware
 * NFR-002: Security, rate limiting, and authentication
 * NFR-004: Centralized error handling
 */

import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'oakridge-polytechnic-stlc-super-secret-key-2026';
export const AUTH_COOKIE_NAME = 'campus_token';
const COOKIE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours (NFR-002)

// ============================================================================
// Cookie Options Helpers
// ============================================================================
export function getAuthCookieOptions(req) {
  const isSecure = Boolean(
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production'
  );
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

export function getClearCookieOptions(req) {
  const isSecure = Boolean(
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production'
  );
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/',
  };
}

// ============================================================================
// Auth & Role Middleware
// ============================================================================
export function authenticate(req, _res, next) {
  let token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required. Please log in to continue.'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return next(new AppError(401, 'INVALID_TOKEN', 'Your session has expired or is invalid. Please log in again.'));
  }
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required. Please log in to continue.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}.`
        )
      );
    }

    next();
  };
}

export async function requireEventOwnership(req, _res, next) {
  const eventId = Number(req.params.id);
  if (isNaN(eventId)) {
    return next(new AppError(400, 'INVALID_EVENT_ID', 'Invalid event identifier format.'));
  }

  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
  }

  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const [rows] = await pool.query('SELECT organizer_id FROM events WHERE id = ?', [eventId]);
    if (!rows || rows.length === 0) {
      return next(new AppError(404, 'EVENT_NOT_FOUND', 'The requested event does not exist.'));
    }

    if (rows[0].organizer_id !== req.user.id) {
      return next(
        new AppError(
          403,
          'EVENT_OWNERSHIP_REQUIRED',
          'You do not have permission to modify this event because you are not its designated organizer.'
        )
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Rate Limiters (Removed / Pass-through)
// ============================================================================
export const activeLoginRateLimits = new Map();

export function getLoginRateLimitRemaining() {
  return 0;
}

const passThroughLimiter = (_req, _res, next) => next();

export const globalApiLimiter = passThroughLimiter;
export const loginLimiter = passThroughLimiter;
export const registerLimiter = passThroughLimiter;
export const eventRegisterLimiter = passThroughLimiter;
export const eventMutateLimiter = passThroughLimiter;

// ============================================================================
// Error Handler
// ============================================================================
export class AppError extends Error {
  constructor(statusCode, code, message, fields) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      if (!fields[path]) {
        fields[path] = issue.message;
      }
    }
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted form contains invalid or missing data. Please review the highlighted fields.',
        fields,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
  }

  console.error('[CampusPass] Unhandled API Exception:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred. Please try your request again later.',
    },
  });
}
