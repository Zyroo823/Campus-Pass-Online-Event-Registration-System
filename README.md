# CampusPass: Online Event Registration System

CampusPass is a full-stack web application designed for school event registration. It serves as the **System Under Test (SUT)** for a Software Quality & Testing (STLC) group project, built with high traceability, deterministic test seed data, and comprehensive test selectors (`data-testid`).

---

## 1. Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **Package Manager**: npm 9+
- **Database Backend**:
  - MySQL 8.0+ or MariaDB 10.4+ (compatible with XAMPP MySQL)
  - *Note*: If local MySQL is not running or unreachable, CampusPass automatically activates an in-memory SQL execution engine loaded with the seed data so developers and testers can verify all 16 FRs without local database setup.

---

## 2. Environment Configuration

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

## 3. Database Initialization & Reset

Run the single-command reset script to drop, recreate tables, and seed all test accounts, events, registrations, and notifications:

```bash
npm run db:reset
```

This runs `src/server/db/reset.ts`, which:
1. Executes `src/server/db/schema.sql` against MySQL/MariaDB.
2. Generates bcrypt hashes (cost 12) for all users with the shared password `Test@1234`.
3. Seeds 20 realistic campus events covering all testing edge cases.
4. Seeds registrations across all 4 statuses (`pending`, `approved`, `rejected`, `cancelled`).

---

## 4. Running the Application

Start the unified development server:
```bash
npm run dev
```

The Express API and Vite React frontend are mounted together on:
```
http://localhost:3000
```

---

## 5. Seeded Accounts Catalog

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

## 6. Special-Case Test Events

| ID | Title | Test Condition Under Test | Expected Behavior |
|---|---|---|---|
| **1** | Annual Research Colloquium | Open event with existing seats | Seats decrement on registration; pass reference code generated |
| **3** | Voluntary Blood Donation Drive | Requires organizer approval (`requires_approval = 1`) | Status set to `pending`; appears in Organizer decision queue |
| **4** | Advanced Marine Simulator Masterclass | **FULL EVENT (capacity 2, 2 approved)** | Rotated FULL stamp; registration rejected with 409 `EVENT_FULL` |
| **5** | Inter-Collegiate Parliamentary Debate Briefing | **Deadline in the past** (`NOW() - 1 DAY`) | Registration rejected with 409 `DEADLINE_PASSED` |
| **6** | Robotics Prototyping Workshop | **Already started** (`NOW() - 2 HOURS`) | Registration rejected with 409 `EVENT_STARTED` |
| **7** | Charity 5K Fun Run | **Cancelled event** | Rotated CANCELLED stamp; registration rejected with 409 `EVENT_CANCELLED` |
| **8** | First Semester Freshmen Orientation | **Ended event in past** (`NOW() - 14 DAYS`) | Read-only in Past events toggle; displays Ended label |
| **9** | Collegiate Leadership Roundtable | **Ended event in past** (`NOW() - 7 DAYS`) | Read-only in Past events toggle; displays Ended label |

---

## 7. Requirement Traceability Matrix (RTM)

A complete mapping from every Functional Requirement (**FR-001** through **FR-016**) and Non-Functional Requirement (**NFR-001** through **NFR-009**) to UI routes, API endpoints, test selectors (`data-testid`), and test data is documented in:
```
docs/REQUIREMENTS_MAP.md
```

---

## 8. Library Justification

Only explicitly allowed libraries are utilized:
- **`zod`**: Schema validation on client and server to guarantee identical validation rules and prevent injection.
- **`bcrypt`**: Password hashing enforced at cost 12 (NFR-002).
- **`jsonwebtoken`**: Stateless session token generation for 2-hour cookie storage (NFR-002, NFR-008).
- **`cookie-parser`**: Parses secure httpOnly cookies.
- **`helmet`**: Security headers injection (NFR-002).
- **`cors`**: Origin-restricted Cross-Origin Resource Sharing.
- **`express-rate-limit`**: Enforces per-endpoint request throttling with live client countdown headers.
- **`dotenv`**: Environment variable loading.
- **`mysql2`**: Parameterized MySQL/MariaDB database driver (NFR-004, NFR-008).
- **`react-router-dom`**: Client-side routing with role-gated guards.
- **`lucide-react`**: Accessible icons for status and landmarks.
- **`concurrently`**: Concurrently orchestrates build/development workflows.
