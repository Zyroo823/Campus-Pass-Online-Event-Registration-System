/**
 * Validation Schemas (Zod)
 * FR-001, FR-002, FR-004, FR-009, FR-010, FR-012, FR-016
 */

import { z } from 'zod';

const noControlChars = (val) => typeof val === 'string' && !/[\x00-\x1F\x7F]/.test(val);

// ============================================================================
// Auth Validators (FR-001, FR-002)
// ============================================================================
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

// ============================================================================
// Event Validators (FR-004, FR-005, FR-009, FR-010, FR-012)
// ============================================================================
export const ALLOWED_CATEGORIES = [
  'Academic',
  'Sports',
  'Arts & Culture',
  'Career & Networking',
  'Community & Service',
  'Technology & STEM',
];

const baseEventSchema = z.object({
  title: z
    .string()
    .trim()
    .refine(noControlChars, { message: 'Title contains invalid control characters' })
    .min(5, { message: 'Title must be between 5 and 120 characters long' })
    .max(120, { message: 'Title must be between 5 and 120 characters long' }),
  description: z
    .string()
    .trim()
    .refine(noControlChars, { message: 'Description contains invalid control characters' })
    .min(20, { message: 'Description must be between 20 and 2000 characters long' })
    .max(2000, { message: 'Description must be between 20 and 2000 characters long' }),
  category: z.enum(ALLOWED_CATEGORIES),
  venue: z
    .string()
    .trim()
    .refine(noControlChars, { message: 'Venue contains invalid control characters' })
    .min(3, { message: 'Venue must be between 3 and 120 characters long' })
    .max(120, { message: 'Venue must be between 3 and 120 characters long' }),
  starts_at: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), { message: 'Please provide a valid start date and time' }),
  ends_at: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), { message: 'Please provide a valid end date and time' }),
  registration_deadline: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), { message: 'Please provide a valid registration deadline' }),
  capacity: z
    .coerce
    .number()
    .int({ message: 'Capacity must be a whole number' })
    .min(1, { message: 'Capacity must be between 1 and 1000 seats' })
    .max(1000, { message: 'Capacity cannot exceed 1000 seats' }),
  fee_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform(val => {
      if (val === undefined || val === null || val === '') return 0;
      return typeof val === 'string' ? val.trim() : val;
    })
    .refine(val => {
      if (val === 0 || val === '0') return true;
      const str = String(val);
      if (!/^\d+(\.\d{1,2})?$/.test(str)) return false;
      const num = Number(str);
      return !isNaN(num) && num >= 0 && num <= 50000;
    }, {
      message: 'Entrance fee must be between 0 and 50,000, with up to 2 decimal places.',
    })
    .transform(val => {
      const num = Number(val);
      return isNaN(num) ? 0 : Number(num.toFixed(2));
    }),
  requires_approval: z
    .union([z.boolean(), z.number()])
    .transform(val => (val === true || val === 1 ? 1 : 0)),
});

export const eventFormSchema = baseEventSchema
  .refine(
    data => {
      const start = new Date(data.starts_at).getTime();
      const end = new Date(data.ends_at).getTime();
      return end > start;
    },
    {
      message: 'Event end time must be after the start time',
      path: ['ends_at'],
    }
  )
  .refine(
    data => {
      const start = new Date(data.starts_at).getTime();
      const deadline = new Date(data.registration_deadline).getTime();
      return deadline <= start;
    },
    {
      message: 'Registration deadline cannot be after the event start time',
      path: ['registration_deadline'],
    }
  );

export const eventUpdateSchema = baseEventSchema.partial();

export const eventQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  category: z
    .string()
    .trim()
    .optional()
    .transform(val => {
      if (!val || val === 'All Categories' || val.toLowerCase() === 'all') return undefined;
      const match = ALLOWED_CATEGORIES.find(c => c.toLowerCase() === val.toLowerCase());
      return match || val;
    }),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  available_only: z.enum(['true', 'false', '1', '0']).optional(),
  when: z.enum(['upcoming', 'past']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const registrationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject'], {
    message: "Decision must be either 'approve' or 'reject'",
  }),
});

// ============================================================================
// User Admin Validators (FR-016)
// ============================================================================
export const updateUserSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters long' })
    .max(100, { message: 'Full name cannot exceed 100 characters' })
    .optional(),
  email: z
    .string()
    .trim()
    .email({ message: 'Please provide a valid email address' })
    .max(255)
    .optional(),
  school_id: z
    .string()
    .trim()
    .min(3, { message: 'School ID must be at least 3 characters long' })
    .max(50)
    .optional(),
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
