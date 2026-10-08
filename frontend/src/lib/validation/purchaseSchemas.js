import { z } from 'zod';
import {
  requiredString, optionalString, optionalEmail, optionalMobileNumber,
  nonNegativeNumber, positiveNumber, currencyAmount, percentage, optionalPercentage, anyDate, optionalDate,
  pastOrTodayDate, futureOrTodayDate, dateRange,
  optionalPersonName, optionalEntityName,
  hsnCode,
  baseDocumentFields,
  freightFields,
  optionalNonNegativeNumber,
  uniqueItemCodes,
} from './common';
import { batchAllocationLineSchema, serialAllocationLineSchema } from './batchSerialSchemas';    

// Which Tax Code a line's taxPercent came from — see the schema.prisma
// comment on e.g. PurchaseOrderItem.taxCodeId. Nullable FK-by-id, same
// preprocess-to-null idiom as salesSchemas.js's own optionalTaxCodeId: an
// empty Autocomplete emits null (see FormSelect), which must stay null
// rather than being coerced to '' (this is an INT column, not a string).
// Optional — a hand-typed/legacy line with no matching Tax Code still saves.
const optionalTaxCodeId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.number({ invalid_type_error: 'Tax code is invalid' }).int().positive().nullable().optional()
);

export const purchaseQuotationItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  taxPercent: percentage('Tax'),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse this line would receive into once ordered/received. No
  // header warehouse exists on a Quotation to seed this from, so the row
  // simply starts blank until picked.
  warehouse: requiredString('Warehouse'),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const purchaseQuotationSchema = z.object({
  quotationNo: requiredString('Quotation number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  supplier: requiredString('Supplier'),
  contactPerson: optionalPersonName('Contact person'),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  quotationDate: anyDate('Quotation date'),
  validUpto: futureOrTodayDate('Valid upto'),
  referenceNo: optionalString(),
  currency: requiredString('Currency'),
  paymentTerms: optionalString(),
  deliveryDate: futureOrTodayDate('Delivery date'),
  shipTo: optionalString(),
  // Display-only, auto-filled from the selected supplier's Business Partner
  // address -- see supplierState in PurchaseQuotation.jsx. Drives CGST/SGST vs IGST.
  supplierState: optionalString(),
  termsConditions: optionalString(),
  attachmentName: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  status: requiredString('Status'),
  // See the doc comment on purchaseQuotationSchema's own preparedBy/
  // approvedBy above — same Sales-Employee-Select-sourced value, same fix.
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  // Road Tax Amount has been removed from every purchase document's UI and
  // print layout, and no longer feeds the Grand Total — no roadTax field
  // here any more.
  ...freightFields(),

  items: z.array(purchaseQuotationItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('quotationDate', 'validUpto', { startLabel: 'Quotation date', endLabel: 'Valid upto' })(data, ctx);
  dateRange('quotationDate', 'deliveryDate', { startLabel: 'Quotation date', endLabel: 'Delivery date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
});

// Document-flow status: Open until a Purchase Order is raised from this
// quotation, then Closed. Set server-side
// (recomputePurchaseQuotationStatus in backend utils/documentFlow.js), never
// chosen on the form. 'Converted' is what Closed now means;
// Sent/Rejected/Expired described a negotiation the app never tracked.
export const QUOTATION_STATUS_OPTIONS = ['Open', 'Closed'];

export const purchaseOrderItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  taxPercent: percentage('Tax'),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse this line would receive into once received. No header
  // warehouse exists on a PO to seed this from, so the row starts blank.
  warehouse: requiredString('Warehouse'),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const purchaseOrderSchema = z.object({
  poNo: requiredString('PO number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  supplier: requiredString('Supplier'),
  contactPerson: optionalPersonName('Contact person'),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  poDate: anyDate('PO date'),
  // The quotation this order was raised from, filled by Copy From. Must be
  // listed here or zod strips it from the payload and the link never reaches
  // the server — which is exactly what used to happen, leaving the Purchase
  // Quotation with no way to know it had been ordered against. Mirrors
  // salesOrderSchema.quotationNo.
  quotationNo: optionalString(),
  referenceNo: optionalString(),
  // Vendor's own reference for this order — same field/name as every other
  // purchase document's own vendorRefNo (see PurchaseOtherDetailsCard.jsx).
  vendorRefNo: optionalString(),
  currency: requiredString('Currency'),
  paymentTerms: optionalString(),
  deliveryDate: futureOrTodayDate('Delivery date'),
  shipTo: optionalString(),
  // "Ship to a different customer" — see the matching pair on
  // purchaseInvoiceSchema and the schema.prisma comment on
  // PurchaseOrder.shipToDifferentCustomer.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  // Counterpart to shipTo — where the goods ship from. Free text.
  shipFrom: optionalString(),
  // Display-only, auto-filled from the selected supplier's own Business
  // Partner record (its default Billing address's state) — same data-flow
  // as shipFrom above, never hand-typed. See supplierState useMemo in
  // PurchaseOrder.jsx. Independent of placeOfSupply, which tracks the
  // BRANCH's state instead.
  supplierState: optionalString(),
  termsConditions: optionalString(),
  attachmentName: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  status: requiredString('Status'),

  // "Other Details" classification fields — fixed-option (CFL) selects, see
  // BILLING_TYPE_OPTIONS / PURCHASE_TYPE_OPTIONS / SALES_TYPE_OPTIONS on
  // PurchaseOrder.jsx. billingType is no longer shown on the Other Details
  // card (see PurchaseOtherDetailsCard.jsx) but is kept here unchanged — a
  // pure UI hide, not a data-model removal. salesType (Payment Method) is
  // now mandatory — every purchase must record whether it's a cash or
  // credit purchase.
  billingType: optionalString(),
  purchaseType: optionalString(),
  salesType: requiredString('Payment method'),
  typeOfPurchase: optionalString(),

  // Print-layout fields
  buyingBranch: optionalString(),
  department: optionalString(),
  placeOfSupply: optionalString(),
  transportMode: optionalString(),
  eWayBillNo: optionalString(),
  eWayBillDate: optionalDate('E-Way Bill Date'),
  packingForwarding: optionalString(),
  loadingUnloading: optionalString(),
  inspection: optionalString(),
  warranty: optionalString(),
  remarks: optionalString(),
  bankAccount: optionalString(),
  // Fixed-option (CFL) select sourced from Company Setup > Sales Employee —
  // see purchaseEmployeeOptions on PurchaseOrder.jsx.
  purchaseEmployee: optionalString(),
  // Invoice Type has been removed from every purchase document's UI —
  // no invoiceType field here any more.
  // preparedBy/checkedBy/approvedBy are Selects sourced from the Sales
  // Employee master's own employeeName (see preparedByOptions/
  // approvedByOptions in the page component) — not free-typed text, so the
  // personName format guard (letters/spaces/.'- only) is the wrong check
  // here: any employee name with a digit, ampersand, or other everyday
  // character would reject a value the user never typed, leaving the Save
  // button silently disabled with no visible field error (the Select never
  // shows one for a value it never rejects on its own). Same bug class as
  // the identical fix already applied to preparedBy on the Stock Transfer /
  // Request / Receipt schemas (see inventorySchemas.js) — a value drawn
  // verbatim from an existing master record just needs to be present.
  preparedBy: optionalString(),
  checkedBy: optionalString(),
  approvedBy: optionalString(),
  // Road Tax Amount has been removed from every purchase document's UI and
  // print layout, and no longer feeds the Grand Total — no roadTax field
  // here any more.
  ...freightFields(),

  items: z.array(purchaseOrderItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('poDate', 'deliveryDate', { startLabel: 'PO date', endLabel: 'Delivery date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
});

export const PO_STATUS_OPTIONS = ['Draft', 'Open', 'Partially Received', 'Received', 'Partially Invoiced', 'Closed', 'Cancelled'];

// One row of the "Batches - Setup" dialog on a GRN line whose product is
// Batch-tracked (Product Master > Manage Item By = 'Batch'). `quantity` is
// how many of the line's received quantity this batch accounts for — the
// dialog's Open Qty is the line's receivedQuantity minus the sum of these.
export const productBatchLineSchema = z.object({
  batchNo: requiredString('Batch no.'),
  // positiveNumber(), not a bare z.number() — see the matching note on
  // batchAllocationLineSchema in batchSerialSchemas.js. The API returns a
  // saved batch line's quantity as a string, and this schema sits inside a
  // nested array that rowToFormValues does not coerce, so without the
  // preprocess step every batch-tracked Stock Receipt and Purchase GRN loads
  // permanently invalid and cannot be saved. Messages are unchanged.
  quantity: positiveNumber('Quantity'),
  batchAttribute1: optionalString(),
  batchAttribute2: optionalString(),
  expirationDate: optionalDate('Expiration date'),
  mfrDate: optionalDate('Mfr date'),
  admissionDate: optionalDate('Admission date'),
  location: optionalString(),
  details: optionalString(),
});

// The Serial equivalent — one row per physical unit, so there is no quantity
// column; the number of rows against a line IS the quantity received.
export const productSerialLineSchema = z.object({
  serialNo: requiredString('Serial no.'),
  lotNo: optionalString(),
  expirationDate: optionalDate('Expiration date'),
  mfrDate: optionalDate('Mfr date'),
  admissionDate: optionalDate('Admission date'),
  mfrWarrantyStart: optionalDate('Mfr warranty start'),
  mfrWarrantyEnd: optionalDate('Mfr warranty end'),
  location: optionalString(),
});

export const goodsReceivedNoteItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  // Which warehouse THIS LINE receives into. Mandatory — every row must pick
  // one; there is no header-level Warehouse field any more, so this is the
  // only place it's set. Lets one GRN receive different products into
  // different warehouses instead of every line sharing one warehouse — same
  // shape as Stock Transfer's per-line fromWarehouse/toWarehouse.
  warehouse: requiredString('Warehouse'),
  // Hidden from this form's UI (per request) but kept on the data model —
  // still written by Copy From and still shown nowhere, purely a reference
  // figure.
  poQuantity: nonNegativeNumber('PO quantity'),
  receivedQuantity: z
    .number({ invalid_type_error: 'Received quantity must be a number' })
    .gt(0, 'Received quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  taxPercent: percentage('Tax %').optional().default(0),
  taxCodeId: optionalTaxCodeId,
  // Populated via the "Batches - Setup" / "Serial Numbers - Setup" dialog —
  // see BatchSerialSetupDialog. Whether either is required, and how much of
  // receivedQuantity it must add up to, depends on the product's Manage Item
  // By value, which this per-line schema has no access to — that check runs
  // at submit time in PurchaseGRN.jsx instead (see validateBatchSerialAllocation).
  batches: z.array(productBatchLineSchema).optional().default([]),
  serials: z.array(productSerialLineSchema).optional().default([]),
  // Machine Serial No / Machine Model — per-line text, but only ever shown
  // (and only ever meaningful) when the HEADER's Purchase Type is 'Machine'
  // (see PURCHASE_TYPE_OPTIONS in purchaseOtherDetailsOptions.js). Unlike
  // Batch/Serial above, whose per-line visibility is driven by each line's
  // own product (Manage Item By), these two are gated purely on a header
  // field that isn't part of this per-line schema at all — so there is
  // nothing to check here. Always optional: the UI's show/hide on GRN/
  // Invoice is what enforces "only applies to Machine purchases", not a
  // conditional-required refinement, so a line saved while Purchase Type
  // was something else simply carries ''/null through untouched.
  machineSerialNo: optionalString(),
  machineModel: optionalString(),
  machineEngineNo: optionalString(),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const goodsReceivedNoteSchema = z.object({
  grnNo: requiredString('GRN number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  supplier: requiredString('Supplier'),
  receivedDate: anyDate('GRN date'),
  // Optional, not required. A goods receipt does not always have a purchase
  // order behind it — a direct delivery, a sample, a replacement shipment —
  // and requiring it here made those impossible to record at all. The column
  // is nullable in the database, and recomputePurchaseOrder() in
  // backend/src/utils/documentFlow.js already returns early on a blank poNo,
  // so a GRN with no PO simply participates in no fulfilment maths. PO No./PO
  // Date stay on the form (hidden, not removed — Copy From still writes
  // them and the server still links fulfilment off them) even though
  // neither has a visible field on this card any more.
  poNo: optionalString(),
  poDate: anyDate('PO date').nullable().optional(),
  deliveryChallanNo: optionalString(),
  // Vendor's own reference for this delivery — their despatch/challan
  // number, distinct from deliveryChallanNo above (this GRN's own).
  vendorRefNo: optionalString(),
  // Drives CGST/SGST vs IGST the same way it does on every other purchase
  // document — see resolveTaxTreatment on the server and isInterState here.
  placeOfSupply: requiredString('Place of supply'),
  // Sourced from the selected supplier's own Business Partner addresses
  // (Billing → Ship From, Shipping → Ship To) — see addressOptionsFor in
  // PurchaseGRN.jsx. Free text once picked, same as Purchase Order's.
  shipFrom: optionalString(),
  // Display-only, auto-filled from the selected supplier's own Business
  // Partner record (its default Billing address's state) — same data-flow
  // as shipFrom above, never hand-typed. See supplierState useMemo in
  // PurchaseGRN.jsx. Independent of placeOfSupply above, which is required
  // and tracks a different concept.
  supplierState: optionalString(),
  shipTo: optionalString(),
  // "Ship to a different customer" — see the matching pair on
  // purchaseOrderSchema/purchaseInvoiceSchema and the schema.prisma comment
  // on GoodsReceivedNote.shipToDifferentCustomer.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  termsConditions: optionalString(),
  attachmentName: optionalString(),
  status: requiredString('Status'),
  // "Other Details" card — see components/common/PurchaseOtherDetailsCard.jsx.
  // Same fixed-option (CFL) fields as Purchase Order's own Other Details card.
  // billingType is no longer shown on the card (pure UI hide, kept here
  // unchanged). salesType (Payment Method) is now mandatory.
  billingType: optionalString(),
  purchaseType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  purchaseEmployee: optionalString(),
  transportMode: optionalString(),
  // Invoice Type has been removed from every purchase document's UI —
  // no invoiceType field here any more.
  // See the doc comment on purchaseQuotationSchema's own preparedBy/
  // approvedBy above — same Sales-Employee-Select-sourced value, same fix.
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  // Road Tax Amount has been removed from every purchase document's UI and
  // print layout, and no longer feeds the Grand Total — no roadTax field
  // here any more.
  ...freightFields(),

  items: z.array(goodsReceivedNoteItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('poDate', 'receivedDate', { startLabel: 'PO date', endLabel: 'GRN date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
});

// 'Draft' is the pre-receipt staging state behind "Save as Draft" — no stock
// has posted yet. 'Open' means received but not yet fully invoiced, 'Closed'
// fully invoiced (recomputeGrnStatus in backend utils/documentFlow.js).
// 'Cancelled' is unchanged and still excludes the GRN from stock and from the
// order's received quantity. The old Received/Partially Received pair is
// gone: how much of an order has arrived is the ORDER's business (it keeps
// its quantity-based status), not the receipt's — a GRN is a single receipt
// event.
export const GRN_STATUS_OPTIONS = ['Draft', 'Open', 'Closed', 'Cancelled'];

// --- Purchase Return -------------------------------------------------------
export const purchaseReturnItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  // Carried from the GRN line so the form can cap the return at what is
  // actually still left — the GRN's received quantity MINUS whatever other
  // (non-cancelled) purchase returns against the same GRN line have already
  // taken; not something the user types.
  receivedQuantity: nonNegativeNumber('Received quantity'),
  returnQuantity: z
    .number({ invalid_type_error: 'Return quantity must be a number' })
    .gt(0, 'Return quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  discountPercent: optionalPercentage('Discount'),
  taxPercent: percentage('Tax'),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse THIS LINE ships back out of. Mandatory — a return always
  // posts a stock movement, unlike an invoice which may or may not depending
  // on grnNo. The form seeds a new row from the header's own (required)
  // Warehouse field.
  warehouse: requiredString('Warehouse'),
  // "Batches Number - Selection" / "Serial Numbers - Selection" — goods
  // going back to the supplier decrement existing stock exactly like a
  // Delivery Challan/Stock Issue line. See BatchSerialSelectionDialog.jsx.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
})
  // A return can never send back more than the GRN brought in — checked per
  // line here so the message lands on the offending row rather than the form.
  .refine((i) => !i.receivedQuantity || i.returnQuantity <= i.receivedQuantity, {
    message: 'Return quantity cannot exceed the received quantity',
    path: ['returnQuantity'],
  });

export const purchaseReturnSchema = z.object({
  returnNo: requiredString('Return number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  status: requiredString('Status'),
  // Optional, not required. Goods do go back without a receipt to point at —
  // a delivery recorded outside the system, a replacement being sent back —
  // and requiring it here made those impossible to enter at all. The column is
  // nullable in the database, and the per-line cap that keeps a return within
  // what a GRN brought in is already written to skip a line with no
  // receivedQuantity (see the refine on purchaseReturnItemSchema above), so a
  // return with no GRN simply has nothing to be capped against.
  grnNo: optionalString(),
  supplier: requiredString('Supplier'),
  supplierName: optionalEntityName('Supplier name'),
  contactPerson: optionalPersonName('Contact person'),
  supplierRefNo: optionalString(),
  branch: requiredString('Branch'),
  // Where the goods physically leave from — see the schema.prisma comment
  // on PurchaseReturn.warehouse.
  //
  // Optional at the header, not required. PurchaseReturn.jsx has no visible
  // input for this field — only each line's own Warehouse (see
  // purchaseReturnItemSchema.warehouse, already required there and what the
  // stock movement actually posts against); the header value exists only as
  // postStockEntries' document-level fallback for a line somehow left
  // without one. Nothing on this form ever sets it (the branch-change effect
  // only ever clears it), so requiring it unconditionally blocked Save on
  // every return — there was no way to fill it in.
  warehouse: optionalString(),
  documentDate: anyDate('Document date'),
  postingDate: anyDate('Posting date').nullable().optional(),
  dueDate: anyDate('Due date').nullable().optional(),
  paymentTerms: optionalString(),
  billDoNo: optionalString(),
  billDoDate: anyDate('Bill/DO date').nullable().optional(),
  reason: optionalString(),
  comments: optionalString(),
  placeOfSupply: optionalString(),
  // Auto-filled from the supplier's Business Partner address; drives GST vs IGST.
  supplierState: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  termsConditions: optionalString(),
  attachmentName: optionalString(),
  // "Other Details" card — see components/common/PurchaseOtherDetailsCard.jsx,
  // rendered here with variant="return" (relabels purchaseType/
  // typeOfPurchase as Return Type/Type of Return and hides Purchase
  // Employee). Same underlying fields/options as every other purchase
  // document's own Other Details card. No invoiceType: Invoice Type has
  // been removed from every purchase document's UI.
  billingType: optionalString(),
  purchaseType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  purchaseEmployee: optionalString(),
  transportMode: optionalString(),
  // Vendor's own reference for this return — same field/name as
  // GoodsReceivedNote/PurchaseOrder/PurchaseInvoice's own vendorRefNo (see
  // PurchaseOtherDetailsCard.jsx). Distinct from supplierRefNo above, which
  // is an older, unrelated field with no rendered input on this form.
  vendorRefNo: optionalString(),
  // See the doc comment on purchaseQuotationSchema's own preparedBy/
  // approvedBy above — same Sales-Employee-Select-sourced value, same fix.
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  // Road Tax Amount has been removed from every purchase document's UI and
  // print layout, and no longer feeds the Grand Total — no roadTax field
  // here any more.
  ...freightFields(),

  items: z.array(purchaseReturnItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('documentDate', 'postingDate', { startLabel: 'Document date', endLabel: 'Posting date' })(data, ctx);
  dateRange('documentDate', 'dueDate', { startLabel: 'Document date', endLabel: 'Due date' })(data, ctx);
  dateRange('documentDate', 'billDoDate', { startLabel: 'Document date', endLabel: 'Bill/DO date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
});

// --- Purchase Credit Memo --------------------------------------------------
export const purchaseCreditMemoItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  // Carried from the invoice line so the memo can be capped at what was billed.
  invoicedQuantity: nonNegativeNumber('Invoiced quantity'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  discountPercent: optionalPercentage('Discount'),
  taxPercent: percentage('Tax'),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse THIS LINE ships back out of. Mandatory — a credit memo
  // always posts a stock movement. The form seeds a new row from the
  // header's own (required) Warehouse field.
  warehouse: requiredString('Warehouse'),
  // "Batches Number - Selection" / "Serial Numbers - Selection" — see the
  // matching comment on purchaseReturnItemSchema above.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
})
  // A credit can never exceed what the invoice billed — checked per line so the
  // message lands on the offending row rather than the whole form.
  .refine((i) => !i.invoicedQuantity || i.quantity <= i.invoicedQuantity, {
    message: 'Quantity cannot exceed the invoiced quantity',
    path: ['quantity'],
  });

export const purchaseCreditMemoSchema = z.object({
  creditNo: requiredString('Credit number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  status: requiredString('Status'),
  // Optional, not required. A supplier credit does not always point at one
  // invoice — a settlement, a rebate, a correction agreed outside the billing
  // run — and requiring it here made those impossible to enter at all. The
  // column is nullable in the database; the per-line cap that keeps a memo
  // within what an invoice billed already skips a line with no
  // invoicedQuantity (see the refine on purchaseCreditMemoItemSchema above),
  // and the server's assertNoOverConsumption returns early on a blank
  // reference, so such a memo simply has nothing to be capped against.
  invoiceNo: optionalString(),
  supplier: requiredString('Supplier'),
  supplierCode: optionalString(),
  supplierName: optionalEntityName('Supplier name'),
  // Currency / Bill From / Ship To, and the Other Details five further
  // down, arrived when this document's header was rebuilt into the same two
  // cards Purchase Order uses. Each is declared exactly as
  // purchaseOrderSchema/purchaseInvoiceSchema declare their own copy, so
  // the three documents' shared fields can't validate differently.
  //
  // currency is optional here where Purchase Order/Invoice make it
  // required: those two store it NOT NULL, this column was added to a table
  // that already had rows and is nullable (see schema.prisma), so an
  // existing memo opened for edit must not be blocked by a field that was
  // never captured when it was created. The form still defaults it to INR.
  currency: optionalString(),
  // Auto-filled from the supplier's default Billing address and from the
  // branch's own address, and rendered as disabled boxes — never typed, so
  // never required. Same data flow as Purchase Order's shipFrom/shipTo.
  billFrom: optionalString(),
  shipTo: optionalString(),
  // contactPerson/supplierRefNo/transactionType are gone entirely — fields,
  // columns and data (migration 20260919060100). They were the only three
  // of the nine fields removed from the header card with no reader anywhere
  // else; everything else that left the card (location, postingDate,
  // billDoNo, billDoDate, reason, status) is still below, still saved, and
  // still doing a job somewhere off-form.
  location: optionalString(),
  branch: requiredString('Branch'),
  // Where the goods physically leave from — see the schema.prisma comment
  // on PurchaseCreditMemo.warehouse.
  //
  // Optional at the header, not required. PurchaseCreditMemo.jsx has no
  // visible input for this field — only each line's own Warehouse (see
  // purchaseCreditMemoItemSchema.warehouse, already required there and what
  // the stock movement actually posts against); the header value exists
  // only as postStockEntries' document-level fallback for a line somehow
  // left without one. Nothing on this form ever sets it (the branch-change
  // effect only ever clears it), so requiring it unconditionally blocked
  // Save on every credit memo — there was no way to fill it in.
  warehouse: optionalString(),
  documentDate: anyDate('Document date'),
  postingDate: anyDate('Posting date').nullable().optional(),
  dueDate: anyDate('Due date').nullable().optional(),
  paymentTerms: optionalString(),
  billDoNo: optionalString(),
  billDoDate: anyDate('Bill/DO date').nullable().optional(),
  reason: optionalString(),
  comments: optionalString(),
  // Other Details card (the shared PurchaseOtherDetailsCard) — same five
  // field names every other purchase document feeds it with.
  //
  // salesType is optional here where purchaseOrderSchema requires it. The
  // card renders it as "Payment Method *" either way, but every credit memo
  // that already exists predates the column and holds NULL; making it
  // required would block Save on an old memo the moment anyone opened it to
  // change something unrelated. billingType is not declared at all — the
  // shared card never renders that field, and this document has no column
  // for it (see the schema.prisma comment).
  purchaseType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: optionalString(),
  purchaseEmployee: optionalString(),
  transportMode: optionalString(),
  // Vendor's own reference for this credit memo — same field/name as
  // GoodsReceivedNote/PurchaseOrder/PurchaseInvoice/PurchaseReturn's own
  // vendorRefNo (see PurchaseOtherDetailsCard.jsx).
  vendorRefNo: optionalString(),
  placeOfSupply: optionalString(),
  // Auto-filled from the supplier's Business Partner address; drives GST vs IGST.
  supplierState: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  termsConditions: optionalString(),
  attachmentName: optionalString(),
  // See the doc comment on purchaseQuotationSchema's own preparedBy/
  // approvedBy above — same Sales-Employee-Select-sourced value, same fix.
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  // Road Tax Amount has been removed from every purchase document's UI and
  // print layout, and no longer feeds the Grand Total — no roadTax field
  // here any more.
  ...freightFields(),

  items: z.array(purchaseCreditMemoItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('documentDate', 'postingDate', { startLabel: 'Document date', endLabel: 'Posting date' })(data, ctx);
  dateRange('documentDate', 'dueDate', { startLabel: 'Document date', endLabel: 'Due date' })(data, ctx);
  dateRange('documentDate', 'billDoDate', { startLabel: 'Document date', endLabel: 'Bill/DO date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
});

export const PURCHASE_CREDIT_MEMO_STATUS_OPTIONS = ['Draft', 'Open', 'Closed', 'Cancelled'];

export const PURCHASE_RETURN_STATUS_OPTIONS = ['Draft', 'Open', 'Closed', 'Cancelled'];

export const purchaseInvoiceItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  discountPercent: optionalPercentage('Discount'),
  taxPercent: percentage('Tax'),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse THIS LINE lands in. Optional at the field level and
  // required by the parent schema's refinement only when the invoice has no
  // grnNo (a direct invoice, which is the document that actually moves
  // stock) — see purchaseInvoiceSchema's superRefine below, mirroring the
  // existing header-level warehouse requirement.
  warehouse: optionalString(),
  // Machine Serial No / Machine Model — per-line text, but only ever shown
  // (and only ever meaningful) when the HEADER's Purchase Type is 'Machine'
  // (see PURCHASE_TYPE_OPTIONS in purchaseOtherDetailsOptions.js). Unlike a
  // per-line product-driven conditional (e.g. Batch/Serial on GRN), these
  // two are gated purely on a header field that isn't part of this per-line
  // schema at all — so there is nothing to check here. Always optional: the
  // UI's show/hide on GRN/Invoice enforces "only applies to Machine
  // purchases", not a conditional-required refinement.
  machineSerialNo: optionalString(),
  machineModel: optionalString(),
  machineEngineNo: optionalString(),
  // Populated via the "Batches - Setup" / "Serial Numbers - Setup" dialog —
  // see BatchSerialSetupDialog. Only ever shown (and only ever meaningful)
  // when this invoice is direct (no grnNo) — same idea as GRN's own
  // batches/serials fields on goodsReceivedNoteItemSchema above. Whether
  // either is required, and how much of quantity it must add up to, depends
  // on the product's Manage Item By value, which this per-line schema has
  // no access to — that check runs at submit time in PurchaseInvoice.jsx
  // instead (see validateBatchSerialAllocation), gated on isDirectInvoice.
  batches: z.array(productBatchLineSchema).optional().default([]),
  serials: z.array(productSerialLineSchema).optional().default([]),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const purchaseInvoiceSchema = z.object({
  invoiceNo: requiredString('Invoice number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  supplier: requiredString('Supplier'),
  invoiceDate: pastOrTodayDate('Invoice date'),
  // Optional, not required — matching poNo beside it. A supplier invoice does
  // not always arrive behind a goods receipt: it may be billed straight off
  // the purchase order, or be a direct charge with nothing upstream at all.
  // Requiring it here made both impossible to record. The column is nullable
  // in the database, and recomputeGoodsReceivedNote()/recomputePurchaseOrder()
  // in backend/src/utils/documentFlow.js already return early on a blank
  // reference, so such an invoice simply participates in no billing maths.
  grnNo: optionalString(),
  // PO No. no longer has a visible field on this card (removed per business
  // request — same "hidden, not removed" convention as GRN's own PO No./PO
  // Date). It is still written internally by Copy From, and PO-closing/
  // Route Map still resolve off it.
  poNo: optionalString(),
  // Place of Supply has been removed entirely (field, defaultValues and
  // validation) — it was already a print/display-only value: GST treatment
  // (CGST/SGST vs IGST) has always been derived from the supplier's own
  // state (supplierState, below), never from Place of Supply.
  // Where the goods land, on the invoice that actually receives them.
  // Optional at the field level and required by the refinement below, because
  // whether it is required depends on grnNo — see there.
  warehouse: optionalString(),
  currency: requiredString('Currency'),
  paymentTerms: requiredString('Payment terms'),
  dueDate: anyDate('Due date'),
  // Vendor's own reference for this invoice — same field/name as every
  // other purchase document's own vendorRefNo (see
  // PurchaseOtherDetailsCard.jsx).
  vendorRefNo: optionalString(),
  billFrom: optionalString(),
  // Display-only, auto-filled from the selected supplier's own Business
  // Partner record — same data-flow as billFrom above, never hand-typed.
  // See supplierState effect in PurchaseInvoice.jsx. This is what GST
  // treatment (CGST/SGST vs IGST) is derived from now that Place of Supply
  // has been removed from this document entirely.
  supplierState: optionalString(),
  shipTo: optionalString(),
  // "Ship to a different customer" — off (default) leaves shipTo deriving
  // from the selected Branch exactly as before this pair of fields existed.
  // On, shipToCustomer names which Customer's Business Partner Shipping
  // Address was used to derive shipTo — same shape as `supplier` above (a
  // name, not an id), consistent with every other party CFL field in this
  // app. Neither field is re-derived from the other on submit — shipTo is
  // always the already-resolved (and possibly hand-edited) text that
  // actually gets saved/printed; these two only let the form correctly
  // re-show which mode was used on reopen.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  notes: optionalString(),
  termsConditions: optionalString(),
  attachmentName: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  status: requiredString('Status'),
  paymentStatus: requiredString('Payment status'),
  // "Other Details" card — see components/common/PurchaseOtherDetailsCard.jsx.
  // Same fixed-option (CFL) fields as Purchase Order's own Other Details card.
  // billingType is no longer shown on the card (pure UI hide, kept here
  // unchanged). salesType (Payment Method) is now mandatory.
  billingType: optionalString(),
  purchaseType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  purchaseEmployee: optionalString(),
  transportMode: optionalString(),
  // Invoice Type has been removed from every purchase document's UI —
  // no invoiceType field here any more.
  // See the doc comment on purchaseQuotationSchema's own preparedBy/
  // approvedBy above — same Sales-Employee-Select-sourced value, same fix.
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  // Road Tax Amount has been removed from every purchase document's UI and
  // print layout, and no longer feeds the Grand Total — no roadTax field
  // here any more.
  ...freightFields(),

  items: z.array(purchaseInvoiceItemSchema).min(1, 'Add at least one item'),
}).superRefine((val, ctx) => {
  dateRange('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' })(val, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(val, ctx);
  // Warehouse is required exactly when this invoice is the document that
  // moves the stock — billed straight off the purchase order with no GRN
  // behind it. With a GRN, the receipt already put the goods somewhere and
  // this invoice is finance-only, so asking for a warehouse would invite
  // someone to name a second one nothing was ever put into.
  //
  // The server enforces the same rule (assertInvoiceWarehouse in
  // backend/src/routes/resources.js) — this copy is only so the message lands
  // on the field instead of coming back as a failed save.
  //
  // This form has no header-level Warehouse control any more — every line
  // picks its own (see the WarehouseCodeSelect on each item row in
  // PurchaseInvoice.jsx) — so the header `warehouse` value is only ever a
  // fallback for a line left blank; it never gets set by the user directly.
  // Requiring it unconditionally used to block Save on every direct invoice
  // even when every line already named its warehouse. Only complain here
  // when some line is ALSO missing one — the per-line superRefine right
  // below is what actually enforces that.
  if (val.grnNo && String(val.grnNo).trim() !== '') return;
  if (val.warehouse && String(val.warehouse).trim() !== '') return;
  const allLinesHaveWarehouse = (val.items || []).length > 0
    && val.items.every((item) => item.warehouse && String(item.warehouse).trim() !== '');
  if (allLinesHaveWarehouse) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['warehouse'],
    message: 'Warehouse is required when there is no GRN — this invoice receives the stock',
  });
}).superRefine((val, ctx) => {
  // Same rule, per line: a direct invoice (no grnNo) is what actually moves
  // stock, so every line needs to say where it landed. With a GRN behind it
  // the receipt already recorded that, so the per-line field stays optional.
  if (val.grnNo && String(val.grnNo).trim() !== '') return;
  (val.items || []).forEach((item, index) => {
    if (item.warehouse && String(item.warehouse).trim() !== '') return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['items', index, 'warehouse'],
      message: 'Warehouse is required when there is no GRN — this invoice receives the stock',
    });
  });
});

export const INVOICE_STATUS_OPTIONS = ['Draft', 'Posted', 'Cancelled'];
export const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partially Paid', 'Paid'];
