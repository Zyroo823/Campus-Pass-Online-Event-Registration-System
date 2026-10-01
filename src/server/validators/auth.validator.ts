/**
 * Authentication Validators
 * FR-001, FR-002, NFR-007
 */

import { z } from 'zod';

const noControlChars = (val: string) => !/[\x00-\x1F\x7F]/.test(val);

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .refine(noControlChars, { message: 'Username contains invalid control characters' })
      .min(4, { message: 'Username must be at least 4 characters long' })
      .max(20, { message: 'Username cannot exceed 20 characters' })
      .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username may only contain letters, numbers, and underscores' }),
    email: z
      .string()
      .trim()
      .refine(noControlChars, { message: 'Email contains invalid control characters' })
      .email({ message: 'Please provide a valid email address' })
      .toLowerCase(),
    full_name: z
      .string()
      .trim()
      .refine(noControlChars, { message: 'Full name contains invalid control characters' })
      .min(2, { message: 'Full name must be at least 2 characters long' })
      .max(80, { message: 'Full name cannot exceed 80 characters' })
      .regex(/^[a-zA-Z\s.'-]+$/, { message: "Full name may only contain letters, spaces, periods, apostrophes, and hyphens" }),
    school_id: z
      .string()
      .trim()
      .refine(noControlChars, { message: 'School ID contains invalid control characters' })
      .min(5, { message: 'School ID must be at least 5 characters long' })
      .max(15, { message: 'School ID cannot exceed 15 characters' })
      .regex(/^[a-zA-Z0-9-]+$/, { message: 'School ID may only contain letters, numbers, and hyphens' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long' })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'Password must include at least one uppercase letter, one lowercase letter, and one number',
      }),
    confirm_password: z.string(),
  })
  .refine(data => data.password !== data.username, {
    message: 'Password cannot be the same as your username',
    path: ['password'],
  })
  .refine(data => data.password === data.confirm_password, {
    message: 'Password confirmation does not match password',
    path: ['confirm_password'],
  });

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { message: 'Username is required' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
