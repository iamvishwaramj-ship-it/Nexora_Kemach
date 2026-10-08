import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'nexora_ui';

function loadInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    // mobileSidebarOpen is transient UI state (the temporary drawer on
    // phones/tablets) — it must never be restored as "open" from a stale
    // localStorage snapshot, otherwise every page load on mobile opens the
    // drawer over the content unrequested. Only sidebarCollapsed (the
    // desktop expand/collapse preference) is meant to persist.
    if (saved) return { sidebarCollapsed: false, ...saved, mobileSidebarOpen: false };
  } catch {
    /* ignore */
  }
  return { sidebarCollapsed: false, mobileSidebarOpen: false };
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: loadInitial(),
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebarCollapsed: state.sidebarCollapsed }));
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebarCollapsed: state.sidebarCollapsed }));
    },
    // Mobile/tablet temporary drawer open state — intentionally NOT
    // persisted to localStorage, separate from the desktop collapsed
    // preference above.
    toggleMobileSidebar(state) {
      state.mobileSidebarOpen = !state.mobileSidebarOpen;
    },
    setMobileSidebarOpen(state, action) {
      state.mobileSidebarOpen = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, toggleMobileSidebar, setMobileSidebarOpen } = uiSlice.actions;
export default uiSlice.reducer;
