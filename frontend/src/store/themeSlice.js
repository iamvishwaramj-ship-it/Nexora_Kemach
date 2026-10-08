import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_SIDEBAR_FONT, DEFAULT_BODY_FONT } from '../theme/fonts';
import { DEFAULT_COLOR_SCHEME } from '../theme/colorSchemes';

// Default theme color: maroon (DEFAULT_COLOR_SCHEME, defined next to the
// schemes themselves). Alt colors: orange, blue, green, red, purple.
// Also supports two-color combos (primary/accent pairs).
// sidebarFont / bodyFont let the sidebar navigation and the main
// dashboard/body content use independent professional fonts (Settings page).
// sidebarBold/Italic/Underline and bodyBold/Italic/Underline are independent
// style toggles layered on top of those fonts, also set from Settings.
const STORAGE_KEY = 'nexora_theme';

const DEFAULTS = {
  colorScheme: DEFAULT_COLOR_SCHEME,
  mode: 'light',
  sidebarFont: DEFAULT_SIDEBAR_FONT,
  bodyFont: DEFAULT_BODY_FONT,
  sidebarBold: false,
  sidebarItalic: false,
  sidebarUnderline: false,
  bodyBold: false,
  bodyItalic: false,
  bodyUnderline: false,
  // Settings > Theme: on/off switch for the sidebar's 3D hover/focus lift
  // (Sidebar.jsx). Independent of the OS-level prefers-reduced-motion query
  // -- that query still wins even when this is true, but setting this to
  // false suppresses the effect outright regardless of OS preference.
  sidebar3dHoverEnabled: true,
  // Settings > Theme: on/off switch for the per-item sidebar icon colours
  // (Sidebar.jsx + layout/sidebarIconColors.js). When false every icon falls
  // back to inheriting the nav button's own colour, which is how the sidebar
  // looked before the palette existed.
  sidebarIconColorsEnabled: true,
  // Settings > Developer Settings: on/off switch for the "Smart Add" button
  // shown on sales documents (SalesQuotation/SalesInvoice/SalesOrder/
  // DeliveryChallan). Lets an admin/developer hide the feature without
  // touching code.
  smartAddEnabled: true,
  // Settings > Developer Settings: on/off switch for the small profile/
  // link icon shown next to master-data fields (Customer, Warehouse,
  // Branch, ...) on documents -- clicking it jumps straight into that
  // record's own master page (Customer Master, Warehouse Master, Branch
  // Master, ...) instead of having to go find it from the sidebar. Starts
  // with sales documents' Customer field; off by default since it's a new,
  // opt-in navigation shortcut.
  masterQuickLinkEnabled: false,
};

function loadInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      return { ...DEFAULTS, ...saved };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

const initialState = loadInitial();

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setColorScheme(state, action) {
      state.colorScheme = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setMode(state, action) {
      state.mode = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    toggleMode(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSidebarFont(state, action) {
      state.sidebarFont = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setBodyFont(state, action) {
      state.bodyFont = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSidebarBold(state, action) {
      state.sidebarBold = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSidebarItalic(state, action) {
      state.sidebarItalic = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSidebarUnderline(state, action) {
      state.sidebarUnderline = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setBodyBold(state, action) {
      state.bodyBold = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setBodyItalic(state, action) {
      state.bodyItalic = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setBodyUnderline(state, action) {
      state.bodyUnderline = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSidebar3dHoverEnabled(state, action) {
      state.sidebar3dHoverEnabled = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSidebarIconColorsEnabled(state, action) {
      state.sidebarIconColorsEnabled = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setSmartAddEnabled(state, action) {
      state.smartAddEnabled = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    setMasterQuickLinkEnabled(state, action) {
      state.masterQuickLinkEnabled = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  },
});

export const {
  setColorScheme,
  setMode,
  toggleMode,
  setSidebarFont,
  setBodyFont,
  setSidebarBold,
  setSidebarItalic,
  setSidebarUnderline,
  setBodyBold,
  setBodyItalic,
  setBodyUnderline,
  setSidebar3dHoverEnabled,
  setSidebarIconColorsEnabled,
  setSmartAddEnabled,
  setMasterQuickLinkEnabled,
} = themeSlice.actions;
export default themeSlice.reducer;
