/**
 * Footer Landmark Component
 * Plain JavaScript
 * NFR-007, NFR-009
 */

import React from 'react';

export const Footer = () => {
  return (
    <footer
      role="contentinfo"
      className="bg-paper-dark border-t-2 border-ink mt-auto py-8 text-xs font-mono text-ink"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <span className="font-bold tracking-wider uppercase">CampusPass</span>
          <span className="hidden sm:inline text-ink-muted">/</span>
          <span className="text-ink-muted">Online Event Registration System</span>
        </div>

        <div className="text-xs font-mono text-ink-muted text-center sm:text-right">
          &copy; {new Date().getFullYear()} University of Cebu. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
