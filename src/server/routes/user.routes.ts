/**
 * User Admin Routes
 * FR-016: Admins list, search, change role, deactivate
 */

import { Router } from 'express';
import { userController } from '../controllers/user.controller.ts';
import { authenticate, requireRole } from '../middleware/auth.middleware.ts';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', (req, res, next) => userController.listUsers(req, res, next));
router.patch('/:id', (req, res, next) => userController.updateUser(req, res, next));

export default router;
