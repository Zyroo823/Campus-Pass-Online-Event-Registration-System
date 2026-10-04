/**
 * Event Routes
 * FR-004, FR-005, FR-006, FR-009, FR-010, FR-011, FR-014, FR-015
 * NFR-001, NFR-002
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { eventFormSchema, eventUpdateSchema, eventQuerySchema } from '../validators.js';
import {
  authenticate,
  requireRole,
  requireEventOwnership,
  eventMutateLimiter,
  AppError,
} from '../middleware.js';

const router = Router();

function getNowInAppTimezone() {
  const tz = process.env.APP_TIMEZONE || 'Asia/Manila';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

async function getEventDetails(eventId) {
  const [rows] = await pool.query(
    `SELECT 
      e.*,
      u.full_name AS organizer_name,
      u.email AS organizer_email,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count
    FROM events e
    JOIN users u ON e.organizer_id = u.id
    WHERE e.id = ?`,
    [eventId]
  );

  if (!rows || rows.length === 0) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'The requested event does not exist.');
  }

  const ev = rows[0];
  const approved = Number(ev.approved_count || 0);
  const pending = Number(ev.pending_count || 0);
  const now = new Date().getTime();

  return {
    ...ev,
    fee_amount: Number(ev.fee_amount) || 0,
    approved_count: approved,
    pending_count: pending,
    total_booked: approved + pending,
    seats_remaining: Math.max(0, ev.capacity - approved),
    is_full: approved >= ev.capacity,
    is_past_deadline: new Date(ev.registration_deadline).getTime() <= now,
    has_started: new Date(ev.starts_at).getTime() <= now,
  };
}

// GET /api/events (FR-004, FR-005, NFR-001)
router.get('/', async (req, res, next) => {
  try {
    const query = eventQuerySchema.parse(req.query);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const offset = (page - 1) * limit;

    const whereClauses = ["e.status = 'published'"];
    const params = [];
    const nowStr = getNowInAppTimezone();
    const isPast = query.when === 'past';

    if (isPast) {
      whereClauses.push('e.starts_at <= ?');
      params.push(nowStr);
    } else {
      whereClauses.push('e.starts_at > ?');
      params.push(nowStr);
    }

    if (query.category) {
      whereClauses.push('e.category = ?');
      params.push(query.category);
    }

    if (query.start_date) {
      whereClauses.push('e.starts_at >= ?');
      params.push(query.start_date);
    }

    if (query.end_date) {
      whereClauses.push('e.starts_at <= ?');
      params.push(query.end_date);
    }

    if (query.keyword) {
      whereClauses.push('(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ?)');
      const kw = `%${query.keyword}%`;
      params.push(kw, kw, kw);
    }

    if (query.available_only === 'true' || query.available_only === '1') {
      whereClauses.push('(e.capacity - (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = \'approved\')) > 0');
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const orderSql = isPast ? 'ORDER BY e.starts_at DESC' : 'ORDER BY e.starts_at ASC';

    const countSql = `SELECT COUNT(*) AS total FROM events e ${whereSql}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const listSql = `
      SELECT 
        e.*,
        u.full_name AS organizer_name,
        u.email AS organizer_email,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      ${whereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(listSql, [...params, limit, offset]);

    const now = new Date().getTime();
    const events = rows.map((ev) => {
      const approved = Number(ev.approved_count || 0);
      const pending = Number(ev.pending_count || 0);
      return {
        ...ev,
        approved_count: approved,
        pending_count: pending,
        total_booked: approved + pending,
        seats_remaining: Math.max(0, ev.capacity - approved),
        is_full: approved >= ev.capacity,
        is_past_deadline: new Date(ev.registration_deadline).getTime() <= now,
        has_started: new Date(ev.starts_at).getTime() <= now,
      };
    });

    res.status(200).json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/organizer-dashboard (FR-012, FR-014)
router.get('/organizer-dashboard', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const organizerId = req.user.id;

    // 1. Pending Queue
    const [pendingRows] = await pool.query(
      `SELECT 
        r.id AS registration_id,
        r.event_id,
        r.user_id,
        r.status,
        r.registered_at,
        u.full_name,
        u.email,
        u.school_id,
        e.title AS event_title
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      WHERE e.organizer_id = ? AND r.status = 'pending'
      ORDER BY r.registered_at ASC`,
      [organizerId]
    );

    // 2. Organizer's managed events
    const [rows] = await pool.query(
      `SELECT 
        e.*,
        u.full_name AS organizer_name,
        u.email AS organizer_email,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE e.organizer_id = ?
      ORDER BY e.starts_at ASC`,
      [organizerId]
    );

    const now = new Date().getTime();
    const events = rows.map((ev) => {
      const approved = Number(ev.approved_count || 0);
      const pending = Number(ev.pending_count || 0);
      return {
        ...ev,
        approved_count: approved,
        pending_count: pending,
        total_booked: approved + pending,
        seats_remaining: Math.max(0, ev.capacity - approved),
        is_full: approved >= ev.capacity,
        is_past_deadline: new Date(ev.registration_deadline).getTime() <= now,
        has_started: new Date(ev.starts_at).getTime() <= now,
      };
    });

    res.status(200).json({
      pendingQueue: pendingRows,
      events,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id (FR-006)
router.get('/:id', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      throw new AppError(400, 'INVALID_EVENT_ID', 'Invalid event ID.');
    }
    const event = await getEventDetails(eventId);
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
});

// POST /api/events (FR-009)
router.post('/', authenticate, requireRole('organizer', 'admin'), eventMutateLimiter, async (req, res, next) => {
  try {
    const data = eventFormSchema.parse(req.body);
    const organizerId = req.user.id;
    const fee = Number(data.fee_amount) || 0;

    const [result] = await pool.execute(
      `INSERT INTO events (
        organizer_id, title, description, category, venue, starts_at, ends_at,
        registration_deadline, capacity, fee_amount, requires_approval, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
      [
        organizerId,
        data.title,
        data.description,
        data.category,
        data.venue,
        data.starts_at,
        data.ends_at,
        data.registration_deadline,
        data.capacity,
        fee,
        data.requires_approval,
      ]
    );

    const event = await getEventDetails(result.insertId);
    res.status(201).json({
      message: 'Event successfully created and published.',
      event,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id (FR-010, FR-013)
router.put(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  eventMutateLimiter,
  async (req, res, next) => {
    try {
      const eventId = Number(req.params.id);
      const data = eventFormSchema.parse(req.body);
      const current = await getEventDetails(eventId);
      const fee = Number(data.fee_amount) || 0;

      const bookedCount = current.approved_count + current.pending_count;
      if (data.capacity < bookedCount) {
        throw new AppError(
          422,
          'CAPACITY_TOO_LOW',
          `Capacity cannot be set below the ${bookedCount} seats currently registered or pending approval.`,
          { capacity: `Minimum allowed capacity is currently ${bookedCount}.` }
        );
      }

      await pool.execute(
        `UPDATE events SET
          title = ?,
          description = ?,
          category = ?,
          venue = ?,
          starts_at = ?,
          ends_at = ?,
          registration_deadline = ?,
          capacity = ?,
          fee_amount = ?,
          requires_approval = ?
        WHERE id = ?`,
        [
          data.title,
          data.description,
          data.category,
          data.venue,
          data.starts_at,
          data.ends_at,
          data.registration_deadline,
          data.capacity,
          fee,
          data.requires_approval,
          eventId,
        ]
      );

      // Notify registered participants if details or fee changed
      const [attendees] = await pool.query(
        "SELECT user_id FROM registrations WHERE event_id = ? AND status IN ('approved', 'pending')",
        [eventId]
      );

      for (const a of attendees) {
        await pool.execute(
          `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
           VALUES (?, 'EVENT_UPDATE', ?, ?, 0, NOW())`,
          [
            a.user_id,
            `Important schedule/detail update for event: "${data.title}". Please verify the updated date and venue.`,
            eventId,
          ]
        );
      }

      const event = await getEventDetails(eventId);
      res.status(200).json({
        message: 'Event details updated successfully.',
        event,
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/events/:id (FR-011, FR-013)
router.delete(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  eventMutateLimiter,
  async (req, res, next) => {
    try {
      const eventId = Number(req.params.id);
      const [regRows] = await pool.query(
        'SELECT id, user_id, status FROM registrations WHERE event_id = ?',
        [eventId]
      );

      if (!regRows || regRows.length === 0) {
        await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
        return res.status(200).json({
          action: 'deleted',
          message: 'Event had no registrations and has been permanently deleted.',
        });
      }

      await pool.execute("UPDATE events SET status = 'cancelled' WHERE id = ?", [eventId]);

      const [eventRow] = await pool.query('SELECT title FROM events WHERE id = ?', [eventId]);
      const title = eventRow[0]?.title || 'Campus Event';

      for (const reg of regRows) {
        if (reg.status !== 'cancelled') {
          await pool.execute(
            `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
             VALUES (?, 'EVENT_UPDATE', ?, ?, 0, NOW())`,
            [reg.user_id, `The event "${title}" has been cancelled by the organizer.`, eventId]
          );
        }
      }

      res.status(200).json({
        action: 'cancelled',
        message: 'Event has active registrations and has been marked as cancelled. Participants have been notified.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/events/:id/attendees (FR-015)
router.get(
  '/:id/attendees',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  async (req, res, next) => {
    try {
      const eventId = Number(req.params.id);
      const [attendees] = await pool.query(
        `SELECT 
          r.id AS registration_id,
          r.status,
          r.registered_at,
          r.decided_at,
          u.id AS user_id,
          u.username,
          u.full_name,
          u.email,
          u.school_id
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.registered_at ASC`,
        [eventId]
      );

      res.status(200).json({ attendees });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/events/:id/attendees/csv (FR-015)
router.get(
  '/:id/attendees/csv',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  async (req, res, next) => {
    try {
      const eventId = Number(req.params.id);
      const event = await getEventDetails(eventId);
      const [attendees] = await pool.query(
        `SELECT 
          r.id AS registration_id,
          r.status,
          r.registered_at,
          r.decided_at,
          u.id AS user_id,
          u.username,
          u.full_name,
          u.email,
          u.school_id
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.registered_at ASC`,
        [eventId]
      );

      const headers = ['Registration ID', 'Reference Code', 'Full Name', 'School ID', 'Username', 'Email', 'Fee', 'Status', 'Registered At', 'Decided At'];
      const feeLabel = event.fee_amount > 0 ? Number(event.fee_amount).toFixed(2) : 'Free';
      const rows = attendees.map((a) => {
        const ref = `EVT-${String(eventId).padStart(4, '0')}-${String(a.registration_id).padStart(4, '0')}`;
        return [
          a.registration_id,
          ref,
          `"${String(a.full_name || '').replace(/"/g, '""')}"`,
          `"${String(a.school_id || '').replace(/"/g, '""')}"`,
          `"${String(a.username || '').replace(/"/g, '""')}"`,
          `"${String(a.email || '').replace(/"/g, '""')}"`,
          feeLabel,
          a.status,
          a.registered_at,
          a.decided_at || 'N/A',
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const safeTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const filename = `attendees_evt_${eventId}_${safeTitle}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
