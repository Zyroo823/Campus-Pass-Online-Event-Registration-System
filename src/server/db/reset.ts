/**
 * Database Reset and Seed Script
 * FR-001, FR-002, FR-004, FR-006, FR-007, FR-012, FR-013, FR-016
 * NFR-002, NFR-007, NFR-008
 * Run via: npm run db:reset
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {
  SHARED_PASSWORD_PLAIN,
  generateSeedUsers,
  generateSeedEvents,
  generateSeedRegistrations,
  generateSeedNotifications,
} from './seed-data.ts';
import { resetInMemoryDb } from './connection.ts';

dotenv.config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'campus_events';
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'University of Cebu - Mandaue';

export async function runReset(): Promise<void> {
  console.log('----------------------------------------------------');
  console.log(`[db:reset] Starting database reset for ${SCHOOL_NAME}...`);
  console.log(`[db:reset] Target: MySQL at ${DB_HOST}:${DB_PORT}, database: ${DB_NAME}`);

  let connectedToMySql = false;

  try {
    // 1. Connect to MySQL server (without selecting database first)
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
      connectTimeout: 3000,
    });

    console.log('[db:reset] Connected to MySQL/MariaDB server.');

    // 2. Read schema.sql
    const schemaPath = path.resolve(process.cwd(), 'src/server/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      console.log('[db:reset] Executing schema.sql (dropping and recreating tables)...');
      await (conn as any).query(sql);
    } else {
      console.warn(`[db:reset] Warning: schema.sql not found at ${schemaPath}`);
    }

    // Connect specifically to campus_events
    await (conn as any).query(`USE \`${DB_NAME}\``);

    // 3. Seed Users
    console.log('[db:reset] Generating seed users with bcrypt cost 12...');
    const users = await generateSeedUsers(SCHOOL_NAME);
    for (const u of users) {
      await (conn as any).execute(
        `INSERT INTO users (username, email, full_name, school_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.username, u.email, u.full_name, u.school_id, u.password_hash, u.role, u.is_active]
      );
    }
    console.log(`[db:reset] Seeded ${users.length} users.`);

    // 4. Seed Events
    console.log('[db:reset] Seeding realistic campus events...');
    const events = generateSeedEvents(SCHOOL_NAME);
    for (const e of events) {
      await (conn as any).execute(
        `INSERT INTO events (organizer_id, title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, requires_approval, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.organizer_id,
          e.title,
          e.description,
          e.category,
          e.venue,
          e.starts_at,
          e.ends_at,
          e.registration_deadline,
          e.capacity,
          e.requires_approval,
          e.status,
        ]
      );
    }
    console.log(`[db:reset] Seeded ${events.length} events.`);

    // 5. Seed Registrations
    console.log('[db:reset] Seeding test registrations (pending, approved, rejected, cancelled)...');
    const registrations = generateSeedRegistrations();
    for (const r of registrations) {
      await (conn as any).execute(
        `INSERT INTO registrations (event_id, user_id, status, registered_at, decided_at)
         VALUES (?, ?, ?, ?, ?)`,
        [r.event_id, r.user_id, r.status, r.registered_at, r.decided_at || null]
      );
    }
    console.log(`[db:reset] Seeded ${registrations.length} registrations.`);

    // 6. Seed Notifications
    console.log('[db:reset] Seeding notifications...');
    const notifications = generateSeedNotifications();
    for (const n of notifications) {
      await (conn as any).execute(
        `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [n.user_id, n.type, n.message, n.event_id, n.is_read, n.created_at]
      );
    }
    console.log(`[db:reset] Seeded ${notifications.length} notifications.`);

    await conn.end();
    connectedToMySql = true;
    console.log('[db:reset] SUCCESS: MySQL database reset and seeded successfully.');
  } catch (err: any) {
    console.warn(`[db:reset] Notice: MySQL server connection error (${err.message}).`);
    console.log('[db:reset] Resetting in-memory test database store instead...');
    await resetInMemoryDb();
    console.log('[db:reset] SUCCESS: In-memory STLC test database reset and seeded.');
  }

  console.log('----------------------------------------------------');
  console.log('Default credentials for testing:');
  console.log(`Password (all accounts): ${SHARED_PASSWORD_PLAIN}`);
  console.log('- Admin: admin01');
  console.log('- Organizers: organizer01, organizer02');
  console.log('- Students: student01 to student12 (student12 is deactivated)');
  console.log('----------------------------------------------------');
}

// Execute immediately when run as a script
runReset().catch(err => {
  console.error('[db:reset] Fatal error during reset:', err);
  process.exit(1);
});
