/**
 * Server-side TypeScript interfaces and types
 * NFR-002, NFR-007
 */

import { Request } from 'express';

export type UserRole = 'participant' | 'organizer' | 'admin';
export type EventCategory =
  | 'Academic'
  | 'Sports'
  | 'Arts & Culture'
  | 'Career & Networking'
  | 'Community & Service'
  | 'Technology & STEM';

export type EventStatus = 'published' | 'cancelled';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AuthJwtPayload {
  id: number;
  username: string;
  role: UserRole;
  email: string;
  school_id: string;
  full_name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthJwtPayload;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    retryAfterSeconds?: number;
  };
}
