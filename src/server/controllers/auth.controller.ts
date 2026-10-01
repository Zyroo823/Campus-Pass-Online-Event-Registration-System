/**
 * Auth Controller
 * FR-001, FR-002, FR-003, NFR-002
 */

import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validators/auth.validator.ts';
import { authService } from '../services/auth.service.ts';
import { AuthenticatedRequest } from '../types.ts';
import { AUTH_COOKIE_NAME } from '../middleware/auth.middleware.ts';

const COOKIE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // NFR-002: 2 hours

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const { user, token } = await authService.register(validated);

      // Set JWT in httpOnly, SameSite=Lax cookie (NFR-002)
      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/',
      });

      res.status(201).json({
        message: 'Registration successful. Account created.',
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const { user, token } = await authService.login(validated);

      // Set JWT in httpOnly, SameSite=Lax cookie (NFR-002)
      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/',
      });

      res.status(200).json({
        message: 'Login successful.',
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear auth cookie (FR-003)
      res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      res.status(200).json({
        message: 'Successfully logged out.',
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
        return;
      }
      const user = await authService.getProfile(req.user.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
