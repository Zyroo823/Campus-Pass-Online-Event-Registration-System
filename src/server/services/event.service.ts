/**
 * Event Service
 * FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-014, FR-015
 * NFR-001, NFR-004
 */

import { pool } from '../db/connection.ts';
import { EventFormInput, EventQueryInput } from '../validators/event.validator.ts';
import { AppError } from '../middleware/error.middleware.ts';
import { notificationService } from './notification.service.ts';

export function getNowInAppTimezone(): string {
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
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

export class EventService {
  /**
   * List events with search and filtering
   * FR-004, FR-005, NFR-001 (paginated server-side, default 12)
   */
  async listEvents(query: EventQueryInput, organizerIdOnly?: number) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];
    const nowStr = getNowInAppTimezone();
    const isPast = query.when === 'past';

    // Filter by organizer if specified (e.g. for organizer dashboard)
    if (organizerIdOnly) {
      whereClauses.push('e.organizer_id = ?');
      params.push(organizerIdOnly);
      if (query.when === 'past') {
        whereClauses.push('e.starts_at <= ?');
        params.push(nowStr);
      } else if (query.when === 'upcoming') {
        whereClauses.push('e.starts_at > ?');
        params.push(nowStr);
      }
    } else {
      // By default for public directory, only show published events
      whereClauses.push("e.status = 'published'");
      // FR-004: Server-side upcoming / past filtering (default upcoming)
      if (isPast) {
        whereClauses.push('e.starts_at <= ?');
        params.push(nowStr);
      } else {
        whereClauses.push('e.starts_at > ?');
        params.push(nowStr);
      }
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

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderSql = isPast ? 'ORDER BY e.starts_at DESC' : 'ORDER BY e.starts_at ASC';

    // Count total records for pagination
    const countSql = `SELECT COUNT(*) AS total FROM events e ${whereSql}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    // Fetch records with approved seats count
    const listSql = `
      SELECT 
        e.*,
        u.full_name AS organizer_name,
        u.email AS organizer_email,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('approved', 'pending')) AS total_booked
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      ${whereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(listSql, [...params, limit, offset]);

    const events = rows.map((ev: any) => {
      const approved = Number(ev.approved_count || 0);
      const pending = Number(ev.pending_count || 0);
      const seatsRemaining = Math.max(0, ev.capacity - approved);
      const isFull = seatsRemaining <= 0;
      const isPastDeadline = ev.registration_deadline <= nowStr;
      const hasStarted = ev.starts_at <= nowStr;

      return {
        ...ev,
        approved_count: approved,
        pending_count: pending,
        seats_remaining: seatsRemaining,
        is_full: isFull,
        is_past_deadline: isPastDeadline,
        has_started: hasStarted,
      };
    });

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single event details
   * FR-006
   */
  async getEventById(id: number) {
    const sql = `
      SELECT 
        e.*,
        u.full_name AS organizer_name,
        u.email AS organizer_email,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('approved', 'pending')) AS total_booked
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ?
    `;

    const [rows] = await pool.query(sql, [id]);
    if (!rows || rows.length === 0) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'The requested event could not be found.');
    }

    const nowStr = getNowInAppTimezone();
    const ev = rows[0];
    const approved = Number(ev.approved_count || 0);
    const pending = Number(ev.pending_count || 0);
    const seatsRemaining = Math.max(0, ev.capacity - approved);
    const isFull = seatsRemaining <= 0;
    const isPastDeadline = ev.registration_deadline <= nowStr;
    const hasStarted = ev.starts_at <= nowStr;

    return {
      ...ev,
      approved_count: approved,
      pending_count: pending,
      seats_remaining: seatsRemaining,
      is_full: isFull,
      is_past_deadline: isPastDeadline,
      has_started: hasStarted,
    };
  }

  /**
   * Create an event
   * FR-009
   */
  async createEvent(organizerId: number, data: EventFormInput) {
    const [result] = await pool.execute(
      `INSERT INTO events (
        organizer_id, title, description, category, venue, starts_at, ends_at,
        registration_deadline, capacity, requires_approval, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
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
        data.requires_approval,
      ]
    );

    return this.getEventById(result.insertId);
  }

  /**
   * Edit event
   * FR-010: capacity on edit never below current pending + approved count
   * FR-013: notify registered participants
   */
  async editEvent(eventId: number, data: EventFormInput) {
    const current = await this.getEventById(eventId);

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
        data.requires_approval,
        eventId,
      ]
    );

    // Notify registered participants of changes (FR-013)
    const [attendees] = await pool.query(
      "SELECT user_id FROM registrations WHERE event_id = ? AND status IN ('approved', 'pending')",
      [eventId]
    );

    for (const a of attendees) {
      await notificationService.createNotification(
        a.user_id,
        'EVENT_UPDATE',
        `Important schedule/detail update for event: "${data.title}". Please verify the updated date and venue.`,
        eventId
      );
    }

    return this.getEventById(eventId);
  }

  /**
   * Delete or Cancel event
   * FR-011: delete if no registrations; cancel if has registrations.
   * FR-013: notify registered participants if cancelled.
   */
  async deleteOrCancelEvent(eventId: number): Promise<{ action: 'deleted' | 'cancelled'; message: string }> {
    const [regRows] = await pool.query(
      'SELECT id, user_id, status FROM registrations WHERE event_id = ?',
      [eventId]
    );

    const hasRegistrations = regRows && regRows.length > 0;

    if (!hasRegistrations) {
      // No registrations -> hard delete from database
      await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
      return {
        action: 'deleted',
        message: 'Event had no registrations and has been permanently deleted.',
      };
    }

    // Has registrations -> mark as cancelled
    await pool.execute("UPDATE events SET status = 'cancelled' WHERE id = ?", [eventId]);

    // Notify all active participants (FR-013)
    const [eventRow] = await pool.query('SELECT title FROM events WHERE id = ?', [eventId]);
    const title = eventRow[0]?.title || 'Campus Event';

    for (const reg of regRows) {
      if (reg.status !== 'cancelled') {
        await notificationService.createNotification(
          reg.user_id,
          'EVENT_UPDATE',
          `The event "${title}" has been cancelled by the organizer.`,
          eventId
        );
      }
    }

    return {
      action: 'cancelled',
      message: 'Event has active registrations and has been marked as cancelled. Participants have been notified.',
    };
  }

  /**
   * Register for event
   * FR-007, NFR-004: DB transaction with row lock (SELECT ... FOR UPDATE)
   * Prevents race conditions and oversubscription.
   * Re-registering after cancelling reuses the same row.
   */
  async registerForEvent(eventId: number, userId: number) {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock event row with FOR UPDATE (NFR-004)
      const [events] = await conn.query(
        `SELECT 
          e.*,
          (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
          (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count
        FROM events e 
        WHERE e.id = ? FOR UPDATE`,
        [eventId]
      );

      if (!events || events.length === 0) {
        throw new AppError(404, 'EVENT_NOT_FOUND', 'The requested event does not exist.');
      }

      const ev = events[0];
      const nowStr = getNowInAppTimezone();

      // 1. Check event not cancelled
      if (ev.status === 'cancelled') {
        throw new AppError(409, 'EVENT_CANCELLED', 'This event has been cancelled by the organizer and is not accepting registrations.');
      }

      // 2. Check event not started
      if (ev.starts_at <= nowStr) {
        throw new AppError(409, 'EVENT_STARTED', 'Registration is closed because this event has already started.');
      }

      // 3. Check registration deadline not passed
      if (ev.registration_deadline <= nowStr) {
        throw new AppError(409, 'DEADLINE_PASSED', 'The registration deadline for this event has passed.');
      }

      // 4. Check capacity (full event check)
      const approvedCount = Number(ev.approved_count || 0);
      if (approvedCount >= ev.capacity) {
        throw new AppError(409, 'EVENT_FULL', 'This event has reached full capacity. No seats are remaining.');
      }

      // 5. Check existing registration
      const [existing] = await conn.query(
        'SELECT * FROM registrations WHERE event_id = ? AND user_id = ?',
        [eventId, userId]
      );

      const targetStatus = ev.requires_approval === 1 ? 'pending' : 'approved';
      let registrationId: number;

      if (existing && existing.length > 0) {
        const reg = existing[0];
        if (reg.status === 'approved' || reg.status === 'pending') {
          throw new AppError(
            409,
            'ALREADY_REGISTERED',
            reg.status === 'approved'
              ? 'You are already registered for this event.'
              : 'Your registration is currently pending review by the event organizer.'
          );
        }

        // If previously cancelled or rejected, re-registering reuses the same row
        await conn.execute(
          `UPDATE registrations 
           SET status = ?, registered_at = NOW(), decided_at = ? 
           WHERE id = ?`,
          [targetStatus, targetStatus === 'approved' ? new Date() : null, reg.id]
        );
        registrationId = reg.id;
      } else {
        // Insert new registration
        const [insertRes] = await conn.execute(
          `INSERT INTO registrations (event_id, user_id, status, registered_at, decided_at)
           VALUES (?, ?, ?, NOW(), ?)`,
          [eventId, userId, targetStatus, targetStatus === 'approved' ? new Date() : null]
        );
        registrationId = insertRes.insertId;
      }

      await conn.commit();

      // Zero-padded reference code EVT-{eventId}-{registrationId}
      const refCode = `EVT-${String(eventId).padStart(4, '0')}-${String(registrationId).padStart(4, '0')}`;

      // Create notification
      if (targetStatus === 'pending') {
        await notificationService.createNotification(
          userId,
          'REGISTRATION_STATUS',
          `Your registration for "${ev.title}" has been submitted and is pending organizer approval.`,
          eventId
        );
      } else {
        await notificationService.createNotification(
          userId,
          'REGISTRATION_STATUS',
          `You are confirmed for "${ev.title}". Reference pass: ${refCode}.`,
          eventId
        );
      }

      return {
        registration_id: registrationId,
        status: targetStatus,
        reference_code: refCode,
        event_title: ev.title,
        starts_at: ev.starts_at,
        venue: ev.venue,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Cancel own registration before event starts
   * FR-008
   */
  async cancelRegistration(eventId: number, userId: number) {
    const [regs] = await pool.query(
      'SELECT r.*, e.starts_at, e.title FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.event_id = ? AND r.user_id = ?',
      [eventId, userId]
    );

    if (!regs || regs.length === 0) {
      throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'No active registration found for this event.');
    }

    const reg = regs[0];

    if (reg.status === 'cancelled') {
      throw new AppError(400, 'ALREADY_CANCELLED', 'This registration has already been cancelled.');
    }

    // Must be before event starts
    const nowStr = getNowInAppTimezone();
    if (reg.starts_at <= nowStr) {
      throw new AppError(
        400,
        'CANNOT_CANCEL_PAST_START',
        'Registrations cannot be cancelled after the event has already started.'
      );
    }

    await pool.execute(
      "UPDATE registrations SET status = 'cancelled', decided_at = NOW() WHERE event_id = ? AND user_id = ?",
      [eventId, userId]
    );

    return {
      message: `Your registration for "${reg.title}" has been cancelled.`,
    };
  }

  /**
   * Organizer approval / rejection
   * FR-012, FR-013
   */
  async decideRegistration(eventId: number, registrationId: number, decision: 'approved' | 'rejected') {
    const [regs] = await pool.query(
      'SELECT r.*, e.title, e.capacity, e.organizer_id FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?',
      [registrationId, eventId]
    );

    if (!regs || regs.length === 0) {
      throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Registration record not found.');
    }

    const reg = regs[0];

    // If approving, make sure capacity isn't exceeded
    if (decision === 'approved') {
      const [approvedCountRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM registrations WHERE event_id = ? AND status = 'approved'",
        [eventId]
      );
      const currentApproved = Number(approvedCountRows[0]?.count || 0);
      if (currentApproved >= reg.capacity) {
        throw new AppError(409, 'EVENT_FULL', 'Cannot approve registration because the event is already at capacity.');
      }
    }

    await pool.execute(
      'UPDATE registrations SET status = ?, decided_at = NOW() WHERE id = ? AND event_id = ?',
      [decision, registrationId, eventId]
    );

    // Notify participant (FR-013)
    const msg =
      decision === 'approved'
        ? `Your registration for "${reg.title}" has been approved by the organizer.`
        : `Your registration request for "${reg.title}" was declined by the organizer.`;

    await notificationService.createNotification(reg.user_id, 'REGISTRATION_STATUS', msg, eventId);

    return {
      registration_id: registrationId,
      status: decision,
      message: `Registration marked as ${decision}.`,
    };
  }

  /**
   * Get Attendee list
   * FR-015
   */
  async getAttendees(eventId: number) {
    const [rows] = await pool.query(
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
    return rows;
  }

  /**
   * Attendee CSV export
   * FR-015
   */
  async getAttendeesCsv(eventId: number): Promise<{ csv: string; filename: string }> {
    const event = await this.getEventById(eventId);
    const attendees = await this.getAttendees(eventId);

    const headers = ['Registration ID', 'Reference Code', 'Full Name', 'School ID', 'Username', 'Email', 'Status', 'Registered At', 'Decided At'];
    const rows = attendees.map((a: any) => {
      const ref = `EVT-${String(eventId).padStart(4, '0')}-${String(a.registration_id).padStart(4, '0')}`;
      return [
        a.registration_id,
        ref,
        `"${String(a.full_name || '').replace(/"/g, '""')}"`,
        `"${String(a.school_id || '').replace(/"/g, '""')}"`,
        `"${String(a.username || '').replace(/"/g, '""')}"`,
        `"${String(a.email || '').replace(/"/g, '""')}"`,
        a.status,
        a.registered_at,
        a.decided_at || 'N/A',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const safeTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `attendees_evt_${eventId}_${safeTitle}.csv`;

    return { csv, filename };
  }

  /**
   * Participant tickets dashboard
   * FR-014
   */
  async getParticipantTickets(userId: number) {
    const [rows] = await pool.query(
      `SELECT 
        r.id AS registration_id,
        r.status AS registration_status,
        r.registered_at,
        r.decided_at,
        e.id AS event_id,
        e.title,
        e.description,
        e.category,
        e.venue,
        e.starts_at,
        e.ends_at,
        e.registration_deadline,
        e.capacity,
        e.requires_approval,
        e.status AS event_status,
        u.full_name AS organizer_name
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN users u ON e.organizer_id = u.id
      WHERE r.user_id = ?
      ORDER BY e.starts_at ASC`,
      [userId]
    );

    return rows.map((r: any) => ({
      ...r,
      reference_code: `EVT-${String(r.event_id).padStart(4, '0')}-${String(r.registration_id).padStart(4, '0')}`,
      has_started: new Date(r.starts_at).getTime() <= Date.now(),
    }));
  }

  /**
   * Organizer Dashboard: events + pending approval queue
   * FR-012, FR-014
   */
  async getOrganizerDashboard(organizerId: number) {
    // 1. Pending queue
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
    const { events } = await this.listEvents({ limit: 100, page: 1, sort: 'starts_at_asc' }, organizerId);

    return {
      pendingQueue: pendingRows,
      events,
    };
  }
}

export const eventService = new EventService();
