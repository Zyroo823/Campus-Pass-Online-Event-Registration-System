/**
 * Database Reset and Seed Script
 * FR-001, FR-002, FR-004, FR-006, FR-007, FR-012, FR-013, FR-016
 * Run via: npm run db:reset or node server/reset.js
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {
  generateSeedUsers,
  generateSeedEvents,
  generateSeedRegistrations,
  generateSeedNotifications,
} from './seed-data.js';
import { resetInMemoryDb } from './db.js';

dotenv.config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'campus_events';
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'University of Cebu - Mandaue';

export async function runReset() {
  console.log('----------------------------------------------------');
  console.log(`[db:reset] Starting database reset for ${SCHOOL_NAME}...`);
  console.log(`[db:reset] Target: MySQL at ${DB_HOST}:${DB_PORT}, database: ${DB_NAME}`);

  try {
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
      connectTimeout: 3000,
    });

    console.log('[db:reset] Connected to MySQL server.');

    const schemaPath = path.resolve(process.cwd(), 'server/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      console.log('[db:reset] Executing schema.sql...');
      await conn.query(sql);
    }

    await conn.query(`USE \`${DB_NAME}\``);

    console.log('[db:reset] Seeding users with bcrypt cost 12...');
    const users = await generateSeedUsers();
    for (const u of users) {
      await conn.execute(
        `INSERT INTO users (username, email, full_name, school_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.username, u.email, u.full_name, u.school_id, u.password_hash, u.role, u.is_active]
      );
    }

    console.log('[db:reset] Seeding 20 events with dynamic dates...');
    const events = generateSeedEvents();
    for (const e of events) {
      await conn.execute(
        `INSERT INTO events (organizer_id, title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, requires_approval, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.organizer_id, e.title, e.description, e.category, e.venue, e.starts_at, e.ends_at, e.registration_deadline, e.capacity, e.requires_approval, e.status]
      );
    }

    console.log('[db:reset] Seeding registrations...');
    const registrations = generateSeedRegistrations();
    for (const r of registrations) {
      await conn.execute(
        `INSERT INTO registrations (event_id, user_id, status, registered_at, decided_at)
         VALUES (?, ?, ?, ?, ?)`,
        [r.event_id, r.user_id, r.status, r.registered_at, r.decided_at]
      );
    }

    console.log('[db:reset] Seeding in-app notifications...');
    const notifications = generateSeedNotifications();
    for (const n of notifications) {
      await conn.execute(
        `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [n.user_id, n.type, n.message, n.event_id, n.is_read, n.created_at]
      );
    }

    await conn.end();
    console.log('[db:reset] SUCCESS: MySQL database reset and seeded.');
  } catch (err) {
    console.log(`[db:reset] Notice: MySQL server connection error (${err.message}).`);
    console.log('[db:reset] Resetting in-memory test database store instead...');
    await resetInMemoryDb();
    console.log('[db:reset] SUCCESS: In-memory STLC test database reset and seeded.');
  }

  console.log('----------------------------------------------------');
  console.log('Default credentials for testing:');
  console.log('Password (all accounts): Test@1234');
  console.log('- Admin: admin01');
  console.log('- Organizers: organizer01, organizer02');
  console.log('- Students: student01 to student12 (student12 is deactivated)');
  console.log('----------------------------------------------------');
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('reset.js')) {
  runReset().catch(err => {
    console.error('[db:reset] Fatal error during reset:', err);
    process.exit(1);
  });
}
