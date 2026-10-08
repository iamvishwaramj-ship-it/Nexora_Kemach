// Sizes a text column (Product Code, Product Name) to fit its widest current
// value instead of sitting at a wasteful fixed width. HTML table columns share
// one width across every row — a cell can't be narrower or wider than its
// column — so this looks at every row's value in the column and returns a
// single width that fits the longest one.

// How much of a cell's width is consumed by everything that ISN'T the text.
//
// Getting this wrong is what made the hover-expand columns still cut names
// off ("Samsung Galaxy S2…" with the column already widened): the old flat
// 64px allowance covered the input's own padding and the table cell's, but
// not the Autocomplete's end adornment — the clear (×) and dropdown (▾)
// buttons together take ~56px out of the box before a single character is
// drawn. A select-backed column therefore needs roughly twice the allowance
// a plain text field does, so the two are measured separately rather than
// sharing one number that is wrong for both.
const FIELD_CHROME = {
  // MUI TableCell size="small" side padding (32) + outlined input padding
  // (~14 left) + border (2) + the 65px strip MUI reserves on the right of an
  // Autocomplete for the clear (×) and popup (▾) buttons, plus slack so the
  // last glyph never sits under them.
  select: 128,
  // Same, without that reserved strip: cell padding (32) + input padding
  // (14 + 14) + border (2).
  text: 66,
};

// The fonts these columns are actually drawn in.
//
// Guessing these is what clipped "PRD-000004" down to "PRD-00000": the widths
// were estimated at 14px, but nothing in the theme (see createAppTheme.js)
// overrides MUI's input font size, so InputBase keeps its default of
// body1 — 1rem, i.e. 16px. Every value was therefore measured about 13% narrow,
// which costs roughly one character on a ten-character code: exactly the
// symptom. Headers are the theme's own MuiTableCell-head rule.
const BODY_FONT = { size: 16, weight: 400 };
const HEADER_FONT = { size: 12, weight: 600, uppercase: true, letterSpacing: 0.05 };

// A couple of px so the final glyph never sits flush against the border.
const SAFETY_PAD = 6;

// Canvas text measurement, so a column's width comes from the glyphs actually
// drawn rather than from an average-character guess. This is what makes the
// sizing survive a font change, a different weight, or a value full of wide
// characters — none of which a characters × average-width estimate can see.
//
// Everything is wrapped in try/catch and falls back to the old estimate: the
// module is imported during render, and a canvas context is not guaranteed
// (SSR, a locked-down embed, a browser refusing 2d contexts). A slightly wrong
// width is a cosmetic problem; a thrown error while rendering is not.
let measureCtx = null;
let measureFamily = null;

function bodyFontFamily() {
  if (measureFamily) return measureFamily;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    measureFamily = window.getComputedStyle(document.body).fontFamily || null;
  } catch {
    measureFamily = null;
  }
  return measureFamily;
}

/** Rendered width of `text` in px, or null when it cannot be measured. */
export function measureTextWidth(text, font = BODY_FONT) {
  const raw = String(text ?? '');
  if (!raw) return 0;
  const value = font.uppercase ? raw.toUpperCase() : raw;
  const family = bodyFontFamily();
  if (!family) return null;
  try {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    if (!measureCtx) return null;
    measureCtx.font = `${font.weight} ${font.size}px ${family}`;
    // Canvas has no letter-spacing in every engine, so it is added by hand —
    // the theme puts 0.05em between header characters.
    const tracking = (font.letterSpacing || 0) * font.size * value.length;
    return measureCtx.measureText(value).width + tracking;
  } catch {
    return null;
  }
}

/**
 * @param {string[]} values  every value the column has to be able to show
 * @param {object} options
 *   min/max   — the width is clamped to this range
 *   charWidth — fallback advance per character, used only when the canvas
 *               measurement above is unavailable. Deliberately generous (9.8
 *               at 16px) so a value full of capitals still fits rather than
 *               nearly fits.
 *   font      — which of BODY_FONT / HEADER_FONT the text is drawn in
 *   field     — 'select' (Autocomplete) or 'text' (plain field); picks the
 *               chrome allowance above. Ignored if `padding` is passed.
 *   padding   — override the allowance outright.
 */
export function fitColumnWidth(values, {
  min = 90,
  max = 320,
  charWidth = 9.8,
  font = BODY_FONT,
  field = 'select',
  padding = FIELD_CHROME[field] ?? FIELD_CHROME.select,
} = {}) {
  const widest = (values || []).reduce((acc, v) => {
    const text = String(v ?? '');
    if (!text) return acc;
    const measured = measureTextWidth(text, font);
    return Math.max(acc, measured == null ? text.length * charWidth : measured);
  }, 0);
  return Math.max(min, Math.min(max, widest + padding + (widest ? SAFETY_PAD : 0)));
}

// How much of a HEADER cell's width is chrome. A header holds plain text, not
// a field, so it pays only the TableCell's own side padding (16 + 16 at
// size="small") — none of the input padding, border or adornment buttons the
// body cells below it have to carry.
const HEADER_CHROME = 36;

// A 'plain' item-table column (see itemTableSx) is measured with the
// plain-text FIELD allowance, which covers an input's own padding and border;
// a cell that merely prints a number pays only the TableCell's padding, so the
// difference comes back off again.
const PLAIN_CHROME_REBATE = FIELD_CHROME.text - HEADER_CHROME;

/**
 * The sx for an item-details column that ALWAYS shows its values in full —
 * no ellipsis, no wrapping, no hover needed, however long the text is.
 *
 * This is the opposite trade-off to hoverExpandColumnSx below. That one keeps
 * the table narrow and hides the overflow behind a hover; this one keeps every
 * value permanently readable and lets the table get as wide as it has to,
 * which the item tables can afford because they already scroll horizontally
 * (see the drag-scroll TableContainer each document page wraps them in).
 *
 * The width is the larger of what the widest VALUE needs and what the column's
 * own HEADING needs, so a column never ends up narrower than its own title —
 * that is what was wrapping "Quantity *" and "Unit Price (₹) *" onto two lines
 * while their values sat on one.
 *
 * Apply the same returned sx to the column's header cell AND to every body
 * cell in it: an HTML table column takes the widest preferred width among its
 * cells, and `width` alone is only a hint that auto-layout may overrule, so
 * `width` and `minWidth` are always set together (same reasoning as the note
 * inside hoverExpandColumnSx).
 *
 * @param {object} options
 *   values   — every value the column holds, across all rows
 *   header   — the column's heading text, so the title fits on one line too
 *   field    — 'select' (Autocomplete) or 'text' (plain field); picks the
 *              chrome allowance the body cells need
 *   min      — floor for an empty column (a freshly added row)
 */
export function fullValueColumnSx({
  values = [],
  header = '',
  field = 'select',
  min = 90,
} = {}) {
  // Values are drawn inside a field, at the input's own font; the heading is
  // drawn as the theme's uppercase, letter-spaced table head. Measuring both
  // with one font is what let a heading overflow a column sized for its values
  // (and the reverse), so each is measured in the font it is actually painted.
  const valueWidth = fitColumnWidth(values, {
    min,
    max: Number.POSITIVE_INFINITY,
    font: BODY_FONT,
    field,
  });
  const headerWidth = header
    ? fitColumnWidth([header], {
      min: 0,
      max: Number.POSITIVE_INFINITY,
      font: HEADER_FONT,
      charWidth: 8.5,
      padding: HEADER_CHROME,
    })
    : 0;
  const width = Math.round(Math.max(valueWidth, headerWidth));

  return {
    width,
    minWidth: width,
    // The heading sits on one line — the column was sized to guarantee it fits.
    whiteSpace: 'nowrap',
    // Undoes the ellipsis/clip an input would otherwise impose on itself. The
    // column is wide enough for the whole value by construction, so there is
    // nothing left to truncate — these rules just make sure nothing re-adds
    // the truncation.
    '& .MuiInputBase-root .MuiInputBase-input': {
      textOverflow: 'clip',
      overflow: 'visible',
      whiteSpace: 'nowrap',
    },
  };
}

/**
 * The `sx` for a whole item-details TABLE, sizing every one of its columns to
 * show its values in full — no ellipsis, no wrapping, no hover, however long
 * the text is. This is what all sixteen document/inventory item tables use.
 *
 * WHY IT SIZES THE TABLE RATHER THAN EACH CELL
 *
 * Sizing has to reach the header cell and every body cell of a column, because
 * an HTML table column takes the widest preferred width among its cells. Doing
 * that per cell means one `sx` on ~10 header cells plus ~10 body cells on each
 * of sixteen pages — roughly 300 places that all have to agree, and silently
 * drift apart the moment one is missed. Emitting `nth-of-type` rules from the
 * table instead sets both ends of every column from ONE place.
 *
 * The rules land at specificity (0,2,1) — the table's own class, plus the
 * `:nth-of-type` pseudo-class, plus the `th`/`td` element — so they outrank any
 * per-cell `sx` (0,1,0) still sitting on a cell. Old fixed `minWidth`s left on
 * a header therefore lose to these, rather than fighting them.
 *
 * THE ONE THING TO KEEP IN STEP
 *
 * `columns` is positional: entry N sizes the Nth `<TableCell>` of the row, so
 * it must mirror the header row top to bottom. Pass `null` for a column that
 * should keep whatever width it already has — the leading `#` counter and the
 * trailing action column both want that. Trailing conditional columns (a
 * `{!readOnly && <TableCell>Action</TableCell>}`) are safe precisely because
 * they are last: nothing after them needs an index.
 *
 * @param {object[]} items     the row objects (RHF's watched `items` array)
 * @param {Array<null|object>} columns  one entry per column, in header order:
 *   header — the heading text, so the title never wraps
 *   get    — (item) => the value shown in that column
 *   field  — 'select' (Autocomplete: clear + dropdown buttons), 'text' (plain
 *            input) or 'plain' (rendered text, no field chrome at all)
 *   min    — floor for an empty column
 */
export function itemTableSx(items = [], columns = []) {
  const sx = {
    // Without this the table shrinks itself to its container and auto-layout is
    // free to squeeze columns back under the widths set below — the value then
    // gets clipped again however carefully the columns were measured. With it
    // the table takes the width its columns genuinely need and the surrounding
    // TableContainer scrolls instead.
    minWidth: 'max-content',
    // Belt-and-braces against anything re-adding truncation inside a field.
    '& .MuiInputBase-root .MuiInputBase-input': {
      textOverflow: 'clip',
      overflow: 'visible',
      whiteSpace: 'nowrap',
    },
  };

  columns.forEach((column, i) => {
    if (!column) return;
    const { header = '', get, field = 'text', min = 90 } = column;
    const { width, minWidth } = fullValueColumnSx({
      values: get ? (items || []).map((item) => get(item || {})) : [],
      header,
      field: field === 'plain' ? 'text' : field,
      min,
    });
    // 'plain' columns hold rendered text, not a field, so they were measured
    // with the text allowance above and then have the input chrome taken back
    // off — they never pay for padding, borders or adornment buttons.
    const adjust = field === 'plain' ? PLAIN_CHROME_REBATE : 0;
    const w = Math.max(min, width - adjust);
    sx[`& th:nth-of-type(${i + 1}), & td:nth-of-type(${i + 1})`] = {
      width: w,
      minWidth: minWidth === width ? w : minWidth,
      whiteSpace: 'nowrap',
    };
  });

  return sx;
}
