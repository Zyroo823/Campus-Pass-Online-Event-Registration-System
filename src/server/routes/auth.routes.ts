/**
 * Auth Routes
 * FR-001, FR-002, FR-003, NFR-002
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.ts';
import { authenticate } from '../middleware/auth.middleware.ts';
import { loginLimiter, registerLimiter, getLoginRateLimitRemaining } from '../middleware/rate-limit.middleware.ts';

const router = Router();

// Endpoint to query current login rate-limit status and Retry-After
const handleRateLimitQuery = (req: any, res: any) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const username = typeof req.query.username === 'string' ? req.query.username : undefined;
  const retryAfterSeconds = getLoginRateLimitRemaining(ip, username);

  if (retryAfterSeconds > 0) {
    res.setHeader('Retry-After', retryAfterSeconds);
    const m = Math.floor(retryAfterSeconds / 60);
    const s = retryAfterSeconds % 60;
    return res.status(429).json({
      rateLimited: true,
      retryAfterSeconds,
      message: `Too many failed attempts. Try again in ${m} min ${s} s.`,
    });
  }

  return res.json({ rateLimited: false, retryAfterSeconds: 0 });
};

router.get('/rate-limit', handleRateLimitQuery);
router.get('/login', handleRateLimitQuery);

router.post('/register', registerLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));

export default router;
