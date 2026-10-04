# Functional Requirements Document (FRD)
## CampusPass: Online Event Registration System

**Document Version:** 1.0.0  
**Project Identifier:** STLC-CP-FRD-2026  
**Status:** Approved / Base-line  
**System Under Test (SUT):** CampusPass Web Application  
**Primary Tech Stack:** Plain JavaScript (Node.js, Express, React, Tailwind CSS, MySQL / SQL Engine)

---

## 1. Executive Summary & Purpose

### 1.1 Purpose
The purpose of this Functional Requirements Document (FRD) is to define the complete functional capabilities, business logic, system interfaces, security access models, and operational requirements for the **CampusPass Online Event Registration System**. This document serves as the formal specification for developers, quality assurance engineers, and academic reviewers conducting Software Testing Life Cycle (STLC) evaluations.

### 1.2 System Scope
CampusPass provides an end-to-end, ticket-style campus event management platform. It automates:
1. Public event browsing, agenda filtering, and search.
2. Participant registration, instant authentication, and pass claiming.
3. Event creation, capacity management, registration decisions, attendee lists, and CSV exports for organizers.
4. User administration, account deactivation, and role management for campus administrators.
5. In-app notifications for event status changes and registration decisions.

---

## 2. System Actors & Role-Based Access Control (RBAC)

The system enforces strict Role-Based Access Control (RBAC) validated via signed JSON Web Tokens (JWT) stored in secure, `httpOnly` cookies (`campus_token`).

| Actor / Role | Description | Access Permissions |
|---|---|---|
| **Visitor / Guest** | Unauthenticated campus student, faculty, or public viewer. | • Browse published events<br>• Filter events by category, keyword, date, and availability<br>• View event details<br>• Register for an account (`/register`)<br>• Log in (`/login`) |
| **Participant / Student** | Authenticated campus student with an active account. | • All Visitor permissions<br>• Claim passes for open events<br>• Request approval for gated events<br>• View personal tickets in Participant Dashboard (`/dashboard`)<br>• Cancel personal registrations before event starts<br>• Receive in-app notifications |
| **Organizer** | Department head, club president, or faculty coordinator. | • All Participant permissions<br>• Access Organizer Dashboard (`/organizer`)<br>• Create new events (`POST /api/events`)<br>• Edit owned events (`PUT /api/events/:id`)<br>• Delete unbooked events or cancel booked events (`DELETE /api/events/:id`)<br>• Review pending registration requests (`approve` / `reject`)<br>• View attendee roster and export attendee CSV |
| **Administrator** | Dean of Student Affairs or System Administrator. | • All permissions across the system<br>• Access Admin Dashboard (`/admin`)<br>• Search and list all system users<br>• Update user roles (`participant`, `organizer`, `admin`)<br>• Activate or deactivate user accounts<br>• Override management on all events |

---

## 3. Information Architecture & Navigation Flows

```text
[Public Arena]
   ├── / (Home Page: Upcoming/Past Events, Search, Filters, Category Chips)
   ├── /events/:id (Event Detail Page: Itinerary, Perforation Stub, Claim Pass)
   ├── /login (Authentication)
   └── /register (Account Creation)

[Authenticated Participant Space]
   ├── /dashboard (Participant Dashboard: Active Passes, Past Events, Cancel Pass)
   └── /notifications (Notifications Feed: Approval Alerts, Cancellation Notices)

[Organizer Workstation]
   └── /organizer (Organizer Dashboard: Event Table, Decision Queue, Attendee Roster Modal, CSV Export)

[Administrative Control]
   └── /admin (Admin Dashboard: User Management Table, Role Select, Deactivate Toggle)
```

---

## 4. Detailed Functional Requirements (FR-001 to FR-016)

### FR-001: Participant Account Registration
- **User Story:** As a student, I want to create an account using my university credentials so that I can claim event passes and manage my registrations.
- **Preconditions:** The visitor is on `/register` and not currently logged in.
- **Inputs & Validation Rules:**
  - `username`: String, 4-20 alphanumeric characters + underscores, unique.
  - `email`: Valid university email format (`@uc.edu.ph` or standard RFC email), unique.
  - `full_name`: String, 2-80 characters (letters, spaces, periods, apostrophes, hyphens).
  - `school_id`: String, 5-15 characters (letters, numbers, hyphens), unique.
  - `password`: String, min 8 characters with at least 1 uppercase, 1 lowercase, 1 digit. Must not equal `username`.
  - `confirm_password`: String, exact match with `password`.
- **Business Logic:**
  1. Server hashes password with bcrypt (cost factor 12).
  2. Inserts user into `users` table with role `'participant'` and `is_active = 1`.
  3. Generates signed JWT session and sets secure `campus_token` `httpOnly` cookie.
  4. Returns `201 Created` with created user object.
  5. The client authentication context immediately stores the user state and redirects to the intended destination or `/dashboard`.
- **API Endpoint:** `POST /api/auth/register`
- **UI Test Selectors:** `register-username`, `register-email`, `register-fullname`, `register-schoolid`, `register-password`, `register-confirm-password`, `register-submit`.

---

### FR-002: User Authentication (Login)
- **User Story:** As a registered user, I want to log in with my username and password so that I can access role-specific capabilities.
- **Preconditions:** User exists in the database.
- **Inputs & Validation Rules:**
  - `username`: String, required.
  - `password`: String, required.
- **Business Logic:**
  1. Look up user by username or email.
  2. If user not found, or password does not match, return `401 Unauthorized` with generic message: `"Invalid username or password. Please verify your credentials and try again."` (prevents username enumeration).
  3. If user is deactivated (`is_active = 0`), return `403 Forbidden` (`ACCOUNT_DEACTIVATED`).
  4. On success, issue JWT in `campus_token` `httpOnly` cookie (expires in 2 hours).
  5. Route user based on role: `admin` -> `/admin`, `organizer` -> `/organizer`, `participant` -> `/dashboard`.
- **API Endpoint:** `POST /api/auth/login`
- **UI Test Selectors:** `login-username`, `login-password`, `login-submit`, `login-error-summary`.

---

### FR-003: User Logout
- **User Story:** As an authenticated user, I want to log out to terminate my active session securely.
- **Preconditions:** User is authenticated.
- **Business Logic:**
  1. Client sends POST request to `/api/auth/logout`.
  2. Server clears `campus_token` cookie with matching security flags (`httpOnly`, `path=/`).
  3. Client clears local user memory state and redirects to `/login`.
- **API Endpoint:** `POST /api/auth/logout`
- **UI Test Selectors:** `logout-button`.

---

### FR-004: Event Agenda & Directory Display
- **User Story:** As a visitor or student, I want to view upcoming and past campus events displayed as tickets so that I can explore campus activities.
- **Preconditions:** None (public endpoint).
- **Business Logic:**
  1. Default view fetches events where `starts_at > NOW()` ordered chronologically (`starts_at ASC`).
  2. Past view (`?when=past`) fetches events where `starts_at <= NOW()` ordered reverse-chronologically (`starts_at DESC`).
  3. Server-side pagination applies limit (default 12) and offset.
  4. Calculates live `approved_count`, `pending_count`, and `seats_remaining = MAX(0, capacity - approved_count)`.
- **API Endpoint:** `GET /api/events?when=upcoming|past&page=1&limit=12`
- **UI Test Selectors:** `page-title`, `when-toggle-upcoming`, `when-toggle-past`, `event-card-{id}`, `pagination-prev`, `pagination-next`.

---

### FR-005: Event Search & Multi-Criteria Filtering
- **User Story:** As a user, I want to search events by keyword and filter by category, date range, and seat availability.
- **Preconditions:** Public access.
- **Filter Parameters:**
  - `keyword`: Searches `title`, `description`, and `venue` (case-insensitive substring match).
  - `category`: Filters by exact category: `Academic`, `Sports`, `Arts & Culture`, `Career & Networking`, `Community & Service`, `Technology & STEM`.
  - `start_date`: Filters `starts_at >= start_date`.
  - `end_date`: Filters `starts_at <= end_date`.
  - `available_only`: Filters events with `seats_remaining > 0`.
- **Business Logic:**
  - One-click Category Chips and Category Select dropdown update the URL query parameters.
  - Reset button resets all filters while preserving the `when` toggle.
- **API Endpoint:** `GET /api/events` with query parameters.
- **UI Test Selectors:** `search-input`, `category-chip-*`, `filter-category`, `filter-start-date`, `filter-end-date`, `filter-available-only`, `reset-filters-btn`.

---

### FR-006: Event Details Specification
- **User Story:** As a user, I want to view full event details including description, venue, schedule, organizer contact, and seat status.
- **Preconditions:** Event exists.
- **Business Logic:**
  1. Returns comprehensive event metadata, organizer full name, email, and live seat counts.
  2. If event does not exist, returns `404 Not Found` (`EVENT_NOT_FOUND`).
- **API Endpoint:** `GET /api/events/:id`
- **UI Test Selectors:** `event-detail-title`, `event-description`, `event-starts-at`, `event-ends-at`, `event-deadline`, `event-venue`, `event-organizer-name`, `seats-remaining-text`.

---

### FR-007: Event Pass Registration & Claiming
- **User Story:** As a participant, I want to claim a pass or request registration for an event so that I can attend.
- **Preconditions:** User is logged in as `participant`, `organizer`, or `admin`.
- **Business Logic & Guard Constraints:**
  1. **Concurrency Protection:** Database transaction locks event row with `SELECT ... FOR UPDATE`.
  2. **Duplicate Check:** If user already has an active registration (`approved` or `pending`), reject with `409 Conflict` (`ALREADY_REGISTERED`).
  3. **Event Status Check:** If event `status = 'cancelled'`, reject with `409 Conflict` (`EVENT_CANCELLED`).
  4. **Start Date Check:** If event already started (`starts_at <= NOW()`), reject with `409 Conflict` (`EVENT_STARTED`).
  5. **Deadline Check:** If registration deadline passed (`registration_deadline <= NOW()`), reject with `409 Conflict` (`DEADLINE_PASSED`).
  6. **Capacity Check:** If `approved_count >= capacity`, reject with `409 Conflict` (`EVENT_FULL`).
  7. **Status Assignment:**
     - If `requires_approval = 0`: Status becomes `'approved'`, reference code is generated (`PASS-XXXXXX`).
     - If `requires_approval = 1`: Status becomes `'pending'`, reference code is generated (`REQ-XXXXXX`).
  8. Commits transaction and creates notification for participant.
- **API Endpoint:** `POST /api/events/:id/register`
- **UI Test Selectors:** `register-submit-btn`, `register-btn-{id}`, `registration-ticket`, `ticket-ref-code`, `registration-stamp`.

---

### FR-008: Participant Registration Cancellation
- **User Story:** As a participant, I want to cancel my registration before an event starts so that my reserved seat is freed for other students.
- **Preconditions:** Authenticated user owns the registration.
- **Business Logic:**
  1. Verifies that `starts_at > NOW()`. If event has already started, reject with `400 Bad Request` (`EVENT_ALREADY_STARTED`).
  2. Sets registration `status = 'cancelled'`.
  3. Releases seat allocation immediately.
- **API Endpoint:** `POST /api/events/:id/cancel`
- **UI Test Selectors:** `cancel-ticket-btn-{id}`, `dialog-confirm`, `dialog-cancel`.

---

### FR-009: Organizer Event Creation
- **User Story:** As an organizer, I want to create new campus events with custom capacity and approval rules.
- **Preconditions:** Authenticated user has role `organizer` or `admin`.
- **Inputs & Validation:**
  - `title`: String, 5-120 chars.
  - `description`: String, 20-2000 chars.
  - `category`: Enum (`Academic`, `Sports`, `Arts & Culture`, `Career & Networking`, `Community & Service`, `Technology & STEM`).
  - `venue`: String, 3-120 chars.
  - `starts_at`: Valid ISO datetime string.
  - `ends_at`: Valid ISO datetime string, strictly `> starts_at`.
  - `registration_deadline`: Valid ISO datetime string, strictly `<= starts_at`.
  - `capacity`: Integer, 1 to 1000.
  - `requires_approval`: Boolean / Integer (0 or 1).
- **Business Logic:**
  - Inserts event with `organizer_id = req.user.id` and `status = 'published'`.
- **API Endpoint:** `POST /api/events`
- **UI Test Selectors:** `create-event-btn`, `event-form-title`, `event-form-description`, `event-form-category`, `event-form-venue`, `event-form-starts-at`, `event-form-ends-at`, `event-form-deadline`, `event-form-capacity`, `event-form-requires-approval`, `save-event-submit`.

---

### FR-010: Organizer Event Modification
- **User Story:** As an organizer, I want to edit details of my own events without violating capacity commitments.
- **Preconditions:** User is the event owner or `admin`.
- **Business Logic:**
  1. Validates ownership via `requireEventOwnership` middleware.
  2. Validates new `capacity`: Must not be lower than current `approved_count + pending_count`. If lower, rejects with `422 Unprocessable Entity` (`CAPACITY_BELOW_BOOKED`).
  3. Validates date chronological constraints.
  4. Automatically dispatches in-app notification to all registered attendees notifying them of the update.
- **API Endpoint:** `PUT /api/events/:id` / `PATCH /api/events/:id`
- **UI Test Selectors:** `edit-event-btn-{id}`, `event-form-capacity`, `field-error-capacity`, `save-event-submit`.

---

### FR-011: Event Deletion and Cancellation Rules
- **User Story:** As an organizer, I want to delete unbooked events or cancel booked events safely.
- **Preconditions:** User is event owner or `admin`.
- **Business Logic:**
  1. If event has `0` registrations: Hard deletes event record from `events` table (`200 OK`, message: `"Event deleted successfully."`).
  2. If event has `>= 1` registrations: Soft cancels event by updating `status = 'cancelled'`. Dispatches cancellation notification to all registered attendees.
- **API Endpoint:** `DELETE /api/events/:id`
- **UI Test Selectors:** `delete-event-btn-{id}`, `dialog-confirm`.

---

### FR-012: Registration Approval & Rejection Decisions
- **User Story:** As an organizer, I want to review, approve, or reject pending registration requests for gated events.
- **Preconditions:** User owns event; registration is currently in `status = 'pending'`.
- **Inputs:** `decision: 'approve' | 'reject'`.
- **Business Logic:**
  1. If `approve`: Checks if `approved_count < capacity`. If full, rejects with `409 Conflict` (`EVENT_FULL`). Otherwise updates registration to `'approved'`.
  2. If `reject`: Updates registration to `'rejected'`.
  3. Dispatches notification to participant informing them of the decision.
- **API Endpoint:** `POST /api/events/:id/registrations/:regId/decision`
- **UI Test Selectors:** `decision-row-{id}`, `approve-btn-{id}`, `reject-btn-{id}`.

---

### FR-013: In-App Notification Center
- **User Story:** As a participant, I want to receive real-time notifications about my ticket approvals, rejections, event edits, and event cancellations.
- **Preconditions:** Authenticated user.
- **Business Logic:**
  1. Lists user notifications sorted by `created_at DESC`.
  2. Provides unread count badge in header.
  3. Endpoints to mark individual notifications as read or mark all notifications as read.
- **API Endpoints:**
  - `GET /api/notifications`
  - `PATCH /api/notifications/:id/read`
  - `POST /api/notifications/read-all`
- **UI Test Selectors:** `notifications-badge`, `notification-item-{id}`, `mark-all-read-btn`, `mark-read-btn-{id}`.

---

### FR-014: Role-Specific Dashboards
- **User Story:** As an authenticated user, I want a dedicated dashboard tailored to my role.
- **Business Logic:**
  - **Participant (`/dashboard`):** Displays active tickets and past tickets with status badges and reference codes.
  - **Organizer (`/organizer`):** Displays "Needs your decision" queue on top and a dense table of organizer's events with seat strips and action buttons.
  - **Admin (`/admin`):** Displays administrative controls and user directory.
- **API Endpoints:**
  - `GET /api/events/my-tickets`
  - `GET /api/events/organizer-dashboard`
  - `GET /api/users`
- **UI Test Selectors:** `dashboard-title`, `organizer-dashboard-title`, `admin-title`.

---

### FR-015: Attendee Roster Viewer & CSV Export
- **User Story:** As an organizer, I want to view the list of registered attendees and export it as a CSV file for check-in.
- **Preconditions:** User owns event or is `admin`.
- **Business Logic:**
  1. `GET /api/events/:id/attendees`: Returns JSON array of attendees (`full_name`, `school_id`, `email`, `status`, `registered_at`, `reference_code`).
  2. `GET /api/events/:id/attendees/csv`: Returns formatted CSV file with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="attendees-event-{id}.csv"`.
- **UI Test Selectors:** `view-attendees-btn-{id}`, `export-csv-btn`.

---

### FR-016: User Administration & Access Control
- **User Story:** As an administrator, I want to search users, update their roles, and toggle account activation status.
- **Preconditions:** User has `role = 'admin'`.
- **Inputs & Logic:**
  1. List and search users with pagination.
  2. Update role to `participant`, `organizer`, or `admin`.
  3. Toggle `is_active` (`1` = active, `0` = deactivated). Deactivated users are blocked from logging in.
- **API Endpoints:**
  - `GET /api/users?keyword=...&role=...&is_active=...`
  - `PATCH /api/users/:id`
- **UI Test Selectors:** `admin-search-input`, `admin-role-filter`, `admin-status-filter`, `user-row-{id}`, `role-select-{id}`, `toggle-status-btn-{id}`.

---

## 5. Non-Functional Requirements (NFR-001 to NFR-009)

| ID | Dimension | Target Specification | Verification Method |
|---|---|---|---|
| **NFR-001** | Performance | API endpoints respond in `< 500 ms` under standard load; paginated lists default to 12 items. | Benchmark tests on `/api/events` and `/api/events/:id`. |
| **NFR-002** | Security | Passwords hashed with bcrypt (cost 12); sessions via signed JWT in `httpOnly` `SameSite=Lax` cookies; generic login failure messages; RBAC enforcement. | Security audit, cookie inspection, auth penetration tests. |
| **NFR-003** | Usability | Pass claiming within 3 clicks; descriptive error messages indicating the exact constraint and remediation. | User journey evaluation from `/` to ticket generation. |
| **NFR-004** | Reliability & Concurrency | Transactional locking (`SELECT ... FOR UPDATE`) prevents overbooking; centralized error format `{ error: { code, message, fields } }`. | Concurrent pass claim test scripts. |
| **NFR-005** | Availability & Health | `GET /api/health` reports status of API and database; dedicated `/system-down` page on network or DB failure. | Simulated DB disconnect and health probe test. |
| **NFR-006** | Compatibility | Full responsive compatibility across modern browsers (Chrome, Edge, Firefox, Safari) from 360px to 1440px+. | Viewport resizing and multi-browser rendering. |
| **NFR-007** | Maintainability | Clean, plain JavaScript codebase with zero TypeScript overhead, straightforward modular structure, and clear separation of concerns. | Code review and module dependency check. |
| **NFR-008** | Scalability | Indexed foreign keys and search columns; stateless API authentication model. | Database index analysis on `schema.sql`. |
| **NFR-009** | Accessibility | WCAG 2.1 Level AA color contrast (>= 4.5:1), visible focus rings, aria-live alerts, semantic HTML landmarks. | Automated accessibility audit (Lighthouse / axe-core). |

---

## 6. Data Entity Model & Schema Specification

```sql
-- Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  school_id VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('participant', 'organizer', 'admin') NOT NULL DEFAULT 'participant',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active)
);

-- Events Table
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('Academic', 'Sports', 'Arts & Culture', 'Career & Networking', 'Community & Service', 'Technology & STEM') NOT NULL,
  venue VARCHAR(150) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  registration_deadline DATETIME NOT NULL,
  capacity INT NOT NULL,
  requires_approval TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('published', 'cancelled') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_events_starts_at (starts_at),
  INDEX idx_events_status (status),
  INDEX idx_events_category (category)
);

-- Registrations Table
CREATE TABLE registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  reference_code VARCHAR(32) NOT NULL UNIQUE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uniq_event_user (event_id, user_id),
  INDEX idx_reg_event (event_id),
  INDEX idx_reg_user (user_id)
);

-- Notifications Table
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('approval', 'rejection', 'event_update', 'event_cancellation', 'general') NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user_read (user_id, is_read)
);
```

---

## 7. Error Handling & HTTP Status Code Matrix

| Error Code | HTTP Status | Trigger Condition | Error Message |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | Form schema parsing fails in Zod. | "The submitted form contains invalid or missing data. Please review the highlighted fields." |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token. | "Authentication is required. Please log in to continue." |
| `INVALID_CREDENTIALS` | 401 | Username/password mismatch on login. | "Invalid username or password. Please verify your credentials and try again." |
| `FORBIDDEN` | 403 | Role lacks required permission. | "Access denied. This action requires one of the following roles: [roles]." |
| `ACCOUNT_DEACTIVATED` | 403 | User account has `is_active = 0`. | "Your student account has been suspended or deactivated. Please contact Student Affairs." |
| `EVENT_NOT_FOUND` | 404 | Event ID does not match any record. | "The requested event does not exist." |
| `ALREADY_REGISTERED` | 409 | User attempts duplicate registration. | "You already have an active registration for this event." |
| `EVENT_FULL` | 409 | Capacity limit reached on registration. | "This event has reached its maximum seat capacity." |
| `DEADLINE_PASSED` | 409 | Registration attempted after deadline. | "The registration deadline for this event has passed." |
| `EVENT_STARTED` | 409 | Registration attempted after start time. | "Registration is closed because this event has already started." |
| `ACCOUNT_CONFLICT` | 409 | Duplicate username, email, or school ID. | "One or more credentials are already registered." |
| `CAPACITY_BELOW_BOOKED`| 422 | Organizer lowers capacity below bookings. | "Event capacity cannot be lowered below the number of registered attendees ([count])." |
| `INTERNAL_SERVER_ERROR`| 500 | Unhandled server exception. | "An internal server error occurred. Please try your request again later." |
