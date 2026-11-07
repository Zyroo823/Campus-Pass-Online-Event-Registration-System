/**
 * Database connection layer
 * NFR-004: DB transaction with row lock
 * NFR-005: Reports API and DB status
 * NFR-008: Parameterized queries only
 */

import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {
  generateSeedUsers,
  generateSeedEvents,
  generateSeedRegistrations,
  generateSeedNotifications,
} from './seed-data.js';

dotenv.config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'campus_events';

let currentDbMode = 'disconnected';
let realPool = null;

// Emulated store for reliable local demo and testing when MySQL is not running
let inMemTables = {
  users: [],
  events: [],
  registrations: [],
  notifications: [],
};

let userNextId = 1;
let eventNextId = 1;
let regNextId = 1;
let notifNextId = 1;

export async function resetInMemoryDb() {
  const users = await generateSeedUsers();
  const events = generateSeedEvents();
  const registrations = generateSeedRegistrations();
  const notifications = generateSeedNotifications();

  inMemTables.users = users.map((u, idx) => ({
    ...u,
    id: idx + 1,
    created_at: '2026-09-01 00:00:00',
  }));
  userNextId = inMemTables.users.length + 1;

  inMemTables.events = events.map((e, idx) => ({
    ...e,
    fee_amount: Number(e.fee_amount) || 0,
    id: idx + 1,
    created_at: '2026-09-05 00:00:00',
    updated_at: '2026-09-05 00:00:00',
  }));
  eventNextId = inMemTables.events.length + 1;

  inMemTables.registrations = registrations.map((r, idx) => ({
    ...r,
    id: idx + 1,
    decided_at: r.decided_at || null,
  }));
  regNextId = inMemTables.registrations.length + 1;

  inMemTables.notifications = notifications.map((n, idx) => ({
    ...n,
    id: idx + 1,
  }));
  notifNextId = inMemTables.notifications.length + 1;
}

// Emulated query engine matching parameterized SQL statements
async function queryEmulated(sql, params = []) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // 1. SELECT * FROM users WHERE id = ?
  if (cleanSql.includes('FROM users') && cleanSql.includes('WHERE id = ?')) {
    const id = Number(params[0]);
    const found = inMemTables.users.filter(x => x.id === id);
    return [found, []];
  }

  // 2. SELECT * FROM users WHERE username = ? OR email = ? (login & registration duplicate checks)
  if (
    cleanSql.includes('FROM users') &&
    (cleanSql.includes('username') || cleanSql.includes('email') || cleanSql.includes('school_id')) &&
    !cleanSql.includes('ORDER BY') &&
    !cleanSql.includes('COUNT(*)')
  ) {
    const [p1, p2, p3] = params;
    const found = inMemTables.users.filter(x => {
      const u = x.username.toLowerCase();
      const em = x.email.toLowerCase();
      const s = (x.school_id || '').toLowerCase();
      const match1 = p1 && (u === String(p1).toLowerCase() || em === String(p1).toLowerCase() || s === String(p1).toLowerCase());
      const match2 = p2 && (u === String(p2).toLowerCase() || em === String(p2).toLowerCase() || s === String(p2).toLowerCase());
      const match3 = p3 && (u === String(p3).toLowerCase() || em === String(p3).toLowerCase() || s === String(p3).toLowerCase());
      return match1 || match2 || match3;
    });
    return [found, []];
  }

  // 3. Admin: list users with search/filter and pagination
  if (cleanSql.includes('FROM users') && cleanSql.includes('ORDER BY')) {
    const isDesc = cleanSql.includes('ORDER BY id DESC') || cleanSql.includes(' DESC');
    let list = [...inMemTables.users];
    let pIdx = 0;
    if (cleanSql.includes('role = ?')) {
      const role = params[pIdx++];
      list = list.filter(x => x.role === role);
    }
    if (cleanSql.includes('is_active = ?')) {
      const active = params[pIdx++];
      list = list.filter(x => x.is_active === Number(active));
    }
    if (cleanSql.includes('LIKE ?')) {
      const keyword = String(params[pIdx++]).replace(/%/g, '').toLowerCase();
      list = list.filter(x =>
        x.username.toLowerCase().includes(keyword) ||
        x.full_name.toLowerCase().includes(keyword) ||
        x.email.toLowerCase().includes(keyword) ||
        x.school_id.toLowerCase().includes(keyword)
      );
    }
    list.sort((a, b) => (isDesc ? b.id - a.id : a.id - b.id));
    const total = list.length;
    const limit = Number(params[pIdx++]) || 12;
    const offset = Number(params[pIdx++]) || 0;
    const paginated = list.slice(offset, offset + limit).map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      school_id: u.school_id,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at,
    }));
    return [paginated, [{ total }]];
  }

  // 4. Admin: count users
  if (cleanSql.includes('SELECT COUNT(*) AS total FROM users')) {
    let list = [...inMemTables.users];
    let pIdx = 0;
    if (cleanSql.includes('role = ?')) {
      list = list.filter(x => x.role === params[pIdx++]);
    }
    if (cleanSql.includes('is_active = ?')) {
      list = list.filter(x => x.is_active === Number(params[pIdx++]));
    }
    if (cleanSql.includes('LIKE ?')) {
      const keyword = String(params[pIdx++]).replace(/%/g, '').toLowerCase();
      list = list.filter(x =>
        x.username.toLowerCase().includes(keyword) ||
        x.full_name.toLowerCase().includes(keyword) ||
        x.email.toLowerCase().includes(keyword) ||
        x.school_id.toLowerCase().includes(keyword)
      );
    }
    return [[{ total: list.length }], []];
  }

  // 5. INSERT INTO users
  if (cleanSql.startsWith('INSERT INTO users')) {
    const [username, email, full_name, school_id, password_hash, role, is_active] = params;
    const newUser = {
      id: userNextId++,
      username,
      email,
      full_name,
      school_id,
      password_hash,
      role: role || 'participant',
      is_active: is_active ?? 1,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    inMemTables.users.push(newUser);
    return [{ insertId: newUser.id, affectedRows: 1 }, []];
  }

  // 6. UPDATE users SET role = ?, is_active = ? WHERE id = ?
  if (cleanSql.startsWith('UPDATE users SET')) {
    let pIdx = 0;
    let newFullName;
    let newEmail;
    let newSchoolId;
    let newRole;
    let newActive;
    if (cleanSql.includes('full_name = ?')) newFullName = params[pIdx++];
    if (cleanSql.includes('email = ?')) newEmail = params[pIdx++];
    if (cleanSql.includes('school_id = ?')) newSchoolId = params[pIdx++];
    if (cleanSql.includes('role = ?')) newRole = params[pIdx++];
    if (cleanSql.includes('is_active = ?')) newActive = params[pIdx++];
    const id = Number(params[pIdx++]);
    const u = inMemTables.users.find(x => x.id === id);
    if (u) {
      if (newFullName !== undefined) u.full_name = newFullName;
      if (newEmail !== undefined) u.email = newEmail;
      if (newSchoolId !== undefined) u.school_id = newSchoolId;
      if (newRole !== undefined) u.role = newRole;
      if (newActive !== undefined) u.is_active = Number(newActive);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // 7. Event details by ID (with approved_count and total_booked)
  if (cleanSql.includes('FROM events e') && cleanSql.includes('WHERE e.id = ?')) {
    const id = Number(params[0]);
    const ev = inMemTables.events.find(x => x.id === id);
    if (!ev) return [[], []];
    const org = inMemTables.users.find(x => x.id === ev.organizer_id);
    const approved_count = inMemTables.registrations.filter(r => r.event_id === ev.id && r.status === 'approved').length;
    const pending_count = inMemTables.registrations.filter(r => r.event_id === ev.id && r.status === 'pending').length;
    return [[{
      ...ev,
      organizer_name: org ? org.full_name : 'Unknown Organizer',
      organizer_email: org ? org.email : '',
      approved_count,
      pending_count,
      total_booked: approved_count + pending_count,
      seats_remaining: Math.max(0, ev.capacity - approved_count),
    }], []];
  }

  // 8. Event listing with count / pagination
  if (cleanSql.includes('FROM events e') && (cleanSql.includes('ORDER BY') || cleanSql.includes('COUNT(*)'))) {
    let list = inMemTables.events.map(ev => {
      const org = inMemTables.users.find(x => x.id === ev.organizer_id);
      const approved_count = inMemTables.registrations.filter(r => r.event_id === ev.id && r.status === 'approved').length;
      const pending_count = inMemTables.registrations.filter(r => r.event_id === ev.id && r.status === 'pending').length;
      return {
        ...ev,
        organizer_name: org ? org.full_name : 'Unknown Organizer',
        organizer_email: org ? org.email : '',
        approved_count,
        pending_count,
        total_booked: approved_count + pending_count,
        seats_remaining: Math.max(0, ev.capacity - approved_count),
        is_full: approved_count >= ev.capacity,
        is_past_deadline: new Date(ev.registration_deadline) <= new Date(),
        has_started: new Date(ev.starts_at) <= new Date(),
      };
    });

    let pIdx = 0;
    if (cleanSql.includes('e.organizer_id = ?')) {
      const orgId = Number(params[pIdx++]);
      list = list.filter(x => x.organizer_id === orgId);
    } else {
      list = list.filter(x => x.status === 'published');
    }

    if (cleanSql.includes('e.starts_at <= ?')) {
      const dt = params[pIdx++];
      list = list.filter(x => x.starts_at <= dt);
    } else if (cleanSql.includes('e.starts_at > ?')) {
      const dt = params[pIdx++];
      list = list.filter(x => x.starts_at > dt);
    }

    if (cleanSql.includes('e.category = ?') || cleanSql.includes('category = ?') || cleanSql.includes('e.category =')) {
      const cat = params[pIdx++];
      if (cat && cat !== 'All Categories' && cat !== 'all') {
        list = list.filter(x => x.category && x.category.toLowerCase() === String(cat).toLowerCase());
      }
    }

    if (cleanSql.includes('e.starts_at >= ?')) {
      const st = params[pIdx++];
      list = list.filter(x => x.starts_at >= st);
    }

    if (cleanSql.includes('e.starts_at <= ?') && pIdx < params.length) {
      const et = params[pIdx++];
      list = list.filter(x => x.starts_at <= et);
    }

    if (cleanSql.includes('e.title LIKE ?') || cleanSql.includes('LIKE ?')) {
      const rawKw = params[pIdx++];
      const kw = String(rawKw || '').replace(/%/g, '').toLowerCase();
      if (cleanSql.includes('e.title LIKE ?')) {
        pIdx += 2; // skip description and venue placeholder params
      }
      list = list.filter(x =>
        (x.title && x.title.toLowerCase().includes(kw)) ||
        (x.description && x.description.toLowerCase().includes(kw)) ||
        (x.venue && x.venue.toLowerCase().includes(kw))
      );
    }

    if (cleanSql.includes("status = 'approved')) > 0")) {
      list = list.filter(x => x.seats_remaining > 0);
    }

    if (cleanSql.startsWith('SELECT COUNT(*)')) {
      return [[{ total: list.length }], []];
    }

    if (cleanSql.includes('ORDER BY e.starts_at DESC')) {
      list.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    } else {
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }

    const limit = Number(params[pIdx++]) || 12;
    const offset = Number(params[pIdx++]) || 0;
    const paginated = list.slice(offset, offset + limit);
    return [paginated, []];
  }

  // 9. INSERT INTO events
  if (cleanSql.startsWith('INSERT INTO events')) {
    const [organizer_id, title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, fee_amount, requires_approval, status] = params;
    const newEvent = {
      id: eventNextId++,
      organizer_id: Number(organizer_id),
      title,
      description,
      category,
      venue,
      starts_at,
      ends_at,
      registration_deadline,
      capacity: Number(capacity),
      fee_amount: Number(fee_amount) || 0,
      requires_approval: Number(requires_approval) || 0,
      status: status || 'published',
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    inMemTables.events.push(newEvent);
    return [{ insertId: newEvent.id, affectedRows: 1 }, []];
  }

  // 10. UPDATE events
  if (cleanSql.startsWith('UPDATE events SET')) {
    const id = Number(params[params.length - 1]);
    const ev = inMemTables.events.find(x => x.id === id);
    if (ev) {
      if (cleanSql.includes('status = ?')) {
        ev.status = params[0];
      } else {
        const [title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, fee_amount, requires_approval] = params;
        ev.title = title;
        ev.description = description;
        ev.category = category;
        ev.venue = venue;
        ev.starts_at = starts_at;
        ev.ends_at = ends_at;
        ev.registration_deadline = registration_deadline;
        ev.capacity = Number(capacity);
        ev.fee_amount = Number(fee_amount) || 0;
        ev.requires_approval = Number(requires_approval);
      }
      ev.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // 11. DELETE FROM events WHERE id = ?
  if (cleanSql.startsWith('DELETE FROM events WHERE id = ?')) {
    const id = Number(params[0]);
    const idx = inMemTables.events.findIndex(x => x.id === id);
    if (idx !== -1) {
      inMemTables.events.splice(idx, 1);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // 12. Registrations: check duplicate / status
  if (cleanSql.includes('FROM registrations') && cleanSql.includes('event_id = ?') && cleanSql.includes('user_id = ?')) {
    const [eId, uId] = params.map(Number);
    const regs = inMemTables.registrations.filter(r => r.event_id === eId && r.user_id === uId);
    return [regs, []];
  }

  // 12b. Registrations with Event details (for cancel pass)
  if (cleanSql.includes('FROM registrations r') && cleanSql.includes('JOIN events e ON r.event_id = e.id') && (cleanSql.includes('WHERE r.id = ?') || cleanSql.includes('WHERE r.event_id = ?'))) {
    let reg;
    if (cleanSql.includes('WHERE r.id = ?')) {
      const regId = Number(params[0]);
      reg = inMemTables.registrations.find(r => r.id === regId);
    } else {
      const eId = Number(params[0]);
      const uId = Number(params[1]);
      reg = inMemTables.registrations.find(r => r.event_id === eId && r.user_id === uId);
    }

    if (!reg) return [[], []];

    const ev = inMemTables.events.find(e => e.id === reg.event_id) || {};
    return [[{
      ...reg,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      title: ev.title,
      event_title: ev.title,
      venue: ev.venue,
    }], []];
  }

  // 13. Registrations: participant tickets list
  if (cleanSql.includes('FROM registrations r') && cleanSql.includes('JOIN events e ON r.event_id = e.id') && cleanSql.includes('r.user_id = ?')) {
    const uId = Number(params[0]);
    const userRegs = inMemTables.registrations.filter(r => r.user_id === uId);
    const results = userRegs.map(r => {
      const ev = inMemTables.events.find(e => e.id === r.event_id) || {};
      const org = inMemTables.users.find(u => u.id === ev.organizer_id) || {};
      return {
        registration_id: r.id,
        id: r.id,
        event_id: r.event_id,
        user_id: r.user_id,
        status: r.status,
        registration_status: r.status,
        registered_at: r.registered_at,
        decided_at: r.decided_at,
        reference_code: `EVT-${String(r.event_id).padStart(4, '0')}-${String(r.id).padStart(4, '0')}`,
        title: ev.title,
        event_title: ev.title,
        description: ev.description || '',
        category: ev.category,
        venue: ev.venue,
        fee_amount: ev.fee_amount || 0,
        starts_at: ev.starts_at,
        ends_at: ev.ends_at,
        registration_deadline: ev.registration_deadline,
        capacity: ev.capacity,
        requires_approval: ev.requires_approval,
        event_status: ev.status,
        organizer_name: org.full_name || 'Organizer',
      };
    });
    results.sort((a, b) => (a.starts_at || '').localeCompare(b.starts_at || ''));
    return [results, []];
  }

  // 14. Registrations: attendee list for organizer
  if (cleanSql.includes('FROM registrations r') && cleanSql.includes('JOIN users u ON r.user_id = u.id') && cleanSql.includes('r.event_id = ?')) {
    const eId = Number(params[0]);
    const regs = inMemTables.registrations.filter(r => r.event_id === eId);
    const results = regs.map(r => {
      const u = inMemTables.users.find(x => x.id === r.user_id) || {};
      return {
        id: r.id,
        user_id: r.user_id,
        username: u.username,
        full_name: u.full_name,
        school_id: u.school_id,
        email: u.email,
        status: r.status,
        registered_at: r.registered_at,
        decided_at: r.decided_at,
        reference_code: `EVT-${String(r.event_id).padStart(4, '0')}-${String(r.id).padStart(4, '0')}`,
      };
    });
    return [results, []];
  }

  // 15. Registrations: count approved
  if (cleanSql.includes('COUNT(*) AS booked FROM registrations') || cleanSql.includes("status = 'approved'")) {
    const eId = Number(params[0]);
    const approved = inMemTables.registrations.filter(r => r.event_id === eId && r.status === 'approved').length;
    return [[{ booked: approved, count: approved }], []];
  }

  // 16. INSERT INTO registrations
  if (cleanSql.startsWith('INSERT INTO registrations')) {
    const [event_id, user_id, status] = params;
    const newReg = {
      id: regNextId++,
      event_id: Number(event_id),
      user_id: Number(user_id),
      status: status || 'pending',
      registered_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      decided_at: status === 'approved' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null,
    };
    inMemTables.registrations.push(newReg);
    return [{ insertId: newReg.id, affectedRows: 1 }, []];
  }

  // 17. UPDATE registrations (status / cancel / approve / reject)
  if (cleanSql.startsWith('UPDATE registrations SET')) {
    let newStatus = 'cancelled';
    if (cleanSql.includes("status = 'cancelled'")) {
      newStatus = 'cancelled';
    } else if (cleanSql.includes("status = 'approved'")) {
      newStatus = 'approved';
    } else if (cleanSql.includes("status = 'rejected'")) {
      newStatus = 'rejected';
    } else if (params.length > 0 && typeof params[0] === 'string' && ['pending', 'approved', 'rejected', 'cancelled'].includes(params[0])) {
      newStatus = params[0];
    }

    let r;
    if (cleanSql.includes('WHERE id = ?')) {
      const regId = Number(params[params.length - 1]);
      r = inMemTables.registrations.find(x => x.id === regId);
    } else if (cleanSql.includes('WHERE event_id = ? AND user_id = ?')) {
      const eventId = Number(params[params.length - 2]);
      const userId = Number(params[params.length - 1]);
      r = inMemTables.registrations.find(x => x.event_id === eventId && x.user_id === userId);
    } else if (cleanSql.includes('WHERE id = ? AND event_id = ?')) {
      const regId = Number(params[params.length - 2]);
      const eventId = Number(params[params.length - 1]);
      r = inMemTables.registrations.find(x => x.id === regId && x.event_id === eventId);
    }

    if (r) {
      r.status = newStatus;
      r.decided_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // 18. Notifications: list
  if (cleanSql.includes('FROM notifications WHERE user_id = ?')) {
    const uId = Number(params[0]);
    const notifs = inMemTables.notifications.filter(n => n.user_id === uId);
    notifs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return [notifs.slice(0, 50), []];
  }

  // 19. INSERT INTO notifications
  if (cleanSql.startsWith('INSERT INTO notifications')) {
    const [user_id, type, message, event_id] = params;
    const newNotif = {
      id: notifNextId++,
      user_id: Number(user_id),
      type,
      message,
      event_id: event_id ? Number(event_id) : null,
      is_read: 0,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    inMemTables.notifications.push(newNotif);
    return [{ insertId: newNotif.id, affectedRows: 1 }, []];
  }

  // 20. UPDATE notifications SET is_read = 1
  if (cleanSql.startsWith('UPDATE notifications SET is_read = 1')) {
    const uId = Number(params[0]);
    const nId = params[1] !== undefined ? Number(params[1]) : null;
    let count = 0;
    inMemTables.notifications.forEach(n => {
      if (n.user_id === uId) {
        if (!nId || n.id === nId) {
          if (n.is_read === 0) count++;
          n.is_read = 1;
        }
      }
    });
    return [{ affectedRows: count || 1 }, []];
  }

  return [[], []];
}

class EmulatedConnection {
  async query(sql, params = []) {
    return queryEmulated(sql, params);
  }
  async execute(sql, params = []) {
    return queryEmulated(sql, params);
  }
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
}

async function seedHostedDb(connection) {
  // Claim the initial seed in the same transaction as its records.
  await connection.beginTransaction();
  try {
    const [claim] = await connection.execute(
      'INSERT IGNORE INTO campuspass_seed_state (id) VALUES (1)'
    );
    if (claim.affectedRows === 1) {
      const [existingUsers] = await connection.query('SELECT id FROM users LIMIT 1');
      if (existingUsers.length === 0) {
        const users = await generateSeedUsers();
        for (const [index, user] of users.entries()) {
          await connection.execute(
            `INSERT INTO users (id, username, email, full_name, school_id, password_hash, role, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [index + 1, user.username, user.email, user.full_name, user.school_id,
              user.password_hash, user.role, user.is_active]
          );
        }

        for (const [index, event] of generateSeedEvents().entries()) {
          await connection.execute(
            `INSERT INTO events (id, organizer_id, title, description, category, venue, starts_at,
              ends_at, registration_deadline, capacity, fee_amount, requires_approval, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [index + 1, event.organizer_id, event.title, event.description, event.category,
              event.venue, event.starts_at, event.ends_at, event.registration_deadline,
              event.capacity, event.fee_amount || 0, event.requires_approval, event.status]
          );
        }

        for (const registration of generateSeedRegistrations()) {
          await connection.execute(
            `INSERT INTO registrations (event_id, user_id, status, registered_at, decided_at)
             VALUES (?, ?, ?, ?, ?)`,
            [registration.event_id, registration.user_id, registration.status,
              registration.registered_at, registration.decided_at]
          );
        }

        for (const notification of generateSeedNotifications()) {
          await connection.execute(
            `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [notification.user_id, notification.type, notification.message,
              notification.event_id, notification.is_read, notification.created_at]
          );
        }
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function initializeHostedDb(options) {
  const connection = await mysql.createConnection(options);
  try {
    const database = mysql.escapeId(DB_NAME, true);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE ${database}`);

    // Reuse only the table definitions. The reset script's DROP statements never run here.
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    for (const [statement] of schema.matchAll(/^CREATE TABLE [\s\S]+?;/gm)) {
      await connection.query(statement.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
    }
    await connection.query(
      'CREATE TABLE IF NOT EXISTS campuspass_seed_state (id TINYINT PRIMARY KEY)'
    );
    await seedHostedDb(connection);
  } finally {
    await connection.end();
  }
}

export const pool = {
  async query(sql, params = []) {
    return realPool ? realPool.query(sql, params) : queryEmulated(sql, params);
  },

  async execute(sql, params = []) {
    return realPool ? realPool.execute(sql, params) : queryEmulated(sql, params);
  },

  async getConnection() {
    return realPool ? realPool.getConnection() : new EmulatedConnection();
  },
};

export async function initDb() {
  const isTiDB = DB_HOST.toLowerCase().endsWith('.tidbcloud.com');
  // Existing Render demo configuration uses sys until an app database is selected.
  if (isTiDB && DB_NAME === 'sys') {
    console.warn('[DB] Set DB_NAME to the CampusPass database to enable TiDB storage.');
  } else {
    const options = {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      connectTimeout: isTiDB ? 10000 : 2000,
      ...(isTiDB && {
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, verifyIdentity: true },
      }),
    };
    if (isTiDB) {
      await initializeHostedDb(options);
    }

    const candidate = mysql.createPool({
      ...options,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });
    try {
      await candidate.query('SELECT 1');
      realPool = candidate;
      currentDbMode = 'connected';
      console.log(`[DB] Connected to ${isTiDB ? 'TiDB' : 'MySQL'} database ${DB_NAME}`);
      return;
    } catch (error) {
      await candidate.end();
      if (isTiDB) throw error;
      console.warn('[DB] Local MySQL unavailable, starting the in-memory demo.');
    }
  }

  await resetInMemoryDb();
  currentDbMode = 'emulated';
  console.log('[DB] In-memory database initialized with seeded test events.');
}

export function getDbStatus() {
  return currentDbMode;
}
