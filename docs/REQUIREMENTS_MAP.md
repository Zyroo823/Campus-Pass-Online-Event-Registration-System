# STLC Requirement Traceability Matrix (RTM)

This document maps all Functional Requirements (**FR-001** to **FR-016**) and Non-Functional Requirements (**NFR-001** to **NFR-009**) of the **CampusPass Online Event Registration System** to the exact UI routes, API endpoints, test selectors (`data-testid`), and deterministic seed data for Software Quality & Testing verification.

---

## 1. Functional Requirements Traceability

| Requirement ID | Priority | Description | UI Route / Component | API Endpoint | Selectors / `data-testid` | Seed Data for Testing |
|---|---|---|---|---|---|---|
| **FR-001** | High | Visitor can create a participant account | `/register` (`RegisterPage.tsx`) | `POST /api/auth/register` | `register-username`, `register-email`, `register-fullname`, `register-schoolid`, `register-password`, `register-confirm-password`, `register-submit`, `field-error-*` | Test with new user or duplicate `student01` / `student01@campus.edu` / `STU-2026-101` |
| **FR-002** | High | Registered users can log in | `/login` (`LoginPage.tsx`) | `POST /api/auth/login` | `login-username`, `login-password`, `login-submit`, `login-error-summary`, `field-error-*` | Any seeded user (e.g. `student01`, password `Test@1234`). Test deactivated `student12` |
| **FR-003** | High | Logged-in users can log out | Global Header (`Header.tsx`) | `POST /api/auth/logout` | `logout-button` | Any authenticated user session |
| **FR-004** | High | Display paginated list of upcoming events (default: starts in future; server-side ?when=upcoming\|past toggle) | `/` (`HomePage.tsx`) | `GET /api/events?when=upcoming\|past` | `page-title`, `when-toggle-upcoming`, `when-toggle-past`, `event-ended-label`, `event-card-{id}`, `pagination-prev`, `pagination-next` | 20 seeded events (default 12 per page, order by `starts_at ASC` for upcoming, `starts_at DESC` for past; dynamic dates relative to `NOW()`) |
| **FR-005** | Medium | Search events by keyword; filter by category, date range, seat availability | `/` (`EventFilters.tsx`) | `GET /api/events?keyword=...&category=...` | `search-input`, `filter-category`, `filter-start-date`, `filter-end-date`, `filter-available-only`, `reset-filters-btn` | Search "Codefest", filter category "Academic", filter "Seats available only" |
| **FR-006** | High | Display event details: schedule, venue, organizer, seats remaining | `/events/:id` (`EventDetailPage.tsx`) | `GET /api/events/:id` | `event-detail-title`, `event-description`, `event-starts-at`, `event-ends-at`, `event-deadline`, `event-venue`, `event-organizer-name`, `seats-remaining-text` | Event ID 1 (Colloquium), Event ID 4 (Workstation Lab), Event ID 3 (Blood Drive) |
| **FR-007** | High | Register for event (reject duplicate, full, past deadline; row lock transaction) | `/events/:id` (`EventDetailPage.tsx`) / Quick Register (`HomePage.tsx`) | `POST /api/events/:id/register` | `register-submit-btn`, `register-btn-{id}`, `registration-ticket`, `ticket-ref-code`, `registration-stamp` | • Open event: Event ID 2<br>• Full event: Event ID 4 (rejects with 409 `EVENT_FULL`)<br>• Past deadline: Event ID 5 (rejects with 409 `DEADLINE_PASSED`)<br>• Started: Event ID 6 (rejects with 409 `EVENT_STARTED`)<br>• Duplicate: Event ID 1 with `student01` (rejects with 409 `ALREADY_REGISTERED`) |
| **FR-008** | Medium | Participant cancels own registration before event starts | `/dashboard` (`ParticipantDashboardPage.tsx`) | `POST /api/events/:id/cancel` | `cancel-ticket-btn-{id}`, `dialog-confirm`, `dialog-cancel` | Login as `student01`, cancel ticket for Event ID 9 |
| **FR-009** | High | Organizers create events | `/organizer` (`OrganizerDashboardPage.tsx`) | `POST /api/events` | `create-event-btn`, `event-form-title`, `event-form-description`, `event-form-category`, `event-form-venue`, `event-form-starts-at`, `event-form-ends-at`, `event-form-deadline`, `event-form-capacity`, `event-form-requires-approval`, `save-event-submit` | Login as `organizer01` |
| **FR-010** | Medium | Organizers edit own events (capacity never below booked count) | `/organizer` (`OrganizerDashboardPage.tsx`) | `PUT /api/events/:id` | `edit-event-btn-{id}`, `event-form-capacity`, `field-error-capacity`, `save-event-submit` | Login as `organizer01`, edit Event ID 4 (capacity cannot be lowered below 2) |
| **FR-011** | Medium | Delete event if no registrations, or cancel if has registrations | `/organizer` (`OrganizerDashboardPage.tsx`) | `DELETE /api/events/:id` | `delete-event-btn-{id}`, `dialog-confirm` | • Delete event with 0 regs: Create temporary event and delete<br>• Cancel event with regs: Event ID 2 |
| **FR-012** | High | Organizers approve or reject pending registrations | `/organizer` (`OrganizerDashboardPage.tsx`) | `POST /api/events/:id/registrations/:regId/decision` | `decision-row-{id}`, `approve-btn-{id}`, `reject-btn-{id}` | Login as `organizer02`, observe pending queue for Event ID 3 (student01 and student02) |
| **FR-013** | Medium | In-app notifications when registration decided or event edited/cancelled | `/notifications` (`NotificationsPage.tsx`) / Header badge | `GET /api/notifications`, `PATCH /api/notifications/:id/read` | `notifications-badge`, `notification-item-{id}`, `mark-all-read-btn`, `mark-read-btn-{id}` | Login as `student01`, check notifications badge (seeded unread alerts) |
| **FR-014** | High | Role-specific dashboard after login | `/dashboard`, `/organizer`, `/admin` | `GET /api/events/my-tickets`, `GET /api/events/organizer-dashboard`, `GET /api/users` | `dashboard-title`, `organizer-dashboard-title`, `admin-title` | • Student: `student01` -> `/dashboard` (tickets grouped by week)<br>• Organizer: `organizer01` -> `/organizer` (dense table + decision queue)<br>• Admin: `admin01` -> `/admin` (dense user table) |
| **FR-015** | Medium | Organizer views attendee roster and exports as CSV | `/organizer` (`OrganizerDashboardPage.tsx`) | `GET /api/events/:id/attendees`, `GET /api/events/:id/attendees/csv` | `view-attendees-btn-{id}`, `export-csv-btn` | Login as `organizer01`, click attendee roster on Event ID 1, export CSV |
| **FR-016** | Medium | Admin lists, searches, changes role of, and deactivates users | `/admin` (`AdminDashboardPage.tsx`) | `GET /api/users`, `PATCH /api/users/:id` | `admin-search-input`, `admin-role-filter`, `admin-status-filter`, `user-row-{id}`, `role-select-{id}`, `toggle-status-btn-{id}` | Login as `admin01`. Search `student12` (deactivated), toggle status, promote `student03` to `organizer` |

---

## 2. Non-Functional Requirements Traceability

| Requirement ID | Category | Requirement Detail | Implementation Evidence & Verification |
|---|---|---|---|
| **NFR-001** | Performance | List & detail endpoints respond under 500 ms with seed data; server-side pagination (default 12). | `src/server/services/event.service.ts` (`LIMIT 12 OFFSET ?`). Seed index optimization on `starts_at`, `status`, `category`. |
| **NFR-002** | Security | bcrypt cost 12; JWT in httpOnly SameSite=Lax cookie (2hr); role check middleware; event ownership check; helmet; CORS origin limited; generic login failure message. | • `src/server/services/auth.service.ts`: `BCRYPT_COST = 12`<br>• `src/server/controllers/auth.controller.ts`: `httpOnly: true, sameSite: 'lax', maxAge: 2 * 3600 * 1000`<br>• `src/server/middleware/auth.middleware.ts`: `requireRole(...)`, `requireEventOwnership(...)`<br>• `server.ts`: `helmet()`, `cors({ origin, credentials: true })`<br>• Generic login error: "Invalid username or password. Please verify your credentials and try again." |
| **NFR-003** | Usability | Visitor to registered in 3 clicks or fewer; every error says what is wrong and how to fix it. | • Click 1: Home page event card "Claim Pass"<br>• Click 2: "Sign In" (if guest) or immediate registration modal<br>• Click 3: Confirmed with pass code.<br>• All field errors explicitly describe the constraint and corrective action. |
| **NFR-004** | Reliability | DB transaction with row lock (`SELECT ... FOR UPDATE`) so concurrent requests never exceed capacity; consistent JSON error format; no stack traces to client. | • `src/server/services/event.service.ts`: `SELECT ... FOR UPDATE` with `conn.beginTransaction()` and `conn.commit()`<br>• `src/server/middleware/error.middleware.ts`: Consistent shape `{ error: { code, message, fields } }`. No stack traces printed in production responses. |
| **NFR-005** | Availability | `GET /api/health` reports API and DB status; UI shows clear page when API or DB is down. | • `src/server/routes/health.routes.ts`: `GET /api/health`<br>• `src/pages/SystemDownPage.tsx`: Dedicated full-screen diagnostic page with retry action.<br>• `Footer.tsx`: Live system health indicator badge. |
| **NFR-006** | Compatibility | Chrome, Firefox, Edge; responsive from 360 px to 1440 px. | Flexbox/CSS Grid layouts tested from mobile viewports (360px) to ultra-wide (1440px). Tickets stack vertically on mobile, perforation turns horizontal. |
| **NFR-007** | Maintainability | Split into routes / controllers / services / validators / components / hooks / lib; `.env.example`; no dead code; FR/NFR IDs in comments. | Architectural separation: `src/server/` and `src/` modular layout; clean TypeScript code; all FR/NFR markers tagged in source. |
| **NFR-008** | Scalability | Indexes on foreign keys and search columns; stateless API (no in-memory sessions). | `schema.sql`: indexes on `idx_users_role`, `idx_events_starts_at`, `idx_events_status`, `idx_reg_event`, `idx_reg_user`, `idx_notifications_user_read`. JWT in cookies. |
| **NFR-009** | Accessibility | WCAG 2.1 AA contrast (>=4.5:1 on paper background using darker ink tone #38342B), minimum 12px for mono labels and 14px for body text, decorative seat strip aria-hidden with accessible text, visible focus rings, keyboard-operable, aria-live for errors and toasts, prefers-reduced-motion respected. | • `src/index.css`: WCAG AA colors, `focus-visible` with 2px vermilion offset, `@media (prefers-reduced-motion: reduce)` disabling CSS stamp animation.<br>• `SeatStrip.tsx`: decorative squares `aria-hidden="true"`, readable seats remaining text.<br>• `ToastContext.tsx`: `aria-live="polite"`<br>• Semantic landmarks `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`. |

---

## 3. Seed Accounts Catalog

Shared Password for all seeded accounts: `Test@1234`

| Username | Role | Full Name | School ID | Email | Status |
|---|---|---|---|---|---|
| `admin01` | `admin` | Engr. Danilo B. Cabahug (Dean of Student Affairs) | `ADM-2024-001` | `admin01@uc.edu.ph` | Active |
| `organizer01` | `organizer` | Prof. Maria Theresa Gomez (College of Computer Studies) | `FAC-2024-101` | `organizer01@uc.edu.ph` | Active |
| `organizer02` | `organizer` | Joshua Neil Alcantara (Supreme Student Council President) | `STU-2024-201` | `organizer02@uc.edu.ph` | Active |
| `student01` | `participant` | Amara D. Mendoza | `26-10201-M` | `student01@uc.edu.ph` | Active |
| `student02` | `participant` | Liam Kyle Fernandez | `26-10202-M` | `student02@uc.edu.ph` | Active |
| `student03` | `participant` | Sofia Isabelle Tan | `26-10203-M` | `student03@uc.edu.ph` | Active |
| `student04` | `participant` | Kenji Paolo Yap | `26-10204-M` | `student04@uc.edu.ph` | Active |
| `student05` | `participant` | Fatima Joyce Suico | `26-10205-M` | `student05@uc.edu.ph` | Active |
| `student06` | `participant` | Lucas Gabriel Ouano | `26-10206-M` | `student06@uc.edu.ph` | Active |
| `student07` | `participant` | Maya Patricia Cortes | `26-10207-M` | `student07@uc.edu.ph` | Active |
| `student08` | `participant` | Nathaniel James Echavez | `26-10208-M` | `student08@uc.edu.ph` | Active |
| `student09` | `participant` | Zoe Marie Villamor | `26-10209-M` | `student09@uc.edu.ph` | Active |
| `student10` | `participant` | Ethan Matthew Seno | `26-10210-M` | `student10@uc.edu.ph` | Active |
| `student11` | `participant` | Hannah Mae Ceniza | `26-10211-M` | `student11@uc.edu.ph` | Active |
| `student12` | `participant` | David Christian Dabon | `26-10212-M` | `student12@uc.edu.ph` | **Deactivated** (for testing) |

---

## 4. Special-Case Test Events

| Event ID | Event Title | Category | Special Condition Under Test | Expected Behavior |
|---|---|---|---|---|
| **1** | Annual Research Colloquium | Academic | Open event with existing approved & cancelled registrations | Normal registration, seats decremented |
| **3** | Voluntary Blood Donation Drive | Community & Service | `requires_approval = 1` | Registration status set to `pending`. Appears in Organizer decision queue. |
| **4** | Advanced Marine Simulator Masterclass | Technology & STEM | **FULL (capacity 2, filled with 2 approved registrations)** | "FULL" rotated stamp. Registration rejected with 409 `EVENT_FULL`. |
| **5** | Inter-Collegiate Parliamentary Debate Briefing | Academic | **Registration deadline passed** (`NOW() - 1 DAY`) | Registration rejected with 409 `DEADLINE_PASSED`. |
| **6** | Robotics Prototyping Workshop | Technology & STEM | **Already started** (`NOW() - 2 HOURS`) | Registration rejected with 409 `EVENT_STARTED`. |
| **7** | Charity 5K Fun Run | Sports | **Cancelled by organizer** | Rotated CANCELLED stamp. Registration rejected with 409 `EVENT_CANCELLED`. |
| **8** | First Semester Freshmen Orientation | Community & Service | **Ended event in past** (`NOW() - 14 DAYS`) | Read-only in Past events toggle; displays Ended label (`event-ended-label`). |
| **9** | Collegiate Leadership Roundtable | Career & Networking | **Ended event in past** (`NOW() - 7 DAYS`) | Read-only in Past events toggle; displays Ended label (`event-ended-label`). |
