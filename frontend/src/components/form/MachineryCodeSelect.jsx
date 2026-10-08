import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import FormSelect from './FormSelect';
import { codeNameOptionFilter, CodeNameOptionRow, CodeNameListPaper } from './codeNameListParts';
import { useGetBusinessPartnerMachineriesQuery } from '../../features/resources';

// Machinery picker for the "Customer & Document Details" card on every
// Sales document (Sales Quotation/Order/Delivery Challan/Invoice): same
// Code/Name two-column picker as WarehouseCodeSelect/PartyCodeSelect, but
// its option list is scoped to whichever Customer is currently selected on
// the document — Machineries only exist per Business Partner (see the
// "Machineries" tab on BusinessPartner.jsx / BusinessPartnerMachinery), so
// there is no global list to offer.
//
// `value` stored on the document is the machinery's item CODE, not an id —
// same by-code convention WarehouseCodeSelect already follows, and
// consistent with SalesQuotation/SalesOrder/DeliveryChallan/SalesInvoice's
// own `machineryCode` column.
//
// `businessPartnerId` is the id of the currently selected Customer's
// Business Partner record — resolve it on the calling page by matching the
// form's `customer` field (a NAME, per PartyCodeSelect's own convention)
// against the loaded customer list's `.id`, e.g.:
//   const businessPartnerId = (customers || []).find((c) => c.customerName === watch('customer'))?.id || null;
export default function MachineryCodeSelect({
  name, label = '', placeholder = 'Select machinery', businessPartnerId,
  showNameBelow = true,
  // Pulled out explicitly (rather than left to land via ...rest) so it
  // merges with, instead of overriding, this component's own disabled
  // conditions below (no customer picked yet / machineries still loading).
  disabled,
  // Pulled out (rather than left to flow through ...rest) so it also
  // drives readOnlyInput below: Sales Type = Parts passes creatable=false,
  // meaning a value here can only come from picking one off the CFL list,
  // never free-typed -- so the text itself is made readOnly too, while
  // Sales Type = Machine (creatable=true) stays a normal editable field.
  creatable = false,
  ...rest
}) {
  const { watch } = useFormContext();
  const { data: machineries, isFetching } = useGetBusinessPartnerMachineriesQuery(businessPartnerId, {
    skip: !businessPartnerId,
  });

  const options = useMemo(
    () => (machineries || []).map((m) => ({
      label: m.itemCode,
      value: m.itemCode,
      code: m.itemCode,
      name: m.itemName || '',
    })),
    [machineries]
  );

  const selectedCode = showNameBelow ? watch(name) : null;
  const selectedName = selectedCode
    ? options.find((o) => o.value === selectedCode)?.name
    : null;

  const noCustomerYet = !businessPartnerId;

  return (
    <Box>
      <FormSelect
        name={name}
        label={label}
        placeholder={noCustomerYet ? 'Select customer first' : placeholder}
        options={options}
        disabled={disabled || noCustomerYet || isFetching}
        creatable={creatable}
        readOnlyInput={!creatable}
        renderOption={CodeNameOptionRow}
        filterOptions={codeNameOptionFilter}
        PaperComponent={CodeNameListPaper}
        // A value typed in while Sales Type was "Machine" must stay visible
        // if Sales Type is then switched to "Parts" (strict pick-from-list),
        // even though it's no longer one of this customer's Machineries
        // options -- see FormSelect's own doc comment on this prop.
        keepValueIfUnmatched
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
