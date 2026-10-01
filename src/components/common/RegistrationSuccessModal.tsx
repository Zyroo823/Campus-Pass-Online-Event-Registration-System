/**
 * Registration Success Ticket Modal
 * FR-007, NFR-009: Reference code EVT-{eventId}-{registrationId}, CSS stamp animation ~300ms, reduced-motion respected
 */

import React from 'react';
import { X, CheckCircle, Calendar, MapPin } from 'lucide-react';

interface RegistrationSuccessModalProps {
  isOpen: boolean;
  registration: {
    registration_id: number;
    status: 'approved' | 'pending';
    reference_code: string;
    event_title: string;
    starts_at: string;
    venue: string;
  } | null;
  onClose: () => void;
}

export const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  isOpen,
  registration,
  onClose,
}) => {
  if (!isOpen || !registration) return null;

  const isPending = registration.status === 'pending';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
    >
      <div className="w-full max-w-lg bg-paper border-2 border-ink shadow-hard-lg p-6 flex flex-col gap-4 text-ink relative">
        <button
          type="button"
          onClick={onClose}
          data-testid="close-modal-button"
          aria-label="Close ticket view"
          className="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="border-b-2 border-ink pb-3">
          <div className="flex items-center gap-2 text-olive mb-1">
            <CheckCircle className="w-5 h-5 text-olive shrink-0" />
            <span className="font-mono text-xs uppercase tracking-wider font-bold">
              {isPending ? 'Application Submitted' : 'Registration Confirmed'}
            </span>
          </div>
          <h2 id="success-modal-title" className="font-display font-black text-2xl tracking-tight text-ink">
            {isPending ? 'Admission Review Required' : 'Official Entry Pass'}
          </h2>
        </div>

        {/* Physical Ticket Stub Representation */}
        <div
          data-testid="registration-ticket"
          className="relative bg-paper-light border-2 border-ink p-5 flex flex-col gap-4 shadow-hard-sm"
        >
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-ink/30 pb-3">
            <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
              Admission Pass
            </span>
            <span
              data-testid="ticket-ref-code"
              className="text-sm font-mono font-bold text-ink bg-paper-contrast px-2 py-0.5 border border-ink"
            >
              {registration.reference_code}
            </span>
          </div>

          {/* Event details */}
          <div className="space-y-2">
            <h3 className="font-display font-bold text-xl text-ink leading-snug">
              {registration.event_title}
            </h3>
            <div className="flex flex-col gap-1 text-xs font-mono text-ink-muted">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-ink" />
                <span>{new Date(registration.starts_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-ink" />
                <span>{registration.venue}</span>
              </div>
            </div>
          </div>

          {/* Stamp */}
          <div className="pt-2 flex justify-end">
            {isPending ? (
              <div
                data-testid="registration-stamp"
                className="animate-stamp border-4 border-mustard px-4 py-1 font-display font-black text-lg text-mustard bg-paper-light/95 shadow-hard uppercase tracking-widest select-none"
              >
                PENDING
              </div>
            ) : (
              <div
                data-testid="registration-stamp"
                className="animate-stamp border-4 border-olive px-4 py-1 font-display font-black text-lg text-olive bg-paper-light/95 shadow-hard uppercase tracking-widest select-none"
              >
                APPROVED
              </div>
            )}
          </div>
        </div>

        <p className="text-xs font-body text-ink-muted">
          {isPending
            ? 'The event organizer will review your registration. You will receive an in-app notification once decided.'
            : 'Present this digital pass or reference code upon entry at the venue check-in desk.'}
        </p>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            data-testid="dismiss-ticket-btn"
            onClick={onClose}
            className="px-5 py-2 text-xs font-mono font-bold border-2 border-ink bg-ink text-paper hover:bg-ink-light transition-colors cursor-pointer shadow-hard-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
