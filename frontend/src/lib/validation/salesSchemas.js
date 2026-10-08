import { z } from 'zod';
import {
  requiredString, optionalString, optionalEmail, optionalMobileNumber, mobileNumberAnyPrefix,
  nonNegativeNumber, currencyAmount, percentage, optionalPercentage, anyDate, optionalDate as sharedOptionalDate,
  pastOrTodayDate, futureOrTodayDate, dateRange,
  personName, optionalPersonName, entityName, optionalEntityName,
  hsnCode, pincode,
  baseDocumentFields,
  freightFields,
  optionalNonNegativeNumber,
  uniqueItemCodes,
  requireMachineSerialNoWhenMachine,
  requireWarehouseUnlessNonStockCategory,
  isNonStockSalesCategory,
  requireLineWarehouseUnlessClaims,
} from './common';
import { batchAllocationLineSchema, serialAllocationLineSchema } from './batchSerialSchemas';

// Which Tax Code a line's taxPercent came from — see the schema.prisma
// comment on e.g. SalesQuotationItem.taxCodeId. Nullable FK-by-id, same
// preprocess-to-null idiom as SalesEmployee.jsx's own optionalDepartmentId:
// an empty Autocomplete emits null (see FormSelect), which must stay null
// rather than being coerced to '' (this is an INT column, not a string).
// Optional — a hand-typed/legacy line with no matching Tax Code still saves.
const optionalTaxCodeId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.number({ invalid_type_error: 'Tax code is invalid' }).int().positive().nullable().optional()
);

export const salesQuotationItemSchema = z.object({
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
  // Which warehouse this line would ship from once ordered/delivered. No
  // header warehouse exists on a Quotation to seed this from, so the row
  // simply starts blank until picked. Declared here so it actually survives
  // to the saved record — zod strips whatever a schema does not declare, and
  // this field was missing entirely, so every line's Warehouse pick was
  // silently dropped from the save and came back blank on edit/view.
  warehouse: optionalString(), // required unless Claims -- see requireLineWarehouseUnlessClaims
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const salesQuotationSchema = z.object({
  quotationNo: requiredString('Quotation number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),

  branch: requiredString('Branch'),
  customer: requiredString('Customer'),
  // Business Partner (Vendor) picked purely so their logo can be printed
  // next to the KEMACH logo on this quotation's printout — see
  // SalesQuotation.jsx's Supplier field and SalesQuotationPrintable.jsx.
  // Optional: unrelated to whether the quotation itself is valid.
  supplier: optionalString(),
  contactPerson: optionalPersonName('Contact person'),
  gstNo: optionalString(),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  quotationDate: anyDate('Quotation date'),
  expiryDate: futureOrTodayDate('Valid till'),
  // The enquiry this quotation answers — the first hop of the sales chain the
  // Route Map draws. Optional: quotations raised without an enquiry behind
  // them are normal, and every quotation that predates this field has none.
  enquiryNo: optionalString(),
  referenceNo: optionalString(),
  customerRefNo: optionalString(),
  // Display-only, auto-filled from the customer's Business Partner billing
  // address; drives CGST/SGST vs IGST (see customerState in the Sales pages).
  customerState: optionalString(),
  currency: requiredString('Currency'),
  priceList: optionalString(),
  receiver: optionalString(),
  receiverPhone: optionalString(),
  billingAddress: optionalString(),
  shippingAddress: optionalString(),
  // "Ship to a different customer" (SalesShipTo): declared so zod doesn't strip them.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  billToDifferentCustomer: z.boolean().optional(),
  billToCustomer: optionalString(),
  billToGstNo: optionalString(),
  billToGstType: optionalString(),
  billToPanNo: optionalString(),
  shipToGstNo: optionalString(),
  shipToGstType: optionalString(),
  shipToPanNo: optionalString(),
  salesPerson: requiredString('Sales person'),
  // Machinery picked from the selected customer's Business Partner
  // "Machineries" tab (see MachineryCodeSelect.jsx) — optional, since not
  // every customer has machineries set up. Declared here so it actually
  // survives to the saved record (zod strips whatever a schema does not
  // declare — same bug class every other field-added-here comment above
  // documents).
  machineryCode: optionalString(),
  termsConditions: optionalString(),
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  attachmentName: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  status: requiredString('Status'),

  // "Other Details" classification fields — fixed-option (CFL) selects, same
  // vocabulary as Purchase Order's own "Other Details" section (see
  // BILLING_TYPE_OPTIONS etc. on SalesQuotation.jsx); Invoice Type has no
  // Purchase Order counterpart.
  billingType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  salesCategory: optionalString(),
  machineSerialNo: optionalString(), // required only when salesCategory === 'Machine' -- see requireMachineSerialNoWhenMachine below
  engineNo: optionalString(),
  hypothecation: optionalString(),
  transportMode: optionalString(),
  invoiceType: optionalString(),
  ...freightFields(),
  // Road Tax Yes/No toggle — see schema.prisma's roadTaxApplicable comment
  // on SalesQuotation. Declared here so it actually survives to the saved
  // record — zod strips whatever a schema does not declare.
  roadTaxApplicable: z.boolean().optional(),

  items: z.array(salesQuotationItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('quotationDate', 'expiryDate', { startLabel: 'Quotation date', endLabel: 'Valid till' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
  requireMachineSerialNoWhenMachine()(data, ctx);
  requireLineWarehouseUnlessClaims()(data, ctx);
});

// Document-flow status: Open until a Sales Order is raised from this
// quotation, then Closed. Set server-side (recomputeSalesQuotationStatus in
// backend utils/documentFlow.js), never chosen on the form — the older
// Draft/Sent/Pending/Accepted/Rejected/Expired vocabulary described a
// negotiation the app never actually tracked, and no two of those values
// changed anything the system did.
export const QUOTATION_STATUS_OPTIONS = ['Open', 'Closed'];

export const salesOrderItemSchema = z.object({
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
  // Which warehouse this line ships from once delivered/invoiced. No header
  // warehouse exists on an Order to seed this from, so the row simply starts
  // blank until picked. Declared here so it actually survives to the saved
  // record — zod strips whatever a schema does not declare, and this field
  // was missing entirely, so every line's Warehouse pick was silently
  // dropped from the save and came back blank on edit/view.
  //
  // Optional at the field level; required by the parent schema's
  // requireWarehouseUnlessNonStockCategory() refinement below, except when
  // salesCategory is Claims/Services — see isNonStockSalesCategory in
  // common.js. The field itself is hidden on the page for those categories.
  warehouse: optionalString(),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const salesOrderSchema = z.object({
  orderNo: requiredString('Order number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  customer: requiredString('Customer'),
  // Business Partner (Vendor) picked purely so their logo can be printed
  // next to the KEMACH logo on this order's printout — see SalesOrder.jsx's
  // Supplier field and SalesOrderPrintable.jsx.
  supplier: optionalString(),
  contactPerson: optionalPersonName('Contact person'),
  gstNo: optionalString(),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  orderDate: anyDate('Order date'),
  deliveryDate: futureOrTodayDate('Delivery date'),
  // The quotation this order came from. The form has offered this dropdown all
  // along, but the field was missing from this schema — and zod strips whatever
  // it does not declare — so the selection was used to copy the quotation's
  // customer and lines across and was then dropped from the payload before the
  // request was sent. Nothing downstream could tell which quotation an order
  // came from, which is what left the Route Map unable to join the two.
  // Declared here (and added to the sales_orders table) so it actually saves.
  quotationNo: optionalString(),
  referenceNo: optionalString(),
  customerRefNo: optionalString(),
  // Display-only, auto-filled from the customer's Business Partner billing
  // address; drives CGST/SGST vs IGST (see customerState in the Sales pages).
  customerState: optionalString(),
  currency: requiredString('Currency'),
  paymentTerms: optionalString(),
  // Labelled "Sales Person *" on the page — was optionalString() here, so
  // (same bug class as enquirySchema) the asterisk was decorative and the
  // field could never fail validation, so it could never show an error on
  // blur either.
  salesPerson: requiredString('Sales person'),
  source: optionalString(),
  // See salesQuotationSchema's own comment on this field.
  machineryCode: optionalString(),
  receiver: optionalString(),
  receiverPhone: optionalString(),
  billingAddress: optionalString(),
  shippingAddress: optionalString(),
  // "Ship to a different customer" (SalesShipTo): declared so zod doesn't strip them.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  billToDifferentCustomer: z.boolean().optional(),
  billToCustomer: optionalString(),
  billToGstNo: optionalString(),
  billToGstType: optionalString(),
  billToPanNo: optionalString(),
  shipToGstNo: optionalString(),
  shipToGstType: optionalString(),
  shipToPanNo: optionalString(),
  // New "Delivery Address" field — distinct from Shipping Address/Billing
  // Address, see the "Customer & Document Details" layout on SalesOrder.jsx.
  deliveryAddress: optionalString(),
  termsConditions: optionalString(),
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  remarks: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  status: requiredString('Status'),
  paymentStatus: requiredString('Payment status'),
  invoiceNo: optionalString(),

  // "Other Details" classification fields — same vocabulary AND same field
  // set as Purchase Order's own "Other Details" section (see the *_OPTIONS
  // constants on SalesOrder.jsx). vehicleType once replaced the form's old
  // Invoice Type field; both are visible now — Invoice Type is back as the
  // shared master-backed <InvoiceTypeField />, last cell of the card.
  billingType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  salesCategory: optionalString(),
  machineSerialNo: optionalString(), // required only when salesCategory === 'Machine' -- see requireMachineSerialNoWhenMachine below
  engineNo: optionalString(),
  hypothecation: optionalString(),
  vehicleType: optionalString(),
  transportMode: optionalString(),
  invoiceType: optionalString(),
  roadTax: optionalNonNegativeNumber('Road tax'),
  // Road Tax Yes/No toggle — see schema.prisma's roadTaxApplicable comment
  // on SalesOrder. Gates whether roadTax above is applied at all.
  roadTaxApplicable: z.boolean().optional(),
  ...freightFields(),

  items: z.array(salesOrderItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('orderDate', 'deliveryDate', { startLabel: 'Order date', endLabel: 'Delivery date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
  requireMachineSerialNoWhenMachine()(data, ctx);
  requireWarehouseUnlessNonStockCategory()(data, ctx);
});

export const ORDER_STATUS_OPTIONS = ['Draft', 'Confirmed', 'Pending', 'Shipped', 'Delivered', 'Cancelled'];
export const ORDER_PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partially Paid', 'Paid'];

export const deliveryChallanItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .gt(0, 'Quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  // No visible Discount % column on this document's item table (a despatch
  // note isn't where pricing gets negotiated) -- but the column already
  // exists on delivery_challan_items in the database, and every other sales
  // document's line discount is declared here the same way. Left out of this
  // schema entirely, a Copy From/To'd line's own discount was silently
  // stripped before the request even left the browser (zod drops whatever a
  // schema does not declare), so a challan copied from a discounted
  // quotation/order priced its lines off the undiscounted amount and came
  // out higher than the document it was copied from. Declaring it keeps it
  // flowing end to end -- carried on Copy From/To, saved, reloaded on edit,
  // and folded into this page's own totals -- entirely off-screen.
  discountPercent: optionalPercentage('Discount'),
  taxPercent: percentage('Tax %').optional().default(0),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse this line ships out of — defaults to the header's own
  // (required) From Warehouse when a row is added, but can be picked per
  // line. Declared here so it actually survives to the saved record — zod
  // strips whatever a schema does not declare, and this field was missing
  // entirely, so every line's Warehouse pick was silently dropped from the
  // save and came back blank on edit/view.
  //
  // Optional at the field level; required by the parent schema's
  // requireWarehouseUnlessNonStockCategory() refinement below, except when
  // salesCategory is Claims/Services — see isNonStockSalesCategory in
  // common.js. The field itself is hidden on the page for those categories.
  warehouse: optionalString(),
  // "Batches Number - Selection" / "Serial Numbers - Selection" — see
  // BatchSerialSelectionDialog.jsx and validateBatchSerialAllocation. Only
  // populated when the line's product is Batch/Serial-tracked.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const deliveryChallanSchema = z.object({
  challanNo: requiredString('Challan number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  customer: requiredString('Customer'),
  // Business Partner (Vendor) picked purely so their logo can be printed
  // next to the KEMACH logo on this challan's printout — see
  // DeliveryChallan.jsx's Supplier field and DeliveryChallanPrintable.jsx.
  supplier: optionalString(),
  contactPerson: optionalPersonName('Contact person'),
  gstNo: optionalString(),
  orderNo: optionalString(),
  customerRefNo: optionalString(),
  // Display-only, auto-filled from the customer's Business Partner billing
  // address; drives CGST/SGST vs IGST (see customerState in the Sales pages).
  customerState: optionalString(),
  challanDate: anyDate('Challan date'),
  deliveryDate: futureOrTodayDate('Delivery date'),
  currency: requiredString('Currency'),
  // Optional at the header, not required. This form has no visible input for
  // it (see the comment on the Customer & Document Details card below) — it
  // exists only to seed a new item row's own Warehouse (see emptyItem above)
  // and as postStockEntries' document-level fallback for a line somehow left
  // without one. Every line's own Warehouse is already required (see
  // deliveryChallanItemSchema.warehouse) and is what the stock movement
  // actually posts against, so this being blank is not an error — requiring
  // it unconditionally blocked Save on every challan created directly (there
  // was no way to fill it in), since nothing ever set it except the
  // branch-change effect that only ever clears it.
  fromWarehouse: optionalString(),
  salesPerson: requiredString('Sales person'),
  // See salesQuotationSchema's own comment on this field.
  machineryCode: optionalString(),
  receiver: optionalString(),
  receiverPhone: optionalString(),
  billingAddress: optionalString(),
  shippingAddress: optionalString(),
  // "Ship to a different customer" (SalesShipTo): declared so zod doesn't strip them.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  billToDifferentCustomer: z.boolean().optional(),
  billToCustomer: optionalString(),
  billToGstNo: optionalString(),
  billToGstType: optionalString(),
  billToPanNo: optionalString(),
  shipToGstNo: optionalString(),
  shipToGstType: optionalString(),
  shipToPanNo: optionalString(),
  termsConditions: optionalString(),
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  remarks: optionalString(),
  status: requiredString('Status'),

  // "Other Details" classification fields — same vocabulary as Purchase
  // Order's own "Other Details" section (see the *_OPTIONS constants on
  // DeliveryChallan.jsx); Invoice Type has no Purchase Order counterpart.
  billingType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  salesCategory: optionalString(),
  machineSerialNo: optionalString(), // required only when salesCategory === 'Machine' -- see requireMachineSerialNoWhenMachine below
  engineNo: optionalString(),
  // Required CFL-style classification of what this despatch is actually for
  // (Warranty / Good will Warranty / FOC / Goodwill FOC / attachments /
  // Claims) -- see TYPE_OF_DC_OPTIONS on DeliveryChallan.jsx. Independent of
  // salesCategory (that's about what kind of goods are moving, this is
  // about why they're moving), so unlike machineSerialNo it's required
  // unconditionally rather than only in a particular salesCategory.
  typeOfDc: requiredString('Type of DC'),
  // Only shown (and only required) when Type of DC is 'Warranty' -- see
  // TYPE_OF_DC_OPTIONS/the BOB Link No. field on DeliveryChallan.jsx.
  // Optional here at the schema-field level; the superRefine below is what
  // actually makes it mandatory, conditionally, same pattern as
  // requireMachineSerialNoWhenMachine just above.
  bobLinkNo: optionalString(),
  hypothecation: optionalString(),
  transportMode: optionalString(),
  invoiceType: optionalString(),
  // No visible Road Tax field on this document (unlike Sales Quotation/
  // Order's own toggle, or Sales Invoice/Return/Credit Memo's manual
  // amount) -- declared purely so a challan copied from a document that DOES
  // have Road Tax applied has somewhere to carry that figure, and this
  // page's own totals still add up to the same Grand Total as the document
  // it was copied from. See deliveryChallanItemSchema's own discountPercent
  // comment for the same reasoning.
  roadTax: optionalNonNegativeNumber('Road tax'),
  roadTaxApplicable: z.boolean().optional(),

  items: z.array(deliveryChallanItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('challanDate', 'deliveryDate', { startLabel: 'Challan date', endLabel: 'Delivery date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
  requireMachineSerialNoWhenMachine()(data, ctx);
  requireWarehouseUnlessNonStockCategory()(data, ctx);
  // BOB Link No. is mandatory only on a Warranty despatch -- the field
  // itself is hidden for every other Type of DC (see DeliveryChallan.jsx),
  // so there's nothing to require there.
  if (data?.typeOfDc === 'Warranty' && !String(data?.bobLinkNo || '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'BOB Link No. is required',
      path: ['bobLinkNo'],
    });
  }
});

// 'Pending' is the pre-despatch staging state behind "Save as Draft" — no
// stock has posted yet. 'Open' means despatched but not yet fully invoiced,
// 'Closed' fully invoiced (recomputeDeliveryChallanStatus in backend
// utils/documentFlow.js). 'Cancelled' is unchanged and still excludes the
// challan from stock and from the order's delivered quantity. The old
// Dispatched/Partially Delivered/Delivered trio is gone: how much has shipped
// is the ORDER's business (it keeps its quantity-based status), not the
// challan's — a challan is a single despatch event.
export const CHALLAN_STATUS_OPTIONS = ['Pending', 'Open', 'Closed', 'Cancelled'];

export const salesInvoiceItemSchema = z.object({
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
  // Which warehouse THIS LINE issues from. Optional at the field level and
  // required by the parent schema's refinement only when the invoice has no
  // deliveryChallanNo (a direct invoice, which is the document that actually
  // moves stock) — see salesInvoiceSchema's superRefine below, mirroring the
  // existing header-level warehouse requirement. Declared here so it
  // actually survives to the saved record — zod strips whatever a schema
  // does not declare, and this field was missing entirely, so every line's
  // Warehouse pick was silently dropped from the save and came back blank
  // on edit/view.
  warehouse: optionalString(),
  // Populated via the "Batches Number - Selection" / "Serial Numbers -
  // Selection" dialog — see BatchSerialSelectionDialog. Only ever shown (and
  // only ever meaningful) when this invoice is direct (no deliveryChallanNo)
  // — same idea as Delivery Challan's own batchAllocations/serialAllocations
  // fields on deliveryChallanItemSchema above. Whether either is required,
  // and how much of quantity it must add up to, depends on the product's
  // Manage Item By value, which this per-line schema has no access to —
  // that check runs at submit time in SalesInvoice.jsx instead (see
  // validateBatchSerialAllocation), gated on isDirectInvoice.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
});

export const salesInvoiceSchema = z.object({
  invoiceNo: requiredString('Invoice number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),

  branch: requiredString('Branch'),
  customer: requiredString('Customer'),
  contactPerson: optionalPersonName('Contact person'),
  gstNo: optionalString(),
  // Business Partner (Vendor) picked purely so their logo can be printed
  // next to the KEMACH logo on this invoice's printout — see
  // SalesInvoice.jsx's Supplier field and SalesInvoicePrintable.jsx.
  supplier: optionalString(),
  invoiceDate: pastOrTodayDate('Invoice date'),
  orderNo: optionalString(),
  orderDate: anyDate('Sales order date').nullable().optional(),
  deliveryChallanNo: optionalString(),
  challanDate: anyDate('Delivery challan date').nullable().optional(),
  customerRefNo: optionalString(),
  // Display-only, auto-filled from the customer's Business Partner billing
  // address; drives CGST/SGST vs IGST (see customerState in the Sales pages).
  customerState: optionalString(),
  dueDate: anyDate('Due date'),
  // Where the goods are issued from, on the invoice that actually despatches
  // them. Optional at the field level and required by the refinement below,
  // because whether it is required depends on deliveryChallanNo.
  warehouse: optionalString(),
  currency: requiredString('Currency'),
  paymentTerms: requiredString('Payment terms'),
  salesPerson: requiredString('Sales person'),
  source: optionalString(),
  // See salesQuotationSchema's own comment on this field.
  machineryCode: optionalString(),
  // No visible input on SalesInvoice.jsx — it auto-fills from the selected
  // customer's Billing address state (see the customer-change effect there)
  // and has no field of its own for the user to set or fix it by hand, so it
  // must stay optional or an invoice whose auto-fill comes up empty (e.g. no
  // Billing address on file) is stuck on Save with nothing to correct.
  placeOfSupply: optionalString(),
  receiver: optionalString(),
  receiverPhone: optionalString(),
  billingAddress: optionalString(),
  shippingAddress: optionalString(),
  // "Ship to a different customer" (SalesShipTo): declared so zod doesn't strip them.
  shipToDifferentCustomer: z.boolean().optional(),
  shipToCustomer: optionalString(),
  billToDifferentCustomer: z.boolean().optional(),
  billToCustomer: optionalString(),
  billToGstNo: optionalString(),
  billToGstType: optionalString(),
  billToPanNo: optionalString(),
  shipToGstNo: optionalString(),
  shipToGstType: optionalString(),
  shipToPanNo: optionalString(),
  termsConditions: optionalString(),
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  remarks: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  status: requiredString('Status'),
  paymentStatus: requiredString('Payment status'),

  // "Other Details" classification fields — same vocabulary as Purchase
  // Order's own "Other Details" section (see the *_OPTIONS constants on
  // SalesInvoice.jsx); Invoice Type has no Purchase Order counterpart.
  billingType: optionalString(),
  typeOfPurchase: optionalString(),
  salesType: requiredString('Payment method'),
  salesCategory: optionalString(),
  // Not required for Machine, Claims or Services -- see
  // requireMachineSerialNoWhenMachine below (Sales Invoice's own call
  // additionally exempts 'Services': a service line isn't necessarily
  // billed against one specific machine).
  machineSerialNo: optionalString(),
  engineNo: optionalString(),
  hypothecation: optionalString(),
  transportMode: optionalString(),
  invoiceType: optionalString(),
  roadTax: optionalNonNegativeNumber('Road tax'),
  ...freightFields(),

  items: z.array(salesInvoiceItemSchema).min(1, 'Add at least one item'),
}).superRefine((val, ctx) => {
  dateRange('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' })(val, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(val, ctx);
  requireMachineSerialNoWhenMachine({ exemptCategories: ['Machine', 'Claims', 'Services'] })(val, ctx);
  // Required exactly when this invoice is the document that moves the stock —
  // billed straight off the sales order with no delivery challan behind it.
  // With a challan, the despatch already took the goods out of its own
  // warehouse and this invoice is finance-only.
  //
  // Mirrors assertInvoiceWarehouse in backend/src/routes/resources.js; this
  // copy exists so the message lands on the field rather than arriving as a
  // failed save.
  //
  // This form has no header-level Warehouse control any more — every line
  // picks its own (see the WarehouseCodeSelect on each item row in
  // SalesInvoice.jsx) — so the header `warehouse` value is only ever a
  // fallback for a line left blank; it never gets set by the user directly.
  // Requiring it unconditionally used to block Save on every direct invoice
  // even when every line already named its warehouse, with a "Warehouse"
  // tooltip nobody could act on since there was nowhere left to fill it in.
  // Only complain here when some line is ALSO missing one — the per-line
  // superRefine right below is what actually enforces that.
  if (isNonStockSalesCategory(val.salesCategory)) return;
  if (val.deliveryChallanNo && String(val.deliveryChallanNo).trim() !== '') return;
  if (val.salesCategory === 'Claims') return; // Claims move no stock
  if (val.warehouse && String(val.warehouse).trim() !== '') return;
  const allLinesHaveWarehouse = (val.items || []).length > 0
    && val.items.every((item) => item.warehouse && String(item.warehouse).trim() !== '');
  if (allLinesHaveWarehouse) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['warehouse'],
    message: 'Warehouse is required when there is no Delivery Challan — this invoice issues the stock',
  });
}).superRefine((val, ctx) => {
  if (val.salesCategory === 'Claims') return; // Claims move no stock
  // Same rule, per line: a direct invoice (no deliveryChallanNo) is what
  // actually moves stock, so every line needs to say where it issued from.
  // With a challan behind it the despatch already recorded that, so the
  // per-line field stays optional.
  if (isNonStockSalesCategory(val.salesCategory)) return;
  if (val.deliveryChallanNo && String(val.deliveryChallanNo).trim() !== '') return;
  (val.items || []).forEach((item, index) => {
    if (item.warehouse && String(item.warehouse).trim() !== '') return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['items', index, 'warehouse'],
      message: 'Warehouse is required when there is no Delivery Challan — this invoice issues the stock',
    });
  });
});

export const SALES_INVOICE_STATUS_OPTIONS = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
export const SALES_INVOICE_PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partially Paid', 'Paid'];

// Enquiry / Follow-up — flat records (see tempmem.md's Reference
// implementations note). Optional number/date fields use the z.preprocess
// idiom from HouseBank/SalesEmployee so empty-string/null from
// FormTextField/FormDatePicker doesn't get rejected as "not a number"/"not a date".
const optionalNumber = () => z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().optional());
const optionalDate = () => sharedOptionalDate();

export const enquirySchema = z.object({
  enquiryNo: requiredString('Enquiry number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  // These four are marked with a "*" on the Enquiry page (Enquiry Date,
  // Source of Enquiry, Subject/Requirement, Requirement/Description) — they
  // were left as optional() here, which meant the asterisk was pure
  // decoration: the field could never fail validation, so it could never
  // show an error either, no matter how long the required-field fix (the
  // onTouched mode + FormSelect's onBlur wiring) worked correctly elsewhere.
  // Making them actually required here is what makes that fix visible on
  // this page.
  enquiryDate: anyDate('Enquiry date'),
  sourceOfEnquiry: requiredString('Source of enquiry'),
  enquiryType: optionalString(),
  priority: optionalString(),
  subject: requiredString('Subject / Requirement'),
  referenceCampaign: optionalString(),

  customerName: entityName('Customer name'),
  contactPerson: personName('Contact person'),
  // Enquiry deliberately accepts any 10-digit number here, not just Indian
  // mobile ranges (6-9 leading digit) — see mobileNumberAnyPrefix in common.js.
  mobileNo: mobileNumberAnyPrefix('Mobile number'),
  emailId: optionalEmail(),
  address: optionalString(),
  city: optionalString(),
  state: optionalString(),
  pinCode: pincode('PIN code'),

  requirementDescription: requiredString('Requirement / Description'),
  expectedBudget: optionalNumber(),
  expectedClosureDate: optionalDate(),
  noOfLocations: optionalNumber(),
  productServiceInterest: optionalString(),
  installationRequired: optionalString(),
  amcRequired: optionalString(),

  existingSetup: optionalString(),
  competitorDiscussed: optionalString(),
  competitorName: optionalString(),
  hearAboutUs: optionalString(),
  remarks: optionalString(),

  status: requiredString('Status'),
  assignedTo: optionalString(),
});

export const ENQUIRY_SOURCE_OPTIONS = ['Website', 'Phone Call', 'Walk-in', 'Referral', 'Social Media', 'Email', 'Exhibition/Event', 'Other'];
export const ENQUIRY_TYPE_OPTIONS = ['Product', 'Service', 'AMC', 'Installation', 'Other'];
export const ENQUIRY_PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
// Document-flow status: Open until a Sales Quotation quotes this enquiry,
// then Closed. Set server-side (recomputeEnquiryStatus in backend
// utils/documentFlow.js), never chosen on the form. This replaces the older
// six-stage funnel — note that the won/lost distinction Closed-Lost carried
// no longer exists, so Enquiry Analysis reports reaching a quotation rather
// than winning the business.
export const ENQUIRY_STATUS_OPTIONS = ['Open', 'Closed'];

export const followUpSchema = z.object({
  followUpNo: requiredString('Follow-up number'),
  enquiryId: z.union([z.number(), z.string()], { required_error: 'Enquiry is required' }),

  followUpMode: requiredString('Follow-up mode'),
  followUpDate: anyDate('Follow-up date'),
  followUpTime: requiredString('Follow-up time'),
  followUpBy: personName('Follow-up by'),
  nextFollowUpDate: optionalDate(),
  // Not personName() — this is bound to a free-choice Autocomplete
  // (FormSelect) seeded from the selected enquiry's own Contact Person plus
  // every distinct followUpWith already on record (see FollowUp.jsx), so a
  // real contact name containing digits, an ampersand, or other punctuation
  // personName()'s letters-only regex rejects was failing validation for a
  // perfectly legitimate pick.
  followUpWith: requiredString('Follow-up with'),
  designation: optionalString(),
  department: optionalString(),
  phoneNo: optionalMobileNumber('Phone number'),
  emailId: optionalEmail(),
  purposeDiscussion: requiredString('Purpose/Discussion'),
  outcomeResult: requiredString('Outcome/Result'),
  status: requiredString('Status'),
  followUpNotes: requiredString('Follow-up notes'),

  reminderAlert: optionalString(),
  reminderDate: optionalDate(),
  reminderTime: optionalString(),
  assignTo: optionalString(),
  priority: optionalString(),
  attachmentName: optionalString(),
  internalRemarks: optionalString(),
}).superRefine((data, ctx) => {
  dateRange('followUpDate', 'nextFollowUpDate', { startLabel: 'Follow-up date', endLabel: 'Next follow-up date' })(data, ctx);
});

export const FOLLOW_UP_MODE_OPTIONS = ['Call', 'Email', 'WhatsApp', 'Meeting'];
export const FOLLOW_UP_STATUS_OPTIONS = ['Completed', 'Pending', 'Scheduled', 'Overdue'];

// --- Sales Credit Memo -----------------------------------------------------
export const salesCreditMemoItemSchema = z.object({
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
  // Which warehouse THIS LINE ships back into. Required — a credit memo
  // always restocks somewhere, and the row starts seeded from the header's
  // own (required) Warehouse field. Declared here so it actually survives to
  // the saved record — zod strips whatever a schema does not declare, and
  // this field was missing entirely, so every line's Warehouse pick was
  // silently dropped from the save and came back blank on edit/view.
  //
  // Optional at the field level; required by the parent schema's
  // requireWarehouseUnlessNonStockCategory() refinement below, except when
  // salesCategory is Claims/Services — see isNonStockSalesCategory in
  // common.js. The field itself is hidden on the page for those categories.
  warehouse: optionalString(),
  // "Restock" — see BatchSerialRestockDialog.jsx and
  // assertBatchSerialRestockAllocation. A returned batch/serial number
  // already exists (created at original receipt), so this reuses the same
  // allocation shape the issue-side "Selection" dialog uses, just restocking
  // instead of consuming.
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

export const salesCreditMemoSchema = z.object({
  creditNo: requiredString('Credit number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  status: requiredString('Status'),
  // Optional, not required. A credit issued to a customer does not always
  // point at one invoice — a settlement, a rebate, a correction agreed outside
  // the billing run — and requiring it here made those impossible to enter at
  // all. The column is nullable in the database; the per-line cap that keeps a
  // memo within what an invoice billed already skips a line with no
  // invoicedQuantity (see the refine on salesCreditMemoItemSchema above), and
  // the server's assertNoOverConsumption returns early on a blank reference,
  // so such a memo simply has nothing to be capped against.
  invoiceNo: optionalString(),
  customer: requiredString('Customer'),
  customerName: optionalEntityName('Customer name'),
  contactPerson: optionalPersonName('Contact person'),
  gstNo: optionalString(),
  customerRefNo: optionalString(),
  // Display-only, auto-filled from the customer's Business Partner billing
  // address; drives CGST/SGST vs IGST (see customerState in the Sales pages).
  customerState: optionalString(),
  branch: requiredString('Branch'),
  // Where the returned goods land back into stock — see the schema.prisma
  // comment on SalesCreditMemo.warehouse.
  //
  // Optional at the header, not required. SalesCreditMemo.jsx has no visible
  // input for this field — only each line's own Warehouse (see
  // salesCreditMemoItemSchema.warehouse, already required there and what the
  // stock movement actually posts against); the header value exists only as
  // postStockEntries' document-level fallback for a line somehow left
  // without one. Nothing on this form ever sets it (the branch-change effect
  // only ever clears it), so requiring it unconditionally blocked Save on
  // every credit memo — there was no way to fill it in.
  warehouse: optionalString(),
  documentDate: anyDate('Document date'),
  postingDate: anyDate('Posting date').nullable().optional(),
  dueDate: anyDate('Due date').nullable().optional(),
  paymentTerms: optionalString(),
  // Bill To/Ship To are frozen, derived display fields — auto-filled from
  // the selected customer's Business Partner Billing/Shipping address, same
  // as every other sales document. See customerAddressFor in
  // SalesCreditMemo.jsx.
  billingAddress: optionalString(),
  shippingAddress: optionalString(),
  reason: optionalString(),
  narration: optionalString(),
  comments: optionalString(),
  placeOfSupply: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  termsConditions: optionalString(),
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  attachmentName: optionalString(),
  salesCategory: optionalString(),
  machineSerialNo: optionalString(), // required only when salesCategory === 'Machine' -- see requireMachineSerialNoWhenMachine below
  salesPerson: requiredString('Sales person'),
  salesType: requiredString('Payment method'),
  engineNo: optionalString(),
  hypothecation: optionalString(),
  roadTax: optionalNonNegativeNumber('Road tax'),
  ...freightFields(),
  items: z.array(salesCreditMemoItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('documentDate', 'postingDate', { startLabel: 'Document date', endLabel: 'Posting date' })(data, ctx);
  dateRange('documentDate', 'dueDate', { startLabel: 'Document date', endLabel: 'Due date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
  requireMachineSerialNoWhenMachine()(data, ctx);
  requireWarehouseUnlessNonStockCategory()(data, ctx);
});

export const SALES_CREDIT_MEMO_STATUS_OPTIONS = ['Draft', 'Open', 'Closed', 'Cancelled'];

// --- Sales Return ----------------------------------------------------------
export const salesReturnItemSchema = z.object({
  productCode: requiredString('Product'),
  productName: optionalString(),
  description: optionalString(),
  hsnCode: hsnCode(),
  uom: optionalString(),
  // Carried from the challan line so the return can be capped at what went out.
  deliveredQuantity: nonNegativeNumber('Delivered quantity'),
  returnQuantity: z
    .number({ invalid_type_error: 'Return quantity must be a number' })
    .gt(0, 'Return quantity must be greater than 0'),
  unitPrice: nonNegativeNumber('Unit price'),
  discountPercent: optionalPercentage('Discount'),
  taxPercent: percentage('Tax'),
  taxCodeId: optionalTaxCodeId,
  // Which warehouse THIS LINE ships back into. Required — a return always
  // restocks somewhere, and the row starts seeded from the header's own
  // (required) Warehouse field. Declared here so it actually survives to the
  // saved record — zod strips whatever a schema does not declare, and this
  // field was missing entirely, so every line's Warehouse pick was silently
  // dropped from the save and came back blank on edit/view.
  //
  // Optional at the field level; required by the parent schema's
  // requireWarehouseUnlessNonStockCategory() refinement below, except when
  // salesCategory is Claims/Services — see isNonStockSalesCategory in
  // common.js. The field itself is hidden on the page for those categories.
  warehouse: optionalString(),
  // "Restock" — see the matching comment on salesCreditMemoItemSchema above.
  batchAllocations: z.array(batchAllocationLineSchema).optional().default([]),
  serialAllocations: z.array(serialAllocationLineSchema).optional().default([]),
  // Where this line was copied from — see baseDocumentFields in common.js.
  ...baseDocumentFields(),
})
  // A return can never send back more than the challan despatched — checked per
  // line so the message lands on the offending row rather than the whole form.
  .refine((i) => !i.deliveredQuantity || i.returnQuantity <= i.deliveredQuantity, {
    message: 'Return quantity cannot exceed the delivered quantity',
    path: ['returnQuantity'],
  });

export const salesReturnSchema = z.object({
  returnNo: requiredString('Return number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  status: requiredString('Status'),
  // Optional, not required. Goods do come back without a despatch to point at
  // — a delivery recorded outside the system, a replacement being sent back —
  // and requiring it here made those impossible to enter at all. The column is
  // nullable in the database; the per-line cap that keeps a return within what
  // a challan sent out already skips a line with no deliveredQuantity (see the
  // refine on salesReturnItemSchema above), and the server's
  // assertNoOverConsumption returns early on a blank reference, so a return
  // with no challan simply has nothing to be capped against.
  challanNo: optionalString(),
  customer: requiredString('Customer'),
  customerName: optionalEntityName('Customer name'),
  contactPerson: optionalPersonName('Contact person'),
  gstNo: optionalString(),
  customerRefNo: optionalString(),
  // Display-only, auto-filled from the customer's Business Partner billing
  // address; drives CGST/SGST vs IGST (see customerState in the Sales pages).
  customerState: optionalString(),
  branch: requiredString('Branch'),
  // Where the returned goods land back into stock — see the schema.prisma
  // comment on SalesReturn.warehouse.
  //
  // Optional at the header, not required. SalesReturn.jsx has no visible
  // input for this field — only each line's own Warehouse (see
  // salesReturnItemSchema.warehouse, already required there and what the
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
  // Bill To/Ship To are frozen, derived display fields — auto-filled from
  // the selected customer's Business Partner Billing/Shipping address, same
  // as every other sales document. See customerAddressFor in
  // SalesReturn.jsx.
  billingAddress: optionalString(),
  shippingAddress: optionalString(),
  reason: optionalString(),
  narration: optionalString(),
  comments: optionalString(),
  placeOfSupply: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  termsConditions: optionalString(),
  preparedBy: optionalString(),
  approvedBy: optionalString(),
  attachmentName: optionalString(),
  salesCategory: optionalString(),
  machineSerialNo: optionalString(), // required only when salesCategory === 'Machine' -- see requireMachineSerialNoWhenMachine below
  salesPerson: requiredString('Sales person'),
  salesType: requiredString('Payment method'),
  engineNo: optionalString(),
  hypothecation: optionalString(),
  roadTax: optionalNonNegativeNumber('Road tax'),
  ...freightFields(),
  items: z.array(salesReturnItemSchema).min(1, 'Add at least one item'),
}).superRefine((data, ctx) => {
  dateRange('documentDate', 'postingDate', { startLabel: 'Document date', endLabel: 'Posting date' })(data, ctx);
  dateRange('documentDate', 'dueDate', { startLabel: 'Document date', endLabel: 'Due date' })(data, ctx);
  uniqueItemCodes('items', 'productCode', { label: 'Product' })(data, ctx);
  requireMachineSerialNoWhenMachine()(data, ctx);
  requireWarehouseUnlessNonStockCategory()(data, ctx);
});

export const SALES_RETURN_STATUS_OPTIONS = ['Draft', 'Open', 'Closed', 'Cancelled'];
