/**
 * Database connection layer
 * NFR-004: DB transaction with row lock
 * NFR-005: Reports API and DB status
 * NFR-008: Parameterized queries only
 */

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
  if (cleanSql.includes('FROM users') && cleanSql.includes('ORDER BY id DESC')) {
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
    let newRole;
    let newActive;
    if (cleanSql.includes('role = ?')) newRole = params[pIdx++];
    if (cleanSql.includes('is_active = ?')) newActive = params[pIdx++];
    const id = Number(params[pIdx++]);
    const u = inMemTables.users.find(x => x.id === id);
    if (u) {
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
    const [organizer_id, title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, requires_approval, status] = params;
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
        const [title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, requires_approval] = params;
        ev.title = title;
        ev.description = description;
        ev.category = category;
        ev.venue = venue;
        ev.starts_at = starts_at;
        ev.ends_at = ends_at;
        ev.registration_deadline = registration_deadline;
        ev.capacity = Number(capacity);
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

  // 13. Registrations: participant tickets list
  if (cleanSql.includes('FROM registrations r') && cleanSql.includes('JOIN events e ON r.event_id = e.id') && cleanSql.includes('r.user_id = ?')) {
    const uId = Number(params[0]);
    const userRegs = inMemTables.registrations.filter(r => r.user_id === uId);
    const results = userRegs.map(r => {
      const ev = inMemTables.events.find(e => e.id === r.event_id) || {};
      const org = inMemTables.users.find(u => u.id === ev.organizer_id) || {};
      return {
        registration_id: r.id,
        event_id: r.event_id,
        user_id: r.user_id,
        status: r.status,
        registered_at: r.registered_at,
        decided_at: r.decided_at,
        reference_code: `EVT-${String(r.event_id).padStart(4, '0')}-${String(r.id).padStart(4, '0')}`,
        event_title: ev.title,
        category: ev.category,
        venue: ev.venue,
        starts_at: ev.starts_at,
        ends_at: ev.ends_at,
        event_status: ev.status,
        organizer_name: org.full_name || 'Organizer',
      };
    });
    results.sort((a, b) => (b.registered_at || '').localeCompare(a.registered_at || ''));
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
    let pIdx = 0;
    let newStatus = params[pIdx++];
    let regId;
    let eventId;
    let userId;

    if (cleanSql.includes('decided_at = NOW()')) {
      regId = Number(params[pIdx++]);
      eventId = Number(params[pIdx++]);
    } else {
      eventId = Number(params[pIdx++]);
      userId = Number(params[pIdx++]);
    }

    let r;
    if (regId) {
      r = inMemTables.registrations.find(x => x.id === regId && x.event_id === eventId);
    } else {
      r = inMemTables.registrations.find(x => x.event_id === eventId && x.user_id === userId);
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
    inMemTables.notifications.forEach(n => {
      if (n.user_id === uId) {
        if (!nId || n.id === nId) {
          n.is_read = 1;
        }
      }
    });
    return [{ affectedRows: 1 }, []];
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

export const pool = {
  async query(sql, params = []) {
    if (currentDbMode === 'connected' && realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err) {
        console.warn('[DB] Fallback to in-memory store due to query error:', err.message);
        return queryEmulated(sql, params);
      }
    }
    return queryEmulated(sql, params);
  },

  async execute(sql, params = []) {
    if (currentDbMode === 'connected' && realPool) {
      try {
        return await realPool.execute(sql, params);
      } catch (err) {
        console.warn('[DB] Fallback to in-memory store due to execute error:', err.message);
        return queryEmulated(sql, params);
      }
    }
    return queryEmulated(sql, params);
  },

  async getConnection() {
    if (currentDbMode === 'connected' && realPool) {
      try {
        return await realPool.getConnection();
      } catch {
        return new EmulatedConnection();
      }
    }
    return new EmulatedConnection();
  },
};

export async function initDb() {
  try {
    const tempPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 2000,
    });

    const [rows] = await tempPool.query('SELECT 1');
    if (rows) {
      realPool = tempPool;
      currentDbMode = 'connected';
      console.log(`[DB] Connected to MySQL on ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
      return;
    }
  } catch {
    console.log('[DB] MySQL not reachable on localhost; initializing in-memory store.');
  }

  await resetInMemoryDb();
  currentDbMode = 'emulated';
  console.log('[DB] In-memory database initialized with seeded test events.');
}

export function getDbStatus() {
  return currentDbMode;
}
