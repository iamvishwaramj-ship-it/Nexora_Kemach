import React, { useEffect, useState } from 'react';
import NexoraLoadingScreen from './NexoraLoadingScreen';

// Guarantees the NEXORA loading screen is on-screen for at least
// MIN_SPLASH_MS on cold boot, no matter how fast the app itself loads.
//
// Without this, the whole hand-off — the plain-CSS splash in index.html,
// then this same screen's React version, then the real app — can finish in
// well under 100ms on a fast dev server or a warm cache, which reads as "no
// loading screen at all" even though it did render (verified by fetching
// the served HTML directly — see BUGLOG / the loading-screen work). A short
// deliberate hold is also just normal splash-screen behaviour — most apps
// hold their brand mark briefly on cold start on purpose, not only when
// something is slow.
//
// performance.now() at mount time already IS "ms elapsed since navigation
// start" (that's what the number is relative to), so it doubles as a
// measure of how long index.html's static splash + the JS bundle itself
// already took — this only tops that up to MIN_SPLASH_MS, it never adds
// the full delay on top of a slow load.
//
// Deliberately scoped to first boot only: wraps <App/> once in main.jsx,
// not every lazy route chunk — AppRouter's own Suspense fallback (also
// NexoraLoadingScreen) still shows with no artificial delay for in-app
// navigation, where a forced hold would just feel sluggish.
const MIN_SPLASH_MS = 250;

export default function AppBootGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const elapsedMs = performance.now();
    const remainingMs = Math.max(0, MIN_SPLASH_MS - elapsedMs);
    const timer = setTimeout(() => setReady(true), remainingMs);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return <NexoraLoadingScreen label="Starting up" />;
  return children;
}
