import React from 'react';
import { Box, Typography } from '@mui/material';

// Label-left field layout — a plain label sits to the left of a plain box,
// instead of this app's usual MUI floating-label style (label riding inside
// the box, shrinking onto the border on focus). Originally built for Product
// Master's add/edit form only (per the "Edit Items / Material" reference
// template); pulled out here so Warehouse Master, Product Group and Product
// Sub-Group can use the exact same concept on their own General tabs
// instead of a second hand-copied version drifting out of sync. Every
// FormTextField/FormSelect/DocumentNoField this wraps still needs its own
// `label=""` passed, so the label text shown here is the only one that
// renders.

// Every knob for this layout's sizing lives here as one constant each, so
// the gap, the input's width and the input's height can each be tuned in one
// place without hunting through the JSX of whichever page uses it:
//   - FIELD_LABEL_WIDTH   how wide the label column is
//   - FIELD_LABEL_GAP     the horizontal gap between a label and its input
//   - FIELD_ROW_SPACING   the gap between rows/columns of label+input pairs
//   - FIELD_MAX_WIDTH     caps how wide the input box itself grows
//   - FIELD_LABEL_OFFSET  nudges the label down/up to line up with the input
//   - FIELD_INPUT_SX      the input's own height (padding) and font size —
//                          also where the helper-text row under every field
//                          is shrunk, since that reserved line (for
//                          validation messages) was the biggest contributor
//                          to the visible top/bottom gap around each field
export const FIELD_LABEL_WIDTH = 190;
export const FIELD_LABEL_GAP = 0;
// Same gap, but for the stacked (label-above-input) mobile layout — kept as
// its own constant rather than reusing FIELD_LABEL_GAP so the two
// breakpoints can be tuned independently (a horizontal gap and a vertical
// one rarely want the same value).
export const FIELD_LABEL_GAP_MOBILE = 0.5;
export const FIELD_ROW_SPACING = 0;
// Horizontal gap between grid columns — pass as FormGrid's `columnSpacing`
// alongside `rowSpacing={FIELD_ROW_SPACING}` (NOT the single `spacing`
// prop, which sets both axes at once). Without a column gap, one column's
// input runs straight into the label of the column beside it, since
// FIELD_ROW_SPACING packs rows to 0.
export const FIELD_COLUMN_SPACING = 4;
export const FIELD_MAX_WIDTH = 500;
export const FIELD_LABEL_OFFSET = 0;
export const FIELD_INPUT_SX = {
  '& .MuiInputBase-input': { paddingTop: '5px', paddingBottom: '5px', fontSize: '0.8125rem' },
  '& .MuiInputBase-root': { minHeight: 34 },
  // Every FormTextField/FormSelect always renders a helper-text line below
  // the box (blank when there's no error) so error messages don't shift the
  // layout when they appear — that reserved line is what made each row look
  // like it had a large top/bottom gap even with FIELD_ROW_SPACING at 0.
  '& .MuiFormHelperText-root': { margin: 0, minHeight: '0.9em', lineHeight: 1.2, fontSize: '0.6875rem' },
};

export function FieldLabel({ children, width = FIELD_LABEL_WIDTH }) {
  const text = String(children || '');
  const required = text.trim().endsWith('*');
  const base = required ? text.trim().replace(/\*$/, '').trimEnd() : text;
  return (
    <Typography
      variant="body2"
      sx={{
        // FIXED width, not minWidth — a minWidth lets a long label (e.g.
        // "Brand & Manufacturer") grow past it, which pushed that row's own
        // input further right than every shorter-labelled row above and
        // below it. A fixed width can't grow, so every input's left edge
        // lines up regardless of its label's length; a label too long for
        // the column wraps onto a second line instead of stealing space
        // from the input next to it.
        //
        // `width` defaults to the shared FIELD_LABEL_WIDTH but can be
        // narrowed per-page via LabeledField's own `labelWidth` prop — a
        // page whose labels are all short (e.g. Tax Code) would otherwise
        // carry the same wide label column sized for the app's longest
        // labels elsewhere, leaving a big blank gap before the input.
        width: { xs: '100%', sm: width },
        flexShrink: 0,
        fontWeight: 600,
        color: 'text.primary',
        pt: FIELD_LABEL_OFFSET,
      }}
    >
      {base}
      {required && <Typography component="span" color="error.main">&nbsp;*</Typography>}
    </Typography>
  );
}

// `align` lets a caller centre the label against its content instead of
// pinning it to the top — every plain text/select field wants top alignment
// (so a multi-line box's label sits by its first line), but a checkbox row
// has no first line to align to, and top-aligning it left the label sitting
// above the checkboxes instead of level with them.
export function LabeledField({ label, children, align = 'flex-start', labelWidth }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: align }, gap: { xs: FIELD_LABEL_GAP_MOBILE, sm: FIELD_LABEL_GAP } }}>
      <FieldLabel width={labelWidth}>{label}</FieldLabel>
      <Box
        sx={{
          flex: 1, minWidth: 0, maxWidth: { sm: FIELD_MAX_WIDTH }, ...FIELD_INPUT_SX,
          ...(align === 'center' ? { display: 'flex', alignItems: 'center', minHeight: 34 } : null),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default LabeledField;
