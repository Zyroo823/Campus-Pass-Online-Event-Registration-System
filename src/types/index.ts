/**
 * Client-side TypeScript definitions
 */

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

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  school_id: string;
  role: UserRole;
  is_active?: number;
  created_at?: string;
}

export interface EventItem {
  id: number;
  organizer_id: number;
  organizer_name?: string;
  organizer_email?: string;
  title: string;
  description: string;
  category: EventCategory;
  venue: string;
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
  capacity: number;
  requires_approval: number | boolean;
  status: EventStatus;
  approved_count: number;
  pending_count: number;
  seats_remaining: number;
  is_full?: boolean;
  is_past_deadline?: boolean;
  has_started?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  registration_id: number;
  registration_status: RegistrationStatus;
  registered_at: string;
  decided_at?: string | null;
  reference_code: string;
  event_id: number;
  title: string;
  description: string;
  category: EventCategory;
  venue: string;
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
  capacity: number;
  requires_approval: number | boolean;
  event_status: EventStatus;
  organizer_name: string;
  has_started?: boolean;
}

export interface PendingDecision {
  registration_id: number;
  event_id: number;
  user_id: number;
  status: 'pending';
  registered_at: string;
  full_name: string;
  email: string;
  school_id: string;
  event_title: string;
}

export interface Attendee {
  registration_id: number;
  status: RegistrationStatus;
  registered_at: string;
  decided_at?: string | null;
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  school_id: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  message: string;
  event_id: number | null;
  is_read: number;
  created_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
}
