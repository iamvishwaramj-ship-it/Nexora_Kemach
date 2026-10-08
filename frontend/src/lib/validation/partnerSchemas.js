import { z } from 'zod';
import {
  requiredString, optionalString, optionalEmail, optionalMobileNumber, statusEnum,
  nonNegativeNumber, optionalNonNegativeNumber, optionalSignedNumber, percentage, optionalPercentage,
  gstin, panNumber, aadhaarNumber, anyDate, optionalDate, optionalZipcode, pincode,
  entityName, optionalEntityName, personName, optionalPersonName,
  optionalAccountNumber, optionalIfscCode, optionalPhoneNumber,
  strictName,
} from './common';

// Local wrapper: optional date-of-birth that also may not be in the future.
// common.js only exports pastOrTodayDate() (required) and optionalDate() (no
// upper bound) — neither alone covers "optional, but not a future date" for
// businessPartnerContactSchema.dateOfBirth below. common.js is being edited
// by another engineer in parallel right now, so rather than add a new export
// there this composes the two existing preprocessed builders locally: run
// optionalDate()'s parsing/undefined-handling, then refine the result against
// "not in the future" only when it actually resolved to a Date.
const optionalPastOrTodayDate = (label = 'Date') =>
  optionalDate(label).refine(
    (v) => v === undefined || !(v instanceof Date) || Number.isNaN(v.getTime()) || v <= new Date(),
    { message: `${label} cannot be in the future` }
  );

// RETIRED, alongside the split Customer/Supplier pages it validated — see the
// note on warehouseSchema/locationSchema below for the same pattern. Partner
// Management > Business Partner now edits both Customer and Supplier records
// through the unified businessPartnerSchema (partnerName: strictName), so
// this is unused by any page. Kept only so nothing importing it breaks;
// aligned to strictName anyway so it can't silently drift back to a looser
// rule than the live form if someone resurrects it.
export const customerSchema = z.object({
  customerCode: requiredString('Customer code'),
  customerName: strictName('Customer name'),
  customerType: requiredString('Customer type'),
  // Optional, unlike customerType: customers created before this field
  // existed have no value for it, and making it required would block
  // saving an edit to any of them until it was filled in.
  salesType: optionalString(),
  status: statusEnum(),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  alternatePhone: optionalMobileNumber('Alternate phone'),
  website: optionalString(),
  gstin: gstin(),
  panNo: panNumber('PAN'),
  aadhaarNo: aadhaarNumber(),
  // Must use optionalDate(), not anyDate().optional() — chaining .optional()
  // onto anyDate() wraps ZodOptional around the preprocess step, and
  // ZodOptional only short-circuits for `undefined`, not the literal `null`
  // these forms default this field to, so it still hit the inner required
  // z.date() and silently blocked saving whenever left blank.
  dateOfRegistration: optionalDate('Date of registration'),
  billingAddress: requiredString('Billing address'),
  shippingAddress: optionalString(),
  city: optionalString(),
  state: optionalString(),
  creditLimit: optionalNonNegativeNumber('Credit limit'),
  openingBalance: optionalNonNegativeNumber('Opening balance'),
  outstandingBalance: optionalNonNegativeNumber('Outstanding balance'),
  paymentTerms: optionalString(),
  priceList: optionalString(),
  salesPerson: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  notes: optionalString(),
  // Accounting — Control Accounts. accountsReceivable / downPaymentClearingAccount
  // store a ChartOfAccount accountCode; accountBalance is a plain figure.
  accountsReceivable: optionalString(),
  downPaymentClearingAccount: optionalString(),
  accountBalance: optionalNonNegativeNumber('Account balance'),
});

export const CUSTOMER_TYPE_OPTIONS = [
  { label: 'Cash Customer', value: 'Cash Customer' },
  { label: 'Credit Customer', value: 'Credit Customer' },
  { label: 'Walk-in Customer', value: 'Walk-in Customer' },
  { label: 'Retail', value: 'Retail' },
  { label: 'Corporate', value: 'Corporate' },
  { label: 'Wholesale', value: 'Wholesale' },
  { label: 'Distributor', value: 'Distributor' },
  { label: 'Government', value: 'Government' },
  // Payment-behaviour types, as opposed to the trade-channel ones above.
  // 'Other' stays last as the catch-all.
  
  { label: 'Other', value: 'Other' },
];

export const SALES_TYPE_OPTIONS = [
  { label: 'B - B', value: 'B - B' },
  { label: 'B - C', value: 'B - C' },
  { label: 'Branch', value: 'Branch' },
];

export const PAYMENT_TERMS_OPTIONS = [
  { label: 'Immediate', value: 'Immediate' },
  { label: 'Net 15', value: 'Net 15' },
  { label: 'Net 30', value: 'Net 30' },
  { label: 'Net 45', value: 'Net 45' },
  { label: 'Net 60', value: 'Net 60' },
];

export const PRICE_LIST_OPTIONS = [
  { label: 'Retail Price List', value: 'Retail Price List' },
  { label: 'Wholesale Price List', value: 'Wholesale Price List' },
  { label: 'Corporate Price List', value: 'Corporate Price List' },
  { label: 'Distributor Price List', value: 'Distributor Price List' },
];

// RETIRED — same reason as customerSchema above: unused now that Business
// Partner is unified, aligned to strictName for consistency rather than left
// on the older entityName rule.
export const supplierSchema = z.object({
  supplierCode: requiredString('Supplier code'),
  supplierName: strictName('Supplier name'),
  supplierType: requiredString('Supplier type'),
  status: statusEnum(),
  contactPerson: optionalPersonName('Contact person'),
  phone: optionalMobileNumber('Phone'),
  alternatePhone: optionalMobileNumber('Alternate phone'),
  email: optionalEmail(),
  gstin: gstin(),
  panNo: panNumber('PAN'),
  msmeNo: optionalString(),
  // Must use optionalDate(), not anyDate().optional() — chaining .optional()
  // onto anyDate() wraps ZodOptional around the preprocess step, and
  // ZodOptional only short-circuits for `undefined`, not the literal `null`
  // these forms default this field to, so it still hit the inner required
  // z.date() and silently blocked saving whenever left blank.
  dateOfRegistration: optionalDate('Date of registration'),
  billingAddress: requiredString('Billing address'),
  shippingAddress: optionalString(),
  city: optionalString(),
  state: optionalString(),
  creditLimit: optionalNonNegativeNumber('Credit limit'),
  openingBalance: optionalNonNegativeNumber('Opening balance'),
  outstandingBalance: optionalNonNegativeNumber('Outstanding balance'),
  paymentTerms: optionalString(),
  paymentMode: optionalString(),
  bankName: optionalEntityName('Bank name'),
  accountNumber: optionalAccountNumber('Account number'),
  ifscCode: optionalIfscCode(),
  priceList: optionalString(),
  currency: optionalString(),
  preferredPurchaseCategory: optionalString(),
  discountPercent: optionalPercentage('Discount'),
  notes: optionalString(),
  // Accounting — Control Accounts. Same shape as customerSchema's own
  // accountsReceivable / downPaymentClearingAccount / accountBalance.
  accountsReceivable: optionalString(),
  downPaymentClearingAccount: optionalString(),
  accountBalance: optionalNonNegativeNumber('Account balance'),
});

export const SUPPLIER_TYPE_OPTIONS = [
  { label: 'Local Supplier', value: 'Local Supplier' },
  { label: 'Import Supplier', value: 'Import Supplier' },
  { label: 'Manufacturer', value: 'Manufacturer' },
  { label: 'Distributor', value: 'Distributor' },
  { label: 'Wholesaler', value: 'Wholesaler' },
  { label: 'Service Provider', value: 'Service Provider' },
  { label: 'Other', value: 'Other' },
];

export const SUPPLIER_PAYMENT_TERMS_OPTIONS = [
  { label: 'Immediate', value: 'Immediate' },
  { label: '15 Days', value: '15 Days' },
  { label: '30 Days', value: '30 Days' },
  { label: '45 Days', value: '45 Days' },
  { label: '60 Days', value: '60 Days' },
  { label: '90 Days', value: '90 Days' },
];

export const PAYMENT_MODE_OPTIONS = [
  { label: 'Bank Transfer', value: 'Bank Transfer' },
  { label: 'Cheque', value: 'Cheque' },
  { label: 'Cash', value: 'Cash' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Credit Card', value: 'Credit Card' },
  { label: 'Other', value: 'Other' },
];

// Currency is now a real master (Product Setup > Currency Master) instead of
// a fixed code list — every currency dropdown reads it live via
// useCurrencyOptions()/useBpCurrencyOptions() in lib/currencyOptions.js. Both
// exports were removed rather than kept as re-exports so nothing can quietly
// go back to a hardcoded list by importing from here again.

export const PURCHASE_CATEGORY_OPTIONS = [
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Office Supplies', value: 'Office Supplies' },
  { label: 'Raw Materials', value: 'Raw Materials' },
  { label: 'Packaging', value: 'Packaging' },
  { label: 'IT Equipment', value: 'IT Equipment' },
  { label: 'Furniture', value: 'Furniture' },
  { label: 'Other', value: 'Other' },
];

export const SUPPLIER_PRICE_LIST_OPTIONS = [
  { label: 'Purchase Price List', value: 'Purchase Price List' },
  { label: 'Wholesale Purchase List', value: 'Wholesale Purchase List' },
  { label: 'Import Price List', value: 'Import Price List' },
  { label: 'Standard Price List', value: 'Standard Price List' },
];

export const transportSchema = z.object({
  transporterCode: requiredString('Transporter code'),
  transporterName: strictName('Transporter name'),
  status: statusEnum(),
  contactPerson: optionalPersonName('Contact person'),
  phone: optionalMobileNumber('Phone'),
  alternatePhone: optionalMobileNumber('Alternate phone'),
  email: optionalEmail(),
  website: optionalString(),
  gstin: gstin(),
  panNo: panNumber('PAN'),
  address: requiredString('Address'),
  serviceType: optionalString(),
  transportType: optionalString(),
  freightPaymentTerms: optionalString(),
  deliveryRegions: optionalString(),
  minimumFreight: optionalNonNegativeNumber('Minimum freight'),
  freightPerKm: optionalNonNegativeNumber('Freight per km'),
  loadingTime: optionalString(),
  unloadingTime: optionalString(),
  vehicleCapacity: optionalString(),
  vehicleType: optionalString(),
  noOfVehicles: optionalNonNegativeNumber('No. of vehicles'),
  // Same fix as dateOfRegistration above — optionalDate() actually handles
  // the `null` default, anyDate().optional() does not.
  insuranceValidUpto: optionalDate('Insurance valid upto'),
  bankName: optionalEntityName('Bank name'),
  accountNumber: optionalAccountNumber('Account number'),
  ifscCode: optionalIfscCode(),
  accountHolderName: optionalPersonName('Account holder name'),
  notes: optionalString(),
});

export const SERVICE_TYPE_OPTIONS = [
  { label: 'Road', value: 'Road' },
  { label: 'Rail', value: 'Rail' },
  { label: 'Air', value: 'Air' },
  { label: 'Sea', value: 'Sea' },
  { label: 'Courier', value: 'Courier' },
];

export const TRANSPORT_TYPE_OPTIONS = [
  { label: 'Full Truck Load (FTL)', value: 'Full Truck Load (FTL)' },
  { label: 'Part Truck Load (PTL)', value: 'Part Truck Load (PTL)' },
  { label: 'Container', value: 'Container' },
  { label: 'Parcel', value: 'Parcel' },
  { label: 'Express', value: 'Express' },
];

export const FREIGHT_PAYMENT_TERMS_OPTIONS = [
  { label: 'To Pay', value: 'To Pay' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Freight Collect', value: 'Freight Collect' },
  { label: 'FOB', value: 'FOB' },
];

export const VEHICLE_TYPE_OPTIONS = [
  { label: 'Truck', value: 'Truck' },
  { label: 'Trailer', value: 'Trailer' },
  { label: 'Mini Truck', value: 'Mini Truck' },
  { label: 'Container', value: 'Container' },
  { label: 'Tempo', value: 'Tempo' },
  { label: 'Pickup', value: 'Pickup' },
];

// RETIRED, alongside the Warehouse model it validates — see the note on that
// model in schema.prisma. Company Setup > Warehouse Master now edits
// WarehouseMaster through warehouseMasterSchema below. Kept only so nothing
// importing it breaks; do not use it for new work.
export const warehouseSchema = z.object({
  warehouseCode: requiredString('Warehouse code'),
  warehouseName: entityName('Warehouse name'),
  warehouseLocation: requiredString('Warehouse location'),
  branch: optionalString(),
  status: statusEnum(),
});

// The surviving warehouse master ([dbo].[warehouse]).
//
// Only code and name are required. Everything else is optional because the
// existing rows were imported from Master Data.xlsx and are sparsely filled —
// making location or address mandatory would make every imported warehouse
// unsaveable until someone had researched it, which is how a master ends up
// edited by nobody.
export const warehouseMasterSchema = z.object({
  whsCode: requiredString('Warehouse code'),
  whsName: entityName('Warehouse name'),
  // Stored as the location CODE, matching the master's own column, so renaming
  // a location cannot orphan the warehouses pointing at it.
  locationCode: optionalString(),
  // Which branch operates this warehouse. What Product Master's Inventory tab
  // reads for its Branch column, and — now that Branch drives every
  // branch-scoped warehouse dropdown app-wide — what actually determines
  // which transaction forms this warehouse can be picked on at all. Now
  // mandatory: a warehouse with no branch is invisible to every branch-scoped
  // picker, which is worse than being asked to assign one. This does mean the
  // next edit to a legacy imported warehouse (branch was optional when those
  // were created) forces a branch choice before anything else on it can be
  // saved — deliberate, since that is the backfill actually getting done
  // rather than deferred again.
  branch: requiredString('Branch'),
  street: optionalString(),
  streetNo: optionalString(),
  buildingFloorRoom: optionalString(),
  block: optionalString(),
  city: optionalString(),
  state: optionalString(),
  country: optionalString(),
  zipCode: optionalZipcode(),
  // Transit Warehouse tick — see the field comment on WarehouseMaster.isTransit
  // in schema.prisma for what it means and how exclusivity per branch is
  // enforced (server-side afterWrite, not here).
  isTransit: z.boolean().optional(),
  // Accounting tab — one Chart of Accounts code per G/L determination role.
  // Optional for the same reason every other field on this master is: a
  // warehouse with none set still posts through whatever default applies
  // elsewhere, and requiring these would block editing every warehouse that
  // hasn't been configured yet.
  expenseAccount: optionalString(),
  revenueAccount: optionalString(),
  inventoryAccount: optionalString(),
  costOfGoodsSoldAccount: optionalString(),
  allocationAccount: optionalString(),
  varianceAccount: optionalString(),
  priceDifferenceAccount: optionalString(),
  negativeInventoryAdjustmentAccount: optionalString(),
  inventoryOffsetDecreaseAccount: optionalString(),
  inventoryOffsetIncreaseAccount: optionalString(),
  salesReturnsAccount: optionalString(),
  purchaseAccount: optionalString(),
  purchaseReturnAccount: optionalString(),
  costOfGoodsPurchasedAccount: optionalString(),
  exchangeRateDifferencesAccount: optionalString(),
  goodsClearingAccount: optionalString(),
  glDecreaseAccount: optionalString(),
  glIncreaseAccount: optionalString(),
  wipInventoryAccount: optionalString(),
  wipInventoryVarianceAccount: optionalString(),
  wipOffsetPnlAccount: optionalString(),
  inventoryOffsetPnlAccount: optionalString(),
  expenseClearingAccount: optionalString(),
  shippedGoodsAccount: optionalString(),
  salesCreditAccount: optionalString(),
  purchaseCreditAccount: optionalString(),
  purchaseBalanceAccount: optionalString(),
  incomingCenvatAccount: optionalString(),
  outgoingCenvatAccount: optionalString(),
  status: statusEnum(),
});

// RETIRED, alongside the Location model it validates — see the note on that
// model in schema.prisma. Company Setup > Location Master now edits
// LocationMaster through locationMasterSchema below. Kept only so nothing
// importing it breaks; do not use it for new work.
export const locationSchema = z.object({
  locationCode: requiredString('Location code'),
  locationName: entityName('Location name'),
  panNo: panNumber('PAN'),
  eccNo: optionalString(),
  gstRegistrationNo: gstin('GST registration no.'),
  status: statusEnum(),
});

// The surviving location master ([dbo].[location_master]).
//
// Code and name are required; the statutory numbers are not, because the
// imported rows are sparsely filled and requiring them would make every
// existing location unsaveable until someone had researched it. The address
// breakdown fields follow the same rule — optional, for the same reason.
export const locationMasterSchema = z.object({
  // `code`, not `locationCode` — this master's own column name, and what
  // WarehouseMaster.locationCode points at.
  code: requiredString('Location code'),
  locationName: entityName('Location name'),
  regType: optionalString(),
  panNo: panNumber('PAN'),
  eccNo: optionalString(),
  gstRegistrationNo: gstin('GST registration no.'),
  streetNo: optionalString(),
  buildingFloorRoom: optionalString(),
  block: optionalString(),
  country: optionalString(),
  state: optionalString(),
  city: optionalString(),
  zipCode: optionalZipcode(),
  status: statusEnum(),
});

// Department Master — a simple 3-field lookup (code, name, status) that
// Employee Master's Department dropdown binds to by id (departmentId FK).
// Modeled on locationMasterSchema above, stripped down.
export const departmentMasterSchema = z.object({
  code: requiredString('Department code'),
  name: entityName('Department name'),
  status: statusEnum(),
});

// Opening Balance — ONE LINE of the Item Details table on
// pages/inventory/OpeningBalance.jsx. Each row is still one stock position
// per item per warehouse (opening_balance keeps its (item_code, warehouse)
// unique index); documentNumber/documentDate/status default down from the
// header but stay per-row so a line can be overridden and so an imported row
// carries its own values. Warehouse is validated as a required string (the
// FormSelect constrains it to a real warehouse-master code); the server's FK
// on the warehouse column is the actual backstop.
export const openingBalanceSchema = z.object({
  documentNumber: optionalString(),
  documentDate: optionalDate('Document date'),
  itemCode: requiredString('Item code'),
  itemName: requiredString('Item name'),
  warehouse: requiredString('Warehouse'),
  // Optional here -- "required for a Batch-managed item" can't be checked
  // against Product Master from this per-line schema, so that check lives
  // in OpeningBalance.jsx's own validateOpeningBalanceBatches instead (same
  // schema/page split GRN's own batch fields already use).
  batchNo: optionalString(),
  // Batch | Serial | Standard -- drives whether Batch No. is required (Batch
  // only). Declared so zod doesn't strip it before it reaches the API.
  manageBy: optionalString(),
  // Id of the saved row a line edits (set by the edit form, never typed).
  rowId: z.any().optional(),
  stock: nonNegativeNumber('Stock'),
  // Unit Cost (DLP price) x Stock = Stock Value -- Stock Value is recomputed
  // by the page whenever either changes and again server-side on save.
  unitCost: nonNegativeNumber('Unit cost'),
  stockValue: nonNegativeNumber('Stock value'),
  status: statusEnum(),
});

// BP Opening Balance — Company Setup > BP Opening Balance
// (pages/company/BPOpeningBalance.jsx). ONE Business Partner line of the
// "Add BP Opening" grid, saved together with the header as a batch (POST/
// PUT /business-partner-opening-balance/...). Unlike stock Opening Balance's
// per-row stock/stockValue (always >= 0), a BP's Opening Balance can
// legitimately be negative — a customer who is actually in credit, or a
// vendor already overpaid — and utils/glPosting.js's BP_OPENING_BALANCE
// builder relies on that sign to flip which side of the entry it lands on,
// so this is a plain signed number, not nonNegativeNumber.
const signedNumber = (label = 'Value') => z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number({ invalid_type_error: `${label} must be a number` }).optional()
);

export const businessPartnerOpeningBalanceLineSchema = z.object({
  bpCode: requiredString('BP Code'),
  bpName: optionalString(),
  // Optional per-line invoice reference; Outstanding uses them when filled
  // (see buildBpOutstandingRow on the backend).
  invoiceNo: optionalString(),
  invoiceDate: optionalDate('Invoice date'),
  dueDate: optionalDate('Due date'),
  openingBalance: signedNumber('Opening Balance'),
})
  .superRefine((line, ctx) => {
    if (line.invoiceDate && line.dueDate && line.dueDate < line.invoiceDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dueDate'], message: 'Due date cannot be before invoice date' });
    }
  });

// The whole "Add BP Opening" screen: one header plus its BP lines, submitted
// together (see the two bespoke endpoints in features/company/
// businessPartnerOpeningBalanceApi.js). documentNumber is left as an
// optional plain string rather than validated as present/absent-meaning-
// something here — DocumentNoField fills it with a preview on create, and
// BPOpeningBalance.jsx itself (not this schema) is what decides create vs.
// edit by which route it calls, per that API file's own comment.
export const businessPartnerOpeningBalanceDocumentSchema = z.object({
  documentNumber: optionalString(),
  // Plumbing, not a real form field -- DocumentNoField (see its own doc
  // comment) stashes the numbering series id its peek call resolved here via
  // setValue, purely so BPOpeningBalance.jsx's submit handler can forward it
  // to the save endpoint as `seriesId` and pin the save to the exact series
  // that was previewed. z.object() strips unrecognised keys by default, so
  // without an entry here this value would silently vanish between
  // DocumentNoField's setValue and handleSubmit's values -- it has to be
  // declared even though nothing renders it or validates it.
  documentNumberSeriesId: z.union([z.number(), z.string()]).nullish(),
  documentDate: optionalDate('Document date'),
  openingBalanceAccount: requiredString('Opening Balance Account'),
  // UI-only, mirrors openingBalanceDocumentSchema's own `branch` field
  // above — auto-filled from openingBalanceAccount when it's picked, never
  // sent to the API (BPOpeningBalance.jsx strips it back out before
  // calling saveBatch/updateDocument).
  openingBalanceAccountDescription: optionalString(),
  ref1: optionalString(),
  ref2: optionalString(),
  bpType: z.enum(['Customer', 'Vendor'], { invalid_type_error: 'BP Type is required' }),
  remarks: optionalString(),
  lines: z.array(businessPartnerOpeningBalanceLineSchema).min(1, 'Add at least one Business Partner line'),
});

// The whole screen: one header plus its lines, submitted together as a batch
// (POST /opening-balance/batch).
//
// `branch` is UI-only — opening_balance has no branch column of its own (a
// warehouse already belongs to exactly one branch via WarehouseMaster.branch)
// — so it exists purely to scope every row's Warehouse dropdown and to make
// Branch genuinely mandatory rather than an unenforced decoration.
// OpeningBalance.jsx strips it back out before calling the API.
export const openingBalanceDocumentSchema = z
  .object({
    branch: requiredString('Branch'),
    documentNumber: optionalString(),
    documentDate: optionalDate('Document date'),
    // Credit side of the journal entry this document posts (Dr Inventory /
    // Cr this account). openingBalanceAccountDescription is UI-only -- the
    // page fills it from the Chart Of Accounts and strips it before saving.
    openingBalanceAccount: requiredString('Opening Balance Account'),
    openingBalanceAccountDescription: optionalString(),
    status: statusEnum(),
    // Document footer, same three fields every Sales/Purchase document
    // carries. Header-only (no per-line override), stamped onto each saved
    // line server-side. preparedBy/approvedBy hold the employee's name.
    termsConditions: optionalString(),
    preparedBy: optionalString(),
    approvedBy: optionalString(),
    items: z.array(openingBalanceSchema).min(1, 'Add at least one item line'),
  });

// ---------------------------------------------------------------------------
// Business Partner (unified) — Partner Management > Business Partner.
// A master/detail record: one header plus two child grids (Contact Person,
// Addresses split into Billing/Shipping). The child rows are added/edited via
// their own dialog and only ever land in the form as a plain array, so each
// gets its own small schema below rather than one giant flat object.
// ---------------------------------------------------------------------------

export const businessPartnerContactSchema = z.object({
  contactId: optionalString(),
  title: optionalString(),
  firstName: optionalString(),
  lastName: optionalString(),
  position: optionalString(),
  address: optionalString(),
  telephone: optionalPhoneNumber('Telephone'),
  mobile: optionalMobileNumber('Mobile'),
  email: optionalEmail(),
  emailGroup: optionalString(),
  password: optionalString(),
  birthCountry: optionalString(),
  birthState: optionalString(),
  birthCity: optionalString(),
  dateOfBirth: optionalPastOrTodayDate('Date of birth'),
  gender: optionalString(),
  profession: optionalString(),
  remarks: optionalString(),
  isDefault: z.boolean().optional(),
});

// Field set/order mirrors Branch's own address block (streetNo /
// buildingFloorRoom / block / country / state / city / zipCode) plus
// address-specific fields (Address Name, Street, Tax Office, GST Type, GST
// Number).
export const businessPartnerAddressSchema = z.object({
  addressName: requiredString('Address Name'),
  street: optionalString(),
  streetNo: optionalString(),
  buildingFloorRoom: optionalString(),
  block: optionalString(),
  // Mandatory — every Billing/Shipping address needs a place, not just a
  // name, and the Country -> State -> City cascade above already guides the
  // user to one. See AddressDialog's canSave gate in BusinessPartner.jsx,
  // which keeps Save disabled until all three are picked.
  country: requiredString('Country'),
  state: requiredString('State'),
  city: requiredString('City'),
  // Digits-only, 6-digit — same rule Branch's own zipCode field already
  // enforces (see FormTextField's digitsOnly+maxLength there), so Business
  // Partner's Billing/Shipping addresses match it instead of the more
  // permissive country-agnostic optionalZipcode.
  zipCode: pincode('Zip Code'),
  taxOffice: optionalString(),
  gstType: optionalString(),
  gstNumber: gstin('GST Number'),
  // PAN Card Number. Must be declared here: z.object strips unknown keys, so
  // without it the value typed in the dialog is silently dropped on submit.
  panNo: panNumber('PAN Card Number'),
  isDefault: z.boolean().optional(),
});

// One row of the "Machineries" tab's grid — just an item code/name pair
// (see pages/businessPartner/BusinessPartner.jsx's MachineryDialog), so
// there's nothing here beyond requiring both.
export const businessPartnerMachinerySchema = z.object({
  itemCode: requiredString('Item Code'),
  itemName: requiredString('Item Name'),
});

// GST registration category — the options offered on the GSTIN portal's own
// "Taxpayer Type" filter.
export const GST_TYPE_OPTIONS = [
  { label: 'Casual Taxable Person', value: 'Casual Taxable Person' },
  { label: 'Composition Levy', value: 'Composition Levy' },
  { label: 'Government Department or PSU', value: 'Government Department or PSU' },
  { label: 'Non Resident Taxable Person', value: 'Non Resident Taxable Person' },
  { label: 'Regular/TDS/ISD', value: 'Regular/TDS/ISD' },
  { label: 'UN Agency or Embassy', value: 'UN Agency or Embassy' },
];

export const businessPartnerSchema = z.object({
  // General
  // Drives which of the three "Code" controls is active — see the
  // PartnerCodeField in pages/businessPartner/BusinessPartner.jsx. Not a
  // persisted column: the backend reads it once (to pick which sequence to
  // draw the code from) and strips it back out before writing.
  codeMode: z.enum(['manual', 'auto-customer', 'auto-supplier']).optional(),
  partnerCode: requiredString('Code'),
  partnerName: entityName('Name'),
  foreignName: optionalString(),
  groupName: entityName('Group'),
  currency: requiredString('Currency'),
  // Signed: a partner's Account Balance can legitimately be negative.
  accountBalance: optionalSignedNumber('Account balance'),
  partnerType: requiredString('Partner type'),
  status: statusEnum(),

  // General tab (below the header fields)
  telephone: optionalPhoneNumber('Telephone'),
  mobile: optionalMobileNumber('Mobile'),
  email: optionalEmail(),
  website: optionalString(),
  shippingType: optionalString(),
  industry: optionalString(),
  businessPartnerType: optionalString(),
  // Free-text display name, not a structured Contact Person row (those live
  // in `contacts` above, added via ContactPersonDialog) — legacy/imported
  // records commonly hold Indian naming conventions like "S/O", "D/O",
  // "W/O" (e.g. "B.BILESH S/O BHASKARAN.PM"), which optionalPersonName's
  // letters-only regex rejects (no '/'), permanently blocking Update on any
  // such record with no visible reason (see FormSubmitButton's tooltip in
  // AppForm.jsx). Plain optionalString() so any legacy or freely-typed value
  // can be saved.
  contactPerson: optionalString(),
  salesPerson: optionalString(),
  remarks: optionalString(),

  // Whether this partner's logo should print (e.g. alongside the KEMACH
  // logo when chosen as the Supplier on a sales document) — a 'Yes'/'No'
  // FormSelect on the General tab, converted to/from the real
  // logoVisible Boolean column at the submit/hydrate boundary in
  // BusinessPartner.jsx. Kept as a string here (not z.boolean()) because
  // that's the shape the form field itself carries; without listing it at
  // all, zod's default strip behaviour would silently drop it from the
  // submit payload before handleSubmit's own Yes/No -> boolean conversion
  // ever ran.
  logoVisible: z.enum(['Yes', 'No']).optional(),

  // Contact Person / Addresses — populated via their own "Add" dialogs
  // (see pages/businessPartner/BusinessPartner.jsx), not typed directly.
  contacts: z.array(businessPartnerContactSchema).optional(),
  billingAddresses: z.array(businessPartnerAddressSchema).optional(),
  shippingAddresses: z.array(businessPartnerAddressSchema).optional(),
  machineries: z.array(businessPartnerMachinerySchema).optional(),

  // Payment Terms
  paymentTerms: optionalString(),
  creditDays: optionalNonNegativeNumber('Credit days'),
  creditLimit: optionalNonNegativeNumber('Credit limit'),

  // Payment Run
  paymentMethod: optionalString(),
  paymentPriority: optionalString(),
  blockPayment: z.boolean().optional(),
  houseBank: optionalString(),
  bankAccountNo: optionalAccountNumber('Bank account no.'),
  ifscCode: optionalIfscCode(),
  branch: optionalString(),

  // Accounting — a single Control Account. Its display label switches
  // between "Accounts Receivable" (Customer) and "Accounts Payable"
  // (Vendor) in the UI based on partnerType — see BusinessPartner.jsx.
  // Down Payment Clearing Account was removed on request.
  controlAccount: optionalString(),
});

export const PARTNER_CODE_MODE_OPTIONS = [
  { label: 'Manual', value: 'manual' },
  { label: 'Auto - Customer', value: 'auto-customer' },
  { label: 'Auto - Supplier', value: 'auto-supplier' },
];

// Simplified to just Customer/Vendor — placed next to Code in the header
// (see BusinessPartner.jsx) and drives the Accounting tab's Control Account
// label (Accounts Receivable / Accounts Payable).
export const PARTNER_TYPE_OPTIONS = [
  { label: 'Customer', value: 'Customer' },
  { label: 'Vendor', value: 'Vendor' },
];

    export const PARTNER_GROUP_OPTIONS = [
      { label: 'Suppliers', value: 'Suppliers' },
      { label: 'Customers', value: 'Customers' },
      { label: 'Vendors', value: 'Vendors' },
      { label: 'Retail', value: 'Retail' },
      { label: 'Corporate', value: 'Corporate' },
      { label: 'Wholesale', value: 'Wholesale' },
      { label: 'Distributor', value: 'Distributor' },
      { label: 'Government', value: 'Government' },
      { label: 'Other', value: 'Other' },
    ];

// Business Partner's Currency field additionally offers "All" (no currency
// restriction) alongside every currency Currency Master lists — see
// useBpCurrencyOptions() in lib/currencyOptions.js, which replaced this
// export.

export const SHIPPING_TYPE_OPTIONS = [
  { label: 'Road', value: 'Road' },
  { label: 'Air', value: 'Air' },
  { label: 'Sea', value: 'Sea' },
  { label: 'Courier', value: 'Courier' },
];

export const INDUSTRY_OPTIONS = [
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'Trading', value: 'Trading' },
  { label: 'Services', value: 'Services' },
  { label: 'Retail', value: 'Retail' },
  { label: 'Construction', value: 'Construction' },
  { label: 'Other', value: 'Other' },
];

export const BUSINESS_PARTNER_TYPE_OPTIONS = [
  { label: 'Company', value: 'Company' },
  { label: 'Individual', value: 'Individual' },
];

// "Select" is only the placeholder shown by SelectStandalone's own blank
// option (see BusinessPartner.jsx) — not a real choice — so the option list
// itself holds just the two real values.
export const EMAIL_GROUP_OPTIONS = [
  { label: 'Customer', value: 'Customer' },
  { label: 'Vendor', value: 'Vendor' },
];

export const TITLE_OPTIONS = [
  { label: 'Mr.', value: 'Mr.' },
  { label: 'Mrs.', value: 'Mrs.' },
  { label: 'Ms.', value: 'Ms.' },
  { label: 'Miss', value: 'Miss' },
];

export const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Bank Transfer', value: 'Bank Transfer' },
  { label: 'Cheque', value: 'Cheque' },
  { label: 'Cash', value: 'Cash' },
  { label: 'Online', value: 'Online' },
];

export const PAYMENT_PRIORITY_OPTIONS = [
  { label: 'Low', value: 'Low' },
  { label: 'Normal', value: 'Normal' },
  { label: 'High', value: 'High' },
];
