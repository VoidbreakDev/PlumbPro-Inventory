import { useEffect, useRef, useCallback } from 'react';

interface UseAutoLogoutOptions {
  timeout: number; // milliseconds
  onLogout: () => void;
  events?: string[];
}

/**
 * Hook to automatically logout user after a period of inactivity
 * @param timeout - Time in milliseconds before auto-logout (default: 30 minutes)
 * @param onLogout - Callback function to execute on auto-logout
 * @param events - List of events to listen for user activity
 */
export function useAutoLogout({
  timeout = 30 * 60 * 1000, // 30 minutes default
  onLogout,
  events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
}: UseAutoLogoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimers();

    // Show warning 2 minutes before auto-logout
    const warningTime = timeout - (2 * 60 * 1000); // 2 minutes before
    if (warningTime > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        // Dispatch custom event for warning notification
        window.dispatchEvent(new CustomEvent('auto-logout-warning', {
          detail: { remainingSeconds: 120 }
        }));
      }, warningTime);
    }

    // Set main logout timer
    timeoutRef.current = setTimeout(() => {
      onLogout();
      // Dispatch custom event for auto-logout
      window.dispatchEvent(new CustomEvent('auto-logout'));
    }, timeout);
  }, [timeout, onLogout, clearTimers]);

  const resetTimer = useCallback(() => {
    // Clear any existing warning
    window.dispatchEvent(new CustomEvent('auto-logout-warning-clear'));
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    // Start the timer on mount
    startTimer();

    // Add event listeners for user activity
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup on unmount
    return () => {
      clearTimers();
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [events, resetTimer, startTimer, clearTimers]);

  return {
    resetTimer,
    clearTimers
  };
}
