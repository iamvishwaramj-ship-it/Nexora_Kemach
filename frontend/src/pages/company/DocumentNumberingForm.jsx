import React, { useMemo } from 'react';
import { Controller, useFormContext, useFormState, useWatch } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Switch,
  Tooltip, IconButton, Alert, Divider,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { LabeledField, FIELD_COLUMN_SPACING, FIELD_LABEL_WIDTH, FIELD_LABEL_GAP } from '../../components/form/LabeledField';
import { documentNumberingSchema } from '../../lib/validation/companySchemas';
import {
  SEPARATORS, NUMBER_LENGTH_OPTIONS, buildDocumentNumber, deriveFyCode,
  formatFyLabel,
} from '../../lib/documentNumbering';

// Card header with the orange accent bar used across the Company Setup screens.
function SectionTitle({ children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
      <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: 'primary.main' }} />
      <Typography variant="subtitle1" fontWeight={700}>{children}</Typography>
    </Stack>
  );
}

/**
 * One switch in the Series Setting card: bold caption + info tooltip on top,
 * the switch and its on/off word in the middle, an explanatory line below.
 *
 * `trueValue`/`falseValue` let a non-boolean field drive the switch — Status
 * is stored as the string 'Active'/'Inactive' but presented as a toggle, and
 * mapping here keeps the form value in the shape the API expects instead of
 * converting on submit.
 */
function SettingToggle({
  name, label, hint,
  onLabel = 'Yes', offLabel = 'No',
  trueValue = true, falseValue = false,
  color = 'success', disabled, disabledReason,
  // Name of another boolean field this one is the exact complement of (Auto
  // Generate / Manual Entry) — the two always sit on opposite settings, so
  // flipping either one always flips the other the other way: Auto Generate
  // on forces Manual Entry off, and Auto Generate off forces Manual Entry
  // on, and the same in reverse.
  exclusiveWith,
}) {
  const { control, setValue } = useFormContext();
  const control_ = (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const on = field.value === trueValue;
        return (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch
              checked={on}
              onChange={(e) => {
                const checked = e.target.checked;
                field.onChange(checked ? trueValue : falseValue);
                if (exclusiveWith) {
                  setValue(exclusiveWith, !checked, { shouldDirty: true, shouldValidate: true });
                }
              }}
              onBlur={field.onBlur}
              inputRef={field.ref}
              color={color}
              disabled={disabled}
              inputProps={{ 'aria-label': label }}
            />
            <Typography variant="body2" fontWeight={600} color={on ? 'text.primary' : 'text.secondary'}>
              {on ? onLabel : offLabel}
            </Typography>
          </Stack>
        );
      }}
    />
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Typography variant="body2" fontWeight={700}>{label}</Typography>
        <Tooltip title={hint} placement="top" arrow>
          <IconButton size="small" sx={{ p: 0.25 }} aria-label={`${label} help`}>
            <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </IconButton>
        </Tooltip>
      </Stack>
      {disabled && disabledReason ? <Tooltip title={disabledReason} arrow><span>{control_}</span></Tooltip> : control_}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, maxWidth: 210 }}>
        {hint}
      </Typography>
    </Box>
  );
}

/**
 * Live preview. Watching the form rather than round-tripping to the server
 * keeps it instant; the same formatting logic runs on both sides
 * (lib/documentNumbering.js mirrors documentNumberService.js).
 */
/**
 * The helper line under each Series Information field — a plain <Typography>
 * sat flush against the Box's own left edge, which put it under the field's
 * *label* rather than under its input, since LabeledField lays the label out
 * beside the input rather than above it. Shifted right by the same label
 * width + gap LabeledField itself uses, so the caption lines up under the
 * input instead. On the stacked mobile layout (label above input) there's no
 * side-by-side offset to match, so the padding drops back to 0.
 *
 * Pass the field's `name` so this can tell whether that field currently has a
 * validation error. When it's clean, FormHelperText is only reserving its
 * blank single line (see FIELD_INPUT_SX in LabeledField.jsx) and this caption
 * pulls up onto it as before. Once an error message actually occupies that
 * line, the same pull-up would drag the caption straight on top of the red
 * text instead of under it — so the negative margin is dropped and the
 * caption falls in normal flow, below whatever height the error message
 * actually took (including a message long enough to wrap).
 */
function FieldCaption({ children, name }) {
  const { errors } = useFormState({ name });
  const hasError = Boolean(name && errors?.[name]);
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      // sx as a function (rather than a plain object with a function buried
      // inside the `sm` breakpoint) is what actually lets MUI resolve
      // theme.spacing here — a function nested inside a breakpoints object
      // is never called, so pl silently never applied and the caption sat
      // under the label instead of the input, as before this fix.
      sx={(theme) => ({
        display: 'block',
        pl: { xs: 0, sm: `${FIELD_LABEL_WIDTH + parseFloat(theme.spacing(FIELD_LABEL_GAP))}px` },
        // Every FormTextField/FormSelect already reserves a blank
        // FormHelperText line below its box for validation messages (see
        // FIELD_INPUT_SX in LabeledField.jsx) — this caption stacks right
        // under that, so without pulling it up the blank reserved line and
        // the caption's own line read as one large gap under the input.
        // Not applied while an error is showing (see comment above).
        mt: hasError ? '2px' : '-10px',
      })}
    >
      {children}
    </Typography>
  );
}

function PreviewField({ financialYears }) {
  const values = useWatch();
  const fy = (financialYears || []).find((f) => f.id === values.financialYearId);
  const fyCode = deriveFyCode(fy);

  const preview = buildDocumentNumber(
    {
      prefix: values.prefix,
      suffix: values.suffix,
      separator: values.separator,
      fyCode,
      includeFyInNumber: values.includeFyInNumber,
      numberLength: values.numberLength,
    },
    values.startNumber || 0
  );

  return (
    <Box>
      <LabeledField label="Preview">
        <TextField
          value={preview}
          size="small"
          fullWidth
          sx={fieldSx}
          // A plain TextField (not FormTextField/FormSelect) renders no
          // FormHelperText at all unless given one — every other field here
          // gets one for free (FormTextField/FormSelect default to a blank
          // helperText=' ' to reserve that line; see reserveHelperSpace in
          // FormTextField.jsx). Without it, FieldCaption's -10px pull-up
          // (tuned to cancel that reserved line) has nothing to cancel and
          // lands the caption right on top of the input instead.
          helperText=" "
          InputProps={{ readOnly: true, sx: { bgcolor: 'action.hover', fontFamily: 'monospace', fontWeight: 600 } }}
        />
      </LabeledField>
      <FieldCaption>Preview of the document number</FieldCaption>
    </Box>
  );
}

// Applied to every field in the Series Information card so a plain text
// input (FormTextField) and an Autocomplete-backed select (FormSelect) come
// out the exact same height and line up cleanly across a row — MUI's
// Autocomplete otherwise renders very slightly taller than a bare TextField
// at the same "small" size once it has a clear/dropdown icon in it.
const fieldSx = { '& .MuiOutlinedInput-root': { minHeight: 40 } };

// Every field in this form's Series Information card is a Box stacking
// LabeledField + a caption line below it — taller than the single-line rows
// FIELD_ROW_SPACING (0) was tuned for elsewhere, so packing rows with no
// gap ran a row's caption straight into the label of the row below it.
// Kept as its own constant rather than raising the shared FIELD_ROW_SPACING,
// so plainer forms without captions are unaffected.
const SERIES_ROW_SPACING = 1;

const blankValues = {
  documentCode: '',
  seriesName: 'Series 1',
  financialYearId: null,
  prefix: '',
  suffix: '',
  separator: '-',
  includeFyInNumber: true,
  numberLength: 6,
  startNumber: 1,
  endNumber: 999999,
  resetEveryFy: true,
  autoGenerate: true,
  manualEntry: false,
  status: 'Active',
};

/**
 * When a document type is picked on a *new* series, pull the server's
 * suggestion for it — the next free name and a Start No. one past the highest
 * existing End No. Without this the user has to read the Existing Series table
 * and work out a non-overlapping range by hand, then get rejected on save if
 * they get it wrong.
 *
 * Only untouched fields are filled in: `isDirty` per-field means a Start No.
 * the user has already typed is never overwritten by a later suggestion.
 */
function SuggestionApplier({ suggestion, suggestionDocumentCode, suggestionLoading, enabled }) {
  const documentCode = useWatch({ name: 'documentCode' });
  const { setValue, getFieldState, formState } = useFormContext();
  const appliedFor = React.useRef(null);

  React.useEffect(() => {
    if (!enabled || !suggestion || !documentCode) return;
    // `suggestion` is fetched for whatever document the parent's query is
    // currently keyed on (suggestionDocumentCode). Right after the user picks
    // a new document type, this component's own `documentCode` (read straight
    // off the form) updates a render ahead of the parent's — so without this
    // check, the effect below would fire using the *previous* document's
    // suggestion, mark itself done for the new code, and then ignore the
    // correct suggestion when it finally arrives (prefix/Start No. etc. stay
    // stuck on the old document's values).
    if (suggestionDocumentCode !== documentCode) return;
    // Matching document codes alone isn't enough: RTK Query's hook can render
    // once with the *new* args (so suggestionDocumentCode already matches)
    // while `suggestion` still holds the *previous* document's cached result,
    // one render before the new fetch resolves — confirmed by reproducing
    // this exact sequence against a live RTK Query store. isFetching/
    // isLoading cover that gap; only trust `suggestion` once both are false.
    if (suggestionLoading) return;
    // Re-apply only when the document type changes, not on every refetch —
    // otherwise a background refresh would stomp on in-progress edits.
    if (appliedFor.current === documentCode) return;
    appliedFor.current = documentCode;

    const setIfClean = (field, value) => {
      if (value === undefined || value === null) return;
      if (getFieldState(field, formState).isDirty) return;
      setValue(field, value, { shouldValidate: false, shouldDirty: false });
    };

    setIfClean('seriesName', suggestion.seriesName);
    setIfClean('prefix', suggestion.prefix);
    setIfClean('separator', suggestion.separator);
    setIfClean('numberLength', suggestion.numberLength);
    setIfClean('includeFyInNumber', suggestion.includeFyInNumber);
    setIfClean('startNumber', suggestion.startNumber);
    setIfClean('endNumber', suggestion.endNumber);
  }, [documentCode, suggestion, suggestionDocumentCode, suggestionLoading, enabled, setValue, getFieldState, formState]);

  return null;
}

/**
 * Keeps Start No. and End No. zero-padded to the current No. of Length in
 * Series, e.g. Start 1100 becomes 001100 once the length is raised from 4 to
 * 6 digits. Purely cosmetic — Number(value) still parses a leading-zero
 * string correctly, so the value actually saved is unaffected — but it lets
 * the user see at a glance that the number fits the new width instead of
 * eyeballing digit counts.
 */
function NumberLengthPadder() {
  const { setValue, getValues } = useFormContext();
  const numberLength = useWatch({ name: 'numberLength' });
  // Starts at `null` rather than the initial numberLength so the effect
  // below also runs once on mount, not just on a later change — otherwise
  // opening Edit on a row whose Start/End No. were saved unpadded (or
  // padded to a different width than the series' current No. of Length)
  // shows them next to a correctly-padded Preview, which reads as a bug
  // even though the underlying number is right either way.
  const prevLength = React.useRef(null);

  React.useEffect(() => {
    if (prevLength.current === numberLength) return;
    prevLength.current = numberLength;

    const len = Number(numberLength);
    if (!Number.isInteger(len) || len < 1) return;

    const repad = (field) => {
      const raw = getValues(field);
      if (raw === '' || raw === null || raw === undefined) return;
      const n = Math.trunc(Number(raw));
      if (!Number.isFinite(n) || n < 0) return;
      // shouldDirty stays false on purpose: this is a re-format of whatever
      // value is already there, not the user editing it. Marking it dirty
      // would make SuggestionApplier's "don't overwrite what the user typed"
      // check skip these two fields forever after — so switching to another
      // document type would update the Prefix but leave the previous
      // document's Start/End No. behind, producing an overlapping series.
      setValue(field, String(n).padStart(len, '0'), { shouldDirty: false, shouldValidate: true });
    };
    repad('startNumber');
    repad('endNumber');
  }, [numberLength, setValue, getValues]);

  return null;
}

/**
 * Guarantees the No. of Length dropdown never drops an option the field
 * currently holds.
 *
 * `numberLengthOptions` (built by the parent) is a snapshot of what the
 * SERVER says is still safe for a brand-new, unsaved series — filtered down
 * to the widths that still have non-overlapping room left, as of when the
 * "Existing Series" query last loaded. It has no idea what the user has
 * since done inside this still-unsaved form. So: pick 3 Digits, try 8
 * Digits to compare, then try to go back to 3 — 3 was never added back into
 * that snapshot (nothing was saved, so the server-side numbers behind it
 * never changed), and the option is simply gone from the list, well before
 * Save has any say in it. That reads as "changing the digit count is
 * broken" even though the underlying validity check (still enforced at
 * Save) was never wrong.
 *
 * Keeping the currently selected value in the option list — even if the
 * server snapshot doesn't include it — fixes exactly that, without loosening
 * what Save itself will accept.
 */
function withCurrentNumberLength(options, current) {
  const value = Number(current);
  if (!Number.isInteger(value) || options.some((o) => o.value === value)) return options;
  return [...options, { label: `${value} Digits`, value }].sort((a, b) => a.value - b.value);
}

function NumberLengthField({ options, disabled }) {
  const current = useWatch({ name: 'numberLength' });
  const fullOptions = React.useMemo(
    () => withCurrentNumberLength(options, current),
    [options, current]
  );
  return (
    <FormSelect
      name="numberLength"
      label=""
      options={fullOptions}
      disabled={disabled}
      disableClearable
      sx={fieldSx}
    />
  );
}

/** Surfaces the selected document code to the parent so it can fetch that
 *  document's existing series without lifting the whole form into state. */
function DocumentCodeWatcher({ onChange }) {
  const documentCode = useWatch({ name: 'documentCode' });
  React.useEffect(() => { onChange(documentCode || ''); }, [documentCode, onChange]);
  return null;
}

/**
 * Add / Edit a numbering series.
 *
 * `editingRow` non-null puts the form in edit mode. If that series has already
 * issued a number, its pattern fields are locked — changing the prefix,
 * separator, padding or Start No. mid-sequence would make two documents in the
 * same series unreconcilable, and the server rejects it anyway. Retire a live
 * series by setting it Inactive rather than by editing it.
 */
export default function DocumentNumberingForm({
  editingRow,
  initialDocumentCode,
  documentCodeLocked,
  catalog,
  financialYears,
  defaultFinancialYearId,
  onSubmit,
  onCancel,
  saving,
  onDocumentCodeChange,
  existingSeriesPanel,
  suggestion,
  suggestionDocumentCode,
  suggestionLoading,
  availableNumberLengths,
}) {
  const isEdit = Boolean(editingRow);
  const isLocked = Boolean(editingRow?.isConsumed);

  // `setError` only exists once AppForm has created its RHF instance, which
  // happens inside the render-prop below — so it's captured into a ref there
  // and read here, in a stable wrapper that's safe to pass as AppForm's
  // onSubmit prop before that instance exists.
  const setErrorRef = React.useRef(() => {});
  const handleFormSubmit = React.useCallback(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      // Field-tagged messages from validateSeriesPayload (see badRequest in
      // routes/company.js) — shown under the input they belong to, on top of
      // the parent's toast with the same text.
      const fieldErrors = err?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        for (const fe of fieldErrors) {
          if (fe.field) setErrorRef.current(fe.field, { type: 'server', message: fe.message });
        }
      }
    }
  }, [onSubmit]);

  const defaultValues = useMemo(() => {
    if (!editingRow) {
      return {
        ...blankValues,
        // Set when the form was opened as a shortcut to the next series for
        // a specific document type (double-click on a row) — the suggestion
        // then fills in Start No., End No., etc. once it loads.
        documentCode: initialDocumentCode || '',
        financialYearId: defaultFinancialYearId ?? null,
      };
    }
    return {
      documentCode: editingRow.documentCode ?? '',
      seriesName: editingRow.seriesName ?? 'Series 1',
      financialYearId: editingRow.financialYearId ?? null,
      prefix: editingRow.prefix ?? '',
      suffix: editingRow.suffix ?? '',
      separator: editingRow.separator ?? '-',
      includeFyInNumber: editingRow.includeFyInNumber ?? true,
      numberLength: editingRow.numberLength ?? 6,
      startNumber: editingRow.startNumber ?? 1,
      endNumber: editingRow.endNumber ?? 999999,
      resetEveryFy: editingRow.resetEveryFy ?? true,
      autoGenerate: editingRow.autoGenerate ?? true,
      manualEntry: editingRow.manualEntry ?? false,
      status: editingRow.status ?? 'Active',
    };
  }, [editingRow, initialDocumentCode, defaultFinancialYearId]);

  // Every document type stays selectable: several series per document type
  // per year is the intended model, so the count is shown as context rather
  // than used to filter the list.
  const documentOptions = useMemo(() => {
    const docs = catalog?.documents || [];
    return docs.map((d) => ({
      label: d.seriesCount ? `${d.name} (${d.code}) — ${d.seriesCount} series` : `${d.name} (${d.code})`,
      value: d.code,
    }));
  }, [catalog]);

  const fyOptions = useMemo(
    () => (financialYears || []).map((f) => ({ label: formatFyLabel(f), value: f.id })),
    [financialYears]
  );

  const separatorOptions = useMemo(() => SEPARATORS.map((s) => ({ label: s.label, value: s.value })), []);

  // Once a document's numbers have filled the whole span a digit count can
  // hold (e.g. a 3-digit series has used 1-999), there's no non-overlapping
  // range left inside THAT SAME WIDTH for a new series — so it's dropped
  // from the list rather than offered and then rejected. This is scoped per
  // digit count on the server (see availableNumberLengths in company.js): a
  // 6-digit series filling 1-999,999 does not block 5 Digits or any other
  // width, since a 5-digit '40079' and a 6-digit '040079' never print the
  // same document number for the same underlying counter. The row being
  // edited keeps its own length available even if it would otherwise be
  // excluded, so opening Edit on an existing series never blanks the field.
  //
  // UPDATE: every digit length is now ALWAYS listed (3-10 Digits etc.), even
  // one an existing series has already filled -- hiding it made e.g. "5 Digits"
  // vanish once a 5-digit series reached 99999. Whether a new series' range
  // overlaps an existing one is still checked and rejected by the server on
  // save, so nothing is lost by showing the option.
  const numberLengthOptions = NUMBER_LENGTH_OPTIONS;

  return (
    <AppForm key={editingRow?.id ?? 'new'} schema={documentNumberingSchema} defaultValues={defaultValues} onSubmit={handleFormSubmit}>
      {({ reset, setError }) => {
        setErrorRef.current = setError;
        return (
        <>
          <DocumentCodeWatcher onChange={onDocumentCodeChange} />
          <SuggestionApplier
            suggestion={suggestion}
            suggestionDocumentCode={suggestionDocumentCode}
            suggestionLoading={suggestionLoading}
            enabled={!isEdit}
          />
          <NumberLengthPadder />

          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h6" fontWeight={700}>
              {isEdit ? 'Edit Document Numbering Series' : 'Add New Document Numbering Series'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEdit
                ? 'Update the numbering series for this business document.'
                : 'Create a new document numbering series for your business documents.'}
            </Typography>
          </Box>

          {isLocked && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This series has already issued <strong>{editingRow.currentNumberFormatted}</strong>. The pattern fields are
              locked so the sequence stays consistent — you can still extend the End No., change the switches, or set the
              series Inactive.
            </Alert>
          )}

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <SectionTitle>Series Information</SectionTitle>

              <FormGrid columns={2} singleColumnOnMobile rowSpacing={SERIES_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                <Box>
                  <LabeledField label="Document Name *">
                    <FormSelect
                      name="documentCode"
                      label=""
                      options={documentOptions}
                      disabled={isEdit || documentCodeLocked}
                      sx={fieldSx}
                    />
                  </LabeledField>
                  <FieldCaption name="documentCode">
                    {isEdit
                      ? 'Document type cannot be changed'
                      : documentCodeLocked
                        ? 'Adding the next series for this document — change it from Add New Series instead'
                        : 'The transaction this series will number'}
                  </FieldCaption>
                </Box>

                <Box>
                  <LabeledField label="Series Name *">
                    <FormTextField name="seriesName" label="" placeholder="Series 1" maxLength={100} sx={fieldSx} />
                  </LabeledField>
                  <FieldCaption name="seriesName">Distinguishes this series from others for the same document</FieldCaption>
                </Box>

                <Box>
                  {/* Displayed uppercase via CSS and normalised on submit,
                      rather than rewriting the input value on every keystroke —
                      mutating e.target.value fights React's controlled input
                      and moves the caret to the end mid-word. */}
                  <LabeledField label="Prefix">
                    <FormTextField
                      name="prefix"
                      label=""
                      placeholder="PO"
                      disabled={isLocked}
                      maxLength={10}
                      inputProps={{ style: { textTransform: 'uppercase' } }}
                      sx={fieldSx}
                    />
                  </LabeledField>
                  <FieldCaption name="prefix">Prefix will appear at the beginning of the document number</FieldCaption>
                </Box>

                <Box>
                  <LabeledField label="Separator">
                    <FormSelect name="separator" label="" options={separatorOptions} disabled={isLocked} disableClearable sx={fieldSx} />
                  </LabeledField>
                  <FieldCaption name="separator">Separator between prefix, FY and number</FieldCaption>
                </Box>
              </FormGrid>

              {/* FY/Number Length/Start No./End No./Suffix/Preview all live in one
                  2-column grid (6 fields — divides evenly into 3 rows) rather than
                  the two separate 3-field grids this used to be split into: at
                  columns=2, a 3-field group leaves its odd field alone on a row,
                  half-width, with a blank gap beside it. */}
              <Box sx={{ mt: 2 }}>
                <FormGrid columns={2} singleColumnOnMobile rowSpacing={SERIES_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  <Box>
                    <LabeledField label="Financial Year (FY) *">
                      <FormSelect
                        name="financialYearId"
                        label=""
                        options={fyOptions}
                        disabled={isLocked}
                        disableClearable
                        sx={fieldSx}
                      />
                    </LabeledField>
                    <FieldCaption name="financialYearId">Select financial year</FieldCaption>
                  </Box>

                  <Box>
                    <LabeledField label="No. of Length in Series *">
                      <NumberLengthField options={numberLengthOptions} disabled={isLocked} />
                    </LabeledField>
                    <FieldCaption name="numberLength">Total digits for the series number</FieldCaption>
                  </Box>

                  <Box>
                    {/* text + digitsOnly (not type="number") so a leading-zero
                        value like "001100" actually displays as typed — a
                        number input silently strips the zeros. */}
                    <LabeledField label="Start No. *">
                      <FormTextField name="startNumber" label="" type="text" digitsOnly disabled={isLocked} sx={fieldSx} />
                    </LabeledField>
                    <FieldCaption name="startNumber">Starting number for this series</FieldCaption>
                  </Box>

                  <Box>
                    <LabeledField label="End No. *">
                      <FormTextField name="endNumber" label="" type="text" digitsOnly sx={fieldSx} />
                    </LabeledField>
                    <FieldCaption name="endNumber">Ending number for this series</FieldCaption>
                  </Box>

                  <Box>
                    <LabeledField label="Suffix">
                      <FormTextField name="suffix" label="" placeholder="Optional" disabled={isLocked} maxLength={10} sx={fieldSx} />
                    </LabeledField>
                    <FieldCaption name="suffix">Optional text appended after the number</FieldCaption>
                  </Box>

                  <PreviewField financialYears={financialYears} />
                </FormGrid>
              </Box>

            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <SectionTitle>Series Setting</SectionTitle>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 2.5, sm: 4 }}
                flexWrap="wrap"
                useFlexGap
              >
                <SettingToggle
                  name="resetEveryFy"
                  label="Reset Every FY"
                  hint="Reset series to starting number in new financial year"
                />
                <SettingToggle
                  name="autoGenerate"
                  label="Auto Generate"
                  hint="System will auto generate document number"
                  exclusiveWith="manualEntry"
                />
                <SettingToggle
                  name="manualEntry"
                  label="Manual Entry"
                  hint="Allow user to enter document number manually"
                  exclusiveWith="autoGenerate"
                />
                <SettingToggle
                  name="status"
                  label="Status"
                  hint="Active series can be used in transactions"
                  onLabel="Active"
                  offLabel="Inactive"
                  trueValue="Active"
                  falseValue="Inactive"
                />
                <SettingToggle
                  name="includeFyInNumber"
                  label="Include FY in Number"
                  hint="Embed the financial year code inside the document number"
                  disabled={isLocked}
                  disabledReason="Locked — this series has already issued numbers"
                />
              </Stack>
            </CardContent>
          </Card>

          <Divider sx={{ mb: 2 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2.5 }}>
            <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                // Resetting a *new* series to the bare form defaults (Start
                // No. 1, End No. 999,999) throws away the non-overlapping
                // range SuggestionApplier already filled in for the picked
                // document type — and since SuggestionApplier only re-applies
                // a suggestion the first time a document code is selected
                // (appliedFor ref), it will NOT refill Start/End after this
                // reset. The result: Reset silently restores the exact
                // 1-999,999 block a prior series already occupies, and the
                // next Save fails with "overlaps series ... (1-999999)" —
                // which reads as "adding a document number doesn't work" even
                // though the form looked fine right after Reset was clicked.
                // Re-merge the current suggestion back in so Reset returns to
                // the state the form was actually in when it opened, not to
                // values that are known to collide.
                onClick={() => reset(
                  !isEdit && suggestion && suggestionDocumentCode === initialDocumentCode
                    ? {
                        ...defaultValues,
                        seriesName: suggestion.seriesName ?? defaultValues.seriesName,
                        prefix: suggestion.prefix ?? defaultValues.prefix,
                        separator: suggestion.separator ?? defaultValues.separator,
                        numberLength: suggestion.numberLength ?? defaultValues.numberLength,
                        includeFyInNumber: suggestion.includeFyInNumber ?? defaultValues.includeFyInNumber,
                        startNumber: suggestion.startNumber ?? defaultValues.startNumber,
                        endNumber: suggestion.endNumber ?? defaultValues.endNumber,
                      }
                    : defaultValues
                )}
                disabled={saving}
              >
                Reset
              </Button>
              <FormSubmitButton startIcon={<SaveOutlinedIcon />} disabled={saving}>
                {isEdit ? 'Update Series' : 'Save Series'}
              </FormSubmitButton>
            </Stack>
          </Stack>

          {/* Existing series for the chosen document type. Rendered by the
              parent (which owns the query) and slotted in here so this
              component stays a pure form. */}
          {existingSeriesPanel}
        </>
        );
      }}
    </AppForm>
  );
}

/**
 * Coerce the form's values into the payload shape the API expects. Zod has
 * already validated types by this point; this is about trimming, casing and
 * turning empty optionals into explicit nulls so a cleared Suffix actually
 * clears server-side instead of being ignored as undefined.
 */
export function normaliseSeriesValues(values) {
  return {
    ...values,
    status: values.status === 'Active' ? 'Active' : 'Inactive',
    startNumber: Number(values.startNumber),
    endNumber: Number(values.endNumber),
    numberLength: Number(values.numberLength),
    financialYearId: Number(values.financialYearId),
    seriesName: values.seriesName?.trim() || 'Series 1',
    suffix: values.suffix?.trim() ? values.suffix.trim() : null,
    prefix: values.prefix?.trim().toUpperCase() || null,
  };
}
