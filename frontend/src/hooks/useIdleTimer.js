import { useCallback, useEffect, useRef, useState } from 'react';

// Activity signals that count as "the user is still here". Deliberately
// broad (mouse, keyboard, touch, wheel/scroll) rather than just mousemove,
// so e.g. someone scrolling a report with the keyboard alone still counts.
const DEFAULT_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'];

/**
 * Generic inactivity timer.
 *
 * Starts (or restarts) a `timeout`-ms countdown on every user activity event
 * and flips `isIdle` to true once it elapses with no activity. Any further
 * activity after that flips it back and fires `onActive` once, exactly at
 * the idle -> active transition (not on every keystroke).
 *
 * Used for two independent things in this app:
 *  - Login screen: stop polling `/health` (and therefore stop hitting the
 *    DB) after 5 minutes of nobody touching the login page, and resume the
 *    instant they move again.
 *  - Authenticated app: log the user out after 15 minutes of inactivity
 *    (session timeout).
 *
 * @param {number} timeout - milliseconds of inactivity before `isIdle` flips true.
 * @param {string[]} [events] - DOM events treated as activity.
 * @param {() => void} [onIdle] - called once, right when the user goes idle.
 * @param {() => void} [onActive] - called once, right when an idle user becomes active again.
 * @param {boolean} [disabled] - when true, the timer is torn down and `isIdle` stays false
 *   (e.g. don't run the 15-minute session timer while the user isn't logged in at all).
 */
export default function useIdleTimer({
  timeout,
  events = DEFAULT_EVENTS,
  onIdle,
  onActive,
  disabled = false,
} = {}) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef(null);
  const isIdleRef = useRef(false);

  // Kept in refs so `reset` doesn't need to change identity (and therefore
  // the event-listener effect below doesn't need to re-run) just because a
  // caller passed a fresh inline callback on every render.
  const onIdleRef = useRef(onIdle);
  const onActiveRef = useRef(onActive);
  onIdleRef.current = onIdle;
  onActiveRef.current = onActive;

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      onActiveRef.current?.();
    }

    timerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
      onIdleRef.current?.();
    }, timeout);
  }, [timeout]);

  useEffect(() => {
    if (disabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (isIdleRef.current) {
        isIdleRef.current = false;
        setIsIdle(false);
      }
      return undefined;
    }

    reset();
    events.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));

    // A backgrounded tab receives no mouse/keyboard events at all, so coming
    // back to the tab should also count as activity -- otherwise a tab left
    // open (but not focused) for 20 minutes would show as idle the instant
    // it regains focus, even though nothing timed out while it was hidden
    // from the user's perspective.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reset();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, reset));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, disabled]);

  return { isIdle };
}
