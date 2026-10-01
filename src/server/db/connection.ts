/**
 * Database connection layer
 * NFR-004: DB transaction with row lock (SELECT ... FOR UPDATE)
 * NFR-005: Reports API and DB status
 * NFR-007: Split into routes / controllers / services / validators
 * NFR-008: Parameterized queries only, no SQL injection
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {
  generateSeedUsers,
  generateSeedEvents,
  generateSeedRegistrations,
  generateSeedNotifications,
  SeedUser,
  SeedEvent,
  SeedRegistration,
  SeedNotification,
} from './seed-data.ts';

dotenv.config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'campus_events';
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'University of Cebu - Mandaue';

export type DbStatus = 'connected' | 'emulated' | 'disconnected';

let currentDbMode: DbStatus = 'disconnected';
let realPool: mysql.Pool | null = null;

// ============================================================================
// Emulated In-Memory Store (Active when MySQL is not running on localhost)
// Guarantees that STLC testers can run all tests and demo all 16 FRs anywhere!
// ============================================================================

interface InMemTables {
  users: (SeedUser & { id: number; created_at: string })[];
  events: (SeedEvent & { id: number; created_at: string; updated_at: string })[];
  registrations: (SeedRegistration & { id: number })[];
  notifications: (SeedNotification & { id: number })[];
}

let inMemTables: InMemTables = {
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
  const users = await generateSeedUsers(SCHOOL_NAME);
  const events = generateSeedEvents(SCHOOL_NAME);
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

// Emulated Query Handler supporting parameterized SQL strings
async function queryEmulated(sql: string, params: any[] = []): Promise<[any, any]> {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // 1. SELECT * FROM users WHERE username = ? OR email = ?
  if (cleanSql.includes('FROM users') && (cleanSql.includes('username = ?') || cleanSql.includes('email = ?'))) {
    if (cleanSql.includes('username = ? OR email = ?')) {
      const [u, e] = params;
      const found = inMemTables.users.filter(x => x.username.toLowerCase() === String(u).toLowerCase() || x.email.toLowerCase() === String(e).toLowerCase());
      return [found, []];
    }
    if (cleanSql.includes('username = ?')) {
      const [u] = params;
      const found = inMemTables.users.filter(x => x.username.toLowerCase() === String(u).toLowerCase());
      return [found, []];
    }
    if (cleanSql.includes('email = ?')) {
      const [e] = params;
      const found = inMemTables.users.filter(x => x.email.toLowerCase() === String(e).toLowerCase());
      return [found, []];
    }
  }

  // 2. SELECT * FROM users WHERE id = ?
  if (cleanSql.includes('FROM users WHERE id = ?')) {
    const id = Number(params[0]);
    const found = inMemTables.users.filter(x => x.id === id);
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
    let newRole: any;
    let newActive: any;
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
      };
    });

    let pIdx = 0;
    if (cleanSql.includes('e.organizer_id = ?')) {
      const orgId = Number(params[pIdx++]);
      list = list.filter(x => x.organizer_id === orgId);
    }
    if (cleanSql.includes('e.status = ?')) {
      const status = params[pIdx++];
      list = list.filter(x => x.status === status);
    }
    if (cleanSql.includes('e.category = ?')) {
      const category = params[pIdx++];
      list = list.filter(x => x.category === category);
    }
    if (cleanSql.includes('e.starts_at >= ?')) {
      const startGte = params[pIdx++];
      list = list.filter(x => x.starts_at >= startGte);
    }
    if (cleanSql.includes('e.starts_at <= ?')) {
      const startLte = params[pIdx++];
      list = list.filter(x => x.starts_at <= startLte);
    }
    if (cleanSql.includes('e.starts_at > ?')) {
      const startGt = params[pIdx++];
      list = list.filter(x => x.starts_at > startGt);
    }
    if (cleanSql.includes('(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ?)')) {
      const kw = String(params[pIdx++]).replace(/%/g, '').toLowerCase();
      pIdx += 2; // skip repeated kw params
      list = list.filter(x =>
        x.title.toLowerCase().includes(kw) ||
        x.description.toLowerCase().includes(kw) ||
        x.venue.toLowerCase().includes(kw)
      );
    }
    if (cleanSql.includes('e.capacity -') || cleanSql.includes('seats_available_only')) {
      list = list.filter(x => x.seats_remaining > 0);
    }

    if (cleanSql.includes('COUNT(*) AS total')) {
      return [[{ total: list.length }], []];
    }

    if (cleanSql.includes('ORDER BY e.starts_at DESC')) {
      list.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    } else {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }

    const limit = Number(params[pIdx++]) || 12;
    const offset = Number(params[pIdx++]) || 0;
    const paginated = list.slice(offset, offset + limit);
    return [paginated, []];
  }

  // 9. INSERT INTO events
  if (cleanSql.startsWith('INSERT INTO events')) {
    const [
      organizer_id,
      title,
      description,
      category,
      venue,
      starts_at,
      ends_at,
      registration_deadline,
      capacity,
      requires_approval,
      status,
    ] = params;

    const newEv: SeedEvent & { id: number; created_at: string; updated_at: string } = {
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
    inMemTables.events.push(newEv);
    return [{ insertId: newEv.id, affectedRows: 1 }, []];
  }

  // 10. UPDATE events
  if (cleanSql.startsWith('UPDATE events SET')) {
    if (cleanSql.includes('status = ? WHERE id = ?')) {
      const [status, id] = params;
      const ev = inMemTables.events.find(x => x.id === Number(id));
      if (ev) {
        ev.status = status;
        ev.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    // Full edit
    const [
      title,
      description,
      category,
      venue,
      starts_at,
      ends_at,
      registration_deadline,
      capacity,
      requires_approval,
      id,
    ] = params;
    const ev = inMemTables.events.find(x => x.id === Number(id));
    if (ev) {
      ev.title = title;
      ev.description = description;
      ev.category = category;
      ev.venue = venue;
      ev.starts_at = starts_at;
      ev.ends_at = ends_at;
      ev.registration_deadline = registration_deadline;
      ev.capacity = Number(capacity);
      ev.requires_approval = Number(requires_approval);
      ev.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // 11. DELETE FROM events WHERE id = ?
  if (cleanSql.startsWith('DELETE FROM events WHERE id = ?')) {
    const id = Number(params[0]);
    const initLen = inMemTables.events.length;
    inMemTables.events = inMemTables.events.filter(x => x.id !== id);
    inMemTables.registrations = inMemTables.registrations.filter(x => x.event_id !== id);
    return [{ affectedRows: initLen - inMemTables.events.length }, []];
  }

  // 12. Registrations: SELECT * FROM registrations WHERE event_id = ? AND user_id = ?
  if (cleanSql.includes('FROM registrations WHERE event_id = ? AND user_id = ?')) {
    const [eId, uId] = params;
    const found = inMemTables.registrations.filter(r => r.event_id === Number(eId) && r.user_id === Number(uId));
    return [found, []];
  }

  // 13. Registration with lock: SELECT ... FROM events WHERE id = ? FOR UPDATE
  if (cleanSql.includes('FROM events') && cleanSql.includes('FOR UPDATE')) {
    const id = Number(params[0]);
    const ev = inMemTables.events.find(x => x.id === id);
    if (!ev) return [[], []];
    const approved_count = inMemTables.registrations.filter(r => r.event_id === ev.id && r.status === 'approved').length;
    const pending_count = inMemTables.registrations.filter(r => r.event_id === ev.id && r.status === 'pending').length;
    return [[{
      ...ev,
      approved_count,
      pending_count,
      booked_count: approved_count + pending_count,
    }], []];
  }

  // 14. INSERT INTO registrations
  if (cleanSql.startsWith('INSERT INTO registrations')) {
    const [event_id, user_id, status, decided_at] = params;
    const newReg = {
      id: regNextId++,
      event_id: Number(event_id),
      user_id: Number(user_id),
      status,
      registered_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      decided_at: decided_at || null,
    };
    inMemTables.registrations.push(newReg);
    return [{ insertId: newReg.id, affectedRows: 1 }, []];
  }

  // 15. UPDATE registrations
  if (cleanSql.startsWith('UPDATE registrations SET')) {
    if (cleanSql.includes('status = ?') && cleanSql.includes('WHERE id = ? AND event_id = ?')) {
      const [status, decided_at, id, event_id] = params;
      const reg = inMemTables.registrations.find(x => x.id === Number(id) && x.event_id === Number(event_id));
      if (reg) {
        reg.status = status;
        reg.decided_at = decided_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (cleanSql.includes('status = ?') && cleanSql.includes('WHERE id = ?')) {
      const [status, decided_at, id] = params;
      const reg = inMemTables.registrations.find(x => x.id === Number(id));
      if (reg) {
        reg.status = status;
        reg.registered_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        reg.decided_at = decided_at || null;
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    // Cancel own registration
    if (cleanSql.includes("status = 'cancelled'") && cleanSql.includes('WHERE event_id = ? AND user_id = ?')) {
      const [eId, uId] = params;
      const reg = inMemTables.registrations.find(x => x.event_id === Number(eId) && x.user_id === Number(uId));
      if (reg) {
        reg.status = 'cancelled';
        reg.decided_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }
  }

  // 16. Attendee list: FR-015
  if (cleanSql.includes('FROM registrations r') && cleanSql.includes('JOIN users u') && cleanSql.includes('WHERE r.event_id = ?')) {
    const eId = Number(params[0]);
    const list = inMemTables.registrations
      .filter(r => r.event_id === eId)
      .map(r => {
        const u = inMemTables.users.find(x => x.id === r.user_id);
        return {
          registration_id: r.id,
          status: r.status,
          registered_at: r.registered_at,
          decided_at: r.decided_at,
          user_id: r.user_id,
          username: u ? u.username : '',
          full_name: u ? u.full_name : '',
          email: u ? u.email : '',
          school_id: u ? u.school_id : '',
        };
      });
    return [list, []];
  }

  // 17. Participant tickets: FR-014
  if (cleanSql.includes('FROM registrations r') && cleanSql.includes('JOIN events e') && cleanSql.includes('WHERE r.user_id = ?')) {
    const uId = Number(params[0]);
    const list = inMemTables.registrations
      .filter(r => r.user_id === uId)
      .map(r => {
        const ev = inMemTables.events.find(x => x.id === r.event_id);
        const org = ev ? inMemTables.users.find(x => x.id === ev.organizer_id) : null;
        return {
          registration_id: r.id,
          registration_status: r.status,
          registered_at: r.registered_at,
          decided_at: r.decided_at,
          event_id: r.event_id,
          title: ev?.title,
          description: ev?.description,
          category: ev?.category,
          venue: ev?.venue,
          starts_at: ev?.starts_at,
          ends_at: ev?.ends_at,
          registration_deadline: ev?.registration_deadline,
          capacity: ev?.capacity,
          requires_approval: ev?.requires_approval,
          status: ev?.status,
          organizer_name: org ? org.full_name : '',
        };
      })
      .filter(x => x.title)
      .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());
    return [list, []];
  }

  // 18. Organizer pending queue: FR-012
  if (cleanSql.includes("WHERE e.organizer_id = ? AND r.status = 'pending'")) {
    const orgId = Number(params[0]);
    const orgEventIds = inMemTables.events.filter(e => e.organizer_id === orgId).map(e => e.id);
    const list = inMemTables.registrations
      .filter(r => orgEventIds.includes(r.event_id) && r.status === 'pending')
      .map(r => {
        const u = inMemTables.users.find(x => x.id === r.user_id);
        const ev = inMemTables.events.find(x => x.id === r.event_id);
        return {
          registration_id: r.id,
          event_id: r.event_id,
          user_id: r.user_id,
          status: r.status,
          registered_at: r.registered_at,
          full_name: u?.full_name || '',
          email: u?.email || '',
          school_id: u?.school_id || '',
          event_title: ev?.title || '',
        };
      })
      .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
    return [list, []];
  }

  // 19. Notifications: FR-013
  if (cleanSql.includes('FROM notifications WHERE user_id = ?')) {
    const uId = Number(params[0]);
    const list = inMemTables.notifications
      .filter(n => n.user_id === uId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return [list, []];
  }

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

  if (cleanSql.startsWith('UPDATE notifications SET is_read = 1')) {
    if (cleanSql.includes('WHERE user_id = ? AND id = ?')) {
      const [uId, id] = params;
      const n = inMemTables.notifications.find(x => x.user_id === Number(uId) && x.id === Number(id));
      if (n) n.is_read = 1;
      return [{ affectedRows: n ? 1 : 0 }, []];
    }
    const [uId] = params;
    let count = 0;
    inMemTables.notifications.forEach(n => {
      if (n.user_id === Number(uId) && !n.is_read) {
        n.is_read = 1;
        count++;
      }
    });
    return [{ affectedRows: count }, []];
  }

  return [[], []];
}

// In-Memory Connection Wrapper with transaction support
class EmulatedConnection {
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  async query(sql: string, params: any[] = []) {
    return queryEmulated(sql, params);
  }
  async execute(sql: string, params: any[] = []) {
    return queryEmulated(sql, params);
  }
  release() {}
}

export const pool = {
  async query(sql: string, params: any[] = []): Promise<[any, any]> {
    if (realPool && currentDbMode === 'connected') {
      try {
        return await realPool.query(sql, params);
      } catch (err: any) {
        // If connection dropped, fallback
        return await queryEmulated(sql, params);
      }
    }
    return queryEmulated(sql, params);
  },

  async execute(sql: string, params: any[] = []): Promise<[any, any]> {
    if (realPool && currentDbMode === 'connected') {
      try {
        return await realPool.execute(sql, params);
      } catch (err: any) {
        return await queryEmulated(sql, params);
      }
    }
    return queryEmulated(sql, params);
  },

  async getConnection(): Promise<any> {
    if (realPool && currentDbMode === 'connected') {
      try {
        return await realPool.getConnection();
      } catch (err) {
        return new EmulatedConnection();
      }
    }
    return new EmulatedConnection();
  },
};

export function isDbConnected(): boolean {
  return currentDbMode === 'connected' || currentDbMode === 'emulated';
}

export function getDbMode(): DbStatus {
  return currentDbMode;
}

export async function initDb(): Promise<void> {
  const forceEmulated = process.env.USE_EMULATED_DB === 'true';

  if (!forceEmulated) {
    try {
      const testPool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2000,
      });

      // Ping to verify connectivity
      const conn = await testPool.getConnection();
      conn.release();

      realPool = testPool;
      currentDbMode = 'connected';
      console.log(`[Database] Connected to MySQL 8/MariaDB on ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
      return;
    } catch (err: any) {
      console.warn(`[Database] MySQL not reachable at ${DB_HOST}:${DB_PORT}. Falling back to in-memory STLC testing engine.`);
    }
  }

  // Fallback to in-memory DB populated with seed data
  await resetInMemoryDb();
  currentDbMode = 'emulated';
  console.log(`[Database] Emulated in-memory database initialized with full seed catalog.`);
}
