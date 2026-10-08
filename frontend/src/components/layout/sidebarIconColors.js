// One distinct colour per top-level sidebar section, keyed by the `key` values
// in router/navConfig.js. Sidebar.jsx paints each nav icon with these when
// Settings > Theme > "Sidebar icon colors" is On, so a section is recognisable
// by its colour before its label is read — and still recognisable when the
// rail is collapsed to icons only.
//
// --- How these values were chosen ------------------------------------------
// Two constraints, both of which every entry below satisfies:
//
//   1. NO TWO KEYS SHARE A COLOUR. The point is telling sections apart, so a
//      repeat would be a bug, not a style choice. The test at the bottom of
//      this comment is simply that the set of values is as large as the set of
//      keys.
//
//   2. AT LEAST 3:1 CONTRAST AGAINST background.paper IN BOTH MODES --
//      #FFFFFF in light and #161C2C in dark (theme/createAppTheme.js). 3:1 is
//      the WCAG 1.4.11 bar for non-text graphics like an icon. Note this is a
//      TWO-SIDED constraint and it is narrower than it looks: a colour light
//      enough to read on the dark paper is often too light to read on white,
//      and vice versa, which leaves a usable relative-luminance band of
//      roughly 0.15-0.30. That is why these are mid-tone Material 600/700-ish
//      values rather than the brighter 400s -- the brighter tones fail on
//      white (a 400-level amber lands near 2:1 there and effectively
//      disappears).
//
// Measured contrast of each value, light paper / dark paper:
//   dashboard 4.23/4.02   company 3.74/4.54   accounting 3.68/4.61
//   product   3.86/4.39   partner 3.46/4.91   purchase   3.70/4.59
//   sales     3.51/4.84   inventory 3.86/4.40 receivables 4.72/3.60
//   payables  4.86/3.49   banking 5.21/3.26   reports    4.82/3.53
//   user      4.13/4.11   settings 3.35/5.07
//
// The hues run in order around the wheel following the nav's own top-to-bottom
// order (red -> orange -> gold -> olive -> green -> teal -> cyan -> blue ->
// indigo -> violet -> magenta), so neighbouring buttons are always well
// separated rather than two adjacent shades of the same hue. `settings` is the
// deliberate exception: a neutral blue-grey, because it is chrome rather than
// a business section.
//
// If you add a top-level entry to navConfig.js, add it here too -- pick a hue
// that isn't already taken and re-check it against both papers. An unmapped
// key is not a crash (see getSidebarIconColor) but it will be the one grey
// icon in a coloured rail.
export const SIDEBAR_ICON_COLORS = {
  dashboard: '#E53935',   // red
  company: '#E2571E',     // deep orange
  accounting: '#B77800',  // gold / amber
  product: '#6E8C1F',     // olive
  partner: '#2E9E3E',     // green
  purchase: '#00958B',    // teal
  sales: '#0097A7',       // cyan
  inventory: '#0288D1',   // light blue
  receivables: '#2A6FE0', // blue
  payables: '#5C6BC0',    // indigo
  banking: '#7E57C2',     // deep purple
  reports: '#AB47BC',     // violet
  user: '#DE3A8B',        // magenta
  settings: '#78909C',    // blue-grey (neutral: chrome, not a section)
};

/**
 * The colour for a nav section, or undefined when the key isn't mapped.
 *
 * undefined rather than a hardcoded grey on purpose: the caller feeds this
 * straight into an sx `color`, where undefined means "inherit whatever the nav
 * button already resolves to". So an unmapped section keeps the pre-palette
 * appearance instead of picking up a colour that only looks right in one mode.
 */
export function getSidebarIconColor(key) {
  return SIDEBAR_ICON_COLORS[key];
}
