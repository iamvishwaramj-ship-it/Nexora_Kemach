import React, { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';

// Under the keep-alive outlet (see KeepAliveOutlet.jsx), every open tab's
// page component stays mounted even while a *different* tab is active, so
// the browser's real location.pathname no longer reliably identifies "which
// tab is this component running inside of" -- it always reflects whichever
// tab is currently visible, not the one a hidden/backgrounded component
// belongs to. This context carries each tab's own fixed path down to its
// subtree so things like dirty-state tracking (AppForm) can key off the
// right tab regardless of which one is on screen right now.
const TabPathContext = createContext(null);

export function TabPathProvider({ path, children }) {
  return <TabPathContext.Provider value={path}>{children}</TabPathContext.Provider>;
}

// Falls back to null when rendered outside a tab (e.g. dialogs, auth pages)
// so callers can fall back to useLocation().pathname themselves.
export function useTabPath() {
  return useContext(TabPathContext);
}

// Returns true if the component is mounted inside the tab currently on screen,
// or if rendered outside of KeepAliveOutlet entirely (standalone pages, tests).
// When false, the tab is in the background and should not portal print elements
// or inject print stylesheets that could conflict with the active tab.
export function useIsActiveTab() {
  const tabPath = useContext(TabPathContext);
  // useLocation is always safe inside BrowserRouter
  const location = useLocation();
  if (!tabPath || !location) return true;
  return tabPath === location.pathname;
}
