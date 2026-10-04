/**
 * Notification Routes
 * FR-013: In-app notifications
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware.js';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, type, message, event_id, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.status(200).json({ notifications: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?',
      [req.user.id, notificationId]
    );
    res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

export default router;
