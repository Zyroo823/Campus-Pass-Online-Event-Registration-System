/**
 * Home Page: Event Agenda & Directory
 * Plain JavaScript
 * FR-004: Paginated list of upcoming events
 * FR-005: Search events by keyword and filter by category, date range, seat availability
 * FR-007: Quick registration
 * Requirement 3: If very first load request cannot reach API, show full-page api-down-page
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, ClientApiError, triggerSystemDown } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EventTicketCard } from '../components/events/EventTicketCard.jsx';
import { EventFilters } from '../components/events/EventFilters.jsx';
import { SkeletonTicket } from '../components/common/SkeletonTicket.jsx';
import { RegistrationSuccessModal } from '../components/common/RegistrationSuccessModal.jsx';
import { SystemDownPage } from './SystemDownPage.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isApiDown, setIsApiDown] = useState(false);
  const [userRegisteredEventIds, setUserRegisteredEventIds] = useState([]);
  const [recentRegistration, setRecentRegistration] = useState(null);

  const initialLoadRef = useRef(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchEvents = useCallback(async () => {
    const isFirstLoad = initialLoadRef.current;
    setLoading(true);
    try {
      const params = {};
      searchParams.forEach((val, key) => {
        params[key] = val;
      });

      const res = await api.get('/api/events', params);
      setEvents(res.events || []);
      setPagination(res.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      initialLoadRef.current = false;
      setIsApiDown(false);

      if (user) {
        try {
          const ticketsRes = await api.get('/api/events/my-tickets');
          const registeredIds = (ticketsRes.tickets || [])
            .filter(t => t.registration_status === 'approved' || t.registration_status === 'pending')
            .map(t => t.event_id);
          setUserRegisteredEventIds(registeredIds);
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      const isUnreachable =
        err?.isServerUnreachable ||
        (err?.status >= 500 && err?.status <= 599) ||
        err?.status === 404 ||
        err?.status === 0 ||
        err?.code === 'NETWORK_ERROR';

      if (isFirstLoad && isUnreachable) {
        setIsApiDown(true);
        triggerSystemDown(true);
      } else {
        showToast(err.message || 'Failed to load events calendar.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [searchParams, user, showToast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (isApiDown) {
    return (
      <SystemDownPage
        onRetry={() => {
          setIsApiDown(false);
          fetchEvents();
        }}
      />
    );
  }

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentWhen = searchParams.get('when') || 'upcoming';

  const handleWhenChange = (when) => {
    const next = new URLSearchParams(searchParams);
    if (when === 'past') {
      next.set('when', 'past');
    } else {
      next.delete('when');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleQuickRegister = async (event) => {
    if (!user) {
      navigate('/login?redirect=/');
      return;
    }

    try {
      const res = await api.post(`/api/events/${event.id}/register`);
      setRecentRegistration({
        registration_id: res.registration.registration_id,
        status: res.registration.status,
        reference_code: res.registration.reference_code,
        event_title: event.title,
        starts_at: event.starts_at,
        venue: event.venue,
      });
      setUserRegisteredEventIds(prev => [...prev, event.id]);
      showToast(res.message, 'success');
      fetchEvents();
    } catch (err) {
      if (err instanceof ClientApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Registration could not be completed.', 'error');
      }
    }
  };

  return (
    <main role="main" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Editorial Header */}
      <section className="mb-6 border-b-2 border-ink pb-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            {process.env.DEMO_MODE === 'true' && (
              <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
                Sample data
              </span>
            )}
            <h1
              data-testid="page-title"
              className="font-display font-black text-3xl sm:text-4xl text-ink tracking-tight mt-1"
            >
              Upcoming events
            </h1>
          </div>
        </div>
      </section>

      {/* Filters (FR-005) */}
      <EventFilters />

      {/* When Toggle (FR-004: Upcoming / Past) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="inline-flex border-2 border-ink bg-paper p-0.5 shadow-hard-sm">
          <button
            type="button"
            data-testid="when-toggle-upcoming"
            onClick={() => handleWhenChange('upcoming')}
            className={`px-3 py-1 text-xs font-mono font-bold transition-colors cursor-pointer ${
              currentWhen !== 'past'
                ? 'bg-ink text-paper'
                : 'bg-transparent text-ink hover:bg-paper-dark'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            data-testid="when-toggle-past"
            onClick={() => handleWhenChange('past')}
            className={`px-3 py-1 text-xs font-mono font-bold transition-colors cursor-pointer ${
              currentWhen === 'past'
                ? 'bg-ink text-paper'
                : 'bg-transparent text-ink hover:bg-paper-dark'
            }`}
          >
            Past
          </button>
        </div>

        <div className="font-mono text-xs text-ink-muted">
          {pagination.total} {pagination.total === 1 ? 'event listed' : 'events listed'}
        </div>
      </div>

      {/* Event Agenda List (FR-004) */}
      <section aria-label="Events list" className="flex flex-col gap-6">
        {loading ? (
          <>
            <SkeletonTicket />
            <SkeletonTicket />
            <SkeletonTicket />
          </>
        ) : events.length === 0 ? (
          <div
            data-testid="empty-events"
            className="p-8 border-2 border-ink bg-paper text-center space-y-2 shadow-hard-sm"
          >
            <p className="font-display font-bold text-lg text-ink">
              No matching events found.
            </p>
            <p className="font-body text-sm text-ink-muted">
              Try adjusting your search query, clearing date constraints, or resetting filters.
            </p>
          </div>
        ) : (
          events.map(event => (
            <EventTicketCard
              key={event.id}
              event={event}
              isPast={currentWhen === 'past'}
              isRegistered={userRegisteredEventIds.includes(event.id)}
              onQuickRegister={handleQuickRegister}
            />
          ))
        )}
      </section>

      {/* Pagination (NFR-001: default 12, server-side) */}
      {!loading && pagination.totalPages > 1 && (
        <nav
          role="navigation"
          aria-label="Pagination"
          className="mt-10 pt-4 border-t-2 border-ink flex items-center justify-between font-mono text-xs"
        >
          <button
            type="button"
            data-testid="pagination-prev"
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
            className="px-3 py-1.5 border-2 border-ink bg-paper text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-paper-dark transition-colors shadow-hard-sm flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="font-bold text-ink">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            type="button"
            data-testid="pagination-next"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
            className="px-3 py-1.5 border-2 border-ink bg-paper text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-paper-dark transition-colors shadow-hard-sm flex items-center gap-1 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}

      {/* Success Modal with Ticket Reference Code and Stamp (FR-007) */}
      <RegistrationSuccessModal
        isOpen={Boolean(recentRegistration)}
        registration={recentRegistration}
        onClose={() => setRecentRegistration(null)}
      />
    </main>
  );
};
