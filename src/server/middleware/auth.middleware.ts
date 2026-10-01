/**
 * Authentication and Authorization Middleware
 * NFR-002: JWT in httpOnly SameSite=Lax cookie, role check, event ownership check
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthJwtPayload, UserRole } from '../types.ts';
import { AppError } from './error.middleware.ts';
import { pool } from '../db/connection.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'oakridge-polytechnic-stlc-super-secret-key-2026';
export const AUTH_COOKIE_NAME = 'campus_token';

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  // Read token from httpOnly cookie or fallback Authorization header
  let token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required. Please log in to continue.'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
    req.user = payload;
    next();
  } catch (err: any) {
    return next(new AppError(401, 'INVALID_TOKEN', 'Your session has expired or is invalid. Please log in again.'));
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
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

/**
 * Event ownership middleware:
 * Ensures organizers can ONLY mutate their own events.
 * Admins are also permitted as super-users.
 */
export async function requireEventOwnership(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const eventId = Number(req.params.id);
  if (isNaN(eventId)) {
    return next(new AppError(400, 'INVALID_EVENT_ID', 'Invalid event identifier format.'));
  }

  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
  }

  // Admins bypass ownership
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
