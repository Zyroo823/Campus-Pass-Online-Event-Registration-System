/**
 * React Error Boundary Component
 * Requirement 4: Crash never gives a blank screen, uses data-testid="app-error-page"
 */

import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CampusPass] React Error Boundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    try {
      window.location.reload();
    } catch {
      // In non-browser environments or jsdom
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="main"
          data-testid="app-error-page"
          className="min-h-screen bg-paper flex items-center justify-center p-6 text-ink"
        >
          <div className="w-full max-w-lg bg-paper border-4 border-vermilion shadow-hard-lg p-8 text-center space-y-6">
            <AlertTriangle className="w-16 h-16 text-vermilion mx-auto animate-bounce" />

            <div className="space-y-2 border-b-2 border-ink pb-4">
              <span className="text-xs font-mono font-bold tracking-widest text-vermilion uppercase">
                Application Error Notice
              </span>
              <h1 className="font-display font-black text-3xl text-ink">
                Something went wrong
              </h1>
              <p className="font-body text-sm text-ink-muted">
                An unexpected error occurred in the application. Please reload the page to continue.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-ink bg-vermilion text-paper font-mono text-xs font-bold uppercase tracking-wider shadow-hard hover:bg-vermilion-hover transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
