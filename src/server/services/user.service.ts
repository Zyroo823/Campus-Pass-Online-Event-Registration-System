/**
 * User Admin Service
 * FR-016: Admins list, search, change role of, and deactivate users
 */

import { pool } from '../db/connection.ts';
import { UserQueryInput, UpdateUserInput } from '../validators/user.validator.ts';
import { AppError } from '../middleware/error.middleware.ts';

export class UserService {
  async listUsers(query: UserQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 12));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

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

    return {
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async updateUser(targetUserId: number, actorUserId: number, input: UpdateUserInput) {
    const [targetRows] = await pool.query('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetRows || targetRows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User does not exist.');
    }

    const targetUser = targetRows[0];

    // Prevent admin from deactivating themselves
    if (targetUserId === actorUserId && input.is_active === 0) {
      throw new AppError(400, 'SELF_DEACTIVATION_BLOCKED', 'You cannot deactivate your own administrative account.');
    }

    // Prevent admin from revoking their own admin role
    if (targetUserId === actorUserId && input.role && input.role !== 'admin') {
      throw new AppError(400, 'SELF_DEMOTION_BLOCKED', 'You cannot demote your own administrative role.');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (input.role) {
      updates.push('role = ?');
      params.push(input.role);
    }

    if (input.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(input.is_active);
    }

    if (updates.length > 0) {
      params.push(targetUserId);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updated] = await pool.query(
      'SELECT id, username, email, full_name, school_id, role, is_active, created_at FROM users WHERE id = ?',
      [targetUserId]
    );

    return updated[0];
  }
}

export const userService = new UserService();
