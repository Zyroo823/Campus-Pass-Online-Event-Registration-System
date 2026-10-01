/**
 * Rate Limiting Middleware
 * NFR-002, Rate Limiting requirements:
 * - All /api: 120 requests/min per IP
 * - POST /api/auth/login: 5 failed attempts per 15 min per IP + username (skipSuccessfulRequests: true)
 * - POST /api/auth/register: 5 per hour per IP
 * - POST /api/events/:id/register: 10/min per user
 * - Event create/edit/delete: 30/min per user
 * On limit: 429 with Retry-After header and exact JSON body format:
 * { error: { code: "RATE_LIMITED", message, retryAfterSeconds } }
 */

import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types.ts';

// Store active login rate limit expiration timestamps so they survive page refresh queries
export const activeLoginRateLimits = new Map<string, number>();

export function getLoginRateLimitRemaining(ip: string, username?: string): number {
  const now = Date.now();
  let resetTime = username ? activeLoginRateLimits.get(`${ip}:${username.toLowerCase().trim()}`) : undefined;
  if (!resetTime || resetTime <= now) {
    resetTime = activeLoginRateLimits.get(ip);
  }
  if (resetTime && resetTime > now) {
    return Math.max(1, Math.ceil((resetTime - now) / 1000));
  }
  return 0;
}

// Standard rate limit handler creating the exact mandated JSON format
const standardRateLimitHandler = (customMessage: string) => {
  return (req: Request, res: Response, _next: any, options: Options) => {
    // Express-rate-limit sets res.setHeader('Retry-After', ...)
    const resetTime = (req as any).rateLimit?.resetTime?.getTime();
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);

    const resetTimeMs = resetTime || (Date.now() + options.windowMs);
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const username = (req.body?.username || '').toLowerCase().trim();
    activeLoginRateLimits.set(ip, resetTimeMs);
    if (username) {
      activeLoginRateLimits.set(`${ip}:${username}`, resetTimeMs);
    }

    res.setHeader('Retry-After', retryAfterSeconds);
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `${customMessage} Please wait ${retryAfterSeconds} seconds before trying again.`,
        retryAfterSeconds,
      },
    });
  };
};

// 1. Global API rate limit: 120 req / min per IP
const globalMax = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '120', 10);
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  handler: standardRateLimitHandler('API rate limit exceeded.'),
});

// 2. Login rate limit: 5 failed attempts per 15 min per IP + username
const loginMax = parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10);
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginMax,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  keyGenerator: (req: Request) => {
    const username = (req.body?.username || '').toLowerCase().trim();
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    return `${ip}:${username}`;
  },
  handler: standardRateLimitHandler('Too many consecutive failed login attempts.'),
});

// 3. Register rate limit: 5 per hour per IP
const registerMax = parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '5', 10);
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: registerMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  handler: standardRateLimitHandler('Too many accounts created from this IP address.'),
});

// 4. Event registration rate limit: 10/min per user
const eventRegMax = parseInt(process.env.RATE_LIMIT_EVENT_REGISTER_MAX || '10', 10);
export const eventRegisterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: eventRegMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id ? `user:${req.user.id}:reg` : (req.ip || 'anon');
  },
  handler: standardRateLimitHandler('You are registering for events too quickly.'),
});

// 5. Event create/edit/delete rate limit: 30/min per user
const eventMutateMax = parseInt(process.env.RATE_LIMIT_EVENT_MUTATE_MAX || '30', 10);
export const eventMutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: eventMutateMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id ? `user:${req.user.id}:mutate` : (req.ip || 'anon');
  },
  handler: standardRateLimitHandler('Too many event modification requests submitted.'),
});
