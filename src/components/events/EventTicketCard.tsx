/**
 * Event Ticket Card
 * Design Constitution: Printed program aesthetic, ticket layout with big date block,
 * perforation line, stub with seat strip, stamp when full/cancelled.
 * FR-004, FR-005, FR-006, FR-007, NFR-003, NFR-009
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { EventItem } from '../../types/index.ts';
import { SeatStrip } from '../common/SeatStrip.tsx';
import { MapPin, Clock, ArrowRight } from 'lucide-react';

interface EventTicketCardProps {
  event: EventItem;
  onQuickRegister?: (event: EventItem) => void;
  isRegistered?: boolean;
  isPast?: boolean;
}

export const EventTicketCard: React.FC<EventTicketCardProps> = ({
  event,
  onQuickRegister,
  isRegistered,
  isPast = false,
}) => {
  const startDate = new Date(event.starts_at);
  const dayNumber = startDate.getDate().toString().padStart(2, '0');
  const monthName = startDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yearNumber = startDate.getFullYear();
  const timeFormatted = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isFull = event.seats_remaining <= 0;
  const isCancelled = event.status === 'cancelled';
  const isPastDeadline = event.is_past_deadline || new Date(event.registration_deadline).getTime() <= Date.now();
  const hasStarted = event.has_started || startDate.getTime() <= Date.now();
  const hasEnded = new Date(event.ends_at).getTime() <= Date.now();
  const isPastEvent = isPast || hasEnded || hasStarted;

  const canRegister = !isPastEvent && !isFull && !isCancelled && !isPastDeadline && !isRegistered;

  return (
    <article
      data-testid={`event-card-${event.id}`}
      className="bg-paper border-2 border-ink shadow-hard flex flex-col md:flex-row overflow-hidden relative transition-transform hover:-translate-y-0.5"
    >
      {/* 1. Date Block Left */}
      <div className="md:w-32 bg-paper-dark border-b-2 md:border-b-0 md:border-r-2 border-ink p-4 flex md:flex-col items-center justify-center text-center shrink-0">
        <span className="font-mono text-xs uppercase tracking-widest text-[#38342B] font-medium">
          {monthName}
        </span>
        <span className="font-display font-black text-4xl md:text-5xl text-ink leading-none my-0.5">
          {dayNumber}
        </span>
        <span className="font-mono text-xs text-[#38342B]">
          {yearNumber}
        </span>
      </div>

      {/* 2. Main Ticket Body */}
      <div className="flex-1 p-4 md:p-5 flex flex-col justify-between gap-3 min-w-0">
        <div>
          {/* Metadata: clean unboxed text with subtle separator */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#38342B] mb-1.5 flex-wrap">
            <span className="font-semibold text-ink">{event.category}</span>
            <span>·</span>
            <span>Deadline: {new Date(event.registration_deadline).toLocaleDateString()}</span>
            {event.requires_approval ? (
              <>
                <span>·</span>
                <span className="text-[#8F6605] font-bold">Requires Approval</span>
              </>
            ) : null}
          </div>

          <Link to={`/events/${event.id}`} className="group block">
            <h3
              data-testid={`event-title-${event.id}`}
              className="font-display font-bold text-lg md:text-xl text-ink group-hover:text-vermilion transition-colors leading-tight mb-2"
            >
              {event.title}
            </h3>
          </Link>

          <p className="text-sm font-body text-[#38342B] line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-ink pt-2 border-t border-ink/20">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#38342B] shrink-0" />
            <span>{timeFormatted}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#38342B] shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
        </div>
      </div>

      {/* 3. Stub with Perforation divider */}
      <div className="border-t-2 md:border-t-0 md:border-l-2 border-dashed border-ink md:w-60 p-4 bg-paper-light flex flex-col justify-between gap-3 shrink-0">
        <div>
          <div className="text-xs font-mono text-[#38342B] uppercase tracking-wider mb-1 font-medium">
            Pass Admission
          </div>
          {/* Text in words is primary info, strip is decorative/aria-hidden, (x/y) hidden on card */}
          <SeatStrip
            capacity={event.capacity}
            approvedCount={event.approved_count}
            seatsRemaining={event.seats_remaining}
            isCancelled={isCancelled}
            showExactRatio={false}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {/* Past / Ended events show a plain "Ended" label and no register button */}
          {isPastEvent ? (
            <div
              data-testid="event-ended-label"
              className="py-1.5 px-3 border-2 border-ink bg-paper-dark text-ink text-center text-xs font-mono font-bold uppercase tracking-wider"
            >
              Ended
            </div>
          ) : (
            <>
              {canRegister && onQuickRegister && (
                <button
                  type="button"
                  data-testid={`register-btn-${event.id}`}
                  onClick={() => onQuickRegister(event)}
                  className="w-full py-2 px-3 text-xs font-mono font-bold border-2 border-ink bg-vermilion text-paper hover:bg-vermilion-hover transition-colors shadow-hard-sm cursor-pointer text-center"
                >
                  {event.requires_approval ? 'Request Approval' : 'Claim Pass'}
                </button>
              )}

              {isRegistered && (
                <div
                  data-testid={`registered-badge-${event.id}`}
                  className="py-1 px-2 border-2 border-olive bg-olive-faint text-olive text-center text-xs font-mono font-bold uppercase"
                >
                  Registered
                </div>
              )}
            </>
          )}

          <Link
            to={`/events/${event.id}`}
            data-testid={`view-event-btn-${event.id}`}
            className="w-full py-1.5 px-3 text-xs font-mono font-bold border-2 border-ink bg-paper text-ink hover:bg-paper-dark transition-colors shadow-hard-sm text-center flex items-center justify-center gap-1"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};
