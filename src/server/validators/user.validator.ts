/**
 * User Admin Validators
 * FR-016, NFR-007
 */

import { z } from 'zod';

export const updateUserSchema = z.object({
  role: z.enum(['participant', 'organizer', 'admin']).optional(),
  is_active: z.union([z.boolean(), z.number()]).transform(val => (val === true || val === 1 ? 1 : 0)).optional(),
});

export const userQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  role: z.enum(['participant', 'organizer', 'admin']).optional(),
  is_active: z.enum(['1', '0', 'true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
