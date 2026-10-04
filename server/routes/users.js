/**
 * User Admin Routes
 * FR-016: Admins list, search, change role of, and deactivate users
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { updateUserSchema, userQuerySchema } from '../validators.js';
import { authenticate, requireRole, AppError } from '../middleware.js';

const router = Router();

// Require admin for all user management routes
router.use(authenticate, requireRole('admin'));

// GET /api/users (FR-016)
router.get('/', async (req, res, next) => {
  try {
    const query = userQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 12));
    const offset = (page - 1) * limit;

    const whereClauses = [];
    const params = [];

    if (query.role) {
      whereClauses.push('role = ?');
      params.push(query.role);
    }

    if (query.is_active !== undefined) {
      whereClauses.push('is_active = ?');
      params.push(query.is_active === '1' || query.is_active === 'true' ? 1 : 0);
    }

    if (query.keyword) {
      whereClauses.push('(username LIKE ? OR full_name LIKE ? OR email LIKE ? OR school_id LIKE ?)');
      const kw = `%${query.keyword}%`;
      params.push(kw, kw, kw, kw);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM users ${whereSql}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const listSql = `
      SELECT id, username, email, full_name, school_id, role, is_active, created_at
      FROM users
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(listSql, [...params, limit, offset]);

    res.status(200).json({
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id (FR-016)
router.patch('/:id', async (req, res, next) => {
  try {
    const targetUserId = Number(req.params.id);
    const updates = updateUserSchema.parse(req.body);

    const [existing] = await pool.query(
      'SELECT id, username, email, full_name, school_id, role, is_active FROM users WHERE id = ?',
      [targetUserId]
    );

    if (!existing || existing.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'The target user was not found.');
    }

    // Safety: prevent admin from deactivating themselves
    if (targetUserId === req.user.id && updates.is_active === 0) {
      throw new AppError(400, 'CANNOT_DEACTIVATE_SELF', 'Administrators cannot deactivate their own active account.');
    }

    const setClauses = [];
    const params = [];

    if (updates.full_name !== undefined) {
      setClauses.push('full_name = ?');
      params.push(updates.full_name);
    }

    if (updates.email !== undefined) {
      setClauses.push('email = ?');
      params.push(updates.email);
    }

    if (updates.school_id !== undefined) {
      setClauses.push('school_id = ?');
      params.push(updates.school_id);
    }

    if (updates.role !== undefined) {
      setClauses.push('role = ?');
      params.push(updates.role);
    }

    if (updates.is_active !== undefined) {
      setClauses.push('is_active = ?');
      params.push(updates.is_active);
    }

    if (setClauses.length > 0) {
      params.push(targetUserId);
      await pool.execute(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    }

    const [updated] = await pool.query(
      'SELECT id, username, email, full_name, school_id, role, is_active, created_at FROM users WHERE id = ?',
      [targetUserId]
    );

    res.status(200).json({
      message: 'User account status updated successfully.',
      user: updated[0],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
