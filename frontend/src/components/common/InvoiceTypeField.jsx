import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import FormSelect from '../form/FormSelect';
import { LabeledField } from '../form/LabeledField';
import { invoiceTypeApi } from '../../features/resources';
import { useNotify } from '../feedback/NotificationProvider';
import { useConfirm } from '../feedback/ConfirmationDialog';
import InvoiceTypeDefineNewDialog from './InvoiceTypeDefineNewDialog';
import InvoiceTypeOptionRow from './InvoiceTypeOptionRow';
import { INVOICE_TYPE_DEFINE_NEW } from '../../lib/purchaseOtherDetailsOptions';

/**
 * The Invoice Type CFL — one labelled grid cell, self-contained.
 *
 * Drop `<InvoiceTypeField />` in as a single child of any FormGrid inside an
 * AppForm whose schema/defaultValues carry an `invoiceType` field, and
 * everything else is handled here: reading the InvoiceType master, the
 * "Define New" dialog that adds a row to that master, and the long-press
 * delete on an unused option.
 *
 * This used to live inline in PurchaseOtherDetailsCard.jsx, which is why only
 * Purchase Order / GRN / Purchase Invoice had it. It was lifted out verbatim
 * so the four sales documents and Purchase Quotation can render the SAME
 * control rather than each growing its own copy — the same anti-drift
 * reasoning that put the Other Details card in one shared component in the
 * first place. PurchaseOtherDetailsCard now renders this too, so there is
 * exactly one implementation of Invoice Type in the app.
 *
 * Deliberately prop-free, matching PurchaseOtherDetailsCard's own convention:
 * the field name is always `invoiceType` and the label is always "Invoice
 * Type", so no caller can accidentally wire it to a different column or
 * relabel it and reintroduce the divergence this component exists to remove.
 */
export default function InvoiceTypeField() {
  const { setValue, getValues } = useFormContext();
  const notify = useNotify();
  const confirm = useConfirm();

  // Invoice Type CFL — its own master (see schema.prisma's InvoiceType doc
  // comment), with a "Define New" option that adds a row to it.
  // includeUsage: true asks the list for each row's `isUsed` flag (see
  // resources.js's /invoice-types route) so the long-press delete icon
  // below can disable itself up front for a type already referenced by a
  // document, instead of only failing after the click.
  const { data: invoiceTypes } = invoiceTypeApi.useList({ includeUsage: true });
  const [createInvoiceType, { isLoading: creatingInvoiceType }] = invoiceTypeApi.useCreate();
  const [deleteInvoiceType, { isLoading: deletingInvoiceType }] = invoiceTypeApi.useDelete();
  const [invoiceTypeDialogOpen, setInvoiceTypeDialogOpen] = useState(false);
  // Which Invoice Type option currently has its delete icon revealed by a
  // long press — at most one at a time, cleared whenever the dropdown is
  // reopened/closed or after a delete completes.
  const [revealedInvoiceType, setRevealedInvoiceType] = useState(null);

  // "Define New" is always the last option, appended after whatever the
  // master already has — never one of its real rows. id/isUsed ride along
  // on each real option so InvoiceTypeOptionRow can delete by id and
  // disable itself for a type already in use.
  const invoiceTypeOptions = [
    ...(invoiceTypes || []).map((t) => ({ label: t.name, value: t.name, id: t.id, isUsed: t.isUsed })),
    { label: 'Define New', value: INVOICE_TYPE_DEFINE_NEW },
  ];

  // Selecting "Define New" adds a row to the shared InvoiceType master (see
  // schema.prisma) rather than committing the sentinel value itself —
  // clears the field back out and opens a small dialog to type + save the
  // new type, which then becomes a normal option for every future document
  // too, not just this one record.
  const handleInvoiceTypeChange = (value) => {
    if (value === INVOICE_TYPE_DEFINE_NEW) {
      setValue('invoiceType', '', { shouldValidate: true });
      setInvoiceTypeDialogOpen(true);
    }
  };

  // Long-press delete for an Invoice Type option (see InvoiceTypeOptionRow).
  // Only ever reachable for an option whose isUsed is false — the row
  // itself disables the icon otherwise — but the backend's own
  // masterGuard('invoiceType', 'name') still enforces this for real, in
  // case the type got used by someone else between this list load and now.
  const handleDeleteInvoiceTypeOption = async (option) => {
    const ok = await confirm({
      title: 'Delete Invoice Type',
      message: `Delete "${option.label}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await deleteInvoiceType(option.id).unwrap();
      notify.success(`Invoice Type "${option.label}" deleted.`);
      setRevealedInvoiceType(null);
      // If this document currently has the deleted type selected, don't
      // leave a dangling value behind.
      if (getValues('invoiceType') === option.value) {
        setValue('invoiceType', '', { shouldValidate: true });
      }
    } catch (err) {
      notify.error(err?.data?.message || 'Could not delete this Invoice Type.');
    }
  };

  return (
    <>
      <LabeledField label="Invoice Type">
        <FormSelect
          name="invoiceType"
          label=""
          placeholder="Select invoice type"
          options={invoiceTypeOptions}
          onValueChange={handleInvoiceTypeChange}
          onOpen={() => setRevealedInvoiceType(null)}
          onClose={() => setRevealedInvoiceType(null)}
          renderOption={(props, option) => {
            const { key, ...liProps } = props;
            // "Define New" is an action, not a real master row —
            // never long-press-deletable.
            if (option.value === INVOICE_TYPE_DEFINE_NEW) {
              return <li key={key} {...liProps}>{option.label}</li>;
            }
            return (
              <InvoiceTypeOptionRow
                key={key}
                liProps={liProps}
                option={option}
                revealed={revealedInvoiceType}
                onReveal={setRevealedInvoiceType}
                onDelete={handleDeleteInvoiceTypeOption}
                deleting={deletingInvoiceType}
              />
            );
          }}
        />
      </LabeledField>

      {/* Rendered as a sibling of the field rather than inside LabeledField:
          a Dialog portals to the body anyway, and keeping it out of the
          labelled cell means it can never be caught by the caller's
          `<fieldset disabled={readOnly}>` and have its own inputs disabled. */}
      <InvoiceTypeDefineNewDialog
        open={invoiceTypeDialogOpen}
        onClose={() => setInvoiceTypeDialogOpen(false)}
        onCreated={(name) => setValue('invoiceType', name, { shouldValidate: true })}
        createInvoiceType={createInvoiceType}
        creating={creatingInvoiceType}
        existingNames={(invoiceTypes || []).map((t) => t.name)}
        notify={notify}
      />
    </>
  );
}
