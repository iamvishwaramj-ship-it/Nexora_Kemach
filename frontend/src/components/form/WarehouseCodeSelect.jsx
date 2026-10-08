import React from 'react';
import { Box, Typography } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import FormSelect from './FormSelect';
import { codeNameOptionFilter, CodeNameOptionRow, CodeNameListPaper } from './codeNameListParts';

// Warehouse picker for the item table's Warehouse column, on every document
// that carries a per-line warehouse (Purchase Order/Quotation/GRN/Return/
// Invoice/Credit Memo, Sales Quotation/Order/Delivery Challan/Return/
// Invoice/Credit Memo, Stock Receipt/Issue/Adjustment): same Code/Name
// picker as PartyCodeSelect (Supplier/Customer) — closed field shows just
// the Code, open list is a two-column Code | Name table, name is echoed
// below once one's picked.
//
// Unlike PartyCodeSelect, `value` here is already the warehouse CODE, not
// the name — that's what useWarehouseOptions has always stored (the stock
// journal's Warehouse column is NVARCHAR(8); a code fits, a full name
// doesn't and survives a rename besides). So this can't just watch(name) for
// the name-below line the way PartyCodeSelect does — it has to look the
// selected code back up in `options` (which useWarehouseOptions now carries
// code/name on, see lib/useWarehouseOptions.js).
//
// options: pass useWarehouseOptions(...).options straight through — no
// separate builder needed, unlike buildPartyCodeOptions.
export default function WarehouseCodeSelect({
  name, label = '', placeholder, options,
  showNameBelow = true,
  ...rest
}) {
  const { watch } = useFormContext();
  const selectedCode = showNameBelow ? watch(name) : null;
  const selectedName = selectedCode
    ? (options || []).find((o) => o.value === selectedCode)?.name
    : null;
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
        <Typography variant="caption" sx={{ display: 'block', mt: '-2px', color: 'text.secondary', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
          {selectedName}
        </Typography>
      ) : null}
    </Box>
  );
}
