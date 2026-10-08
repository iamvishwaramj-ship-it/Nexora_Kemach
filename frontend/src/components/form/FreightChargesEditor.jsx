import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Box, IconButton, Popover, Stack, Typography, Divider, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import FormTextField from './FormTextField';
import FormSelect from './FormSelect';
import { useFormReadOnly } from './AppForm';
import { transportApi, taxCodeApi } from '../../features/resources';
import { round2, num, computeFreightGross } from '../../lib/documentTotals';

/**
 * "Freight Charges" — the small ✎ next to the totals-panel row opens this
 * popup, the same "banking-style amount paid" edit-in-a-popover pattern the
 * user asked for rather than a permanently-open block of fields. Everything
 * inside reads/writes the SAME six form fields the parent document's Zod
 * schema and computeTotals() already know about (freightTransportId,
 * freightName, freightRemarks, freightTaxCodeId, freightTaxAmount,
 * freightNetAmount, freightGrossAmount) — this component owns no state of
 * its own beyond which popover is open and the two "did the user just pick
 * a new option" refs below.
 *
 * Freight Name is a Transport Master (see pages/businessPartner/
 * TransportMaster.jsx) dropdown, not free text — picking a transporter
 * writes both freightTransportId (the link) and freightName (a frozen copy
 * of the name, so printed/historic documents read correctly even if the
 * Transport Master record is later renamed). Selecting a Tax Code
 * auto-fills Total Tax Amount from that code's rate as a one-time starting
 * point; both Net Amount and Total Tax Amount stay plain editable fields
 * afterwards, exactly like every other "auto-filled but still yours to
 * change" field in this app.
 */
export default function FreightChargesEditor() {
  const { setValue, control } = useFormContext();
  const readOnly = useFormReadOnly();
  const [anchorEl, setAnchorEl] = useState(null);

  const { data: transporters } = transportApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();

  const transportOptions = useMemo(
    () => (transporters || [])
      .filter((t) => (t.status || 'Active') === 'Active')
      .map((t) => ({ label: t.transporterName, value: t.id })),
    [transporters],
  );
  const taxCodeOptions = useMemo(
    () => (taxCodes || [])
      .filter((c) => (c.status || 'Active') === 'Active')
      .map((c) => ({ label: `${c.taxCode} (${num(c.taxRate)}%)`, value: c.id })),
    [taxCodes],
  );
  const transportById = useMemo(() => new Map((transporters || []).map((t) => [t.id, t])), [transporters]);
  const taxCodeById = useMemo(() => new Map((taxCodes || []).map((c) => [c.id, c])), [taxCodes]);

  const freightTransportId = useWatch({ control, name: 'freightTransportId' });
  const freightTaxCodeId = useWatch({ control, name: 'freightTaxCodeId' });
  const freightNetAmount = useWatch({ control, name: 'freightNetAmount' });
  const freightTaxAmount = useWatch({ control, name: 'freightTaxAmount' });
  const grossAmount = computeFreightGross(freightNetAmount, freightTaxAmount);

  // Keep freightGrossAmount on the form in sync with Net/Tax as the user
  // types, so the totals-panel row (and computeTotals' own grandTotal, which
  // reads this field) update live without waiting for a save.
  useEffect(() => {
    setValue('freightGrossAmount', grossAmount, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grossAmount]);

  // Only overwrite freightName / auto-fill freightTaxAmount on a change the
  // user actually made in this session — not on the initial hydration of an
  // existing document, which already carries its own correct freightName /
  // freightTaxAmount and must not have them silently recomputed on open.
  const mountedTransport = useRef(false);
  useEffect(() => {
    if (!mountedTransport.current) { mountedTransport.current = true; return; }
    const t = transportById.get(freightTransportId);
    setValue('freightName', t ? t.transporterName : '', { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freightTransportId]);

  const mountedTaxCode = useRef(false);
  useEffect(() => {
    if (!mountedTaxCode.current) { mountedTaxCode.current = true; return; }
    const c = taxCodeById.get(freightTaxCodeId);
    if (c) {
      setValue('freightTaxAmount', round2(num(freightNetAmount) * (num(c.taxRate) / 100)), { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freightTaxCodeId]);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="Edit Freight Charges"
        sx={{ p: 0.25 }}
      >
        <EditIcon fontSize="inherit" />
      </IconButton>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <LocalShippingIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight={700}>Freight Charges</Typography>
          </Stack>

          <Stack spacing={1.5}>
            <FormSelect
              name="freightTransportId"
              label="Freight Name (Transporter)"
              placeholder="Select transporter"
              options={transportOptions}
              disabled={readOnly}
            />
            <FormTextField name="freightRemarks" label="Remarks" placeholder="Remarks" disabled={readOnly} />
            <FormSelect
              name="freightTaxCodeId"
              label="Tax Code"
              placeholder="Select tax code"
              options={taxCodeOptions}
              disabled={readOnly}
            />
            <Stack direction="row" spacing={1.5}>
              <FormTextField name="freightNetAmount" label="Net Amount" type="number" placeholder="0" disabled={readOnly} />
              <FormTextField name="freightTaxAmount" label="Total Tax Amount" type="number" placeholder="0" disabled={readOnly} />
            </Stack>

            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Gross Amount</Typography>
              <Typography variant="body2" fontWeight={700}>₹{grossAmount.toFixed(2)}</Typography>
            </Stack>
          </Stack>

          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button size="small" variant="contained" onClick={() => setAnchorEl(null)}>Done</Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
