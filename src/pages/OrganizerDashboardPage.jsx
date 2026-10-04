/**
 * Organizer Dashboard
 * FR-014: Dense table of organizer's events with seat strips; "Needs your decision" queue on top
 * FR-009: Create events (with entrance fee)
 * FR-010: Edit own events (with entrance fee)
 * FR-011: Delete event (no registrations) or Cancel event (with registrations)
 * FR-012: Approve/reject pending registrations
 * FR-015: Attendee list viewer and CSV export
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ClientApiError } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { SeatStrip } from '../components/common/SeatStrip.jsx';
import { formatFee } from '../utils/formatters.js';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Download,
  Clock,
  X,
  AlertCircle,
} from 'lucide-react';

const CATEGORIES = [
  'Academic',
  'Sports',
  'Arts & Culture',
  'Career & Networking',
  'Community & Service',
  'Technology & STEM',
];

export const OrganizerDashboardPage = () => {
  const [events, setEvents] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Active state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [attendeeModalEvent, setAttendeeModalEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Academic',
    venue: '',
    starts_at: '',
    ends_at: '',
    registration_deadline: '',
    capacity: 50,
    fee_amount: '',
    requires_approval: false,
  });
  const [formErrors, setFormErrors] = useState({});
  const [formGlobalError, setFormGlobalError] = useState(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  const { showToast } = useToast();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/events/organizer-dashboard');
      setEvents(res.events || []);
      setPendingQueue(res.pendingQueue || []);
    } catch (err) {
      showToast(err.message || 'Failed to load organizer dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle Approval / Rejection (FR-012)
  const handleDecision = async (eventId, registrationId, decision) => {
    try {
      const res = await api.post(`/api/events/${eventId}/registrations/${registrationId}/decision`, {
        decision,
      });
      showToast(res.message, 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to process decision.', 'error');
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      category: 'Academic',
      venue: '',
      starts_at: '',
      ends_at: '',
      registration_deadline: '',
      capacity: 50,
      fee_amount: '',
      requires_approval: false,
    });
    setFormErrors({});
    setFormGlobalError(null);
    setIsEventModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (ev) => {
    setEditingEvent(ev);
    setFormData({
      title: ev.title,
      description: ev.description,
      category: ev.category,
      venue: ev.venue,
      starts_at: ev.starts_at ? ev.starts_at.slice(0, 16).replace(' ', 'T') : '',
      ends_at: ev.ends_at ? ev.ends_at.slice(0, 16).replace(' ', 'T') : '',
      registration_deadline: ev.registration_deadline ? ev.registration_deadline.slice(0, 16).replace(' ', 'T') : '',
      capacity: ev.capacity,
      fee_amount: ev.fee_amount > 0 ? String(ev.fee_amount) : '',
      requires_approval: Boolean(ev.requires_approval),
    });
    setFormErrors({});
    setFormGlobalError(null);
    setIsEventModalOpen(true);
  };

  // Save Event (Create or Edit)
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setFormGlobalError(null);

    const errs = {};
    if (formData.title.trim().length < 5 || formData.title.trim().length > 120) {
      errs.title = 'Title must be between 5 and 120 characters long.';
    }
    if (formData.description.trim().length < 20 || formData.description.trim().length > 2000) {
      errs.description = 'Description must be between 20 and 2000 characters long.';
    }
    if (formData.venue.trim().length < 3 || formData.venue.trim().length > 120) {
      errs.venue = 'Venue must be between 3 and 120 characters long.';
    }
    if (!formData.starts_at) {
      errs.starts_at = 'Start date and time is required.';
    }
    if (!formData.ends_at) {
      errs.ends_at = 'End date and time is required.';
    }
    if (!formData.registration_deadline) {
      errs.registration_deadline = 'Registration deadline is required.';
    }
    if (Number(formData.capacity) < 1 || Number(formData.capacity) > 1000) {
      errs.capacity = 'Capacity must be between 1 and 1000 seats.';
    }

    // Fee validation
    const feeStr = String(formData.fee_amount || '').trim();
    if (feeStr !== '') {
      if (!/^\d+(\.\d{1,2})?$/.test(feeStr) || Number(feeStr) < 0 || Number(feeStr) > 50000) {
        errs.fee_amount = 'Entrance fee must be between 0 and 50,000, with up to 2 decimal places.';
      }
    }

    if (formData.starts_at && new Date(formData.starts_at).getTime() <= Date.now() && !editingEvent) {
      errs.starts_at = 'Event start time must be in the future.';
    }

    if (formData.starts_at && formData.ends_at && new Date(formData.ends_at).getTime() <= new Date(formData.starts_at).getTime()) {
      errs.ends_at = 'End time must be after the start time.';
    }

    if (formData.starts_at && formData.registration_deadline && new Date(formData.registration_deadline).getTime() > new Date(formData.starts_at).getTime()) {
      errs.registration_deadline = 'Registration deadline must be on or before start time.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      setFormGlobalError('Please fix the highlighted errors before saving.');
      return;
    }

    setSubmittingForm(true);

    try {
      const payload = {
        ...formData,
        capacity: Number(formData.capacity),
        fee_amount: feeStr === '' ? 0 : Number(feeStr),
        requires_approval: formData.requires_approval ? 1 : 0,
      };

      if (editingEvent) {
        await api.put(`/api/events/${editingEvent.id}`, payload);
        showToast('Event updated successfully.', 'success');
      } else {
        await api.post('/api/events', payload);
        showToast('Event created and published.', 'success');
      }

      setIsEventModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setFormGlobalError(err.message);
        if (err.fields) setFormErrors(err.fields);
      } else {
        setFormGlobalError('Failed to save event.');
      }
    } finally {
      setSubmittingForm(false);
    }
  };

  // Confirm Delete / Cancel (FR-011)
  const handleConfirmDeleteOrCancel = async () => {
    if (!eventToDelete) return;

    try {
      const res = await api.delete(`/api/events/${eventToDelete.id}`);
      showToast(res.message, 'success');
      setEventToDelete(null);
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Operation failed.', 'error');
    }
  };

  // View Attendees & CSV (FR-015)
  const openAttendeesModal = async (ev) => {
    setAttendeeModalEvent(ev);
    setAttendeesLoading(true);
    try {
      const res = await api.get(`/api/events/${ev.id}/attendees`);
      setAttendees(res.attendees || []);
    } catch (err) {
      showToast(err.message || 'Failed to load attendee roster.', 'error');
    } finally {
      setAttendeesLoading(false);
    }
  };

  const handleExportCsv = (eventId) => {
    window.location.href = `/api/events/${eventId}/attendees/csv`;
  };

  return (
    <main role="main" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header Bar */}
      <section className="border-b-2 border-ink pb-4 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
            Faculty &amp; Staff Administration
          </span>
          <h1 data-testid="organizer-dashboard-title" className="font-display font-black text-3xl sm:text-4xl text-ink mt-1">
            Organizer Dashboard
          </h1>
        </div>

        <button
          type="button"
          data-testid="create-event-btn"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 border-2 border-ink bg-vermilion text-paper font-mono text-xs font-bold uppercase shadow-hard hover:bg-vermilion-hover transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </section>

      {/* 1. Pending Approvals Queue (FR-012) */}
      {pendingQueue.length > 0 && (
        <section aria-labelledby="decision-queue-heading" className="mb-10">
          <div className="bg-mustard-faint border-2 border-ink shadow-hard p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-mustard" />
                <h2 id="decision-queue-heading" className="font-display font-bold text-lg text-ink">
                  Needs Your Decision ({pendingQueue.length})
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-muted">
                Action required for restricted events
              </span>
            </div>

            <div className="divide-y divide-ink/20 bg-paper border border-ink overflow-hidden">
              {pendingQueue.map((item) => (
                <div
                  key={item.registration_id}
                  data-testid={`decision-row-${item.registration_id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-paper-dark border border-ink px-1.5 py-0.5">
                        {item.school_id}
                      </span>
                      <span className="font-display font-bold text-sm text-ink">{item.full_name}</span>
                      <span className="text-xs font-mono text-ink-muted">({item.email})</span>
                    </div>
                    <div className="text-xs font-mono text-ink-muted">
                      Requesting seat for: <strong className="text-ink">{item.event_title}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      data-testid={`reject-btn-${item.registration_id}`}
                      onClick={() => handleDecision(item.event_id, item.registration_id, 'reject')}
                      className="px-3 py-1.5 border border-ink bg-paper text-ink hover:bg-paper-dark font-mono text-xs font-bold transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      data-testid={`approve-btn-${item.registration_id}`}
                      onClick={() => handleDecision(item.event_id, item.registration_id, 'approve')}
                      className="px-3 py-1.5 border-2 border-ink bg-olive text-paper hover:bg-olive-hover font-mono text-xs font-bold shadow-hard-sm transition-colors cursor-pointer"
                    >
                      Approve Pass
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. Dense Event Management Table (FR-014) */}
      <section aria-labelledby="events-table-heading" className="space-y-4">
        <h2 id="events-table-heading" className="font-display font-bold text-xl text-ink">
          Your Published &amp; Hosted Events
        </h2>

        {loading ? (
          <div className="p-8 border-2 border-ink bg-paper text-center font-mono text-xs text-ink-muted animate-pulse">
            Loading managed events...
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 border-2 border-ink bg-paper text-center space-y-3 shadow-hard-sm">
            <p className="font-display font-bold text-base text-ink">No hosted events found.</p>
            <p className="text-xs font-body text-ink-muted">
              Click &quot;Create New Event&quot; above to schedule your first academic or extracurricular session.
            </p>
          </div>
        ) : (
          <div className="border-2 border-ink bg-paper shadow-hard overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-paper-dark border-b-2 border-ink text-ink font-bold">
                  <th className="p-3 border-r border-ink/20">Event Title &amp; Category</th>
                  <th className="p-3 border-r border-ink/20">Schedule &amp; Venue</th>
                  <th className="p-3 border-r border-ink/20">Fee</th>
                  <th className="p-3 border-r border-ink/20 min-w-[160px]">Seat Capacity</th>
                  <th className="p-3 border-r border-ink/20">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/20">
                {events.map((ev) => {
                  const isCancelled = ev.status === 'cancelled';

                  return (
                    <tr key={ev.id} data-testid={`organizer-event-row-${ev.id}`} className="hover:bg-paper-light">
                      <td className="p-3 border-r border-ink/10">
                        <Link
                          to={`/events/${ev.id}`}
                          className="font-display font-bold text-sm text-ink hover:text-vermilion transition-colors block mb-1"
                        >
                          {ev.title}
                        </Link>
                        <span className="text-[11px] font-mono uppercase bg-paper-dark border border-ink/30 px-1.5 py-0.5">
                          {ev.category}
                        </span>
                        {ev.requires_approval ? (
                          <span className="ml-1.5 text-[11px] font-mono font-bold text-mustard uppercase">
                            (Restricted)
                          </span>
                        ) : null}
                      </td>

                      <td className="p-3 border-r border-ink/10 text-ink-muted space-y-0.5">
                        <div className="text-ink font-semibold">{new Date(ev.starts_at).toLocaleString()}</div>
                        <div>{ev.venue}</div>
                      </td>

                      <td className="p-3 border-r border-ink/10 font-bold text-ink">
                        {formatFee(ev.fee_amount)}
                      </td>

                      <td className="p-3 border-r border-ink/10">
                        <SeatStrip
                          capacity={ev.capacity}
                          approvedCount={ev.approved_count}
                          seatsRemaining={ev.seats_remaining}
                          isCancelled={isCancelled}
                          showExactRatio={true}
                        />
                      </td>

                      <td className="p-3 border-r border-ink/10">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 border border-vermilion text-vermilion font-bold uppercase text-[10px]">
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-olive text-olive font-bold uppercase text-[10px]">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`view-attendees-btn-${ev.id}`}
                            onClick={() => openAttendeesModal(ev)}
                            title="View Attendees"
                            className="p-1.5 border border-ink bg-paper hover:bg-paper-dark text-ink cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-testid={`edit-event-btn-${ev.id}`}
                            onClick={() => openEditModal(ev)}
                            title="Edit Event"
                            className="p-1.5 border border-ink bg-paper hover:bg-paper-dark text-ink cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-event-btn-${ev.id}`}
                            onClick={() => setEventToDelete(ev)}
                            title={ev.approved_count + ev.pending_count > 0 ? 'Cancel Event' : 'Delete Event'}
                            className="p-1.5 border border-ink bg-paper text-vermilion hover:bg-vermilion hover:text-paper cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Create / Edit Event Modal (FR-009, FR-010) */}
      {isEventModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 overflow-y-auto"
        >
          <div className="w-full max-w-2xl bg-paper border-2 border-ink shadow-hard-lg p-6 flex flex-col my-8">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <h2 id="event-modal-title" className="font-display font-bold text-xl text-ink">
                {editingEvent ? 'Edit Event Details' : 'Create New Campus Event'}
              </h2>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer p-1"
                aria-label="Close form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formGlobalError && (
              <div
                role="alert"
                className="p-3 border-2 border-vermilion bg-vermilion-faint text-ink font-mono text-xs flex items-center gap-2 mb-4"
              >
                <AlertCircle className="w-4 h-4 text-vermilion shrink-0" />
                <span>{formGlobalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEvent} noValidate className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="evt-title" className="block text-xs font-mono font-bold uppercase mb-1">
                  Event Title <span className="text-vermilion">*</span>
                </label>
                <input
                  id="evt-title"
                  type="text"
                  data-testid="event-form-title"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. UC Mandaue Annual Innovation Colloquium 2026 (5-120 chars)"
                  className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-body text-ink placeholder:text-ink-muted focus:bg-paper"
                />
                {formErrors.title && (
                  <p data-testid="field-error-title" className="text-xs font-mono text-vermilion mt-1">
                    {formErrors.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="evt-desc" className="block text-xs font-mono font-bold uppercase mb-1">
                  Detailed Description <span className="text-vermilion">*</span>
                </label>
                <textarea
                  id="evt-desc"
                  rows={4}
                  data-testid="event-form-description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Minimum 20 characters describing event itinerary, speakers, or student prerequisites..."
                  className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-body text-ink placeholder:text-ink-muted focus:bg-paper"
                />
                {formErrors.description && (
                  <p data-testid="field-error-description" className="text-xs font-mono text-vermilion mt-1">
                    {formErrors.description}
                  </p>
                )}
              </div>

              {/* Category & Venue Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="evt-cat" className="block text-xs font-mono font-bold uppercase mb-1">
                    Category <span className="text-vermilion">*</span>
                  </label>
                  <select
                    id="evt-cat"
                    data-testid="event-form-category"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-xs font-mono text-ink cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="evt-venue" className="block text-xs font-mono font-bold uppercase mb-1">
                    Venue / Room <span className="text-vermilion">*</span>
                  </label>
                  <input
                    id="evt-venue"
                    type="text"
                    data-testid="event-form-venue"
                    value={formData.venue}
                    onChange={e => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g. Grand Auditorium, Building B"
                    className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-xs font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
                  />
                  {formErrors.venue && (
                    <p data-testid="field-error-venue" className="text-xs font-mono text-vermilion mt-1">
                      {formErrors.venue}
                    </p>
                  )}
                </div>
              </div>

              {/* Schedule Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="evt-start" className="block text-xs font-mono font-bold uppercase mb-1">
                    Starts At <span className="text-vermilion">*</span>
                  </label>
                  <input
                    id="evt-start"
                    type="datetime-local"
                    data-testid="event-form-starts-at"
                    value={formData.starts_at}
                    onChange={e => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-2.5 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink"
                  />
                  {formErrors.starts_at && (
                    <p data-testid="field-error-starts_at" className="text-xs font-mono text-vermilion mt-1">
                      {formErrors.starts_at}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="evt-end" className="block text-xs font-mono font-bold uppercase mb-1">
                    Ends At <span className="text-vermilion">*</span>
                  </label>
                  <input
                    id="evt-end"
                    type="datetime-local"
                    data-testid="event-form-ends-at"
                    value={formData.ends_at}
                    onChange={e => setFormData({ ...formData, ends_at: e.target.value })}
                    className="w-full px-2.5 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink"
                  />
                  {formErrors.ends_at && (
                    <p data-testid="field-error-ends_at" className="text-xs font-mono text-vermilion mt-1">
                      {formErrors.ends_at}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="evt-deadline" className="block text-xs font-mono font-bold uppercase mb-1">
                    Reg. Deadline <span className="text-vermilion">*</span>
                  </label>
                  <input
                    id="evt-deadline"
                    type="datetime-local"
                    data-testid="event-form-deadline"
                    value={formData.registration_deadline}
                    onChange={e => setFormData({ ...formData, registration_deadline: e.target.value })}
                    className="w-full px-2.5 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink"
                  />
                  {formErrors.registration_deadline && (
                    <p data-testid="field-error-registration_deadline" className="text-xs font-mono text-vermilion mt-1">
                      {formErrors.registration_deadline}
                    </p>
                  )}
                </div>
              </div>

              {/* Capacity, Entrance Fee & Requires Approval */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label htmlFor="evt-capacity" className="block text-xs font-mono font-bold uppercase mb-1">
                    Total Capacity (1 - 1000) <span className="text-vermilion">*</span>
                  </label>
                  <input
                    id="evt-capacity"
                    type="number"
                    min={1}
                    max={1000}
                    placeholder="1 to 1000 seats"
                    data-testid="event-form-capacity"
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
                  />
                  {formErrors.capacity && (
                    <p data-testid="field-error-capacity" className="text-xs font-mono text-vermilion mt-1">
                      {formErrors.capacity}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="evt-fee" className="block text-xs font-mono font-bold uppercase mb-1">
                    Entrance Fee (PHP)
                  </label>
                  <input
                    id="evt-fee"
                    type="text"
                    placeholder="0.00 (Blank = Free)"
                    data-testid="event-fee"
                    value={formData.fee_amount}
                    onChange={e => setFormData({ ...formData, fee_amount: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
                  />
                  {formErrors.fee_amount && (
                    <p data-testid="field-error-fee_amount" className="text-xs font-mono text-vermilion mt-1">
                      {formErrors.fee_amount}
                    </p>
                  )}
                </div>

                <div className="flex items-center sm:pt-5">
                  <label
                    htmlFor="evt-approval"
                    className="flex items-center gap-2.5 text-xs font-mono font-bold text-ink cursor-pointer select-none"
                  >
                    <input
                      id="evt-approval"
                      type="checkbox"
                      data-testid="event-form-requires-approval"
                      checked={formData.requires_approval}
                      onChange={e => setFormData({ ...formData, requires_approval: e.target.checked })}
                      className="w-4 h-4 border-2 border-ink text-vermilion rounded-none cursor-pointer"
                    />
                    <span>Requires Approval</span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t-2 border-ink">
                <button
                  type="button"
                  data-testid="cancel-event-form"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 border-2 border-ink bg-paper text-ink font-mono text-xs font-bold shadow-hard-sm hover:bg-paper-dark cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-event-submit"
                  disabled={submittingForm}
                  className="px-5 py-2 border-2 border-ink bg-vermilion text-paper font-mono text-xs font-bold uppercase shadow-hard hover:bg-vermilion-hover transition-colors cursor-pointer"
                >
                  {submittingForm ? 'Saving...' : editingEvent ? 'Update Event' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Attendee List Modal with CSV Export (FR-015) */}
      {attendeeModalEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendee-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
        >
          <div className="w-full max-w-3xl bg-paper border-2 border-ink shadow-hard-lg p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-4">
              <div>
                <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
                  Attendee Roster
                </span>
                <h2 id="attendee-modal-title" className="font-display font-bold text-xl text-ink">
                  {attendeeModalEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAttendeeModalEvent(null)}
                className="text-ink-muted hover:text-ink cursor-pointer p-1"
                aria-label="Close roster"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-mono text-ink-muted">
                {attendees.length} total registration entries
              </span>
              <button
                type="button"
                data-testid="export-csv-btn"
                onClick={() => handleExportCsv(attendeeModalEvent.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-olive text-paper font-mono text-xs font-bold shadow-hard-sm hover:bg-olive-hover cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export as CSV</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border-2 border-ink bg-paper-light">
              {attendeesLoading ? (
                <div className="p-8 text-center font-mono text-xs text-ink-muted animate-pulse">
                  Loading attendee records...
                </div>
              ) : attendees.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-ink-muted">
                  No participants have registered for this event yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-paper-dark border-b border-ink font-bold">
                      <th className="p-2.5 border-r border-ink/20">Ref Code</th>
                      <th className="p-2.5 border-r border-ink/20">Name</th>
                      <th className="p-2.5 border-r border-ink/20">School ID</th>
                      <th className="p-2.5 border-r border-ink/20">Email</th>
                      <th className="p-2.5 border-r border-ink/20">Fee</th>
                      <th className="p-2.5 border-r border-ink/20">Status</th>
                      <th className="p-2.5">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map(a => (
                      <tr key={a.registration_id} className="border-b border-ink/10 hover:bg-paper">
                        <td className="p-2.5 font-bold border-r border-ink/10">
                          EVT-{String(attendeeModalEvent.id).padStart(4, '0')}-{String(a.registration_id).padStart(4, '0')}
                        </td>
                        <td className="p-2.5 font-body border-r border-ink/10">{a.full_name}</td>
                        <td className="p-2.5 border-r border-ink/10">{a.school_id}</td>
                        <td className="p-2.5 text-ink-muted border-r border-ink/10">{a.email}</td>
                        <td className="p-2.5 font-bold border-r border-ink/10">
                          {formatFee(attendeeModalEvent.fee_amount)}
                        </td>
                        <td className="p-2.5 border-r border-ink/10">
                          <span
                            className={`px-1.5 py-0.5 text-xs font-bold uppercase border ${
                              a.status === 'approved'
                                ? 'bg-olive text-paper border-olive'
                                : a.status === 'pending'
                                ? 'bg-mustard text-ink border-mustard'
                                : 'bg-paper text-ink border-ink line-through'
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-ink-muted">
                          {new Date(a.registered_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setAttendeeModalEvent(null)}
                className="px-4 py-1.5 border-2 border-ink bg-paper text-ink font-mono text-xs font-bold shadow-hard-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete or Cancel Event Confirmation (FR-011) */}
      <ConfirmDialog
        isOpen={Boolean(eventToDelete)}
        title={
          eventToDelete && (eventToDelete.approved_count + eventToDelete.pending_count > 0)
            ? 'Cancel Published Event'
            : 'Permanently Delete Event'
        }
        itemName={eventToDelete?.title || ''}
        actionType={
          eventToDelete && (eventToDelete.approved_count + eventToDelete.pending_count > 0)
            ? 'cancel'
            : 'delete'
        }
        message={
          eventToDelete && (eventToDelete.approved_count + eventToDelete.pending_count > 0)
            ? 'This event has registered attendees. Cancelling it will close registration and automatically alert all ticket holders in-app.'
            : 'This event has zero registrations and will be permanently removed from the system directory.'
        }
        confirmLabel={
          eventToDelete && (eventToDelete.approved_count + eventToDelete.pending_count > 0)
            ? 'Cancel Event & Notify'
            : 'Delete Permanently'
        }
        onConfirm={handleConfirmDeleteOrCancel}
        onClose={() => setEventToDelete(null)}
      />
    </main>
  );
};
