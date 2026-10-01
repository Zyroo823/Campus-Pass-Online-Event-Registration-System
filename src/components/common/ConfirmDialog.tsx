/**
 * Accessible Confirmation Dialog
 * NFR-007, NFR-009: Focus trapped & returned, names item being deleted/cancelled
 */

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  actionType: 'delete' | 'cancel' | 'deactivate';
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  itemName,
  actionType,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      // Focus first actionable button inside dialog
      const confirmBtn = dialogRef.current?.querySelector<HTMLButtonElement>('[data-testid="dialog-confirm"]');
      confirmBtn?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        triggerRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-grayscale-0"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-paper border-2 border-ink shadow-hard-lg p-6 flex flex-col gap-4 text-ink"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-vermilion shrink-0" />
            <h2 id="confirm-dialog-title" className="font-display font-bold text-lg leading-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-ink-muted hover:text-ink cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm font-body text-ink space-y-2">
          <p>{message}</p>
          <div className="p-2.5 bg-paper-dark border border-ink font-mono text-xs font-semibold break-words">
            Target: &ldquo;{itemName}&rdquo;
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-ink">
          <button
            type="button"
            data-testid="dialog-cancel"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold border-2 border-ink bg-paper text-ink hover:bg-paper-dark transition-colors cursor-pointer shadow-hard-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="dialog-confirm"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-mono font-bold border-2 border-ink text-paper cursor-pointer shadow-hard-sm transition-colors ${
              actionType === 'delete' || actionType === 'cancel'
                ? 'bg-vermilion hover:bg-vermilion-hover'
                : 'bg-mustard text-ink hover:bg-mustard-hover'
            }`}
          >
            {confirmLabel || (actionType === 'delete' ? 'Delete Permanently' : 'Confirm Action')}
          </button>
        </div>
      </div>
    </div>
  );
};
