/**
 * Auth Routes
 * FR-001, FR-002, FR-003, NFR-002
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { registerSchema, loginSchema } from '../validators.js';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
  authenticate,
  loginLimiter,
  registerLimiter,
  AppError,
} from '../middleware.js';

const router = Router();
const BCRYPT_COST = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'oakridge-polytechnic-stlc-super-secret-key-2026';
const JWT_EXPIRY = '2h';

// POST /api/auth/register (FR-001)
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);

    const [existing] = await pool.query(
      'SELECT id, username, email, school_id FROM users WHERE username = ? OR email = ? OR school_id = ?',
      [input.username, input.email, input.school_id]
    );

    if (existing && existing.length > 0) {
      const match = existing[0];
      const fields = {};
      if (match.username.toLowerCase() === input.username.toLowerCase()) {
        fields.username = 'This username is already taken. Please choose another.';
      }
      if (match.email.toLowerCase() === input.email.toLowerCase()) {
        fields.email = 'An account with this email address already exists.';
      }
      if (match.school_id.toUpperCase() === input.school_id.toUpperCase()) {
        fields.school_id = 'This school ID is already registered.';
      }
      throw new AppError(409, 'ACCOUNT_CONFLICT', 'One or more credentials are already registered.', fields);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    const [result] = await pool.execute(
      `INSERT INTO users (username, email, full_name, school_id, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, 'participant', 1)`,
      [input.username, input.email, input.full_name, input.school_id, passwordHash]
    );

    const user = {
      id: result.insertId,
      username: input.username,
      email: input.email,
      full_name: input.full_name,
      school_id: input.school_id,
      role: 'participant',
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(req));

    res.status(201).json({
      message: 'Registration successful. Account created.',
      user,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login (FR-002)
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const cleanUsername = input.username.trim();

    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, school_id, password_hash, role, is_active FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [cleanUsername, cleanUsername]
    );

    const genericError = new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Invalid username or password. Please verify your credentials and try again.'
    );

    if (!rows || rows.length === 0) {
      throw genericError;
    }

    const match = rows[0];

    if (!match.is_active) {
      throw new AppError(
        403,
        'ACCOUNT_DEACTIVATED',
        'Your student account has been suspended or deactivated. Please contact Student Affairs.'
      );
    }

    let passwordValid = await bcrypt.compare(input.password, match.password_hash);
    if (!passwordValid && input.password.trim() !== input.password) {
      passwordValid = await bcrypt.compare(input.password.trim(), match.password_hash);
    }

    if (!passwordValid) {
      throw genericError;
    }

    const user = {
      id: match.id,
      username: match.username,
      email: match.email,
      full_name: match.full_name,
      school_id: match.school_id,
      role: match.role,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(req));

    res.status(200).json({
      message: 'Login successful.',
      user,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout (FR-003)
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions(req));
  res.status(200).json({ message: 'Successfully logged out.' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, school_id, role, is_active FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows || rows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found.');
    }
    res.status(200).json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
