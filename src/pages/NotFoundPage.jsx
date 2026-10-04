/**
 * Not Found 404 Page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <main role="main" className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="bg-paper border-2 border-ink shadow-hard-lg p-8 space-y-4">
        <Compass className="w-12 h-12 text-ink mx-auto" />
        <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
          Error 404
        </span>
        <h1 className="font-display font-black text-2xl text-ink">
          Page Not Located
        </h1>
        <p className="font-body text-xs text-ink-muted">
          The requested campus program page or document could not be found. It may have been moved or archived.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 border-2 border-ink bg-vermilion text-paper font-mono text-xs font-bold shadow-hard-sm hover:bg-vermilion-hover"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Event Directory</span>
          </Link>
        </div>
      </div>
    </main>
  );
};
