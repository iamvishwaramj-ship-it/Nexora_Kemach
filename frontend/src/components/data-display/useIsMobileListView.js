import { useMediaQuery, useTheme } from '@mui/material';

// Shared breakpoint check for "should this listing render as cards instead
// of a table?" — mobile only (below `sm`), never on tablet/desktop.
// See tempmem.md section 5. Every list table in the app must use this same
// check rather than inventing its own breakpoint.
//
// { noSsr: true } makes useMediaQuery read `window.matchMedia` synchronously
// on the very first render instead of assuming `false` (desktop) until after
// mount and correcting itself on a second render once the real viewport is
// known. This app is a client-only Vite SPA — there is no server-rendered
// HTML to keep consistent with a real window, which is the only reason
// useMediaQuery defaults to the two-pass behaviour — so noSsr is safe here.
// Without it, every list page mounts as a table, then immediately flips to
// cards (or vice versa) on tablet/phone: a visible layout shift plus an
// avoidable extra render, on top of whatever a page's own data fetching
// already re-renders for.
export function useIsMobileListView() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
}
