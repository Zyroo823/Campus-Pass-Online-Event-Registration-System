/**
 * System Down / Outage Page
 * NFR-005 Availability: The UI shows a clear page when the API or DB is down.
 */

import React, { useState } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.ts';

interface SystemDownPageProps {
  onRetry?: () => void;
}

export const SystemDownPage: React.FC<SystemDownPageProps> = ({ onRetry }) => {
  const [checking, setChecking] = useState(false);
  const [statusDetails, setStatusDetails] = useState<string | null>(null);

  const handleCheckAgain = async () => {
    setChecking(true);
    setStatusDetails(null);
    try {
      const res = await api.get<{ status: string }>('/api/health');
      if (res.status === 'healthy') {
        if (onRetry) onRetry();
        window.location.reload();
      } else {
        setStatusDetails('Database service remains offline. Awaiting recovery.');
      }
    } catch {
      setStatusDetails('Campus API gateway is unreachable. Please verify server connection.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <main
      role="main"
      data-testid="system-down-page"
      className="min-h-screen bg-paper flex items-center justify-center p-6 text-ink"
    >
      <div className="w-full max-w-lg bg-paper border-4 border-vermilion shadow-hard-lg p-8 text-center space-y-6">
        <AlertOctagon className="w-16 h-16 text-vermilion mx-auto animate-bounce" />

        <div className="space-y-2 border-b-2 border-ink pb-4">
          <span className="text-xs font-mono font-bold tracking-widest text-vermilion uppercase">
            Critical System Outage Notice (NFR-005)
          </span>
          <h1 className="font-display font-black text-3xl text-ink">
            Campus Database Offline
          </h1>
          <p className="font-body text-sm text-ink-muted">
            The CampusPass application server is unable to establish an active connection with the database backend (MySQL 8 / MariaDB).
          </p>
        </div>

        <div className="text-left font-mono text-xs bg-paper-dark p-4 border border-ink space-y-2">
          <div className="font-bold text-ink uppercase">STLC Diagnostic Checklist:</div>
          <ul className="list-disc list-inside space-y-1 text-ink-muted">
            <li>Verify MySQL server is running via XAMPP control panel or CLI.</li>
            <li>Confirm DB_HOST and DB_PORT (default 127.0.0.1:3306) in .env.</li>
            <li>Run `npm run db:reset` to seed schema and tables.</li>
          </ul>
        </div>

        {statusDetails && (
          <p className="font-mono text-xs text-vermilion font-bold">{statusDetails}</p>
        )}

        <div className="pt-2">
          <button
            type="button"
            data-testid="retry-health-btn"
            disabled={checking}
            onClick={handleCheckAgain}
            className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-ink bg-ink text-paper font-mono text-xs font-bold uppercase tracking-wider shadow-hard hover:bg-ink-light disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Connection...' : 'Retry Connection'}</span>
          </button>
        </div>
      </div>
    </main>
  );
};
