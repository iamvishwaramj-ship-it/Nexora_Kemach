// Wraps an RTK Query `use...Query` hook for a report page so the report
// tab (the in-app page/tab under Reports, not the browser tab) keeps its
// data reasonably fresh while it sits open, without polling on a fixed
// timer regardless of whether anyone is even looking at it.
//
// Behavior:
//   - On mount, and whenever this report tab becomes the active one again
//     (see "activity" note below), check how long it's been since this
//     hook instance last had fresh data:
//       - >= syncIntervalMs already elapsed -> refetch() right away.
//       - < syncIntervalMs elapsed -> don't refetch now, just arm a timer
//         for the remaining time.
//   - While this tab is NOT the active one, no timer is left running --
//     any armed timer is cleared the moment the tab goes inactive, and
//     re-armed (recomputing the remaining wait from the still-current
//     lastSyncedAt) once it becomes active again. This tab's timer never
//     fires in the background.
//   - Every successful resolution of the query -- the initial mount
//     fetch, an RTK Query cache hit from another subscriber, our own
//     refetch() above, or any refetch RTK Query itself does for its own
//     reasons (tag invalidation, arg change, etc.) -- resets the clock,
//     so the interval always measures "since this tab last actually had
//     fresh-enough data", not just "since we last pulled the trigger".
//     If that resolution happens while the tab is inactive, only the
//     clock is updated -- no timer is armed, since it would just fire
//     while hidden.
//
// Source of truth for "when was this last synced": RTK Query's own
// `fulfilledTimeStamp` on the query result, rather than hand-rolling a
// separate isSuccess-driven timestamp. RTK Query already tracks this per
// subscription and updates it on every fulfillment (fetch, cache hit,
// refetch), so reusing it is both simpler and more correct than
// reimplementing the same bookkeeping here.
//
// Source of truth for "is this tab active": these 7 report pages are
// rendered under KeepAliveOutlet (components/navigation/KeepAliveOutlet.jsx),
// which keeps every opened report tab mounted simultaneously and only
// toggles CSS display between them -- so document.visibilitychange (the
// browser Page Visibility API) never fires when switching between report
// tabs in-app; it only fires for actual browser tab/window visibility.
// useIsActiveTab() (components/navigation/TabPathContext.jsx) is the
// mechanism KeepAliveOutlet already provides for exactly this: it compares
// this tab's fixed path (carried via TabPathContext, since the real
// location.pathname only ever reflects whichever tab is on screen) against
// the current location.pathname, and falls back to `true` when rendered
// outside a tab (standalone pages, tests) so this hook keeps working there
// unchanged.
//
// Scope: the "lastSyncedAt" clock and its timer live in this hook
// instance's own refs -- they are not shared with other report pages'
// hook instances, and not synced across browser tabs/windows. Each
// mounted report page tracks its own freshness independently, matching
// how each of the 7 inventory report pages is already independent.
import { useEffect, useRef } from 'react';
import { useIsActiveTab } from '../components/navigation/TabPathContext';

const DEFAULT_SYNC_INTERVAL_MS = 45_000;

export function useTabSyncedReportQuery(useQueryHook, queryArgs, options = {}) {
  const { syncIntervalMs = DEFAULT_SYNC_INTERVAL_MS, queryOptions } = options;

  const queryResult = useQueryHook(queryArgs, queryOptions);
  const { isSuccess, fulfilledTimeStamp } = queryResult;
  const isActive = useIsActiveTab();

  // Seed from whatever RTK Query already knows at first render -- if this
  // mount immediately gets a cache hit (e.g. navigating back to a report
  // page whose query is still subscribed/cached elsewhere), fulfilledTimeStamp
  // is already set and we should trust it instead of treating this as a
  // never-synced mount.
  const lastSyncedAtRef = useRef(fulfilledTimeStamp ?? null);
  const timerRef = useRef(null);

  // refetch (and the rest of queryResult) is a fresh function identity on
  // every render from the underlying hook -- keep the latest one in a ref
  // so the timer callback always calls the current one without needing to
  // be re-armed every render.
  const refetchRef = useRef(queryResult.refetch);
  refetchRef.current = queryResult.refetch;

  const clearTimer = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Never stack timers -- always clear any pending one before scheduling
  // the next, whether that's a reschedule from fresh data or a "remaining
  // time" timer from a visibility check.
  const scheduleTimer = (delayMs) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      refetchRef.current();
      lastSyncedAtRef.current = Date.now();
      scheduleTimer(syncIntervalMs);
    }, Math.max(delayMs, 0));
  };

  // Keep the latest "is this tab active" flag in a ref too, so the
  // isSuccess effect below (which can fire independently of the
  // active-tab effect, e.g. from a background RTK Query refetch) always
  // checks the current value without needing to be in its own deps.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Every successful resolution resets the clock -- covers cache hits and
  // RTK Query's own refetches, not just ones this hook triggered -- but
  // only (re)arms a live timer while this tab is the active one. A
  // resolution while inactive just records the timestamp; the timer gets
  // armed (with the correct remaining wait) once the tab becomes active
  // again, by the active-tab effect below.
  useEffect(() => {
    if (isSuccess && fulfilledTimeStamp) {
      lastSyncedAtRef.current = fulfilledTimeStamp;
      if (isActiveRef.current) {
        scheduleTimer(syncIntervalMs);
      } else {
        clearTimer();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, fulfilledTimeStamp, syncIntervalMs]);

  // "Becoming active" = mount while active, or this report tab regaining
  // the active tab slot (isActive flipping from false to true) under
  // KeepAliveOutlet. Going inactive fully pauses the timer so it can't
  // fire in the background; the elapsed-time bookkeeping in
  // lastSyncedAtRef is untouched while paused, so the remaining wait is
  // recomputed correctly next time this effect runs with isActive true.
  useEffect(() => {
    if (!isActive) {
      clearTimer();
      return undefined;
    }

    const last = lastSyncedAtRef.current;
    if (last == null) {
      // No known sync timestamp yet -- the underlying RTK Query hook is
      // already doing its own initial fetch, so don't duplicate that
      // call here. Just arm a full-interval timer; the isSuccess effect
      // above will replace it with an accurate one once real data (or a
      // cache hit) lands.
      scheduleTimer(syncIntervalMs);
    } else {
      const elapsed = Date.now() - last;
      if (elapsed >= syncIntervalMs) {
        refetchRef.current();
        lastSyncedAtRef.current = Date.now();
        scheduleTimer(syncIntervalMs);
      } else {
        scheduleTimer(syncIntervalMs - elapsed);
      }
    }

    return () => {
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, syncIntervalMs]);

  // Drop-in replacement for the wrapped hook's own return value.
  return queryResult;
}

export default useTabSyncedReportQuery;
