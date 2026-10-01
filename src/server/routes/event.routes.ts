/**
 * Event Routes
 * FR-004 to FR-015, NFR-001, NFR-002, NFR-004
 */

import { Router } from 'express';
import { eventController } from '../controllers/event.controller.ts';
import { authenticate, requireRole, requireEventOwnership } from '../middleware/auth.middleware.ts';
import { eventRegisterLimiter, eventMutateLimiter } from '../middleware/rate-limit.middleware.ts';

const router = Router();

// Public / visitor event listing and details (FR-004, FR-005, FR-006)
router.get('/', (req, res, next) => eventController.listEvents(req, res, next));
router.get('/my-tickets', authenticate, (req, res, next) => eventController.getParticipantTickets(req, res, next));
router.get('/organizer-dashboard', authenticate, requireRole('organizer', 'admin'), (req, res, next) =>
  eventController.getOrganizerDashboard(req, res, next)
);
router.get('/:id', (req, res, next) => eventController.getEventById(req, res, next));

// Organizer event creation (FR-009)
router.post(
  '/',
  authenticate,
  requireRole('organizer', 'admin'),
  eventMutateLimiter,
  (req, res, next) => eventController.createEvent(req, res, next)
);

// Organizer event modification (FR-010)
router.put(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  eventMutateLimiter,
  (req, res, next) => eventController.editEvent(req, res, next)
);

// Organizer event deletion / cancellation (FR-011)
router.delete(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  eventMutateLimiter,
  (req, res, next) => eventController.deleteOrCancelEvent(req, res, next)
);

// Participant registration (FR-007, NFR-004)
router.post(
  '/:id/register',
  authenticate,
  eventRegisterLimiter,
  (req, res, next) => eventController.registerForEvent(req, res, next)
);

// Participant cancellation (FR-008)
router.post(
  '/:id/cancel',
  authenticate,
  (req, res, next) => eventController.cancelRegistration(req, res, next)
);

// Organizer attendee management (FR-015)
router.get(
  '/:id/attendees',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  (req, res, next) => eventController.getAttendees(req, res, next)
);

router.get(
  '/:id/attendees/csv',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  (req, res, next) => eventController.exportAttendeesCsv(req, res, next)
);

// Organizer registration approval / rejection (FR-012)
router.post(
  '/:id/registrations/:registrationId/decision',
  authenticate,
  requireRole('organizer', 'admin'),
  requireEventOwnership,
  (req, res, next) => eventController.decideRegistration(req, res, next)
);

export default router;
