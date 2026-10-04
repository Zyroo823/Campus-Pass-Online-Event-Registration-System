/**
 * Event Detail Page
 * Plain JavaScript
 * FR-006: Display event details: schedule, venue, organizer, seats remaining, fee
 * FR-007: Register for event, rejecting duplicates, full events, past deadline
 * FR-008: Cancel active registration before event starts
 * NFR-003: Usability: under 3 clicks from home; clear error messages
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, ClientApiError } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SeatStrip } from '../components/common/SeatStrip.jsx';
import { RateLimitCountdown } from '../components/common/RateLimitCountdown.jsx';
import { RegistrationSuccessModal } from '../components/common/RegistrationSuccessModal.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { formatFee } from '../utils/formatters.js';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export const EventDetailPage = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(null);
  const [activeUserRegistration, setActiveUserRegistration] = useState(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [registrationModalData, setRegistrationModalData] = useState(null);

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchEvent = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get(`/api/events/${id}`);
      setEvent(res.event);

      if (user) {
        try {
          const ticketsRes = await api.get('/api/events/my-tickets');
          const matched = (ticketsRes.tickets || []).find(
            t => t.event_id === res.event.id && (t.registration_status === 'approved' || t.registration_status === 'pending')
          );
          setActiveUserRegistration(matched || null);
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'The requested event could not be found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEvent();
  }, [id, user]);

  const handleRegister = async () => {
    if (!user) {
      navigate(`/login?redirect=/events/${id}`);
      return;
    }

    setRegistering(true);
    setErrorMessage(null);
    setRateLimitSeconds(null);

    try {
      const res = await api.post(`/api/events/${id}/register`);
      setRegistrationModalData({
        registration_id: res.registration.registration_id,
        status: res.registration.status,
        reference_code: res.registration.reference_code,
        event_title: event.title,
        starts_at: event.starts_at,
        venue: event.venue,
      });
      setActiveUserRegistration({
        registration_id: res.registration.registration_id,
        event_id: event.id,
        registration_status: res.registration.status,
      });

      // Update seat counts locally immediately
      if (res.registration.status === 'approved') {
        setEvent(prev => ({
          ...prev,
          approved_count: prev.approved_count + 1,
          seats_remaining: Math.max(0, prev.seats_remaining - 1),
        }));
      }

      showToast(res.message, 'success');
      fetchEvent();
    } catch (err) {
      if (err instanceof ClientApiError) {
        if (err.status === 429 && err.retryAfterSeconds) {
          setRateLimitSeconds(err.retryAfterSeconds);
        }
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to complete registration. Please try again.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelPass = async () => {
    if (!activeUserRegistration) return;
    setCancelling(true);

    try {
      const res = await api.patch(`/api/registrations/${activeUserRegistration.registration_id}/cancel`);
      showToast(res.message || 'Your pass was cancelled.', 'success');
      setIsCancelDialogOpen(false);

      // Free seat immediately without page reload
      const wasApproved = activeUserRegistration.registration_status === 'approved';
      setActiveUserRegistration(null);

      if (wasApproved) {
        setEvent(prev => ({
          ...prev,
          approved_count: Math.max(0, prev.approved_count - 1),
          seats_remaining: Math.min(prev.capacity, prev.seats_remaining + 1),
        }));
      }

      fetchEvent();
    } catch (err) {
      showToast(err.message || 'Failed to cancel pass.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="p-8 border-2 border-ink bg-paper animate-pulse space-y-4">
          <div className="w-1/3 h-6 bg-paper-dark" />
          <div className="w-3/4 h-8 bg-paper-dark" />
          <div className="w-full h-32 bg-paper-dark/60" />
        </div>
      </main>
    );
  }

  if (errorMessage && !event) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="p-8 border-2 border-vermilion bg-paper text-center space-y-4 shadow-hard">
          <AlertCircle className="w-8 h-8 text-vermilion mx-auto" />
          <h1 className="font-display font-bold text-2xl text-ink">Event Unavailable</h1>
          <p className="font-body text-sm text-ink-muted">{errorMessage}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 border-2 border-ink bg-paper text-ink font-mono text-xs font-bold shadow-hard-sm hover:bg-paper-dark"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Events Directory</span>
          </Link>
        </div>
      </main>
    );
  }

  if (!event) return null;

  const startDate = new Date(event.starts_at);
  const endDate = new Date(event.ends_at);
  const deadlineDate = new Date(event.registration_deadline);

  const isFull = event.seats_remaining <= 0;
  const isCancelled = event.status === 'cancelled';
  const isPastDeadline = event.is_past_deadline || deadlineDate.getTime() <= Date.now();
  const hasStarted = event.has_started || startDate.getTime() <= Date.now();

  const isAlreadyRegistered = Boolean(activeUserRegistration);
  const canRegister = !isFull && !isCancelled && !isPastDeadline && !hasStarted && !isAlreadyRegistered;
  const canCancel = isAlreadyRegistered && !hasStarted;

  return (
    <main role="main" className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/"
          data-testid="back-to-events"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-ink hover:text-vermilion transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Events</span>
        </Link>
      </div>

      {/* Main Event Article Container */}
      <article className="bg-paper border-2 border-ink shadow-hard-lg overflow-hidden">
        {/* Top Header Banner */}
        <header className="bg-paper-dark border-b-2 border-ink p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-ink-muted mb-2">
            <Link
              to={`/?category=${encodeURIComponent(event.category)}`}
              data-testid="event-detail-category-link"
              className="font-bold text-ink uppercase tracking-wider hover:text-vermilion hover:underline"
            >
              {event.category}
            </Link>
            <span>·</span>
            <span>Created by Faculty / Organization</span>
            {event.requires_approval ? (
              <>
                <span>·</span>
                <span className="text-mustard font-bold uppercase tracking-wider">
                  Approval Required
                </span>
              </>
            ) : null}
          </div>

          <h1
            data-testid="event-detail-title"
            className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-ink leading-tight"
          >
            {event.title}
          </h1>
        </header>

        {/* Content Body Grid */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Description & Schedule */}
          <div className="md:col-span-2 space-y-6">
            <section aria-labelledby="desc-heading">
              <h2 id="desc-heading" className="text-xs font-mono font-bold uppercase text-ink-muted mb-2">
                Program Description
              </h2>
              <div
                data-testid="event-description"
                className="font-body text-base text-ink leading-relaxed whitespace-pre-line"
              >
                {event.description}
              </div>
            </section>

            <section aria-labelledby="schedule-heading" className="border-t-2 border-ink/20 pt-6 space-y-4">
              <h2 id="schedule-heading" className="text-xs font-mono font-bold uppercase text-ink-muted">
                Schedule & Location
              </h2>

              <div className="space-y-3 font-mono text-xs text-ink">
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Starts: </span>
                    <span data-testid="event-starts-at">{startDate.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Ends: </span>
                    <span data-testid="event-ends-at">{endDate.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-vermilion shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-vermilion">Registration Closes: </span>
                    <span data-testid="event-deadline">{deadlineDate.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Venue: </span>
                    <span data-testid="event-venue">{event.venue}</span>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="organizer-heading" className="border-t-2 border-ink/20 pt-6 space-y-2">
              <h2 id="organizer-heading" className="text-xs font-mono font-bold uppercase text-ink-muted">
                Event Host & Inquiries
              </h2>
              <div className="font-mono text-xs text-ink space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-ink-muted" />
                  <span data-testid="event-organizer-name" className="font-semibold">
                    {event.organizer_name}
                  </span>
                </div>
                {event.organizer_email && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{event.organizer_email}</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Admission Stub & Register Action */}
          <div className="md:col-span-1">
            <aside
              aria-label="Ticket Registration Section"
              className="bg-paper-light border-2 border-ink p-5 flex flex-col gap-4 shadow-hard-sm"
            >
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink border-b border-ink/20 pb-2">
                Seat Availability
              </h2>

              <SeatStrip
                capacity={event.capacity}
                approvedCount={event.approved_count}
                seatsRemaining={event.seats_remaining}
                isCancelled={isCancelled}
                showExactRatio={true}
              />

              {/* Entrance Fee Info (FR-006, FR-009, FR-010) */}
              <div className="p-3 border-2 border-ink bg-paper space-y-1.5">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-ink-muted uppercase font-bold">Entrance Fee:</span>
                  <span data-testid="event-fee-label" className="font-bold text-sm text-ink">
                    {formatFee(event.fee_amount)}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-ink-muted leading-tight border-t border-ink/20 pt-1.5">
                  Pay at the entrance. This site does not take payments.
                </p>
              </div>

              {/* Status Notices */}
              {isCancelled && (
                <div
                  data-testid="status-cancelled-notice"
                  className="p-3 border border-ink bg-paper text-ink font-mono text-xs"
                >
                  This event was cancelled by the host. Registrations are not accepted.
                </div>
              )}

              {isFull && !isCancelled && (
                <div
                  data-testid="status-full-notice"
                  className="p-3 border border-vermilion bg-vermilion-faint text-ink font-mono text-xs"
                >
                  All seats for this session have been claimed.
                </div>
              )}

              {isPastDeadline && !isCancelled && !isFull && (
                <div
                  data-testid="status-deadline-notice"
                  className="p-3 border border-mustard bg-mustard-faint text-ink font-mono text-xs"
                >
                  Registration closed on {deadlineDate.toLocaleDateString()}.
                </div>
              )}

              {hasStarted && !isCancelled && (
                <div className="p-3 border border-ink bg-paper text-ink font-mono text-xs">
                  This event is in progress or has concluded.
                </div>
              )}

              {isAlreadyRegistered && (
                <div
                  data-testid="already-registered-notice"
                  className="p-3 border-2 border-olive bg-olive-faint text-ink font-mono text-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-olive shrink-0" />
                  <span>You are currently registered for this event ({activeUserRegistration.registration_status}).</span>
                </div>
              )}

              {/* Inline Error Display */}
              {errorMessage && (
                <div
                  role="alert"
                  data-testid="registration-error-summary"
                  className="p-3 border-2 border-vermilion bg-vermilion-faint text-ink font-mono text-xs"
                >
                  {errorMessage}
                </div>
              )}

              {/* Live Rate Limit Countdown */}
              {rateLimitSeconds && (
                <RateLimitCountdown
                  initialSeconds={rateLimitSeconds}
                  onExpire={() => setRateLimitSeconds(null)}
                />
              )}

              {/* Action Button */}
              {canRegister && (
                <button
                  type="button"
                  data-testid="register-submit-btn"
                  disabled={registering || Boolean(rateLimitSeconds)}
                  onClick={handleRegister}
                  className="w-full py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider border-2 border-ink bg-vermilion text-paper hover:bg-vermilion-hover transition-colors shadow-hard disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {registering
                    ? 'Processing...'
                    : event.requires_approval
                    ? 'Submit Registration Request'
                    : 'Claim Admission Pass'}
                </button>
              )}

              {/* Cancel Pass Button when user holds an active pass */}
              {canCancel && (
                <button
                  type="button"
                  data-testid="cancel-pass-button"
                  onClick={() => setIsCancelDialogOpen(true)}
                  className="w-full py-2.5 px-4 text-xs font-mono font-bold text-center border-2 border-vermilion bg-paper text-vermilion hover:bg-vermilion hover:text-paper transition-colors shadow-hard-sm cursor-pointer"
                >
                  Cancel pass
                </button>
              )}

              {isAlreadyRegistered && (
                <Link
                  to="/dashboard"
                  data-testid="view-my-tickets-link"
                  className="w-full py-2.5 px-4 text-xs font-mono font-bold text-center border-2 border-ink bg-paper text-ink hover:bg-paper-dark transition-colors shadow-hard-sm"
                >
                  View My Tickets
                </Link>
              )}
            </aside>
          </div>
        </div>
      </article>

      {/* Cancel Pass Confirm Dialog */}
      <ConfirmDialog
        isOpen={isCancelDialogOpen}
        title={`Cancel your pass for ${event.title}?`}
        itemName={event.title}
        actionType="cancel"
        dialogTestId="cancel-pass-dialog"
        confirmTestId="cancel-pass-confirm"
        confirmLabel={cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
        message="Are you sure you want to cancel your pass for this event? Your seat will be freed immediately and returned to the open pool."
        onConfirm={handleCancelPass}
        onClose={() => setIsCancelDialogOpen(false)}
      />

      {/* Registration Success Modal (FR-007) */}
      <RegistrationSuccessModal
        isOpen={Boolean(registrationModalData)}
        registration={registrationModalData}
        onClose={() => setRegistrationModalData(null)}
      />
    </main>
  );
};
