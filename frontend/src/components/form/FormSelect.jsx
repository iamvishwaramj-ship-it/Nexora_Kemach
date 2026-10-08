import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Autocomplete, TextField } from '@mui/material';
import { useFormReadOnly } from './AppForm';

// Any select with more than a handful of options must be type-to-filter —
// this wraps MUI's Autocomplete, never a plain static <select>.
// options: [{ label, value }]
//
// `emptyValue` opts a select into "there is no unselected state" behaviour,
// for report filters that carry an explicit All Customers / All Status /
// All Sources option. Pass the value that option holds (normally '').
//
// Without it, a filter looks unset in two situations even though it isn't:
// clearing the field with the Autocomplete's × writes null, which matches no
// option and leaves the box blank, and a field the form never initialised
// reads undefined and does the same. In both cases the report is still
// unfiltered on that column — "blank" and "All" mean exactly the same thing
// to the query — so showing a blank box states something the report is not
// doing. With `emptyValue` set, both cases resolve to the All option and the
// × snaps back to it instead of emptying the field.
// Character-count bounds for autoWidth — see the prop's own doc comment
// below. Kept small-ish at the low end so an empty/short field doesn't
// collapse to nothing, and capped at the high end so one very long option
// can't blow out an entire table row.
const AUTO_WIDTH_MIN_CH = 4;
const AUTO_WIDTH_MAX_CH = 60;
// A little breathing room past the raw character count, roughly accounting
// for the dropdown/clear icons and the caret, so text doesn't sit flush
// against them.
const AUTO_WIDTH_PADDING_CH = 2;

export default function FormSelect({
  name, label, options = [], fullWidth, multiple = false, size = 'small', emptyValue,
  // When true, the selected option's text wraps onto additional lines
  // inside the box (which grows taller to fit) instead of overflowing past
  // a fixed-width, single-line input — for columns like Product Name where
  // the box width is deliberately capped but the text isn't.
  multiline = false,
  // When true, the field sizes itself to whatever text is currently shown
  // (the selected option's label, or the in-progress search text while
  // typing) instead of stretching to fill its container — for spreadsheet-
  // style table cells (e.g. Journal Lines' G/L Account / Business Partner
  // columns) where a fixed-width or fullWidth box either truncates a long
  // name or wastes space on a short one. Implemented with an inline `ch`-
  // based width on the native input, recomputed on every render, so it
  // grows and shrinks live as the user types or as the selected value
  // changes. Defaults fullWidth to false (a fullWidth autoWidth field would
  // fight itself); pass fullWidth explicitly to override.
  autoWidth = false,
  // Same reservation-skipping behaviour as FormTextField's own prop of the
  // same name -- see its doc comment. Off by default so every existing
  // select keeps its fixed validation strip; pass false for dense grid cells.
  reserveHelperSpace = true,
  // Optional (value, option) => void, called right after the field's own
  // RHF value is written — for a select whose choice needs to also drive
  // ANOTHER field on the same row (e.g. Tax (%): picking a Tax Code writes
  // its id here, and the caller uses this hook to copy that code's rate
  // into the row's own taxPercent field). `option` is the full matched
  // option object (or null when cleared), so the caller doesn't have to
  // re-look it up. Destructured out explicitly so it never reaches the
  // underlying Autocomplete as a stray prop.
  onValueChange,
  // When true, the dropdown popup is sized to whatever its longest visible
  // option needs (never narrower than the field itself) instead of being
  // pinned to the field's own width — MUI's Autocomplete otherwise stretches
  // the popper to exactly match the anchor input, so a select crammed into a
  // narrow table cell (Item No / Description in a dense item table, say)
  // shows its options wrapped or clipped onto multiple lines even though the
  // full text would fit on one line at the popup's natural width. Off by
  // default so every existing select keeps matching its field's width.
  popupFitContent = false,
  // When true, the field becomes a freeSolo combobox: the user can commit
  // text that matches no existing option (via Enter/blur) and it's accepted
  // as the field's raw string value, instead of being discarded because it
  // never resolved to an option's `.value`. Used for fields like Machine
  // Serial No. that need to both pick an existing record and let the user
  // type a brand-new one. Off by default -- every existing select keeps its
  // strict "must match an option" behaviour.
  creatable = false,
  // When true, a stored value that no longer matches any option (e.g. a
  // Machine Serial No. typed in while Sales Type was "Machine", now viewed
  // with Sales Type switched to "Parts", where the field goes back to
  // strict pick-from-list) is still shown as text instead of going blank.
  // Independent of `creatable`: this only affects what's DISPLAYED for a
  // value the field already holds, it does not let the user newly type an
  // unmatched value while this is on but `creatable` is off -- that's still
  // governed entirely by `creatable`/`freeSolo` above.
  keepValueIfUnmatched = false,
  // When true, the underlying text input is set readOnly: the user can no
  // longer type/backspace over whatever text is currently shown, but the
  // field stays fully clickable and its dropdown arrow still opens the
  // options popup as normal -- picking a NEW value still works exactly like
  // before, only free-hand editing of the displayed text is blocked. Used
  // for the (non-creatable) Machine Serial No CFL: once a value is chosen,
  // it should only be replaced by picking another one from the list, not by
  // typing over it. Off by default so every other select keeps its normal
  // type-to-filter behaviour.
  readOnlyInput = false,
  ...rest
}) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();
  const hasEmptyValue = emptyValue !== undefined;
  const resolvedFullWidth = fullWidth !== undefined ? fullWidth : !autoWidth;
  // Autocomplete's `open` prop is either always-controlled or always-
  // uncontrolled for the component's whole lifetime -- it decides which on
  // first render based on whether `open` is undefined, and `creatable` can
  // flip at runtime (Sales Type toggling Machine/Parts on the very same
  // field), so passing `creatable ? false : undefined` made it swap between
  // the two and both broke the popup and warned. Keeping a real boolean
  // state here always keeps it controlled, and creatable simply forces that
  // state closed rather than changing whether it's controlled at all.
  const [popupOpen, setPopupOpen] = React.useState(false);
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        // null/undefined collapse onto the All option when one is declared.
        const current = !multiple && hasEmptyValue && field.value == null ? emptyValue : field.value;
        const selected = multiple
          ? options.filter((o) => (field.value || []).includes(o.value))
          : options.find((o) => o.value === current) || ((creatable || keepValueIfUnmatched) && current ? current : null);

        return (
          <Autocomplete
            // In creatable (freeSolo) mode this field is meant to act as a
            // plain "type a new value" create box, not a pick-from-list
            // dropdown -- an empty options array alone wasn't enough: MUI's
            // Autocomplete still opens its popup on focus/typing even with
            // zero options, rendering PaperComponent (CodeNameListPaper's
            // "Code | Name" header here) with nothing underneath it, which
            // looked like a half-broken CFL rather than a plain text field.
            // Forcing `open` to false is what actually stops the popup from
            // appearing at all; typed text still commits via onInputChange
            // below exactly as before, and Parts mode (creatable=false) is
            // completely untouched.
            options={creatable ? [] : options}
            open={creatable ? false : popupOpen}
            onOpen={() => { if (!creatable) setPopupOpen(true); }}
            onClose={() => setPopupOpen(false)}
            forcePopupIcon={creatable ? false : undefined}
            multiple={multiple}
            value={selected}
            size={size}
            isOptionEqualToValue={(o, v) => (typeof v === 'string' ? o.value === v : o.value === v.value)}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o.label || '')}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              return (
                <li key={option.value !== undefined && option.value !== null ? option.value : key} {...optionProps}>
                  {option.label}
                </li>
              )
            }}
            onChange={(_e, newValue) => {
              if (multiple) {
                field.onChange(newValue.map((v) => v.value));
                return;
              }
              if (creatable && typeof newValue === 'string') {
                const typed = newValue.trim();
                field.onChange(typed || (hasEmptyValue ? emptyValue : null));
                if (onValueChange) onValueChange(typed, null);
                return;
              }
              // Clearing a filter means "All", not "nothing".
              const value = newValue?.value ?? (hasEmptyValue ? emptyValue : null);
              field.onChange(value);
              if (onValueChange) onValueChange(value, newValue ?? null);
            }}
            // Autocomplete doesn't forward a bare onBlur the way a plain input
            // does — without wiring it through explicitly, RHF never learns
            // this field was visited, so in 'onTouched' mode (see AppForm) a
            // required select could be focused and left empty and never show
            // its error: the field simply never entered the `touched` set.
            // freeSolo's onChange only fires on Enter, selecting an option,
            // or (in some MUI versions) blur -- it does NOT reliably commit
            // typed-but-not-yet-committed text otherwise, so clicking
            // straight from this field into another field or a Save button
            // can silently drop whatever was just typed. onInputChange fires
            // on every keystroke, so committing there (reason 'input' only,
            // so a programmatic reset/selection-driven text sync doesn't
            // also get written as if the user typed it) keeps RHF's value in
            // sync live, the same pattern already used for the one other
            // freeSolo field in this codebase (StockTransferReceipt.jsx's
            // Transfer No.).
            onInputChange={creatable ? (_e, newInputValue, reason) => {
              if (reason === 'input') field.onChange(newInputValue);
            } : undefined}
            onBlur={field.onBlur}
            renderInput={(params) => {
              // The text actually on screen right now — Autocomplete keeps
              // this in sync itself: the selected option's label once
              // settled, or the in-progress search text while the box has
              // focus and the user is typing.
              const shownText = params.inputProps?.value || '';
              const widthCh = autoWidth
                ? Math.min(AUTO_WIDTH_MAX_CH, Math.max(AUTO_WIDTH_MIN_CH, String(shownText).length + AUTO_WIDTH_PADDING_CH))
                : null;
              return (
                <TextField
                  {...params}
                  label={label}
                  multiline={multiline}
                  // A multiline field is a <textarea>, where Enter means
                  // "newline" — so picking an option with the keyboard would
                  // also punch a line break into the filter text. Autocomplete
                  // listens for Enter on its ROOT element, not the input, so
                  // this handler runs first and preventDefault stops only the
                  // newline; the event still bubbles and the highlighted option
                  // is still selected.
                  onKeyDown={(e) => {
                    if (multiline && e.key === 'Enter') e.preventDefault();
                  }}
                  error={!!error}
                  helperText={error?.message || (reserveHelperSpace ? ' ' : undefined)}
                  FormHelperTextProps={{
                    sx: reserveHelperSpace
                      ? { mx: 0, mt: 0.25, minHeight: '1.1em', lineHeight: 1.3 }
                      : { mx: 0, mt: 0.25, lineHeight: 1.3 },
                  }}
                  inputProps={{
                    ...params.inputProps,
                    ...(autoWidth ? { style: { ...params.inputProps?.style, width: `${widthCh}ch` } } : null),
                    ...(readOnlyInput ? { readOnly: true } : null),
                  }}
                  sx={multiline ? {
                    '& .MuiOutlinedInput-root': { alignItems: 'flex-start' },
                    '& .MuiAutocomplete-input': { whiteSpace: 'normal', wordBreak: 'break-word' },
                  } : undefined}
                />
              );
            }}
            fullWidth={resolvedFullWidth}
            componentsProps={popupFitContent ? {
              // The popper itself is left alone here — MUI pins it to the
              // field's own pixel width via an inline `width: <anchor
              // width>px` style, and that width is what any percentage on a
              // DESCENDANT resolves against. Overriding it on the popper
              // directly (as this used to) replaces that pixel value with a
              // plain `auto`, and because the popper is position-fixed,
              // `minWidth: '100%'` on a fixed element resolves against the
              // viewport, not the field — the popup ballooned to the full
              // page width and rendered off the field, over whatever sat to
              // its left (e.g. the side nav).
              paper: {
                // Paper is a normal (non-fixed) child of the popper, so a
                // percentage here correctly resolves against the popper's
                // own anchor-pinned pixel width — `minWidth: '100%'` keeps
                // the popup at least as wide as the field, and `width:
                // max-content` (plus one-line options below) lets it grow
                // past that to fit a longer option, overflowing the
                // popper's box to the right rather than being clipped.
                sx: { width: 'max-content', minWidth: '100%', '& .MuiAutocomplete-option': { whiteSpace: 'nowrap' } },
              },
            } : undefined}
            freeSolo={creatable}
            {...rest}
            // A read-only form disables its fields; an explicit
            // disabled still applies while editing.
            disabled={readOnly || rest.disabled}
          />
        );
      }}
    />
  );
}
