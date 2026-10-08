import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import FormSelect from '../form/FormSelect';
import FormTextField from '../form/FormTextField';
import FormRadioGroup from '../form/FormRadioGroup';
import { FormGrid, useFormReadOnly } from '../form/AppForm';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../form/LabeledField';
import { salesEmployeeApi } from '../../features/resources';
import {
  PURCHASE_TYPE_OPTIONS, SALES_TYPE_OPTIONS,
  TYPE_OF_PURCHASE_OPTIONS, TRANSPORT_MODE_OPTIONS,
} from '../../lib/purchaseOtherDetailsOptions';

/**
 * "Other Details" card shared by Purchase Order, Purchase GRN, Purchase
 * Invoice and Purchase Return — Billing Type / Type of Sales (purchaseType) /
 * Type of Purchase / Payment Method (salesType) / Purchase Employee /
 * Transport Mode. A drop-in component: render it anywhere inside an AppForm
 * whose schema/defaultValues carry these six field names (billingType,
 * purchaseType, typeOfPurchase, salesType, purchaseEmployee, transportMode)
 * and everything else — data fetching, read-only state — is self-contained.
 *
 * Kept as one shared component (rather than copy-pasted per document) so
 * every caller's Other Details card can never quietly drift apart from each
 * other — a fix or a new option here reaches every document at once.
 *
 * Billing Type is intentionally not rendered here: the field still exists on
 * every schema/defaultValues and is still saved/printed, this is a pure UI
 * hide (see purchaseOtherDetailsOptions.js's BILLING_TYPE_OPTIONS, kept for
 * that reason even though nothing here imports it any more).
 *
 * Invoice Type has been removed entirely from every purchase document (it
 * used to render here via InvoiceTypeField.jsx) — that field name/column no
 * longer appears on any Purchase Order/GRN/Invoice/Return record.
 *
 * Vendor Reference No is a plain optional free-text field, shown on every
 * variant (including Return) — the vendor's own reference/document number
 * for whatever they sent, printed on the corresponding document only when
 * filled in (see each Printable's metaLeftRows/po3-meta-row).
 *
 * @param {'order'|'return'} variant  'order' (the default) is unchanged
 *   behaviour for Purchase Order/GRN/Invoice. 'return' is Purchase Return
 *   only: purchaseType/typeOfPurchase are relabelled "Return Type"/"Type of
 *   Return" (same underlying field names/options — this is a label-only
 *   change so the one shared component keeps working for every caller) and
 *   Purchase Employee is hidden. Every other purchase document keeps
 *   showing Purchase Employee unchanged.
 */
export default function PurchaseOtherDetailsCard({ variant = 'order' } = {}) {
  const readOnly = useFormReadOnly();
  const isReturn = variant === 'return';

  // Purchase Employee CFL — Company Setup > Sales Employee master (same
  // master/convention SalesOrder.jsx uses for its own Sales Person field).
  // Not fetched at all on Purchase Return, which never shows this field.
  const { data: salesEmployees } = salesEmployeeApi.useList(undefined, { skip: isReturn });

  const purchaseEmployeeOptions = (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName }));

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Other Details</Typography>
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
          <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
            <LabeledField label={isReturn ? 'Return Type' : 'Purchase Type'}>
              <FormSelect name="purchaseType" label="" placeholder={isReturn ? 'Select return type' : 'Select purchase type'} options={PURCHASE_TYPE_OPTIONS} />
            </LabeledField>
            <LabeledField label={isReturn ? 'Type of Return' : 'Type of Purchase'}>
              <FormSelect name="typeOfPurchase" label="" placeholder={isReturn ? 'Select type of return' : 'Select type of purchase'} options={TYPE_OF_PURCHASE_OPTIONS} />
            </LabeledField>
            <LabeledField label="Payment Method *">
              <FormRadioGroup name="salesType" label="" options={SALES_TYPE_OPTIONS} />
            </LabeledField>
            {!isReturn && (
              <LabeledField label="Purchase Employee">
                <FormSelect name="purchaseEmployee" label="" placeholder="Select purchase employee" options={purchaseEmployeeOptions} />
              </LabeledField>
            )}
            <LabeledField label="Transport Mode">
              <FormSelect name="transportMode" label="" placeholder="Select transport mode" options={TRANSPORT_MODE_OPTIONS} />
            </LabeledField>
            <LabeledField label="Vendor Reference No">
              <FormTextField name="vendorRefNo" label="" placeholder="Optional" />
            </LabeledField>
          </FormGrid>
        </fieldset>
      </CardContent>
    </Card>
  );
}
