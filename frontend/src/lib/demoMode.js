// Client-demo switch for Production Planning screens — frontend-only, no
// backend/database involvement at all. Flip DEMO_MODE to true before a
// client demo so these screens show fixed, reliable data instead of calling
// the real API (immune to anything going on with the database), and flip it
// back to false afterward to restore the real, working screens exactly as
// they were — nothing else needs to change. Kept as a plain source constant
// rather than an environment variable so it's a single, visible, one-line
// toggle that doesn't depend on .env or a restart picking up new env vars.
export const DEMO_MODE = true;

export function isDemoMode() {
  return DEMO_MODE;
}
