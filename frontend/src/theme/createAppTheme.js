import { createTheme } from '@mui/material/styles';
import { colorSchemes, DEFAULT_COLOR_SCHEME } from './colorSchemes';
import { getFontStack, DEFAULT_SIDEBAR_FONT, DEFAULT_BODY_FONT } from './fonts';

// Builds a full MUI theme from a color-scheme key + light/dark mode.
// Every visual variant comes from palette tokens — components must never
// hardcode hex values, so both modes and every scheme stay consistent.
// sidebarFontKey / bodyFontKey let the sidebar nav and the main body
// (dashboard + all pages) use independent professional fonts, chosen from
// theme/fonts.js in Settings. sidebarStyle / bodyStyle layer bold / italic /
// underline on top of those fonts, independently for each region.
//
// Body content (everything inside MainLayout's <main data-font-scope="body">)
// is only reliably forced via `!important`, because MUI variant styles
// (h4/h5/button/etc.) already set their own fontWeight with normal
// specificity. The sidebar applies the same trick locally in Sidebar.jsx.
export function createAppTheme(
  colorSchemeKey = DEFAULT_COLOR_SCHEME,
  mode = 'light',
  sidebarFontKey = DEFAULT_SIDEBAR_FONT,
  bodyFontKey = DEFAULT_BODY_FONT,
  sidebarStyle = {},
  bodyStyle = {}
) {
  const scheme = colorSchemes[colorSchemeKey] || colorSchemes[DEFAULT_COLOR_SCHEME];
  const isDark = mode === 'dark';
  const bodyFontStack = getFontStack(bodyFontKey);
  const sidebarFontStack = getFontStack(sidebarFontKey);

  // Resolve each scope's toggles into a CSS fragment. Only emit a property
  // when the toggle is on — leaving it off preserves each component's
  // normal MUI styling (e.g. headings stay bold, buttons stay normal weight)
  // instead of flattening everything to one weight/style.
  const toTextOverrides = (style) => ({
    ...(style.bold ? { fontWeight: '700 !important' } : {}),
    ...(style.italic ? { fontStyle: 'italic !important' } : {}),
    ...(style.underline ? { textDecoration: 'underline !important' } : {}),
  });
  const sidebarTextOverrides = toTextOverrides(sidebarStyle);
  const bodyTextOverrides = toTextOverrides(bodyStyle);
  const bodyHasOverrides = Object.keys(bodyTextOverrides).length > 0;
  // Every scheme (single-color ones too, via primary -> accent shading) has
  // a primary/accent pair, so this is always a genuine two-stop gradient —
  // used on brand-forward surfaces (primary buttons, active sidebar item,
  // login) instead of a flat primary.main fill.
  const gradient = `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.accent} 100%)`;

  return createTheme({
    palette: {
      mode,
      primary: { main: scheme.primary, contrastText: '#fff' },
      secondary: { main: scheme.accent, contrastText: '#fff' },
      background: {
        default: isDark ? '#0F1420' : '#F5F6FA',
        paper: isDark ? '#161C2C' : '#FFFFFF',
      },
      success: { main: '#48BB78' },
      error: { main: '#F56565' },
      warning: { main: '#F6AD55' },
      info: { main: '#63B3ED' },
      text: isDark
        ? { primary: '#E2E8F0', secondary: '#A0AEC0' }
        : { primary: '#1A202C', secondary: '#4A5568' },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: bodyFontStack,
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          containedPrimary: {
            backgroundImage: gradient,
            '&:hover': { backgroundImage: gradient, filter: 'brightness(0.94)' },
            '&.Mui-disabled': { backgroundImage: 'none' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.08)', borderRadius: 10 },
        },
      },
      // Every table header across the app takes the same treatment as the
      // G/L Account Determination screen — filled with the active color
      // scheme's primary color, not a per-page inline override — so it comes
      // from the theme (and follows the user's scheme/mode choice in
      // Settings) instead of being hand-set on each page's TableRow.
      // Every table's grid lines come from the theme divider token instead
      // of a hardcoded light-grey literal, so they read as a subtle line in
      // light mode and don't turn into a bright white grid in dark mode.
      // `border` (not just borderColor) is set here because most list pages
      // used to hand-roll a full 1px box around every th/td for a grid look
      // (MUI's own default is a borderBottom only) — replicating that here
      // keeps light mode visually the same while making dark mode themed.
      // Pages that used to set their own '1px solid rgba(224,224,224,1)'
      // border on th/td rely on this instead — see MuiTableHead just below
      // for the header's own themed fill.
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({ border: '1px solid', borderColor: theme.palette.divider }),
          head: ({ theme }) => ({ borderColor: theme.palette.divider }),
          body: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
              backgroundColor: scheme.primary, color: '#fff',
            },
          },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      // A "View" page (AppForm's readOnly mode) disables every field rather
      // than swapping to plain text, so the record stays inside the exact
      // same boxes as the edit form. MUI's own disabled-input treatment
      // (dimmed by opacity, and re-asserted via -webkit-text-fill-color on
      // WebKit/Chromium, which a plain `color` override can't beat) is tuned
      // for a field that's unusable, not for a field that's just being read —
      // it landed the actual saved value at nearly the same low contrast as
      // the box's own outline, exactly the "the data is very light" report.
      // Forcing full-strength text.primary here keeps the disabled *look*
      // (grey-ish outline, no focus ring) while making what's actually typed
      // in the box legible.
      MuiInputBase: {
        styleOverrides: {
          input: ({ theme }) => ({
            '&.Mui-disabled': {
              WebkitTextFillColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              opacity: 1,
            },
          }),
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      ...(bodyHasOverrides
        ? {
            MuiCssBaseline: {
              styleOverrides: {
                // Scoped to the main content area (MainLayout marks it with
                // data-font-scope="body") so this never bleeds into the
                // sidebar, which has its own independent style toggles.
                '[data-font-scope="body"]': bodyTextOverrides,
                '[data-font-scope="body"] *': bodyTextOverrides,
              },
            },
          }
        : {}),
    },
    custom: {
      scheme: scheme,
      schemeKey: colorSchemeKey,
      gradient,
      sidebarFontFamily: sidebarFontStack,
      bodyFontFamily: bodyFontStack,
      sidebarTextOverrides,
      bodyTextOverrides,
    },
  });
}

export default createAppTheme;
