/**
 * Accessible Toast Notifications Context
 * NFR-009: aria-live for toasts, polite announcement, WCAG contrast
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container with aria-live="polite" */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map(toast => {
          let borderClass = 'border-ink bg-paper text-ink';
          let icon = <Info className="w-5 h-5 text-ink shrink-0" />;

          if (toast.type === 'success') {
            borderClass = 'border-olive bg-olive-faint text-ink';
            icon = <CheckCircle2 className="w-5 h-5 text-olive shrink-0" />;
          } else if (toast.type === 'error') {
            borderClass = 'border-vermilion bg-vermilion-faint text-ink';
            icon = <AlertCircle className="w-5 h-5 text-vermilion shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              data-testid="toast-message"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 border-2 shadow-hard bg-paper text-sm font-body ${borderClass}`}
              role="status"
            >
              {icon}
              <div className="flex-1 text-ink text-sm leading-tight pt-0.5">{toast.message}</div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-ink-muted hover:text-ink cursor-pointer p-0.5"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
