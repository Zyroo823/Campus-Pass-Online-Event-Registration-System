/**
 * Rate Limit Countdown Banner
 * Rate Limiting requirement: UI shows a plain message with a live countdown
 * and disables the submit button until it expires.
 */

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface RateLimitCountdownProps {
  initialSeconds: number;
  message?: string;
  onExpire?: () => void;
}

export const RateLimitCountdown: React.FC<RateLimitCountdownProps> = ({
  initialSeconds,
  message,
  onExpire,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onExpire]);

  if (secondsLeft <= 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="rate-limit-message"
      className="p-3 border-2 border-mustard bg-mustard-faint text-ink flex items-center gap-3 font-mono text-xs shadow-hard-sm"
    >
      <Clock className="w-4 h-4 text-mustard shrink-0" />
      <div>
        <p className="font-bold text-ink">
          {message || 'Rate limit reached. Please pause before submitting again.'}
        </p>
        <p className="text-ink-muted mt-0.5">
          Resets in <span className="font-bold text-ink underline">{secondsLeft}</span> seconds.
        </p>
      </div>
    </div>
  );
};
