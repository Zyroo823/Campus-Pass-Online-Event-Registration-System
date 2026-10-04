/**
 * Registration Routes
 * FR-007, FR-008, FR-012, FR-014, NFR-004
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { registrationDecisionSchema } from '../validators.js';
import {
  authenticate,
  requireRole,
  requireEventOwnership,
  eventRegisterLimiter,
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

// GET /api/events/my-tickets (FR-008, FR-014)
router.get('/my-tickets', authenticate, async (req, res, next) => {
  try {
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
        e.fee_amount,
        e.requires_approval,
        e.status AS event_status,
        u.full_name AS organizer_name
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN users u ON e.organizer_id = u.id
      WHERE r.user_id = ?
      ORDER BY e.starts_at ASC`,
      [req.user.id]
    );

    const tickets = rows.map((r) => ({
      ...r,
      fee_amount: Number(r.fee_amount) || 0,
      reference_code: `EVT-${String(r.event_id).padStart(4, '0')}-${String(r.registration_id).padStart(4, '0')}`,
      has_started: new Date(r.starts_at).getTime() <= Date.now(),
    }));

    res.status(200).json({ tickets });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/register (FR-007, NFR-004)
router.post('/:id/register', authenticate, eventRegisterLimiter, async (req, res, next) => {
  const eventId = Number(req.params.id);
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

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

    if (ev.status === 'cancelled') {
      throw new AppError(409, 'EVENT_CANCELLED', 'This event has been cancelled by the organizer and is not accepting registrations.');
    }

    if (ev.starts_at <= nowStr) {
      throw new AppError(409, 'EVENT_STARTED', 'Registration is closed because this event has already started.');
    }

    if (ev.registration_deadline <= nowStr) {
      throw new AppError(409, 'DEADLINE_PASSED', 'The registration deadline for this event has passed.');
    }

    const approvedCount = Number(ev.approved_count || 0);
    if (approvedCount >= ev.capacity) {
      throw new AppError(409, 'EVENT_FULL', 'This event has reached full capacity. No seats are remaining.');
    }

    const [existing] = await conn.query(
      'SELECT * FROM registrations WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );

    const targetStatus = ev.requires_approval === 1 ? 'pending' : 'approved';
    let registrationId;

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

      await conn.execute(
        `UPDATE registrations 
         SET status = ?, registered_at = NOW(), decided_at = ? 
         WHERE id = ?`,
        [targetStatus, targetStatus === 'approved' ? new Date() : null, reg.id]
      );
      registrationId = reg.id;
    } else {
      const [insertRes] = await conn.execute(
        `INSERT INTO registrations (event_id, user_id, status, registered_at, decided_at)
         VALUES (?, ?, ?, NOW(), ?)`,
        [eventId, userId, targetStatus, targetStatus === 'approved' ? new Date() : null]
      );
      registrationId = insertRes.insertId;
    }

    await conn.commit();

    const refCode = `EVT-${String(eventId).padStart(4, '0')}-${String(registrationId).padStart(4, '0')}`;

    // Notification
    const notifMsg = targetStatus === 'pending'
      ? `Your registration for "${ev.title}" has been submitted and is pending organizer approval.`
      : `You are confirmed for "${ev.title}". Reference pass: ${refCode}.`;

    await pool.execute(
      `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
       VALUES (?, 'REGISTRATION_STATUS', ?, ?, 0, NOW())`,
      [userId, notifMsg, eventId]
    );

    res.status(201).json({
      message: targetStatus === 'pending'
        ? 'Registration submitted. This event requires organizer approval.'
        : 'Registration confirmed. Your ticket pass has been generated.',
      registration: {
        registration_id: registrationId,
        status: targetStatus,
        reference_code: refCode,
        event_title: ev.title,
        starts_at: ev.starts_at,
        venue: ev.venue,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PATCH /api/registrations/:id/cancel or PATCH /api/events/:id/cancel (FR-008)
router.patch('/:id/cancel', authenticate, eventRegisterLimiter, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    // Search by registration id first, or fallback to event id
    let [regs] = await pool.query(
      `SELECT r.*, e.starts_at, e.title 
       FROM registrations r 
       JOIN events e ON r.event_id = e.id 
       WHERE r.id = ?`,
      [id]
    );

    if (!regs || regs.length === 0) {
      // Fallback: check if id was event_id
      const [byEvent] = await pool.query(
        `SELECT r.*, e.starts_at, e.title 
         FROM registrations r 
         JOIN events e ON r.event_id = e.id 
         WHERE r.event_id = ? AND r.user_id = ?`,
        [id, userId]
      );
      regs = byEvent;
    }

    if (!regs || regs.length === 0) {
      throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Registration not found.');
    }

    const reg = regs[0];

    if (reg.user_id !== userId && req.user.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to cancel this pass.');
    }

    if (reg.status === 'cancelled') {
      throw new AppError(409, 'ALREADY_CANCELLED', 'This pass is already cancelled.');
    }

    const nowStr = getNowInAppTimezone();
    if (reg.starts_at <= nowStr) {
      throw new AppError(
        409,
        'EVENT_STARTED',
        "This event has already started, so the pass can't be cancelled."
      );
    }

    await pool.execute(
      "UPDATE registrations SET status = 'cancelled', decided_at = NOW() WHERE id = ?",
      [reg.id]
    );

    res.status(200).json({
      message: 'Your pass was cancelled.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/cancel (FR-008 alias)
router.post('/:id/cancel', authenticate, eventRegisterLimiter, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    let [regs] = await pool.query(
      `SELECT r.*, e.starts_at, e.title 
       FROM registrations r 
       JOIN events e ON r.event_id = e.id 
       WHERE r.id = ?`,
      [id]
    );

    if (!regs || regs.length === 0) {
      const [byEvent] = await pool.query(
        `SELECT r.*, e.starts_at, e.title 
         FROM registrations r 
         JOIN events e ON r.event_id = e.id 
         WHERE r.event_id = ? AND r.user_id = ?`,
        [id, userId]
      );
      regs = byEvent;
    }

    if (!regs || regs.length === 0) {
      throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Registration not found.');
    }

    const reg = regs[0];

    if (reg.user_id !== userId && req.user.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to cancel this pass.');
    }

    if (reg.status === 'cancelled') {
      throw new AppError(409, 'ALREADY_CANCELLED', 'This pass is already cancelled.');
    }

    const nowStr = getNowInAppTimezone();
    if (reg.starts_at <= nowStr) {
      throw new AppError(
        409,
        'EVENT_STARTED',
        "This event has already started, so the pass can't be cancelled."
      );
    }

    await pool.execute(
      "UPDATE registrations SET status = 'cancelled', decided_at = NOW() WHERE id = ?",
      [reg.id]
    );

    res.status(200).json({
      message: 'Your pass was cancelled.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/registrations/:registrationId/decision (FR-012)
router.post(
  '/:id/registrations/:registrationId/decision',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  async (req, res, next) => {
    try {
      const eventId = Number(req.params.id);
      const registrationId = Number(req.params.registrationId);
      const { decision } = registrationDecisionSchema.parse(req.body);
      const targetStatus = decision === 'approve' ? 'approved' : 'rejected';

      const [regs] = await pool.query(
        'SELECT r.*, e.title, e.capacity, e.organizer_id FROM registrations r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?',
        [registrationId, eventId]
      );

      if (!regs || regs.length === 0) {
        throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Registration record not found.');
      }

      const reg = regs[0];

      if (targetStatus === 'approved') {
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
        [targetStatus, registrationId, eventId]
      );

      const msg = targetStatus === 'approved'
        ? `Your registration for "${reg.title}" has been approved by the organizer.`
        : `Your registration request for "${reg.title}" was declined by the organizer.`;

      await pool.execute(
        `INSERT INTO notifications (user_id, type, message, event_id, is_read, created_at)
         VALUES (?, 'REGISTRATION_STATUS', ?, ?, 0, NOW())`,
        [reg.user_id, msg, eventId]
      );

      res.status(200).json({
        registration_id: registrationId,
        status: targetStatus,
        message: `Registration marked as ${targetStatus}.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
