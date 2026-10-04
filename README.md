# CampusPass: Online Event Registration System

CampusPass is a full-stack web application designed for school event registration. Written in **plain JavaScript** with a clean and simple structure, it serves as the **System Under Test (SUT)** for a Software Quality & Testing (STLC) group project, built with high traceability, deterministic test seed data, and comprehensive test selectors (`data-testid`).

---

## 1. Project Directory Structure

```text
├── server/
│   ├── index.js              # Express app setup and static/Vite middleware
│   ├── db.js                 # MySQL connection pool and emulated fallback engine
│   ├── middleware.js         # Auth, role check, rate limiters, centralized error handler
│   ├── validators.js         # Zod input validation schemas
│   ├── reset.js              # Database reset and deterministic seeding runner
│   ├── schema.sql            # DDL for users, events, registrations, notifications
│   ├── seed-data.js          # Realistic seed records for STLC testing
│   └── routes/
│       ├── auth.js           # /api/auth (register, login, logout, me)
│       ├── events.js         # /api/events (list, filter, create, edit, delete)
│       ├── registrations.js  # /api/events (register, cancel, decisions, tickets)
│       ├── notifications.js  # /api/notifications (feed, read, read-all)
│       └── users.js          # /api/users (admin list, role update, toggle active)
├── src/
│   ├── api.js                # Shared client API fetcher (credentials: 'include')
│   ├── App.jsx               # Application root, routing, system down watcher
│   ├── main.jsx              # React DOM entry point
│   ├── index.css             # Tailwind CSS global styles
│   ├── context/
│   │   ├── AuthContext.jsx   # Single source of truth auth context
│   │   └── ToastContext.jsx  # Notification toast system
│   ├── pages/
│   │   ├── HomePage.jsx                 # Public event directory & filters
│   │   ├── EventDetailPage.jsx          # Event details & pass claiming
│   │   ├── LoginPage.jsx                # User authentication with rate countdown
│   │   ├── RegisterPage.jsx             # Participant registration
│   │   ├── ParticipantDashboardPage.jsx # Ticket management
│   │   ├── OrganizerDashboardPage.jsx   # Event management & decision queue
│   │   ├── AdminDashboardPage.jsx       # User administration
│   │   ├── NotificationsPage.jsx        # Notification center
│   │   ├── SystemDownPage.jsx           # Outage diagnostic screen
│   │   └── NotFoundPage.jsx             # 404 page
│   └── components/
│       ├── common/           # Header, Footer, SeatStrip, ConfirmDialog, etc.
│       └── events/           # EventTicketCard, EventFilters
├── docs/
│   ├── FRD.md                # Functional Requirements Document (complete specifications)
│   └── REQUIREMENTS_MAP.md   # STLC Requirement Traceability Matrix (FR/NFR)
├── vite.config.js            # Vite build configuration
└── package.json              # Scripts and dependencies (plain JavaScript only)
```

---

## 2. Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **Package Manager**: npm 9+
- **Database Backend**:
  - MySQL 8.0+ or MariaDB 10.4+ (compatible with XAMPP MySQL)
  - *Note*: If local MySQL is not running or unreachable, CampusPass automatically activates an in-memory SQL execution engine loaded with the seed data so developers and testers can verify all 16 FRs without local database setup.

---

## 3. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   # Windows (Command Prompt)
   copy .env.example .env

   # Windows (PowerShell) / macOS / Linux
   cp .env.example .env
   ```

2. Review `.env` parameters:
   ```ini
   PORT=3000
   SCHOOL_NAME="University of Cebu - LM Campus"
   APP_TIMEZONE="Asia/Manila"
   APP_URL="http://localhost:3000"
   JWT_SECRET="stlc-campus-pass-production-secret-key-super-secure-32chars"

   # MySQL Connection (XAMPP default: root with no password)
   DB_HOST="127.0.0.1"
   DB_PORT=3306
   DB_USER="root"
   DB_PASSWORD=""
   DB_NAME="campus_events"

   # Rate limits (tunable for fast STLC limit verification)
   RATE_LIMIT_GLOBAL_MAX=120
   RATE_LIMIT_LOGIN_MAX=5
   RATE_LIMIT_REGISTER_MAX=5
   RATE_LIMIT_EVENT_REGISTER_MAX=10
   RATE_LIMIT_EVENT_MUTATE_MAX=30

   # Demo Mode (displays "Demo Accounts" box on the sign-in screen when true; defaults to false)
   DEMO_MODE=false
   ```

---

## 4. Database Initialization & Reset

Run the reset script to drop, recreate tables, and seed all test accounts, events, registrations, and notifications:

```bash
npm run db:reset
```

This runs `server/reset.js`, which:
1. Executes `server/schema.sql` against MySQL/MariaDB (or in-memory fallback).
2. Generates bcrypt hashes (cost 12) for all users with the shared password `Test@1234`.
3. Seeds 20 realistic campus events covering all testing edge cases.
4. Seeds registrations across all 4 statuses (`pending`, `approved`, `rejected`, `cancelled`).

---

## 5. Running the Application

Start the unified development server:
```bash
npm run dev
```

The Express API and Vite React frontend are mounted together on:
```
http://localhost:3000
```

To build for production:
```bash
npm run build
npm start
```

---

## 6. Seeded Accounts Catalog

All accounts share the documented password: **`Test@1234`**

| Username | Role | Full Legal Name | School ID | Email | Notes |
|---|---|---|---|---|---|
| `admin01` | Admin | Engr. Danilo B. Cabahug (Dean) | `ADM-2024-001` | `admin01@uc.edu.ph` | Can promote roles and deactivate users |
| `organizer01` | Organizer | Prof. Maria Theresa Gomez (CCS) | `FAC-2024-101` | `organizer01@uc.edu.ph` | Owns events 1, 2, 4, 6, 9, 12, 15, 17, 18 |
| `organizer02` | Organizer | Joshua Neil Alcantara (SSC Pres) | `STU-2024-201` | `organizer02@uc.edu.ph` | Owns events 3, 5, 7, 8, 10, 11, 13, 14, 16, 19, 20 |
| `student01` | Participant | Amara D. Mendoza | `26-10201-M` | `student01@uc.edu.ph` | Has active passes and pending applications |
| `student02` | Participant | Liam Kyle Fernandez | `26-10202-M` | `student02@uc.edu.ph` | Has pending application for Event 3 |
| `student03` to `student11` | Participant | Various Students | `26-10203-M`+ | `studentNN@uc.edu.ph` | Available for multi-user test cases |
| `student12` | Participant | David Christian Dabon | `26-10212-M` | `student12@uc.edu.ph` | **Deactivated** (to test login block & admin reactivate) |

---

## 7. Requirement Traceability Matrix (RTM)

A complete mapping from every Functional Requirement (**FR-001** through **FR-016**) and Non-Functional Requirement (**NFR-001** through **NFR-009**) to UI routes, API endpoints, test selectors (`data-testid`), and test data is documented in:
```
docs/REQUIREMENTS_MAP.md
```
