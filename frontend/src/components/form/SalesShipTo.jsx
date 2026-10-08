import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, MenuItem, TextField } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import { FormCheckbox } from './FormCheckbox';
import FormTextField from './FormTextField';
import PartyCodeSelect, { buildPartyCodeOptions } from './PartyCodeSelect';
import { useFormReadOnly } from './AppForm';

/**
 * "Bill To" / "Ship To" blocks for the Sales documents (Quotation / Order /
 * Delivery Challan / Invoice). Ship To is the sales-side counterpart of the
 * purchase documents' "Ship to a different customer" checkbox; Bill To has no
 * checkbox (see SalesBillTo below) — it only offers the customer's own Billing
 * addresses. The description below is the Ship To behaviour.
 *
 *  - Unchecked (default): the address is the selected customer's own default
 *    Business Partner Billing / Shipping address (the page's customer-change
 *    handler fills the text; this block keeps the GST / PAN snapshot in step).
 *  - Checked: a Customer picker appears. Picking a customer lists THAT
 *    customer's Billing (or Shipping) addresses (Business Partner > Addresses
 *    tab). One address is filled automatically; with several the user must
 *    choose one, and the chosen address is written into the box.
 *
 * Whatever address ends up selected, its GST Number, GST Type and PAN Number
 * are copied onto the document (billToGstNo, shipToPanNo and friends) so
 * the printouts show the numbers of THAT address, not the main customer's.
 *
 * Props:
 *   customers      - customerApi.useList() rows (each carries `.addresses`)
 *   formatAddress  - the page's own formatBusinessPartnerAddress(addr)
 *   mode           - 'ship' (default) | 'bill'
 */
const MODES = {
  ship: {
    flag: 'shipToDifferentCustomer', customer: 'shipToCustomer', address: 'shippingAddress',
    gst: 'shipToGstNo', gstType: 'shipToGstType', pan: 'shipToPanNo',
    type: 'Shipping', label: 'Ship to a different customer', noun: 'Shipping address',
    otherType: 'Billing',
  },
  bill: {
    flag: 'billToDifferentCustomer', customer: 'billToCustomer', address: 'billingAddress',
    gst: 'billToGstNo', gstType: 'billToGstType', pan: 'billToPanNo',
    type: 'Billing', label: 'Bill to a different customer', noun: 'Billing address',
    otherType: 'Shipping',
  },
};

/**
 * Bill To block. No "Bill to a different customer" checkbox and no second
 * customer picker any more: the Bill To always belongs to the document's own
 * customer. When that customer has several Billing addresses (Business
 * Partner > Addresses tab) a dropdown lets the user choose which one is
 * billed; the chosen address text and its GST Number / GST Type / PAN are
 * copied onto the document (billToGstNo / billToGstType / billToPanNo).
 */
function SalesBillTo({ customers, formatAddress }) {
  const M = MODES.bill;
  const { watch, setValue, getValues } = useFormContext();
  const readOnly = useFormReadOnly();

  const mainCustomer = watch('customer') || '';
  const addressText = watch(M.address) || '';

  const ownRecord = useMemo(
    () => (customers || []).find((c) => c.customerName === mainCustomer) || null,
    [customers, mainCustomer],
  );
  const addrs = useMemo(
    () => (ownRecord?.addresses || []).filter((a) => a.addressType === M.type),
    [ownRecord, M.type],
  );

  const [pickedId, setPickedId] = useState('');

  const addrLabel = (a) => {
    const place = [a.city, a.state].filter(Boolean).join(', ');
    return `${a.addressName || M.noun}${place ? ` — ${place}` : ''}${a.isDefault ? ' (Default)' : ''}`;
  };

  const applyTaxIds = (addr) => {
    setValue(M.gst, (addr?.gstNumber || '').trim());
    setValue(M.gstType, addr?.gstType || '');
    setValue(M.pan, (addr?.panNo || '').trim().toUpperCase());
  };

  // The customer's default Billing address (falls back to a Shipping one for
  // the GST / PAN snapshot, same as before).
  const defaultAddr = () => {
    const list = (ownRecord?.addresses || []).filter((a) => a.addressType === M.type);
    const other = (ownRecord?.addresses || []).filter((a) => a.addressType === M.otherType);
    return list.find((a) => a.isDefault) || list[0] || other.find((a) => a.isDefault) || other[0] || null;
  };

  // The "different customer" feature is gone: always keep the flags cleared so
  // an older document that had it ticked saves as a plain Bill To.
  useEffect(() => {
    if (getValues(M.flag)) setValue(M.flag, false);
    if (getValues(M.customer)) setValue(M.customer, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Customer changed (by hand, or by Copy From / Copy To): keep the address
  // text the page / copy wrote when it is one of this customer's Billing
  // addresses, otherwise fall back to the default. The first render is
  // skipped so opening a saved document never overwrites what it was saved with.
  const prevMain = useRef(mainCustomer);
  useEffect(() => {
    if (mainCustomer === prevMain.current) return;
    prevMain.current = mainCustomer;
    const current = getValues(M.address) || '';
    const match = current && addrs.find((a) => (formatAddress(a) || '') === current);
    if (match) {
      setPickedId(String(match.id));
      applyTaxIds(match);
      return;
    }
    const own = addrs.find((a) => a.isDefault) || addrs[0] || null;
    setPickedId(own ? String(own.id) : '');
    applyTaxIds(defaultAddr());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCustomer, customers]);

  // A saved document: highlight the address that matches the saved text.
  useEffect(() => {
    if (pickedId || !addressText || !addrs.length) return;
    const match = addrs.find((a) => (formatAddress(a) || '') === addressText);
    if (match) setPickedId(String(match.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrs, addressText]);

  const onPick = (e) => {
    const id = e.target.value;
    setPickedId(id);
    const addr = addrs.find((a) => String(a.id) === String(id));
    setValue(M.address, addr ? (formatAddress(addr) || '') : '', { shouldValidate: true });
    applyTaxIds(addr || null);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {addrs.length > 1 && (
        <TextField
          select
          fullWidth
          size="small"
          value={pickedId}
          onChange={onPick}
          disabled={readOnly}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          label={M.noun}
          helperText=" "
          sx={{ mb: 1 }}
        >
          {addrs.map((a) => (
            <MenuItem key={a.id} value={String(a.id)}>{addrLabel(a)}</MenuItem>
          ))}
        </TextField>
      )}
      <FormTextField
        name={M.address}
        label=""
        placeholder="Auto-filled from customer"
        multiline
        rows={3}
        disabled
      />
    </Box>
  );
}

export default function SalesShipTo({ customers, formatAddress, mode = 'ship' }) {
  if (mode === 'bill') return <SalesBillTo customers={customers} formatAddress={formatAddress} />;
  return <SalesShipToBlock customers={customers} formatAddress={formatAddress} mode={mode} />;
}

function SalesShipToBlock({ customers, formatAddress, mode = 'ship' }) {
  const M = MODES[mode] || MODES.ship;
  const { watch, setValue, getValues } = useFormContext();
  const readOnly = useFormReadOnly();

  const checked = !!watch(M.flag);
  const partyCustomer = watch(M.customer) || '';
  const mainCustomer = watch('customer') || '';
  const addressText = watch(M.address) || '';

  const customerOptions = useMemo(
    () => buildPartyCodeOptions(customers, 'customerCode', 'customerName'),
    [customers],
  );

  const partyRecord = useMemo(
    () => (checked && partyCustomer ? (customers || []).find((c) => c.customerName === partyCustomer) : null),
    [checked, partyCustomer, customers],
  );
  const addrs = useMemo(
    () => (partyRecord?.addresses || []).filter((a) => a.addressType === M.type),
    [partyRecord, M.type],
  );

  const [pickedId, setPickedId] = useState('');

  const addrLabel = (a) => {
    const place = [a.city, a.state].filter(Boolean).join(', ');
    return `${a.addressName || M.noun}${place ? ` — ${place}` : ''}${a.isDefault ? ' (Default)' : ''}`;
  };

  // Copies the GST / PAN of an address onto the document (blank when none).
  const applyTaxIds = (addr) => {
    setValue(M.gst, (addr?.gstNumber || '').trim());
    setValue(M.gstType, addr?.gstType || '');
    setValue(M.pan, (addr?.panNo || '').trim().toUpperCase());
  };

  // Default address of the MAIN customer — what the box goes back to when the
  // checkbox is cleared, and what the GST / PAN follow in the default mode.
  const mainDefaultAddr = (customerName = mainCustomer) => {
    const rec = (customers || []).find((c) => c.customerName === customerName);
    const list = (rec?.addresses || []).filter((a) => a.addressType === M.type);
    const other = (rec?.addresses || []).filter((a) => a.addressType === M.otherType);
    return list.find((a) => a.isDefault) || list[0] || other.find((a) => a.isDefault) || other[0] || null;
  };
  const mainOwnAddr = () => {
    const rec = (customers || []).find((c) => c.customerName === mainCustomer);
    const list = (rec?.addresses || []).filter((a) => a.addressType === M.type);
    return list.find((a) => a.isDefault) || list[0] || null;
  };

  // Un-checking hands the address straight back to the main customer's own
  // default and drops the different customer.
  const prevChecked = useRef(checked);
  useEffect(() => {
    if (prevChecked.current && !checked) {
      setValue(M.customer, '', { shouldValidate: true });
      const own = mainOwnAddr();
      setValue(M.address, own ? (formatAddress(own) || '') : '', { shouldValidate: true });
      applyTaxIds(mainDefaultAddr());
      setPickedId('');
    }
    // Bill To only: ticking the box with a customer already chosen pre-fills
    // the Bill To customer with that customer (the user can still change it).
    // The existing "picking a customer" effect below then fills the address.
    if (mode === 'bill' && !prevChecked.current && checked && mainCustomer && !getValues(M.customer)) {
      setValue(M.customer, mainCustomer, { shouldValidate: true });
    }
    prevChecked.current = checked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  // Default mode: when the main customer changes (page handler refills the
  // address text) keep the GST / PAN snapshot in step. The first render is
  // skipped so opening a saved document never overwrites what it was saved with.
  const prevMain = useRef(mainCustomer);
  useEffect(() => {
    if (mainCustomer === prevMain.current) return;
    const previousMain = prevMain.current;
    prevMain.current = mainCustomer;
    if (checked) {
      // Bill To only: box already ticked and the customer is picked afterwards
      // (or changed) — follow it unless the user chose a different bill-to.
      if (mode === 'bill' && mainCustomer && (!partyCustomer || partyCustomer === previousMain)) {
        setValue(M.customer, mainCustomer, { shouldValidate: true });
      }
      return;
    }
    applyTaxIds(mainDefaultAddr());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCustomer, customers]);

  // Picking (or changing) the different customer: one address is filled
  // straight in, several wait for the user's choice, none leaves it empty.
  const prevParty = useRef(partyCustomer);
  useEffect(() => {
    if (partyCustomer === prevParty.current) return;
    prevParty.current = partyCustomer;
    if (!checked) return;
    // Copy From / Copy To already wrote this customer's address (and its GST /
    // PAN): keep it rather than re-deriving it.
    const current = getValues(M.address) || '';
    const copied = current && addrs.find((a) => (formatAddress(a) || '') === current);
    if (copied) {
      setPickedId(String(copied.id));
      return;
    }
    if (addrs.length === 1) {
      setPickedId(String(addrs[0].id));
      setValue(M.address, formatAddress(addrs[0]) || '', { shouldValidate: true });
      applyTaxIds(addrs[0]);
    } else {
      setPickedId('');
      setValue(M.address, '', { shouldValidate: true });
      applyTaxIds(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCustomer, addrs]);

  // A saved document: highlight the address that matches the saved text.
  useEffect(() => {
    if (!checked || pickedId || !addressText || !addrs.length) return;
    const match = addrs.find((a) => (formatAddress(a) || '') === addressText);
    if (match) setPickedId(String(match.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrs, checked]);

  const onPick = (e) => {
    const id = e.target.value;
    setPickedId(id);
    const addr = addrs.find((a) => String(a.id) === String(id));
    setValue(M.address, addr ? (formatAddress(addr) || '') : '', { shouldValidate: true });
    applyTaxIds(addr || null);
  };

  const needsChoice = checked && !!partyCustomer && addrs.length > 1 && !pickedId && !addressText;
  const noAddress = checked && !!partyCustomer && addrs.length === 0;

  return (
    <Box sx={{ width: '100%' }}>
      <FormCheckbox name={M.flag} label={M.label} compact />
      {checked && (
        <Box sx={{ mb: 1 }}>
          <PartyCodeSelect
            name={M.customer}
            label=""
            placeholder="Select customer"
            options={customerOptions}
            showNameBelow
            fullWidth
          />
          {!!partyCustomer && addrs.length > 0 && (
            <TextField
              select
              fullWidth
              size="small"
              value={pickedId}
              onChange={onPick}
              disabled={readOnly}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
              label={M.noun}
              error={needsChoice}
              helperText={needsChoice ? `Select one of this customer's ${M.noun.toLowerCase()}es` : ' '}
              sx={{ mt: 1 }}
            >
              {addrs.map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>{addrLabel(a)}</MenuItem>
              ))}
            </TextField>
          )}
          {noAddress && (
            <Box sx={{ color: 'warning.main', fontSize: '0.75rem', mt: 0.5 }}>
              This customer has no {M.noun.toLowerCase()} in Business Partner &gt; Addresses.
            </Box>
          )}
        </Box>
      )}
      <FormTextField
        name={M.address}
        label=""
        placeholder={checked ? `Select customer and ${M.noun.toLowerCase()}` : 'Auto-filled from customer'}
        multiline
        rows={3}
        disabled
      />
    </Box>
  );
}
