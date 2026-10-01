/**
 * Event Controller
 * FR-004 to FR-015
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types.ts';
import { eventService } from '../services/event.service.ts';
import { eventFormSchema, eventQuerySchema, approvalDecisionSchema } from '../validators/event.validator.ts';
import { AppError } from '../middleware/error.middleware.ts';

export class EventController {
  async listEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = eventQuerySchema.parse(req.query);
      const result = await eventService.listEvents(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getEventById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError(400, 'INVALID_ID', 'Invalid event identifier format.');
      }
      const event = await eventService.getEventById(id);
      res.status(200).json({ event });
    } catch (err) {
      next(err);
    }
  }

  async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = eventFormSchema.parse(req.body);
      const organizerId = req.user!.id;
      const event = await eventService.createEvent(organizerId, validated);
      res.status(201).json({ message: 'Event successfully created.', event });
    } catch (err) {
      next(err);
    }
  }

  async editEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const validated = eventFormSchema.parse(req.body);
      const event = await eventService.editEvent(id, validated);
      res.status(200).json({ message: 'Event successfully updated.', event });
    } catch (err) {
      next(err);
    }
  }

  async deleteOrCancelEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const result = await eventService.deleteOrCancelEvent(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async registerForEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = Number(req.params.id);
      const userId = req.user!.id;
      const result = await eventService.registerForEvent(eventId, userId);
      res.status(201).json({
        message: result.status === 'pending'
          ? 'Registration submitted and awaiting organizer approval.'
          : 'Registration confirmed. Your ticket pass has been generated.',
        registration: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async cancelRegistration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = Number(req.params.id);
      const userId = req.user!.id;
      const result = await eventService.cancelRegistration(eventId, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async decideRegistration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = Number(req.params.id);
      const registrationId = Number(req.params.registrationId);
      const { decision } = approvalDecisionSchema.parse(req.body);

      const result = await eventService.decideRegistration(eventId, registrationId, decision);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getAttendees(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = Number(req.params.id);
      const attendees = await eventService.getAttendees(eventId);
      res.status(200).json({ attendees });
    } catch (err) {
      next(err);
    }
  }

  async exportAttendeesCsv(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = Number(req.params.id);
      const { csv, filename } = await eventService.getAttendeesCsv(eventId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  async getParticipantTickets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tickets = await eventService.getParticipantTickets(userId);
      res.status(200).json({ tickets });
    } catch (err) {
      next(err);
    }
  }

  async getOrganizerDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizerId = req.user!.id;
      const data = await eventService.getOrganizerDashboard(organizerId);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}

export const eventController = new EventController();
