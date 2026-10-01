/**
 * Participant Dashboard: "My Tickets"
 * FR-014: Participant role dashboard showing tickets grouped by week
 * FR-008: Cancel own registration before event starts
 * UI: Ticket stubs with reference codes, status stamps (APPROVED, PENDING, REJECTED, CANCELLED)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Ticket } from '../types/index.ts';
import { api, ClientApiError } from '../lib/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.tsx';
import { Calendar, MapPin, Ticket as TicketIcon, Clock, ArrowRight, Ban } from 'lucide-react';

export const ParticipantDashboardPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketToCancel, setSelectedTicketToCancel] = useState<Ticket | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { showToast } = useToast();

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ tickets: Ticket[] }>('/api/events/my-tickets');
      setTickets(res.tickets);
    } catch (err: any) {
      showToast(err.message || 'Could not load your event passes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleConfirmCancel = async () => {
    if (!selectedTicketToCancel) return;
    setCancelling(true);
    try {
      const res = await api.post(`/api/events/${selectedTicketToCancel.event_id}/cancel`);
      showToast(res.message, 'success');
      setSelectedTicketToCancel(null);
      fetchTickets();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel registration.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  // Group tickets by week (Monday as week start)
  const groupedTickets = useMemo(() => {
    const groups: Record<string, Ticket[]> = {};

    tickets.forEach(ticket => {
      const d = new Date(ticket.starts_at);
      // Find Monday of the event week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekLabel = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      if (!groups[weekLabel]) {
        groups[weekLabel] = [];
      }
      groups[weekLabel].push(ticket);
    });

    return groups;
  }, [tickets]);

  return (
    <main role="main" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header Landmark */}
      <section className="border-b-2 border-ink pb-4 mb-8">
        <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
          Participant Dashboard
        </span>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-1">
          <h1 data-testid="dashboard-title" className="font-display font-black text-3xl sm:text-4xl text-ink">
            My Registered Passes
          </h1>
          <div className="font-mono text-xs text-ink-muted">
            {tickets.length} {tickets.length === 1 ? 'pass active or on file' : 'passes active or on file'}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="p-8 border-2 border-ink bg-paper animate-pulse space-y-4">
          <div className="w-48 h-6 bg-paper-dark" />
          <div className="w-full h-24 bg-paper-dark/60" />
        </div>
      ) : tickets.length === 0 ? (
        <section
          data-testid="no-tickets-view"
          className="p-10 border-2 border-ink bg-paper text-center space-y-3 shadow-hard"
        >
          <TicketIcon className="w-10 h-10 text-ink-muted mx-auto" />
          <h2 className="font-display font-bold text-xl text-ink">No Event Registrations Yet</h2>
          <p className="font-body text-sm text-ink-muted max-w-md mx-auto">
            You have not registered for any upcoming events. Browse the public campus calendar to claim your admission passes.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              data-testid="browse-events-btn"
              className="inline-flex items-center gap-2 px-4 py-2 border-2 border-ink bg-vermilion text-paper font-mono text-xs font-bold shadow-hard-sm hover:bg-vermilion-hover transition-colors"
            >
              <span>Explore Upcoming Events</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedTickets).map(([weekTitle, weekItems]) => (
            <section key={weekTitle} aria-label={weekTitle} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink bg-paper-dark border border-ink px-2.5 py-1">
                  {weekTitle}
                </span>
                <div className="flex-1 border-b-2 border-dashed border-ink/40" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {weekItems.map(ticket => {
                  const isApproved = ticket.registration_status === 'approved';
                  const isPending = ticket.registration_status === 'pending';
                  const isCancelled = ticket.registration_status === 'cancelled';
                  const isRejected = ticket.registration_status === 'rejected';

                  const canCancel =
                    (isApproved || isPending) &&
                    !ticket.has_started &&
                    new Date(ticket.starts_at).getTime() > Date.now();

                  return (
                    <article
                      key={ticket.registration_id}
                      data-testid={`ticket-card-${ticket.registration_id}`}
                      className="bg-paper border-2 border-ink shadow-hard flex flex-col justify-between overflow-hidden relative"
                    >
                      {/* Top Bar with Reference Code */}
                      <div className="bg-paper-dark border-b-2 border-ink px-4 py-2.5 flex items-center justify-between">
                        <span
                          data-testid={`ticket-ref-${ticket.registration_id}`}
                          className="font-mono font-bold text-xs text-ink bg-paper px-2 py-0.5 border border-ink"
                        >
                          {ticket.reference_code}
                        </span>
                        <span className="text-xs font-mono text-ink-muted">
                          Registered: {new Date(ticket.registered_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-xs font-mono text-ink-muted uppercase">
                              {ticket.category}
                            </span>
                            <h3 className="font-display font-bold text-lg text-ink leading-snug">
                              {ticket.title}
                            </h3>
                          </div>

                          {/* Status Stamp */}
                          <div className="shrink-0">
                            {isApproved && (
                              <div
                                data-testid={`ticket-status-${ticket.registration_id}`}
                                className="border-2 border-olive text-olive font-display font-black text-xs px-2 py-0.5 tracking-wider uppercase rotate-[-6deg] bg-paper"
                              >
                                APPROVED
                              </div>
                            )}
                            {isPending && (
                              <div
                                data-testid={`ticket-status-${ticket.registration_id}`}
                                className="border-2 border-mustard text-mustard font-display font-black text-xs px-2 py-0.5 tracking-wider uppercase rotate-[-6deg] bg-paper"
                              >
                                PENDING
                              </div>
                            )}
                            {isCancelled && (
                              <div
                                data-testid={`ticket-status-${ticket.registration_id}`}
                                className="border-2 border-ink text-ink font-display font-black text-xs px-2 py-0.5 tracking-wider uppercase rotate-[-6deg] bg-paper line-through decoration-vermilion"
                              >
                                CANCELLED
                              </div>
                            )}
                            {isRejected && (
                              <div
                                data-testid={`ticket-status-${ticket.registration_id}`}
                                className="border-2 border-ink text-ink font-display font-black text-xs px-2 py-0.5 tracking-wider uppercase rotate-[-6deg] bg-paper line-through decoration-ink"
                              >
                                REJECTED
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 font-mono text-xs text-ink-muted border-t border-ink/20 pt-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-ink" />
                            <span>{new Date(ticket.starts_at).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-ink" />
                            <span>{ticket.venue}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom action perforation strip */}
                      <div className="border-t-2 border-dashed border-ink p-3 bg-paper-light flex items-center justify-between gap-3">
                        <Link
                          to={`/events/${ticket.event_id}`}
                          className="font-mono text-xs font-bold text-ink hover:text-vermilion flex items-center gap-1"
                        >
                          <span>Event Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>

                        {canCancel && (
                          <button
                            type="button"
                            data-testid={`cancel-ticket-btn-${ticket.registration_id}`}
                            onClick={() => setSelectedTicketToCancel(ticket)}
                            className="px-2.5 py-1 text-xs font-mono font-bold border border-ink text-vermilion hover:bg-vermilion hover:text-paper transition-colors cursor-pointer"
                          >
                            Cancel Pass
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Ticket Cancellation (FR-008, NFR-007) */}
      <ConfirmDialog
        isOpen={Boolean(selectedTicketToCancel)}
        title="Cancel Registration"
        itemName={selectedTicketToCancel?.title || ''}
        actionType="cancel"
        confirmLabel={cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
        message="Are you sure you want to surrender your pass for this event? Your seat will be returned to the open pool."
        onConfirm={handleConfirmCancel}
        onClose={() => setSelectedTicketToCancel(null)}
      />
    </main>
  );
};
