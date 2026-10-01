/**
 * Notification Routes
 * FR-013: in-app notifications
 */

import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.ts';
import { authenticate } from '../middleware/auth.middleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));
router.patch('/read-all', (req, res, next) => notificationController.markAsRead(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

export default router;
