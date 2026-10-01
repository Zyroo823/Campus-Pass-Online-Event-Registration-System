/**
 * Seat Strip Component
 * Capacity <= 40: one square per seat, filled for taken seats.
 * Capacity > 40: fixed 20-segment strip, filled count scaled proportionally & rounded up.
 * Accessible text in words ("148 seats left") is main information; strip is aria-hidden.
 * Exact ratio "(2/150)" shown only on details page via showExactRatio prop.
 */

import React from 'react';

interface SeatStripProps {
  capacity: number;
  approvedCount: number;
  seatsRemaining: number;
  isCancelled?: boolean;
  showExactRatio?: boolean;
}

export const SeatStrip: React.FC<SeatStripProps> = ({
  capacity,
  approvedCount,
  seatsRemaining,
  isCancelled,
  showExactRatio = false,
}) => {
  const isFull = seatsRemaining <= 0;

  // Capacity segmentation rules
  let totalSegments: number;
  let filledSegments: number;

  if (capacity <= 40) {
    totalSegments = Math.max(1, capacity);
    filledSegments = Math.min(totalSegments, Math.max(0, approvedCount));
  } else {
    totalSegments = 20;
    // Scaled proportionally and rounded up so any registration shows at least one filled segment
    filledSegments =
      approvedCount > 0
        ? Math.min(20, Math.max(1, Math.ceil((approvedCount / capacity) * 20)))
        : 0;
  }

  return (
    <div className="relative flex flex-col gap-1.5 py-1">
      {/* Words first - main accessible information */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[#38342B] font-medium">Seats:</span>
        <span className="font-bold text-ink" data-testid="seats-remaining-text">
          {isCancelled
            ? 'Event Cancelled'
            : isFull
            ? '0 seats left (Full)'
            : seatsRemaining === 1
            ? '1 seat left'
            : `${seatsRemaining} seats left`}
        </span>
      </div>

      {/* Decorative row of small squares marked aria-hidden */}
      <div
        className="flex items-center gap-1 flex-wrap"
        aria-hidden="true"
      >
        {Array.from({ length: totalSegments }).map((_, i) => {
          const isTaken = i < filledSegments;
          return (
            <span
              key={i}
              className={`w-2.5 h-2.5 border border-ink transition-colors ${
                isTaken ? 'bg-ink' : 'bg-paper-light'
              }`}
            />
          );
        })}
        {showExactRatio && (
          <span className="text-xs font-mono text-[#38342B] ml-1">
            ({approvedCount}/{capacity})
          </span>
        )}
      </div>

      {/* Rotated FULL stamp when capacity is exhausted */}
      {isFull && !isCancelled && (
        <div
          data-testid="full-stamp"
          className="absolute -right-1 top-2 rotate-[-12deg] pointer-events-none select-none border-2 border-vermilion px-2 py-0.5 font-display font-black text-xs text-vermilion bg-paper/90 shadow-hard-sm uppercase tracking-wider"
        >
          FULL
        </div>
      )}

      {/* Rotated CANCELLED stamp */}
      {isCancelled && (
        <div
          data-testid="cancelled-stamp"
          className="absolute -right-1 top-2 rotate-[-12deg] pointer-events-none select-none border-2 border-ink px-2 py-0.5 font-display font-black text-xs text-ink bg-paper/90 shadow-hard-sm uppercase tracking-wider line-through decoration-vermilion decoration-2"
        >
          CANCELLED
        </div>
      )}
    </div>
  );
};
