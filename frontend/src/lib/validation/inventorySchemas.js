import { z } from 'zod';
import { requiredString, optionalString, nonNegativeNumber, optionalNonNegativeNumber, anyDate, optionalDate, hsnCode, optionalPersonName, percentage, uniqueItemCodes } from './common';
import { productBatchLineSchema, productSerialLineSchema } from './purchaseSchemas';
import { batchAllocationLineSchema, serialAllocationLineSchema } from './batchSerialSchemas';

// Which Tax Code a line's taxPercent came from — same soft-FK-by-id idiom as
// purchaseSchemas.js's own optionalTaxCodeId (see the comment there): an
// empty Autocomplete emits null (FormSelect), which must stay null rather
// than being coerced to '' since this is an INT column, not a string.
const optionalTaxCodeId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.number({ invalid_type_error: 'Tax code is invalid' }).int().positive().nullable().optional()
);

export const stockReceiptItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  hsnCode: hsnCode(),
  batchNo: optionalString(),
  expiryDate: anyDate('Expiry date').nullable().optional(),
  // Per-line Warehouse — additive alongside the header's own `warehouse`.
  // The header value seeds new rows (see StockReceipt.jsx Add Item / load);
  // this is what actually gets posted per line, header-fallback on the
  // backend for any legacy row saved before this field existed.
  warehouse: requiredString('Warehouse'),
  uom: requiredString('Unit'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Rate'),
  // Same Batch/Serial "Setup" dialog allocation as Purchase GRN — see
  // BatchSerialSetupDialog.jsx and validateBatchSerialAllocation.
  batches: z.array(productBatchLineSchema).optional().default([]),
  serials: z.array(productSerialLineSchema).optional().default([]),
});

export const stockReceiptSchema = z.object({
  receiptNo: requiredString('Receipt number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  receiptType: requiredString('Receipt type'),
  date: anyDate('Receipt date'),
  postingDate: anyDate('Posting date'),
  referenceNo: optionalString(),
  warehouse: requiredString('Warehouse'),
  notes: optionalString(),
  attachmentName: optionalString(),
  remarks: optionalString(),
  status: requiredString('Status'),
  items: z.array(stockReceiptItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  uniqueItemCodes('items', 'productCode', { label: 'Item' })(data, ctx);
});

export const RECEIPT_TYPE_OPTIONS = ['Stock Transfer In', 'Other'];
export const STOCK_RECEIPT_STATUS_OPTIONS = ['Draft', 'Posted', 'Cancelled'];

export const stockIssueItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  hsnCode: hsnCode(),
  batchNo: optionalString(),
  expiryDate: anyDate('Expiry date').nullable().optional(),
  // Per-line Warehouse — additive alongside the header's own `toWarehouse`.
  // The header value seeds new rows; header-fallback on the backend covers
  // any legacy row saved before this field existed. The live
  // quantity<=available-stock check against this warehouse is done outside
  // this static schema (see StockIssue.jsx AvailableStockCell) since it
  // needs a live server fetch.
  warehouse: requiredString('Warehouse'),
  uom: requiredString('Unit'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  // Not rendered as a visible field (valued behind the scenes from the
  // product's cost price / the source Stock Receipt's rate) but must stay in
  // the schema -- react-hook-form's zodResolver silently strips any key not
  // declared here before onSubmit, so without this the rate never reached
  // the backend and every saved issue's total came out as ₹0.00.
  unitPrice: nonNegativeNumber('Rate'),
  // "Batches Number - Selection" / "Serial Numbers - Selection" — see
  // BatchSerialSelectionDialog.jsx and validateBatchSerialAllocation. Only
  // populated when the line's product is Batch/Serial-tracked.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
});

export const stockIssueSchema = z.object({
  issueNo: requiredString('Issue number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  issueType: requiredString('Issue type'),
  date: anyDate('Issue date'),
  postingDate: anyDate('Posting date'),
  referenceNo: optionalString(),
  toWarehouse: requiredString('Warehouse'),
  notes: optionalString(),
  attachmentName: optionalString(),
  remarks: optionalString(),
  status: requiredString('Status'),
  items: z.array(stockIssueItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  uniqueItemCodes('items', 'productCode', { label: 'Item' })(data, ctx);
});

export const ISSUE_TYPE_OPTIONS = ['Material Issue', 'Production Issue', 'Stock Transfer Out', 'Sales Issue', 'Other'];
export const STOCK_ISSUE_STATUS_OPTIONS = ['Draft', 'Posted', 'Cancelled'];

export const stockAdjustmentItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  hsnCode: hsnCode(),
  batchNo: optionalString(),
  expiryDate: anyDate('Expiry date').nullable().optional(),
  // Per-line Warehouse — additive alongside the header's own `warehouse`.
  // The header value seeds new rows; header-fallback on the backend covers
  // any legacy row saved before this field existed. For Decrease lines only,
  // a live quantity<=available-stock check against this warehouse is done
  // outside this static schema (see StockAdjustment.jsx AvailableStockCell)
  // since it needs a live server fetch.
  warehouse: requiredString('Warehouse'),
  uom: requiredString('Unit'),
  currentStock: nonNegativeNumber('Current stock'),
  itemAdjustmentType: requiredString('Adjustment type'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  reason: optionalString(),
  // Valued behind the scenes from the product's cost price, not a visible
  // field. Must stay declared here or zodResolver strips it before onSubmit
  // and every saved adjustment's amount is ₹0.00.
  unitPrice: nonNegativeNumber('Rate'),
});

export const stockAdjustmentSchema = z.object({
  adjustmentNo: requiredString('Adjustment number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  adjustmentType: requiredString('Adjustment type'),
  date: anyDate('Adjustment date'),
  postingDate: anyDate('Posting date'),
  referenceNo: optionalString(),
  warehouse: requiredString('Warehouse'),
  reason: optionalString(),
  attachmentName: optionalString(),
  remarks: optionalString(),
  status: requiredString('Status'),
  items: z.array(stockAdjustmentItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  uniqueItemCodes('items', 'productCode', { label: 'Item' })(data, ctx);
});

export const ADJUSTMENT_TYPE_OPTIONS = ['Increase', 'Decrease'];
export const ITEM_ADJUSTMENT_TYPE_OPTIONS = ['Increase', 'Decrease'];
export const STOCK_ADJUSTMENT_STATUS_OPTIONS = ['Draft', 'Posted', 'Cancelled'];

// Stock Transfer ("Material Transfer") — each line names its OWN From/To
// Warehouse, independently editable in the item table and independently
// validated here; there is no header-level From/To Warehouse (see
// StockTransfer.jsx). Each row's warehouse dropdowns are scoped to whichever
// Branch is selected (WarehouseMaster.branch), which is why Branch itself is
// mandatory: with no branch there is no warehouse list to choose from.
export const stockTransferItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  fromWarehouse: requiredString('Issue Warehouse'),
  // Required for a plain Stock Transfer (the user picks it directly), but
  // NOT for a Branch Transfer — there this column is the destination
  // branch's own Transit Warehouse, auto-filled from WarehouseMaster
  // (isTransit) and not a field the user can edit at all (see
  // TransitWarehouseCell / transitWarehouseCode in StockTransfer.jsx).
  // Making it required here would block Save whenever the destination
  // branch simply has no warehouse flagged as transit yet, with no field
  // for the user to fix. The stockTransferSchema superRefine below enforces
  // it only for the plain Stock Transfer case.
  toWarehouse: optionalString(),
  // Read-only reference figure filled in behind the scenes from the ledger,
  // scoped to this row's own From Warehouse (see the "Total Stock" column) —
  // not part of the transfer's own movement math, but must stay declared
  // here or zodResolver strips it.
  totalStock: nonNegativeNumber('Total stock'),
  uom: requiredString('UoM'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  itemCost: nonNegativeNumber('Item cost'),
  taxPercent: percentage('Tax').optional().default(0),
  taxCodeId: optionalTaxCodeId,
  accountCode: optionalString(),
  project: optionalString(),
  remarks: optionalString(),
  // "Relocate" — which existing batch/serial this line moves. A batch moves
  // whole-row-only (see the schema.prisma comment on ProductBatch: one
  // warehouse per row), so the picker locks a batch's quantity at its full
  // remaining amount rather than letting it be split. See
  // BatchSerialSelectionDialog.jsx (lockBatchQuantity) and
  // assertWholeBatchRelocation in businessRules.js.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
}).refine((data) => !data.toWarehouse || data.fromWarehouse !== data.toWarehouse, {
  message: 'From and To Warehouse must be different',
  path: ['toWarehouse'],
});

export const stockTransferSchema = z.object({
  transferNo: requiredString('Material Transfer No.'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  // Mandatory: it is what scopes every warehouse choice on this document —
  // each item row's own From/To Warehouse (there is no header-level pair).
  // Doubles as "From Branch" when transferType is 'Branch Transfer' (see
  // toBranch below and the superRefine at the bottom of this schema).
  branch: requiredString('Branch'),
  // "To Branch" — only meaningful (and only required) when transferType is
  // 'Branch Transfer'; blank/unused for a plain 'Stock Transfer'.
  toBranch: optionalString(),
  transferType: requiredString('Type'),
  // Optional link back to the Stock Transfer Request this transfer is
  // fulfilling — a plain string match against stock_transfer_requests.
  // request_no (see StockTransfer.jsx), same convention as
  // goods_received_notes.po_no -> purchase_orders.po_no. Only requests
  // still Open are offered in the picker.
  requestNo: optionalString(),
  status: requiredString('Status'),
  // Business Partner reference — purely informational, no ledger effect.
  partyCode: optionalString(),
  partyName: optionalString(),
  contactPerson: optionalPersonName('Contact person'),
  shipTo: optionalString(),
  priceList: optionalString(),
  project: optionalString(),
  requestDate: anyDate('Request date'),
  documentDate: anyDate('Document date'),
  // A Select sourced from the User master, not free-typed text — its value
  // legitimately falls back to a user's email when they have no display
  // name set (see preparedByOptions in StockTransfer.jsx), and personName's
  // letters-only format guard rejects the '@' in that email outright. That
  // silently failed schema validation with no visible field error (the
  // Select never renders one for a value it never rejects on its own) and
  // left the Save button permanently disabled with no clue why. The format
  // guard belongs on genuinely free-typed name fields (contactPerson,
  // right above); a value drawn verbatim from an existing user record just
  // needs to be present.
  preparedBy: requiredString('Prepared by'),
  journalRemarks: optionalString(),
  remarks: optionalString(),
  attachmentName: optionalString(),
  items: z.array(stockTransferItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  uniqueItemCodes('items', 'productCode', { label: 'Item' })(data, ctx);
  // Plain Stock Transfer: the destination is a manual per-row choice
  // (the "To Whse *" column), so it's required there. Branch Transfer:
  // that same column is instead the auto-filled Transit Warehouse — not
  // user-editable — so it stays optional (see the comment on
  // stockTransferItemSchema.toWarehouse above).
  if (data.transferType !== 'Branch Transfer') {
    (data.items || []).forEach((item, idx) => {
      if (!item.toWarehouse) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', idx, 'toWarehouse'], message: 'To Warehouse is required' });
      }
    });
    return;
  }
  if (!data.toBranch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toBranch'], message: 'To Branch is required' });
  } else if (data.toBranch === data.branch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toBranch'], message: 'From and To Branch must be different' });
  }
});

export const TRANSFER_TYPE_OPTIONS = ['Stock Transfer', 'Branch Transfer'];
// Just two states — Open (raised, not yet moved) and Closed (posted: stock
// moved, GL journalled). Renamed from Draft/Closed: status is no longer a
// manual choice on save at all (see StockTransfer.jsx, which always saves
// Open) — a transfer only closes once a Stock Transfer Receipt confirms the
// goods arrived (see syncStockTransferClosure in routes/resources.js). The
// backend's stock-posting logic (utils/stockTable.js / stockLedger.js)
// decides "did this move stock" by EXCLUDING Open/Draft/Cancelled/Pending
// rather than by matching 'Closed' literally, so this rename needed no
// other backend change beyond adding 'Open' to that exclusion list.
export const STOCK_TRANSFER_STATUS_OPTIONS = ['Open', 'Closed'];

// Stock Transfer Request — a pure paperwork/reference document (no ledger
// effect, no batch/serial allocation). Each line names a single Warehouse
// (stored in the `toWarehouse` column — the destination the stock is being
// requested for) rather than the From/To pair Stock Transfer itself uses;
// there used to be a matching `fromWarehouse` column here too, dropped at
// the user's request since a request only needs the one warehouse.
//
// Tax (%) is a Tax Code CFL, same convention as Stock Transfer/Stock
// Transfer Receipt's own — see buildTaxCodeOptions: keyed by taxCodeId (not
// the rate), so two Tax Codes that happen to share a rate both still show up
// in the dropdown. Still no ledger/GL posting of its own; the tax is purely
// for costing this request's own Total Request Value (see computeTotals in
// StockTransferRequest.jsx).
export const stockTransferRequestItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  // Required for a plain 'Stock Transfer' only — a 'Branch Transfer' request
  // has no Warehouse column at all. Enforced in stockTransferRequestSchema's
  // superRefine below, which can see the header's transferType.
  toWarehouse: optionalString(),
  uom: requiredString('UoM'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  // Read-only reference figure showing how much of this line has already
  // been transferred against a Stock Transfer Receipt — not part of this
  // request's own math, but must stay declared here or zodResolver strips it.
  transferredQuantity: optionalNonNegativeNumber('Transferred quantity'),
  unitPrice: nonNegativeNumber('Unit price'),
  itemCost: nonNegativeNumber('Item cost'),
  taxPercent: percentage('Tax').optional().default(0),
  taxCodeId: optionalTaxCodeId,
  accountCode: optionalString(),
  project: optionalString(),
  remarks: optionalString(),
});

export const stockTransferRequestSchema = z.object({
  requestNo: requiredString('Request No.'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  // Doubles as "From Branch" when transferType is 'Branch Transfer' — see
  // toBranch below. For a plain 'Stock Transfer' it is simply "the Branch".
  branch: requiredString('Branch'),
  // "To Branch" — only meaningful (and only required) when transferType is
  // 'Branch Transfer'; blank/unused for a plain 'Stock Transfer'.
  toBranch: optionalString(),
  transferType: requiredString('Type'),
  status: requiredString('Status'),
  // Business Partner reference — purely informational, no ledger effect.
  partyCode: optionalString(),
  partyName: optionalString(),
  contactPerson: optionalPersonName('Contact person'),
  project: optionalString(),
  requestDate: anyDate('Request date'),
  documentDate: anyDate('Document date'),
  // Select sourced from the User master — see the identical note on
  // stockTransferSchema's own preparedBy just above it in this file.
  preparedBy: requiredString('Prepared by'),
  remarks: optionalString(),
  attachmentName: optionalString(),
  items: z.array(stockTransferRequestItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  uniqueItemCodes('items', 'productCode', { label: 'Item' })(data, ctx);
  if (data.transferType !== 'Branch Transfer') {
    (data.items || []).forEach((item, idx) => {
      if (!String(item.toWarehouse || '').trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', idx, 'toWarehouse'], message: 'Warehouse is required' });
      }
    });
    return;
  }
  if (!data.toBranch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toBranch'], message: 'To Branch is required' });
  } else if (data.toBranch === data.branch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toBranch'], message: 'From and To Branch must be different' });
  }
});

// Just Open/Closed per request — a request is either still awaiting a Stock
// Transfer to be raised against it, or it's done. 'Partially Transferred'
// and 'Cancelled' were dropped; this document has no ledger effect either
// way (see the file-level note above), so this is a pure relabelling with
// no backend logic depending on the old values.
export const STOCK_TRANSFER_REQUEST_STATUS_OPTIONS = ['Open', 'Closed'];

// Stock Transfer Receipt — the confirmation side of a Stock Transfer
// Request/Stock Transfer: `transferNo` is a plain string reference to an
// existing Stock Transfer document (no FK), while `receiptNo` is this
// document's own number. Also a pure paperwork/reference document.
export const stockTransferReceiptItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  // From Warehouse is required for a plain 'Stock Transfer' only — a Branch
  // Transfer receipt hides the column (it is still carried over from the
  // source transfer line when one is picked). Enforced in
  // stockTransferReceiptSchema's superRefine, which sees the header's type.
  fromWarehouse: optionalString(),
  toWarehouse: requiredString('To Warehouse'),
  uom: requiredString('UoM'),
  // Read-only reference qty from the source Stock Transfer line.
  transferQuantity: optionalNonNegativeNumber('Transfer quantity'),
  // This receipt's own confirmed quantity.
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  itemCost: nonNegativeNumber('Item cost'),
  taxPercent: percentage('Tax').optional().default(0),
  taxCodeId: optionalTaxCodeId,
  accountCode: optionalString(),
  project: optionalString(),
  remarks: optionalString(),
});

export const stockTransferReceiptSchema = z.object({
  receiptNo: requiredString('Receipt No.'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  // Doubles as "From Branch" when transferType is 'Branch Transfer' — see
  // toBranch below, same convention as stockTransferSchema/
  // stockTransferRequestSchema. For a plain 'Stock Transfer' it is simply
  // "the Branch".
  branch: requiredString('Branch'),
  // "To Branch" — only meaningful (and only required) when transferType is
  // 'Branch Transfer'; blank/unused for a plain 'Stock Transfer'. Usually
  // auto-filled from whichever source Stock Transfer is picked (see
  // StockTransferReceipt.jsx), but stays independently editable.
  toBranch: optionalString(),
  transferType: requiredString('Type'),
  status: requiredString('Status'),
  // Plain string reference to an existing Stock Transfer Request's
  // requestNo — no FK, purely informational, same convention as transferNo
  // just below (which references a Stock Transfer instead).
  requestNo: optionalString(),
  // Plain string reference to an existing Stock Transfer's transferNo — no
  // FK, purely informational.
  transferNo: optionalString(),
  transferDate: optionalDate('Transfer date'),
  partyCode: optionalString(),
  partyName: optionalString(),
  contactPerson: optionalPersonName('Contact person'),
  project: optionalString(),
  documentDate: anyDate('Document date'),
  // Select sourced from the User master — see the identical note on
  // stockTransferSchema's own preparedBy earlier in this file.
  preparedBy: requiredString('Prepared by'),
  remarks: optionalString(),
  attachmentName: optionalString(),
  items: z.array(stockTransferReceiptItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  uniqueItemCodes('items', 'productCode', { label: 'Item' })(data, ctx);
  // Same Branch Transfer rule as stockTransferSchema/stockTransferRequestSchema
  // above — To Branch only matters (and is only required) once Type is
  // switched to 'Branch Transfer'.
  if (data.transferType !== 'Branch Transfer') {
    (data.items || []).forEach((item, idx) => {
      if (!String(item.fromWarehouse || '').trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', idx, 'fromWarehouse'], message: 'From Warehouse is required' });
      }
    });
    return;
  }
  if (!data.toBranch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toBranch'], message: 'To Branch is required' });
  } else if (data.toBranch === data.branch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toBranch'], message: 'From and To Branch must be different' });
  }
});

export const STOCK_TRANSFER_RECEIPT_STATUS_OPTIONS = ['Draft', 'Confirmed', 'Cancelled'];
