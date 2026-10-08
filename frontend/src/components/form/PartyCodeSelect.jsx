import React from 'react';
import { Box, Typography } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import FormSelect from './FormSelect';
import { codeNameOptionFilter, CodeNameOptionRow, CodeNameListPaper } from './codeNameListParts';

// Shared Supplier/Customer picker for every purchase and sales document
// (Purchase Order/Quotation/GRN/Return/Invoice/Credit Memo, Sales
// Quotation/Order/Delivery Challan/Return/Invoice/Credit Memo): the closed
// field shows just the party's Code, the open list is a two-column Code |
// Name table so parties with similar names are easy to tell apart, and once
// one is picked its full Name is echoed just below the field so a bare code
// never leaves the user guessing which party it is.
//
// `value` on every option stays the party's NAME, exactly as it already was
// on each of these pages before this component existed — the contact-info
// autofill effect, Copy From's party match, print-record lookups etc. all
// compare the form's stored value against Supplier/Customer Master's
// *Name column, and changing that to the code would break every one of
// them. Only the LABEL (what's shown in the closed box and matched by
// default when typing) changes to the code; `code`/`name` are carried on the
// option purely for rendering the two-column list and the name-below line.
// (The Warehouse picker below this one in the item table is the same idea,
// but there the stored value already IS the code — see WarehouseCodeSelect.)

// options: [{ value, label, code, name }] — build with buildPartyCodeOptions.
export function buildPartyCodeOptions(records, codeField, nameField) {
  return (records || []).map((r) => ({
    label: r[codeField] || r[nameField] || '',
    value: r[nameField] || '',
    code: r[codeField] || '',
    name: r[nameField] || '',
  }));
}

export default function PartyCodeSelect({
  name, label = '', placeholder, options,
  // Off for a caller that already shows the name elsewhere (e.g. right next
  // to this field rather than below it).
  showNameBelow = true,
  ...rest
}) {
  const { watch } = useFormContext();
  // The stored value already IS the party's name (see buildPartyCodeOptions
  // above), so no extra lookup against the records list is needed here.
  const selectedName = showNameBelow ? watch(name) : null;
  return (
    <Box>
      <FormSelect
        name={name}
        label={label}
        placeholder={placeholder}
        options={options}
        renderOption={CodeNameOptionRow}
        filterOptions={codeNameOptionFilter}
        PaperComponent={CodeNameListPaper}
        {...rest}
      />
      {showNameBelow && selectedName ? (
        <Typography variant="caption" sx={{ display: 'block', mt: '-2px', color: 'text.secondary', lineHeight: 1.3 }}>
          {selectedName}
        </Typography>
      ) : null}
    </Box>
  );
}
