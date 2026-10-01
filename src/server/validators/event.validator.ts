/**
 * Event Validators
 * FR-004, FR-005, FR-009, FR-010, NFR-007
 */

import { z } from 'zod';

const noControlChars = (val: string) => !/[\x00-\x1F\x7F]/.test(val);

export const ALLOWED_CATEGORIES: [string, ...string[]] = [
  'Academic',
  'Sports',
  'Arts & Culture',
  'Career & Networking',
  'Community & Service',
  'Technology & STEM',
];

export const eventFormSchema = z
  .object({
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
    requires_approval: z
      .union([z.boolean(), z.number()])
      .transform(val => (val === true || val === 1 ? 1 : 0)),
  })
  .refine(
    data => {
      const startsAt = new Date(data.starts_at).getTime();
      return startsAt > Date.now();
    },
    {
      message: 'Event start time must be in the future',
      path: ['starts_at'],
    }
  )
  .refine(
    data => {
      const startsAt = new Date(data.starts_at).getTime();
      const endsAt = new Date(data.ends_at).getTime();
      return endsAt > startsAt;
    },
    {
      message: 'Event end time must be after the start time',
      path: ['ends_at'],
    }
  )
  .refine(
    data => {
      const deadline = new Date(data.registration_deadline).getTime();
      const startsAt = new Date(data.starts_at).getTime();
      return deadline <= startsAt;
    },
    {
      message: 'Registration deadline must be on or before the event start time',
      path: ['registration_deadline'],
    }
  );

export const eventQuerySchema = z.object({
  keyword: z
    .string()
    .trim()
    .max(100, { message: 'Search keyword cannot exceed 100 characters' })
    .optional(),
  category: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  available_only: z.enum(['true', 'false', '1', '0']).optional(),
  when: z.enum(['upcoming', 'past']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(['starts_at_asc', 'starts_at_desc', 'title_asc', 'created_at_desc']).default('starts_at_asc'),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

export type EventFormInput = z.infer<typeof eventFormSchema>;
export type EventQueryInput = z.input<typeof eventQuerySchema>;
