/**
 * Authentication Service
 * FR-001, FR-002, FR-003, NFR-002
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.ts';
import { RegisterInput, LoginInput } from '../validators/auth.validator.ts';
import { AppError } from '../middleware/error.middleware.ts';
import { AuthJwtPayload, UserRole } from '../types.ts';

const BCRYPT_COST = 12; // NFR-002: bcrypt cost 12
const JWT_SECRET = process.env.JWT_SECRET || 'oakridge-polytechnic-stlc-super-secret-key-2026';
const JWT_EXPIRY = '2h'; // NFR-002: expires in 2 hours

export class AuthService {
  /**
   * Register a new participant account
   * FR-001
   */
  async register(input: RegisterInput): Promise<{ user: AuthJwtPayload; token: string }> {
    // 1. Check uniqueness of username, email, school_id
    const [existing] = await pool.query(
      'SELECT id, username, email, school_id FROM users WHERE username = ? OR email = ? OR school_id = ?',
      [input.username, input.email, input.school_id]
    );

    if (existing && existing.length > 0) {
      const match = existing[0];
      const fields: Record<string, string> = {};
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

    // 2. Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    // 3. Insert into database
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, full_name, school_id, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, 'participant', 1)`,
      [input.username, input.email, input.full_name, input.school_id, passwordHash]
    );

    const newUserId = result.insertId;

    const payload: AuthJwtPayload = {
      id: newUserId,
      username: input.username,
      email: input.email,
      full_name: input.full_name,
      school_id: input.school_id,
      role: 'participant',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return { user: payload, token };
  }

  /**
   * Log in user
   * FR-002, NFR-002: generic login failure message (no username enumeration)
   */
  async login(input: LoginInput): Promise<{ user: AuthJwtPayload; token: string }> {
    const genericMessage = 'Invalid username or password.';

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [input.username]);

    if (!rows || rows.length === 0) {
      // Intentionally generic to avoid username enumeration
      throw new AppError(401, 'INVALID_CREDENTIALS', genericMessage);
    }

    const user = rows[0];

    // Check account status
    if (user.is_active !== 1 && user.is_active !== true) {
      throw new AppError(
        403,
        'ACCOUNT_DEACTIVATED',
        'Your account has been deactivated by an administrator. Please contact student affairs.'
      );
    }

    // Verify password
    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', genericMessage);
    }

    const payload: AuthJwtPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      school_id: user.school_id,
      role: user.role as UserRole,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return { user: payload, token };
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: number): Promise<AuthJwtPayload> {
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, school_id, role, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!rows || rows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile could not be found.');
    }

    const user = rows[0];
    if (!user.is_active) {
      throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'Account is deactivated.');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      school_id: user.school_id,
      role: user.role,
    };
  }
}

export const authService = new AuthService();
