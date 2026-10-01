/**
 * Notification Controller
 * FR-013: in-app notifications
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types.ts';
import { notificationService } from '../services/notification.service.ts';

export class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const notifications = await notificationService.getNotifications(userId);
      res.status(200).json({ notifications });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id ? Number(req.params.id) : undefined;
      await notificationService.markAsRead(userId, notificationId);
      res.status(200).json({ message: 'Notifications updated.' });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
