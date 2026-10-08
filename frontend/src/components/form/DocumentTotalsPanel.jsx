import React from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import FormTextField from './FormTextField';
import { FormCheckbox } from './FormCheckbox';
import FreightChargesEditor from './FreightChargesEditor';
import { taxComponentRows } from '../../lib/documentTotals';

/**
 * The totals panel shared by all eight sales/purchase document pages.
 *
 * Each page used to inline its own copy of this markup, and every copy
 * hard-coded the tax lines as "CGST (9%)" and "SGST (9%)" regardless of what
 * the goods actually attract — a document of 5% items still announced 9% —
 * and none of them could render IGST at all. That last part mattered: the
 * server decides CGST/SGST vs IGST by comparing the document's Place of
 * Supply against the company's registered state (resolveTaxTreatment in
 * backend/src/routes/resources.js), so on an inter-state supply the panel was
 * showing a split that the saved record does not have.
 *
 * Rendering it once, here, driven by the same `interState` flag the server
 * uses, means the screen and the ledger can't disagree again.
 *
 * Row order (top to bottom) is fixed across every caller: Total, Discount,
 * Freight Charges, Taxable Amount, CGST/SGST (or IGST), Road Tax, Round Off,
 * Grand Total — see the five Sales document pages, which all pass
 * showFreight and (except Sales Quotation) roadTaxField.
 */

// labelAdornment sits right next to the LABEL (e.g. Freight Charges' pencil
// icon, Road Tax's checkbox just below) rather than after the value on the
// far right — matches the Road Tax row's own "[label] [control]  ₹value"
// shape, so every row in the panel that pairs a control with an amount
// reads the same way.
function Row({ label, value, bold = false, labelAdornment = null }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        {labelAdornment}
      </Stack>
      <Typography variant="body2" fontWeight={bold ? 700 : 600}>₹{value}</Typography>
    </Stack>
  );
}

/**
 * @param {object}  totals        result of the page's computeTotals()
 * @param {boolean} interState    true when the supply is taxed wholly as IGST
 * @param {string}  subtotalLabel some pages say "Sub Total", others "Subtotal"
 * @param {string}  discountField name of the header Discount % field, or null
 *                                on documents that have no header discount
 * @param {boolean} showDiscount  false hides the Discount row entirely —
 *                                for a document like Stock Transfer that has
 *                                no discount concept at all (not even a
 *                                fixed-at-zero one worth showing), or a read-
 *                                only Discount total (see totals.discount)
 *                                when discountField is null. Ignored when
 *                                discountField is set.
 * @param {boolean} showRoundOff  Purchase Order has no round-off line
 * @param {boolean} showFreight   Every Sales document — shows a "Freight
 *                                Charges" row (read from totals.
 *                                freightGrossAmount) with a small edit icon
 *                                that opens FreightChargesEditor. Like
 *                                Road Tax, the figure is expected to already
 *                                be included in totals.grandTotal by the
 *                                caller, not layered on top of it again here.
 * @param {boolean} showRoadTax   Sales Quotation only — pairs with
 *                                roadTaxCheckboxField to render one
 *                                "[checkbox] Road Tax (8.2%)   ₹value" row,
 *                                read from totals.roadTax. totals.roadTax is
 *                                expected to already be included in
 *                                totals.grandTotal by the caller (see
 *                                SalesQuotation.jsx's computeTotals) — the
 *                                value shown is just a read-only breakdown of
 *                                a figure the grand total already reflects,
 *                                not a separate addition on top of it. With
 *                                no roadTaxCheckboxField passed, renders as
 *                                its own always-on read-only row instead
 *                                (kept for any future caller that wants the
 *                                figure with no checkbox at all).
 * @param {string}  roadTaxField  Sales Order — name of a manually-entered
 *                                Road Tax amount field (unlike Sales
 *                                Quotation's own auto-computed 8.2%). Same
 *                                editable-inline pattern as discountField,
 *                                paired with roadTaxCheckboxField the same
 *                                way showRoadTax is. Mutually exclusive with
 *                                showRoadTax in practice, but nothing stops
 *                                both being passed.
 * @param {string}  roadTaxCheckboxField  Sales Quotation/Sales Order only —
 *                                name of a boolean form field. The checkbox
 *                                renders directly against the Road Tax
 *                                amount (showRoadTax's read-only value, or
 *                                roadTaxField's input) in ONE row, rather
 *                                than a separate checkbox-only row above a
 *                                second amount row — default unticked
 *                                (₹0.00 / a disabled input), ticking it
 *                                reveals the live amount in that same row.
 *                                Absent (the default) on every other sales
 *                                document, which has no Road Tax UI at all.
 *                                The caller's own computeTotals is
 *                                responsible for zeroing totals.roadTax when
 *                                unchecked; this panel only controls display.
 * @param {boolean} roadTaxChecked  Current value of roadTaxCheckboxField.
 */
export default function DocumentTotalsPanel({
  totals,
  interState = false,
  subtotalLabel = 'Sub Total',
  discountField = 'discountPercent',
  showDiscount = true,
  showRoundOff = true,
  showFreight = false,
  showRoadTax = false,
  roadTaxField = null,
  roadTaxCheckboxField = null,
  roadTaxChecked = false,
}) {
  const taxRows = taxComponentRows(totals, interState);

  return (
    <Stack spacing={1.25}>
      <Row label={subtotalLabel} value={totals.subtotal.toFixed(2)} />

      {discountField ? (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">Discount %</Typography>
          <Box sx={{ width: 90 }}>
            <FormTextField name={discountField} label="" type="number" placeholder="0" />
          </Box>
        </Stack>
      ) : showDiscount ? (
        <Row label="Discount" value={(Number(totals.discount) || 0).toFixed(2)} />
      ) : null}

      {showFreight && (
        <Row
          label="Freight Charges"
          value={(Number(totals.freightGrossAmount) || 0).toFixed(2)}
          labelAdornment={<FreightChargesEditor />}
        />
      )}

      <Row label="Taxable Amount" value={totals.taxableAmount.toFixed(2)} />

      {taxRows.map((r) => (
        <Row key={r.label} label={r.label} value={r.amount.toFixed(2)} />
      ))}

      {/* The checkbox used to sit alone on its own "Road Tax" row, with the
          8.2%/manual amount appearing on a SECOND row underneath only once
          ticked — two rows doing one row's job, and the amount row popping
          in/out shifted every row below it. Now one row: the checkbox sits
          right against the amount it turns on, default unticked (Sales
          Quotation/Sales Order both default roadTaxApplicable to false),
          worth ₹0.00 until ticked — same "still included in totals.grandTotal
          via the caller's computeTotals" contract as before, just rendered
          together instead of stacked. */}
      {roadTaxCheckboxField ? (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {showRoadTax ? 'Road Tax (8.2%)' : 'Road Tax Amount'}
            </Typography>
            <FormCheckbox name={roadTaxCheckboxField} label="" compact />
          </Stack>
          {(showRoadTax || roadTaxField) && (
            <Typography variant="body2" fontWeight={600}>
              ₹{(roadTaxChecked ? Number(totals.roadTax) || 0 : 0).toFixed(2)}
            </Typography>
          )}
        </Stack>
      ) : (
        <>
          {showRoadTax && (
            <Row label="Road Tax (8.2%)" value={(Number(totals.roadTax) || 0).toFixed(2)} />
          )}
          {roadTaxField && (
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Road Tax Amount</Typography>
              <Box sx={{ width: 90 }}>
                <FormTextField name={roadTaxField} label="" type="number" placeholder="0" />
              </Box>
            </Stack>
          )}
        </>
      )}

      {showRoundOff && <Row label="Round Off" value={totals.roundOff.toFixed(2)} />}

      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="subtitle1" fontWeight={700}>Grand Total</Typography>
        <Typography variant="subtitle1" fontWeight={700}>₹{totals.grandTotal.toFixed(2)}</Typography>
      </Stack>
    </Stack>
  );
}
