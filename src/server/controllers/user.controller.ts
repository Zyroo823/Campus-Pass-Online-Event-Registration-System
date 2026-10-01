/**
 * User Admin Controller
 * FR-016: Admin list, search, change role, deactivate
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types.ts';
import { userService } from '../services/user.service.ts';
import { userQuerySchema, updateUserSchema } from '../validators/user.validator.ts';
import { AppError } from '../middleware/error.middleware.ts';

export class UserController {
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = userQuerySchema.parse(req.query);
      const result = await userService.listUsers(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = Number(req.params.id);
      if (isNaN(targetUserId)) {
        throw new AppError(400, 'INVALID_USER_ID', 'Invalid user ID format.');
      }
      const validated = updateUserSchema.parse(req.body);
      const updatedUser = await userService.updateUser(targetUserId, req.user!.id, validated);
      res.status(200).json({
        message: 'User record updated successfully.',
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
