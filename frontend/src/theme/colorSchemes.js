// Default: maroon. Alt single colors: orange, blue, green, red, purple.
// Plus sensible two-color primary/accent combos.
//
// Every entry needs BOTH a primary and an accent, even the single-colour ones:
// createAppTheme builds a two-stop gradient from the pair for primary buttons,
// the active sidebar item and the login screen, and passes accent through as
// palette.secondary. An accent equal to its primary would flatten all of that.
//
// Both colours end up carrying white text — createAppTheme hardcodes
// contrastText: '#fff' on primary and secondary — so each value in a new
// scheme has to hold up against white on its own.
export const colorSchemes = {
  // Brand orange updated to #FF4900 (was #FF6B35). Accent re-derived to keep
  // this scheme's own convention — same hue, lightened by the same amount the
  // old accent sat above the old primary — rather than reusing the old
  // #FF8C5A tint, which was fitted to the old hue and would have sat slightly
  // off next to the new one. White-on-#FF4900 measures 3.38:1, up from the
  // old primary's 2.84:1 (still short of the 4.5:1 AA threshold that most of
  // this file's single-colour schemes already fall short of — pre-existing,
  // not introduced here).
  orange: { primary: '#FF4900', accent: '#FF6325', label: 'Orange' },
  blue: { primary: '#1976D2', accent: '#42A5F5', label: 'Blue' },
  green: { primary: '#2E7D32', accent: '#66BB6A', label: 'Green' },
  red: { primary: '#D32F2F', accent: '#EF5350', label: 'Red' },
  purple: { primary: '#7B1FA2', accent: '#AB47BC', label: 'Purple' },
  // Classic maroon, kept deliberately far deeper than `red` above so the two
  // are still told apart at 16px swatch size in the header menu.
  //
  // accent deliberately equals primary here — every other single-colour
  // scheme (orange/blue/green/red/purple above) shades its accent lighter,
  // which makes createAppTheme's gradient visible on buttons/sidebar/login.
  // Maroon is the one scheme meant to read as a single flat colour with no
  // gradient, by request — a same-colour "gradient" paints as one flat fill
  // (two identical stops), so this needed no change to createAppTheme itself.
  // White-on-#7F1D1D measures 10.02:1, clear of WCAG AA.
  maroon: { primary: '#7F1D1D', accent: '#7F1D1D', label: 'Maroon' },
  // Orange stop updated to match the `orange` scheme above (#FF4900) — left at
  // the old #FF6B35 this combo would show a different orange than the plain
  // Orange swatch right next to it in the same picker.
  'orange-purple': { primary: '#FF4900', accent: '#7B1FA2', label: 'Orange + Purple' },
  'blue-green': { primary: '#1976D2', accent: '#2E7D32', label: 'Blue + Green' },
  // Same update, other order — see the note on 'orange-purple' above.
  'purple-orange': { primary: '#7B1FA2', accent: '#FF4900', label: 'Purple + Orange' },
  'red-blue': { primary: '#D32F2F', accent: '#1976D2', label: 'Red + Blue' },
  // The one combo whose two stops are neighbours on the wheel rather than
  // opposites — it reads as a single colour deepening from bright red into
  // maroon, where the others (red->blue, green->purple) read as two colours
  // meeting. Ordered red-then-maroon so the gradient darkens along its 135deg
  // sweep; reversing it makes buttons look lit from the bottom right.
  'red-maroon': { primary: '#D32F2F', accent: '#7F1D1D', label: 'Red + Maroon' },
  'green-purple': { primary: '#2E7D32', accent: '#7B1FA2', label: 'Green + Purple' },
};

// The scheme a browser gets before anyone has chosen one. Exported so the
// Redux default (store/themeSlice.js) and createAppTheme's fallback both read
// the same value — they each used to spell 'orange' themselves, which is two
// places to miss when the default changes.
//
// NOTE: this only reaches a user who has never picked a colour. Anyone with an
// existing `nexora_theme` in localStorage keeps whatever is stored there, so
// changing this will not repaint an existing session — clear that key (or use
// a fresh profile) to see it.
export const DEFAULT_COLOR_SCHEME = 'maroon';

export const colorSchemeList = Object.entries(colorSchemes).map(([key, v]) => ({ key, ...v }));
