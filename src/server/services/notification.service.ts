/**
 * Notification Service
 * FR-013: Notify users in-app when registration approved/rejected or event edited/cancelled
 */

import { pool } from '../db/connection.ts';

export class NotificationService {
  async createNotification(
    userId: number,
    type: 'REGISTRATION_STATUS' | 'EVENT_UPDATE' | 'SYSTEM_ALERT',
    message: string,
    eventId?: number | null
  ): Promise<void> {
    await pool.execute(
      `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [userId, type, message, eventId || null]
    );
  }

  async getNotifications(userId: number) {
    const [rows] = await pool.query(
      `SELECT id, user_id, type, message, event_id, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    return rows;
  }

  async markAsRead(userId: number, notificationId?: number): Promise<void> {
    if (notificationId) {
      await pool.execute(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?`,
        [userId, notificationId]
      );
    } else {
      await pool.execute(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
        [userId]
      );
    }
  }
}

export const notificationService = new NotificationService();
