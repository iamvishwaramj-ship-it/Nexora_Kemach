import { createSlice } from '@reduxjs/toolkit';
import { credentialsSet, loggedOut } from './authSlice';

// Chrome-style tab system: every page a user opens gets its own closeable tab.
// maxTabs defaults to 10, user-adjustable 1-10. When the max is hit, opening a
// new tab should prompt the user (handled by the TabBar component via
// pendingTab), not silently evict the oldest tab.
const STORAGE_KEY = 'nexora_tabs';
const USER_STORAGE_KEY = 'nexora_user';

// nexora_user is authSlice's own persistence key (see store/authSlice.js) --
// read directly rather than importing selectCurrentUser, since this file has
// no access to the live redux state at module-load time, only localStorage.
function loggedInUserId() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function defaultState(ownerId = null) {
  return { tabs: [], activeTabPath: null, maxTabs: 10, pendingTab: null, dirtyPaths: {}, ownerId };
}

function loadInitial() {
  const currentUserId = loggedInUserId();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    // dirtyPaths is deliberately never persisted/restored -- unsaved form
    // state doesn't survive a page reload anyway (keep-alive is in-memory
    // only), so a stale "dirty" flag from a previous session would just
    // block closing a tab that's actually clean.
    if (saved) {
      // The tab list used to have no idea whose account it belonged to, so
      // it was just one shared localStorage entry -- logging in as a
      // different person on the same browser inherited whatever pages the
      // previous account had open, menus and all, even ones the new account
      // has no permission for. ownerId ties the saved list to an account; a
      // pre-fix save (or one left over from someone else) has no ownerId or
      // a different one, so it gets discarded here instead of reused.
      if (saved.ownerId !== undefined && saved.ownerId !== null && saved.ownerId !== currentUserId) {
        return defaultState(currentUserId);
      }
      return { ...defaultState(currentUserId), ...saved, pendingTab: null, dirtyPaths: {}, ownerId: currentUserId };
    }
  } catch {
    /* ignore */
  }
  return defaultState(currentUserId);
}

function persist(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tabs: state.tabs, activeTabPath: state.activeTabPath, maxTabs: state.maxTabs, ownerId: state.ownerId,
  }));
}

// Wipes the tab bar back to empty (Dashboard re-pins itself the next time
// it's opened) and re-labels the saved list as belonging to `ownerId`.
// Shared by the logout/login handling below so both go through one place.
function resetTabs(state, ownerId) {
  state.tabs = [];
  state.activeTabPath = null;
  state.pendingTab = null;
  state.dirtyPaths = {};
  state.ownerId = ownerId;
  persist(state);
}

const tabsSlice = createSlice({
  name: 'tabs',
  initialState: loadInitial(),
  reducers: {
    openTab(state, action) {
      const { path, title, closable = true } = action.payload;
      const existing = state.tabs.find((t) => t.path === path);
      if (existing) {
        // Re-pin on every open in case an older, pre-pinned-Dashboard session
        // was persisted to localStorage with closable still true.
        if (closable === false) existing.closable = false;
        // Keep the tab's label in sync with the current nav config -- a menu
        // rename (e.g. "Business Partner" -> "Partner Management") should
        // take effect on the next visit, not stay stuck at whatever title
        // was persisted to localStorage the first time this path was opened.
        if (title && existing.title !== title) existing.title = title;
        state.activeTabPath = path;
        persist(state);
        return;
      }
      if (state.tabs.length >= state.maxTabs) {
        state.pendingTab = { path, title, closable };
        return;
      }
      state.tabs.push({ path, title, closable });
      state.activeTabPath = path;
      persist(state);
    },
    confirmOpenPendingTab(state) {
      if (!state.pendingTab) return;
      // Evict the oldest closable tab to make room, per user confirmation
      const idx = state.tabs.findIndex((t) => t.closable);
      if (idx !== -1) state.tabs.splice(idx, 1);
      state.tabs.push(state.pendingTab);
      state.activeTabPath = state.pendingTab.path;
      state.pendingTab = null;
      persist(state);
    },
    cancelPendingTab(state) {
      state.pendingTab = null;
    },
    closeTab(state, action) {
      const path = action.payload;
      const idx = state.tabs.findIndex((t) => t.path === path);
      if (idx === -1) return;
      if (state.tabs[idx].closable === false) return; // e.g. Dashboard -- always pinned, never removable
      state.tabs.splice(idx, 1);
      delete state.dirtyPaths[path];
      if (state.activeTabPath === path) {
        const fallback = state.tabs[idx] || state.tabs[idx - 1];
        state.activeTabPath = fallback ? fallback.path : null;
      }
      persist(state);
    },
    // Despite the name, this is "close all OTHER tabs" -- the tab the user
    // is actually sitting on stays open, same as Chrome's own "Close other
    // tabs". Closing the one tab someone is looking at out from under them,
    // right as they clicked a button that visibly says "all", was jarring
    // and (if it had unsaved changes) discarded work they never asked to
    // discard. Pinned tabs (Dashboard) survive this too, same as before --
    // it's static, not just closeable-one-at-a-time.
    closeAllTabs(state) {
      const keep = (t) => t.closable === false || t.path === state.activeTabPath;
      const closing = state.tabs.filter((t) => !keep(t)).map((t) => t.path);
      state.tabs = state.tabs.filter(keep);
      closing.forEach((p) => delete state.dirtyPaths[p]);
      // activeTabPath is unchanged -- it names a tab that's still there.
      persist(state);
    },
    setActiveTab(state, action) {
      state.activeTabPath = action.payload;
      persist(state);
    },
    setMaxTabs(state, action) {
      state.maxTabs = Math.min(10, Math.max(1, action.payload));
      persist(state);
    },
    // Not persisted to localStorage -- purely in-memory, mirrors whether the
    // tab's form currently has unsaved edits (RHF's formState.isDirty).
    setTabDirty(state, action) {
      const { path, dirty } = action.payload;
      if (dirty) state.dirtyPaths[path] = true;
      else delete state.dirtyPaths[path];
    },
  },
  // Tabs used to be pure localStorage, unaware of who was signed in -- so
  // signing out and signing back in as someone else kept the previous
  // account's tab bar (and the menus behind those tabs) on screen, even
  // when the new account's permission grid doesn't cover them. Reset the
  // tab bar whenever the signed-in identity actually changes: a fresh login
  // (as anyone, including the same person re-logging-in) and a logout both
  // now start the next session with a clean, Dashboard-only tab bar instead
  // of inheriting someone else's.
  extraReducers: (builder) => {
    builder
      .addCase(loggedOut, (state) => {
        resetTabs(state, null);
      })
      .addCase(credentialsSet, (state, action) => {
        const nextOwnerId = action.payload?.user?.id ?? null;
        if (state.ownerId !== nextOwnerId) resetTabs(state, nextOwnerId);
      });
  },
});

export const {
  openTab, confirmOpenPendingTab, cancelPendingTab,
  closeTab, closeAllTabs, setActiveTab, setMaxTabs, setTabDirty,
} = tabsSlice.actions;
export default tabsSlice.reducer;
