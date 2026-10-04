# STLC Requirement Traceability Matrix (RTM)

This document maps all Functional Requirements (**FR-001** to **FR-016**) and Non-Functional Requirements (**NFR-001** to **NFR-009**) of the **CampusPass Online Event Registration System** to the exact UI routes, API endpoints, test selectors (`data-testid`), and deterministic seed data for Software Quality & Testing verification.

---

## 1. Functional Requirements Traceability

| Requirement ID | Priority | Description | UI Route / Component | API Endpoint | Selectors / `data-testid` | Seed Data for Testing |
|---|---|---|---|---|---|---|
| **FR-001** | High | Visitor can create a participant account (sign-up sets httpOnly auth cookie, logs user in, and validates session via GET /api/auth/me) | `/register` (`RegisterPage.jsx`) | `POST /api/auth/register` | `register-username`, `register-email`, `register-fullname`, `register-schoolid`, `register-password`, `register-confirm-password`, `register-submit`, `field-error-*` | Test with new user or duplicate `student01` / `student01@uc.edu.ph` / `26-10201-M` |
| **FR-002** | High | Registered users can log in | `/login` (`LoginPage.jsx`) | `POST /api/auth/login` | `login-username`, `login-password`, `login-submit`, `login-error-summary`, `field-error-*` | Any seeded user (e.g. `student01`, password `Test@1234`) |
| **FR-003** | High | Logged-in users can log out | Global Header (`Header.jsx`) | `POST /api/auth/logout` | `logout-button` | Any authenticated user session |
| **FR-004** | High | Display paginated list of upcoming events (default: starts in future after base; server-side ?when=upcoming\|past toggle) | `/` (`HomePage.jsx`) | `GET /api/events?when=upcoming\|past` | `page-title`, `when-toggle-upcoming`, `when-toggle-past`, `event-ended-label`, `event-card-{id}`, `pagination-prev`, `pagination-next` | 20 seeded events (default 12 per page, order by `starts_at ASC` for upcoming, `starts_at DESC` for past; dynamic dates relative to `NOW()` and `SEED_MIN_DATE`) |
| **FR-005** | Medium | Search events by keyword; filter by category, date range, seat availability | `/` (`EventFilters.jsx`) | `GET /api/events?keyword=...&category=...` | `search-input`, `filter-category`, `filter-start-date`, `filter-end-date`, `filter-available-only`, `reset-filters-btn` | Search "Codefest", filter category "Academic", filter "Seats available only" |
| **FR-006** | High | Display event details: schedule, venue, organizer, seats remaining, entrance fee (Free or formatted amount with notice: "Pay at the entrance. This site does not take payments.") | `/events/:id` (`EventDetailPage.jsx`), `/` (`EventTicketCard.jsx`) | `GET /api/events/:id` | `event-detail-title`, `event-description`, `event-starts-at`, `event-ends-at`, `event-deadline`, `event-venue`, `event-organizer-name`, `seats-remaining-text`, `event-fee-label` | • Free: Event ID 1 (Colloquium, Free)<br>• Fee: Event ID 2 (Codefest, ₱50.00), Event ID 4 (Masterclass, ₱150.00), Event ID 7 (Charity Run, ₱100.00), Event ID 11 (Recital, ₱250.00), Event ID 13 (Bootcamp, ₱500.00) |
| **FR-007** | High | Register for event (reject duplicate, full, past deadline; row lock transaction; claiming a pass right after sign-up works seamlessly without re-login) | `/events/:id` (`EventDetailPage.jsx`) / Quick Register (`HomePage.jsx`) | `POST /api/events/:id/register` | `register-submit-btn`, `register-btn-{id}`, `registration-ticket`, `ticket-ref-code`, `registration-stamp` | • Open event: Event ID 2<br>• Full event: Event ID 4 (rejects with 409 `EVENT_FULL`)<br>• Past deadline: Event ID 5 (rejects with 409 `DEADLINE_PASSED`)<br>• Started: Event ID 6 (rejects with 409 `EVENT_STARTED`)<br>• Duplicate: Event ID 1 with `student01` (rejects with 409 `ALREADY_REGISTERED`) |
| **FR-008** | Medium | Participant cancels own active registration (pending or approved) before event starts; seat freed immediately; ticket stamped CANCELLED; pass can be claimed again | `/dashboard` (`ParticipantDashboardPage.jsx`), `/events/:id` (`EventDetailPage.jsx`) | `PATCH /api/registrations/:id/cancel` | `cancel-pass-button`, `cancel-pass-dialog`, `cancel-pass-confirm`, `event-fee-label` | Login as `student01`, cancel ticket for Event ID 1 (`Annual Research Colloquium`) or Event ID 3 (`Voluntary Blood Donation Drive`) on `/dashboard` or `/events/1` |
| **FR-009** | High | Organizers create events with entrance fee validation (0 to 50,000, 2 decimals; blank = free) | `/organizer` (`OrganizerDashboardPage.jsx`) | `POST /api/events` | `create-event-btn`, `event-form-title`, `event-form-description`, `event-form-category`, `event-form-venue`, `event-form-starts-at`, `event-form-ends-at`, `event-form-deadline`, `event-form-capacity`, `event-fee`, `event-form-requires-approval`, `save-event-submit` | Login as `organizer01`. Create event with fee 150.00 |
| **FR-010** | Medium | Organizers edit own events (capacity never below booked count; fee changes trigger participant notifications) | `/organizer` (`OrganizerDashboardPage.jsx`) | `PUT /api/events/:id` | `edit-event-btn-{id}`, `event-form-capacity`, `event-fee`, `field-error-capacity`, `field-error-fee_amount`, `save-event-submit` | Login as `organizer01`, edit Event ID 4 (capacity cannot be lowered below 2; fee editable) |
| **FR-011** | Medium | Delete event if no registrations, or cancel if has registrations | `/organizer` (`OrganizerDashboardPage.jsx`) | `DELETE /api/events/:id` | `delete-event-btn-{id}`, `dialog-confirm` | • Delete event with 0 regs: Create temporary event and delete<br>• Cancel event with regs: Event ID 2 |
| **FR-012** | High | Organizers approve or reject pending registrations | `/organizer` (`OrganizerDashboardPage.jsx`) | `POST /api/events/:id/registrations/:regId/decision` | `decision-row-{id}`, `approve-btn-{id}`, `reject-btn-{id}` | Login as `organizer01`, observe pending queue for Event ID 3 (`student01` and `student02`) |
| **FR-013** | Medium | In-app notifications when registration decided or event edited/cancelled; mark single or mark all as read | `/notifications` (`NotificationsPage.jsx`) / Header badge | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` | `notifications-badge`, `notification-item-{id}`, `mark-all-read-button`, `mark-read-btn-{id}` | Login as `student01`, observe unread badge count (3), click `mark-all-read-button`, badge immediately disappears with toast and button disabled with `aria-disabled="true"` |
| **FR-014** | High | Role-specific dashboard after login | `/dashboard`, `/organizer`, `/admin` | `GET /api/events/my-tickets`, `GET /api/events/organizer-dashboard`, `GET /api/users` | `dashboard-title`, `organizer-dashboard-title`, `admin-title` | • Student: `student01` -> `/dashboard` (tickets grouped by week)<br>• Organizer: `organizer01` -> `/organizer` (dense table + decision queue)<br>• Admin: `admin01` -> `/admin` (dense user table) |
| **FR-015** | Medium | Organizer views attendee roster and exports as CSV with "Fee" column | `/organizer` (`OrganizerDashboardPage.jsx`) | `GET /api/events/:id/attendees`, `GET /api/events/:id/attendees/csv` | `view-attendees-btn-{id}`, `export-csv-btn` | Login as `organizer01`, click attendee roster on Event ID 1 or Event ID 2, export CSV (verifies `Fee` column) |
| **FR-016** | Medium | Admin lists, searches, edits name/details, changes role of, and deactivates users | `/admin` (`AdminDashboardPage.jsx`) | `GET /api/users`, `PATCH /api/users/:id` | `admin-search-input`, `admin-role-filter`, `admin-status-filter`, `user-row-{id}`, `edit-user-btn-{id}`, `edit-user-fullname`, `role-select-{id}`, `toggle-status-btn-{id}` | Login as `admin01`. Search `student04`, edit name/details, toggle status, promote `student03` to `organizer` |

---

## 2. Non-Functional Requirements Traceability

| Requirement ID | Category | Requirement Detail | Implementation Evidence & Verification |
|---|---|---|---|
| **NFR-001** | Performance | List & detail endpoints respond under 500 ms with seed data; server-side pagination (default 12). | `server/routes/events.js` (`LIMIT 12 OFFSET ?`). Seed index optimization on `starts_at`, `status`, `category`. |
| **NFR-002** | Security | bcrypt cost 12; JWT in httpOnly SameSite=Lax cookie (2hr); role check middleware; event ownership check; helmet; CORS origin limited; generic login failure message. | • `server/routes/auth.js`: `BCRYPT_COST = 12`<br>• `server/middleware.js`: `getAuthCookieOptions(req)` with `httpOnly: true`, `sameSite`, `maxAge: 2 * 3600 * 1000`<br>• `server/middleware.js`: `authenticate`, `requireRole(...)`, `requireEventOwnership(...)`<br>• `server/index.js`: `helmet()`, `cors({ origin, credentials: true })`<br>• Generic login error: "Invalid username or password. Please verify your credentials and try again." |
| **NFR-003** | Usability | Visitor to registered in 3 clicks or fewer; every error says what is wrong and how to fix it. | • Click 1: Home page event card "Claim Pass"<br>• Click 2: "Sign In" (if guest) or immediate registration modal<br>• Click 3: Confirmed with pass code.<br>• All field errors explicitly describe the constraint and corrective action. |
| **NFR-004** | Reliability | DB transaction with row lock (`SELECT ... FOR UPDATE`) so concurrent requests never exceed capacity; consistent JSON error format; no stack traces to client. | • `server/routes/registrations.js`: `SELECT ... FOR UPDATE` with `conn.beginTransaction()` and `conn.commit()`<br>• `server/middleware.js`: `errorHandler` with consistent shape `{ error: { code, message, fields } }`. No stack traces printed in client responses. |
| **NFR-005** | Availability | `GET /api/health` reports API and DB status; UI shows clear page when API or DB is down. | • `server/index.js`: `GET /api/health`<br>• `src/pages/SystemDownPage.jsx`: Dedicated diagnostic page with retry action.<br>• `Footer.jsx`: Live system health indicator badge. |
| **NFR-006** | Compatibility | Chrome, Firefox, Edge; responsive from 360 px to 1440 px. | Flexbox/CSS Grid layouts tested from mobile viewports (360px) to ultra-wide (1440px). Tickets stack vertically on mobile, perforation turns horizontal. |
| **NFR-007** | Maintainability | Plain JavaScript codebase with a simple, readable structure that any student can explain in one sitting. Split into server route files, shared middleware, validators, client pages, components, and one central api.js file. | Plain JavaScript only (no TypeScript, interfaces, or generics). Clean separation: `server/index.js`, `server/db.js`, `server/middleware.js`, `server/validators.js`, `server/routes/`, and `src/api.js`. All FR/NFR markers tagged in source. |
| **NFR-008** | Scalability | Indexes on foreign keys and search columns; stateless API (no in-memory sessions). | `server/schema.sql`: indexes on `idx_users_role`, `idx_events_starts_at`, `idx_events_status`, `idx_reg_event`, `idx_reg_user`, `idx_notifications_user_read`. JWT in cookies. |
| **NFR-009** | Accessibility | WCAG 2.1 AA contrast (>=4.5:1 on paper background using darker ink tone #38342B), minimum 12px for mono labels and 14px for body text, decorative seat strip aria-hidden with accessible text, visible focus rings, keyboard-operable, aria-live for errors and toasts, prefers-reduced-motion respected. | • `src/index.css`: WCAG AA colors, `focus-visible` with 2px vermilion offset, `@media (prefers-reduced-motion: reduce)` disabling CSS stamp animation.<br>• `SeatStrip.jsx`: decorative squares `aria-hidden="true"`, readable seats remaining text.<br>• `ToastContext.jsx`: `aria-live="polite"`<br>• Semantic landmarks `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`. |

---

## 3. Seed Accounts Catalog

Shared Password for all seeded accounts: `Test@1234`

| Username | Role | Full Name | School ID | Email | Status |
|---|---|---|---|---|---|
| `admin01` | `admin` | Engr. Danilo B. Cabahug (Dean of Student Affairs) | `ADM-2024-001` | `admin01@uc.edu.ph` | Active |
| `organizer01` | `organizer` | Prof. Maria Theresa Gomez (College of Computer Studies) | `FAC-2024-101` | `organizer01@uc.edu.ph` | Active |
| `student01` | `participant` | Amara D. Mendoza | `26-10201-M` | `student01@uc.edu.ph` | Active |
| `student02` | `participant` | Liam Kyle Fernandez | `26-10202-M` | `student02@uc.edu.ph` | Active |
| `student03` | `participant` | Sofia Isabelle Tan | `26-10203-M` | `student03@uc.edu.ph` | Active |
| `student04` | `participant` | Kenji Paolo Yap | `26-10204-M` | `student04@uc.edu.ph` | Active |

---

## 4. Test Scenarios and Automated Verification Paths

1. **Sign-up & Immediate Pass Claiming (FR-001, FR-007)**:
   - Register at `/register` -> creates user, sets HTTPOnly cookie, validates session on `GET /api/auth/me`.
   - Navigate to `/events/2` -> Click "Claim Pass" -> Returns 201 with ticket pass without re-login.

2. **Cancel Pass Flow (FR-008)**:
   - Login as `student01` -> Visit `/dashboard` or `/events/1`.
   - Click `data-testid="cancel-pass-button"`.
   - Dialog opens with `data-testid="cancel-pass-dialog"` naming the event.
   - Click `data-testid="cancel-pass-confirm"` -> sends `PATCH /api/registrations/:id/cancel`.
   - Seat count increments and ticket displays `CANCELLED` stamp with no remaining actions.

3. **Entrance Fee & Attendee Export (FR-006, FR-009, FR-010, FR-015)**:
   - Observe `data-testid="event-fee-label"` displaying "Free" or formatted currency (e.g. ₱50.00).
   - Login as `organizer01` -> Create/edit event using `data-testid="event-fee"`.
   - Click attendee list -> Export CSV -> Verify `Fee` column.

4. **Mark All Notifications as Read (FR-013)**:
   - Login as `student01` -> Visit `/notifications`.
   - Click `data-testid="mark-all-read-button"` -> sends `PATCH /api/notifications/read-all`.
   - All notifications marked read, header badge clears immediately, button becomes disabled with `aria-disabled="true"`.
