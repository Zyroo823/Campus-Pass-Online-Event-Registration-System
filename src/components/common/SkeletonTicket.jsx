/**
 * Ticket Skeleton Loader
 * Plain JavaScript
 */

import React from 'react';

export const SkeletonTicket = () => {
  return (
    <div
      aria-hidden="true"
      className="bg-paper border-2 border-ink shadow-hard flex flex-col md:flex-row overflow-hidden animate-pulse"
    >
      {/* Date block left */}
      <div className="md:w-32 bg-paper-dark border-b-2 md:border-b-0 md:border-r-2 border-ink p-4 flex md:flex-col items-center justify-center gap-2">
        <div className="w-12 h-10 bg-paper-contrast border border-ink" />
        <div className="w-16 h-4 bg-paper-contrast" />
      </div>

      {/* Main body */}
      <div className="flex-1 p-5 space-y-3">
        <div className="w-24 h-4 bg-paper-dark" />
        <div className="w-3/4 h-6 bg-paper-dark" />
        <div className="w-full h-10 bg-paper-dark/60" />
        <div className="w-1/2 h-4 bg-paper-dark" />
      </div>

      {/* Perforation divider */}
      <div className="border-t-2 md:border-t-0 md:border-l-2 border-dashed border-ink md:w-56 p-4 bg-paper-light flex flex-col justify-between gap-4">
        <div className="w-full h-12 bg-paper-contrast" />
        <div className="w-full h-8 bg-paper-dark" />
      </div>
    </div>
  );
};
