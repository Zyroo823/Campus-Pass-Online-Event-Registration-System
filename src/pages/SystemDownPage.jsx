/**
 * System Down / Outage Page
 * NFR-005 Availability: The UI shows a clear page when the API or DB is down.
 * Requirement 3: Full-page message with Retry button, data-testid="api-down-page"
 */

import React, { useState } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { api } from '../api.js';

export const SystemDownPage = ({
  title = 'Campus Service Offline',
  message = "The server can't be reached. Please try again later.",
  onRetry,
}) => {
  const [checking, setChecking] = useState(false);
  const [statusDetails, setStatusDetails] = useState(null);

  const handleCheckAgain = async () => {
    setChecking(true);
    setStatusDetails(null);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        const res = await api.get('/api/health');
        if (res.status === 'healthy') {
          try {
            window.location.reload();
          } catch {
            // In jsdom or test environment
          }
        } else {
          setStatusDetails('Database service remains offline. Awaiting recovery.');
        }
      }
    } catch {
      setStatusDetails("The server can't be reached. Please try again later.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main
      role="main"
      data-testid="api-down-page"
      className="min-h-screen bg-paper flex items-center justify-center p-6 text-ink"
    >
      <div
        data-testid="system-down-page"
        className="w-full max-w-lg bg-paper border-4 border-vermilion shadow-hard-lg p-8 text-center space-y-6"
      >
        <AlertOctagon className="w-16 h-16 text-vermilion mx-auto animate-bounce" />

        <div className="space-y-2 border-b-2 border-ink pb-4">
          <span className="text-xs font-mono font-bold tracking-widest text-vermilion uppercase">
            Critical System Outage Notice (NFR-005)
          </span>
          <h1 className="font-display font-black text-3xl text-ink">
            {title}
          </h1>
          <p className="font-body text-sm text-ink-muted">
            {message}
          </p>
        </div>

        <div className="text-left font-mono text-xs bg-paper-dark p-4 border border-ink space-y-2">
          <div className="font-bold text-ink uppercase">STLC Diagnostic Checklist:</div>
          <ul className="list-disc list-inside space-y-1 text-ink-muted">
            <li>Verify MySQL server is running via XAMPP control panel or CLI.</li>
            <li>Confirm host, port, user, and password in environment configuration.</li>
            <li>Run <code className="bg-paper px-1 border border-ink font-bold">npm run db:reset</code> to initialize tables and default seeds.</li>
          </ul>
        </div>

        {statusDetails && (
          <div className="p-3 border-2 border-ink bg-paper-light font-mono text-xs text-vermilion">
            {statusDetails}
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <button
            type="button"
            data-testid="retry-button"
            onClick={handleCheckAgain}
            disabled={checking}
            className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-ink bg-vermilion text-paper font-mono text-xs font-bold uppercase tracking-wider shadow-hard hover:bg-vermilion-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Retry Connection'}</span>
          </button>
        </div>
      </div>
    </main>
  );
};
