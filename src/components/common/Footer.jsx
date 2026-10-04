/**
 * Footer Landmark Component
 * Plain JavaScript
 * NFR-005, NFR-007, NFR-009
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

export const Footer = () => {
  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    api
      .get('/api/health')
      .then(res => {
        setHealthStatus({
          status: res.status,
          dbMode: res.services?.db_mode || 'connected',
        });
      })
      .catch(() => {
        setHealthStatus({ status: 'degraded', dbMode: 'disconnected' });
      });
  }, []);

  return (
    <footer
      role="contentinfo"
      className="bg-paper-dark border-t-2 border-ink mt-auto py-8 text-xs font-mono text-ink"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <span className="font-bold tracking-wider uppercase">CampusPass STLC Test System</span>
          <span className="hidden sm:inline text-ink-muted">/</span>
          <span className="text-ink-muted">Software Quality & Testing Group Project</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-ink-muted">System Status:</span>
          <span
            data-testid="system-health-badge"
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 border border-ink text-xs font-bold uppercase ${
              healthStatus?.status === 'healthy'
                ? 'bg-olive text-paper'
                : 'bg-mustard text-ink'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                healthStatus?.status === 'healthy' ? 'bg-paper' : 'bg-ink'
              }`}
            />
            {healthStatus ? `${healthStatus.status} (${healthStatus.dbMode})` : 'Checking...'}
          </span>
        </div>
      </div>
    </footer>
  );
};
