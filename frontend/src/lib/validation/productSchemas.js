import { z } from 'zod';
import { requiredString, optionalString, statusEnum, currencyAmount, optionalCurrencyAmount, nonNegativeNumber, optionalNonNegativeNumber, percentage, anyDate, hsnCode, hsnCodeRequired, entityName, strictName, optionalStrictName } from './common';

export const productGroupSchema = z.object({
  groupCode: requiredString('Group code'),
  groupName: strictName('Group name'),
  description: optionalString(),
  uom: optionalString(),
  status: statusEnum(),
  // Accounting tab — same G/L account determination roles as
  // WarehouseMaster's Accounting tab; every one optional, same as there.
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
});

export const productSubGroupSchema = z.object({
  subGroupCode: requiredString('Sub-group code'),
  subGroupName: strictName('Sub-group name'),
  groupName: optionalString(),
  description: optionalString(),
  status: statusEnum(),
});

export const brandSchema = z.object({
  brandCode: requiredString('Brand code'),
  brandName: strictName('Brand name'),
  description: optionalString(),
  status: statusEnum(),
});

export const uomSchema = z.object({
  uomCode: requiredString('UOM code'),
  uomName: strictName('UOM name'),
  unitType: optionalString(),
  description: optionalString(),
  status: statusEnum(),
});

// Currency Master — Currency Code / Currency Name / Symbol / an Active
// checkbox. Code is not in the reference "Add Currency" design, but every
// currency field elsewhere in the app already stores a 3-letter code on
// already-saved documents, so it stays a required field here — see the
// CurrencyMaster model doc comment in schema.prisma. Symbol is optional —
// not every currency needs one recorded to be usable. isActive is a plain
// boolean, matching isControlAccount/isBankAccount on Chart of Accounts
// rather than the Active/Inactive select Brand/UOM use.
export const currencySchema = z.object({
  currencyCode: requiredString('Currency code'),
  currencyName: strictName('Currency name'),
  symbol: optionalString(),
  isActive: z.boolean().optional(),
});

// HSN Master — HSN/SAC Code / Description / an Active checkbox. GST Rate is
// no longer captured on this form (removed per request); the DB column still
// exists and defaults to 0 (see schema.prisma) so nothing else breaks.
// Modeled on currencySchema just above. Unlike the optional hsnCode() used
// on Product Master (an existing saved product may have no HSN yet), the
// code is required here — an HSN Master row with a blank code is not a
// usable master record. Reuses hsnCode()'s 4/6/8-digit format check via
// z.preprocess, just without the "or empty string" escape hatch.
export const hsnMasterSchema = z.object({
  hsnCode: hsnCodeRequired('HSN/SAC code'),
  description: optionalString(),
  isActive: z.boolean().optional(),
});

/**
 * The at-least-one-flow rule, as a reusable superRefine body.
 *
 * Exported separately because applying `.superRefine()` turns a ZodObject into
 * a ZodEffects, which has no `.omit()` or `.extend()` — so a caller that needs
 * to reshape the schema (ProductMaster swaps `status` for an `active`
 * checkbox) has to refine AFTER reshaping, not before. Keeping the rule in one
 * named function is what stops those two call sites drifting apart.
 */
export function refineProductUsageFlags(values, ctx) {
  // A product with none of the three flow flags set can be selected nowhere:
  // not on a sales document, not on a purchase document, not on a stock
  // document. It would be a master record that exists but cannot be used.
  //
  // The message is attached to all three fields so whichever one the user is
  // looking at shows it — a form-level error on a three-checkbox row is easy
  // to miss, and there is no single "the flags" control to point at.
  if (values.salesItem || values.purchaseItem || values.inventoryItem) return;
  for (const field of ['salesItem', 'purchaseItem', 'inventoryItem']) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: 'Select at least one of Sales Item, Purchase Item or Inventory Item.',
    });
  }
}

/**
 * Item Category (General tab) — Excisable and GST are mutually exclusive
 * (enforced on the form: ticking one unchecks the other) but at least one of
 * the two must be selected; a product left with neither has no tax
 * classification at all. Same pattern as refineProductUsageFlags above:
 * exported separately so a caller that reshapes the schema (ProductMaster
 * swaps `status` for an `active` checkbox) can chain it on after reshaping.
 */
export function refineItemCategoryRequired(values, ctx) {
  if (values.excisable || values.gst) return;
  for (const field of ['excisable', 'gst']) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: 'Select either Excisable or GST.',
    });
  }
}

// The unrefined object, for callers that need to reshape it before refining —
// see refineProductUsageFlags above. Prefer `productSchema` unless you are
// doing exactly that.
export const productBaseSchema = z.object({
  productCode: requiredString('Product code'),
  productName: requiredString('Description'),
  barcode: optionalString(),
  productGroup: requiredString('Product group'),
  productSubGroup: optionalString(),
  brand: optionalString(),
  productType: optionalString(),
  // Which flows this product may be used in. Independent, not exclusive — a
  // traded good is bought and sold and carries both; a raw material is
  // purchase-only; a service is sales-only and never moves stock. Each
  // document's product picker offers only the products flagged for its own
  // flow (see lib/productUsage.js).
  //
  // At least one must be set; the rule lives in the superRefine below rather
  // than on the individual fields, because it is a statement about the three
  // together and there is no one field to hang it on.
  salesItem: z.boolean().optional(),
  purchaseItem: z.boolean().optional(),
  inventoryItem: z.boolean().optional(),
  uom: requiredString('Unit of measure'),
  salesUom: optionalString(),
  // The standalone "HSN / SAC Code" input was removed from the General tab;
  // this column is now populated by the conditional "HSN" field that appears
  // under Item Category while GST is ticked (see ProductMaster.jsx) — same
  // column, single source of truth, no separate gstHsn field.
  hsnCode: hsnCode(),
  // Item Category tax treatment — mutually exclusive, enforced on the form
  // (ProductMaster.jsx checks one and unchecks the other) rather than here,
  // since a superRefine rejecting both-true would surface as a save-time
  // error instead of simply never letting both get ticked in the first place.
  excisable: z.boolean().optional(),
  gst: z.boolean().optional(),
  // Conditional Item Category detail fields — chapterId is shown only while
  // excisable is ticked, taxCategory only while gst is ticked (see
  // ProductMaster.jsx). GST's own HSN entry reuses the hsnCode field below
  // rather than a separate column — see the comment there. Both optional,
  // same reasoning as excisable/gst above.
  chapterId: optionalString(),
  taxCategory: optionalString(),
  // taxCode / taxRateType / taxRate / salesPrice / minSalesPrice removed —
  // see migration 20260823160000_drop_product_sales_tax_fields. Product
  // Master's Sales tab no longer collects a per-product default price or
  // tax.
  // Inventory costing method — 'None' | 'FIFO' | 'Moving Average'. Optional
  // so existing products (which have no value) keep validating.
  calculationMethod: optionalString(),
  // How this product is tracked at the unit level — 'None' | 'Batch' | 'Serial'.
  // Required: the form always defaults it to 'None' on both create (see
  // getEmptyValues) and edit (editingRow.manageItemBy || 'None'), so no
  // existing or new product can actually reach submit with this blank —
  // making it required just stops a direct API call from clearing it.
  manageItemBy: requiredString('Manage item by'),
  // Which level's G/L account mappings this product posts through —
  // 'Warehouse' | 'Product Group'. Optional so existing products (saved
  // before this field existed) keep validating; the form defaults it to
  // 'Warehouse' for a new product regardless.
  glAccountsBy: optionalString(),
  costPrice: currencyAmount('Cost price'),
  openingStock: nonNegativeNumber('Opening stock'),
  reorderLevel: nonNegativeNumber('Reorder level'),
  expiryApplicable: z.boolean().optional(),
  defaultSupplier: optionalString(),
  // The warehouse a product is stocked in by default. Was required and
  // picked from the Warehouse Master; the input was removed from the
  // Inventory tab on request, so this can no longer be required — a form
  // with no control for a required field could never be saved. Left
  // optional (rather than deleted) so an existing product's stored value
  // still round-trips.
  //
  // NOTE: five inventory reports built their warehouse filter off this
  // column's distinct values (see the comment that used to live here); any
  // product created after this field lost its input has no value here,
  // which those reports should account for.
  defaultLocation: optionalString(),
  rackNo: optionalString(),
  description: optionalString(),
  remarks: optionalString(),
  status: statusEnum(),

  // --- General tab (header) — see migration 20260823150000_add_product_tab_fields ---
  foreignName: optionalStrictName('Foreign name'),
  manufacturer: optionalString(),
  msdc: optionalString(),
  additionalIdentifier: optionalString(),
  shippingType: optionalString(),
  costCenterCode: optionalString(),
  costCenterName: optionalString(),
  manageMethod: optionalString(),
  priceList: optionalString(),
  unitPrice: optionalCurrencyAmount('Unit price'),
  // Fourth "Item Listed In" flag, independent of salesItem/purchaseItem/
  // inventoryItem — see the schema comment on Product.assetItem.
  assetItem: z.boolean().optional(),

  // --- Purchase tab ---
  mfrCatalogNo: optionalString(),
  purchasingUomName: optionalString(),
  itemsPerPurchaseUnit: optionalNonNegativeNumber('Items per purchase unit'),
  purchasePackagingUomName: optionalString(),
  quantityPerPurchasePackage: optionalNonNegativeNumber('Quantity per package'),
  customsGroup: optionalString(),

  // --- Sales tab ---
  itemsPerSalesUnit: optionalNonNegativeNumber('Items per sales unit'),
  salesPackagingUomName: optionalString(),
  quantityPerSalesPackage: optionalNonNegativeNumber('Quantity per package'),

  // --- Shared physical attributes (repeated across Purchase/Sales/Inventory
  // tabs in the UI, one column each here) ---
  taxGroup: optionalString(),
  productLength: optionalNonNegativeNumber('Length'),
  width: optionalNonNegativeNumber('Width'),
  height: optionalNonNegativeNumber('Height'),
  // Read-only on the form — auto-calculated from length * width * height.
  volume: optionalNonNegativeNumber('Volume'),
  weight: optionalNonNegativeNumber('Weight'),
  // factor1-4 removed — see migration 20260823200000_drop_product_factor_fields.

  // --- Inventory tab ---
  manageInventoryByWarehouse: z.boolean().optional(),
  inventoryLevelRequired: optionalNonNegativeNumber('Inventory level required'),
  minimumLevel: optionalNonNegativeNumber('Minimum level'),
  maximumLevel: optionalNonNegativeNumber('Maximum level'),
  inventoryUomName: optionalString(),
});

export const productSchema = productBaseSchema.superRefine(refineProductUsageFlags);

export const purchasePriceSchema = z.object({
  supplier: requiredString('Supplier'),
  productCode: requiredString('Product code'),
  productName: requiredString('Product name'),
  uom: optionalString(),
  currency: requiredString('Currency'),
  price: currencyAmount('Price'),
  effectiveDate: anyDate('Effective date'),
  status: statusEnum(),
});

export const salesPriceSchema = z.object({
  customer: requiredString('Customer / price list'),
  productCode: requiredString('Product code'),
  productName: requiredString('Product name'),
  uom: optionalString(),
  currency: requiredString('Currency'),
  price: currencyAmount('Price'),
  effectiveDate: anyDate('Effective date'),
  status: statusEnum(),
});

// customer/productCode are intentionally optional here — an empty value
// means "All Customers" / "All Products" (a broad discount rule), not a
// missing field.
// Product Setup > Price List — a named, dated list of item prices (header)
// plus one row per priced item (lines), same master/detail shape as the
// inventory documents (Stock Transfer, Stock Issue, ...): productCode is the
// only thing a row truly needs, productName/productGroup are carried along
// for display (and for the Download/Upload Excel round-trip) rather than
// re-looked-up every render, and price is always hand-typed here (Price List
// is itself a source other pages price from, not a consumer of one).
export const priceListItemSchema = z.object({
  productCode: requiredString('Item'),
  productName: optionalString(),
  productGroup: optionalString(),
  price: currencyAmount('Price'),
});

// type drives auto-fill: DLP feeds Purchase Unit Price, CLP feeds Sales Unit
// Price (see usePriceListRates). MRP/Other are informational only for now.
export const priceListTypeEnum = () => z.enum(['DLP', 'CLP', 'MRP', 'Other']);

export const priceListSchema = z.object({
  priceListName: requiredString('Price list name'),
  effectiveDate: anyDate('Effective date'),
  type: priceListTypeEnum(),
  status: statusEnum(),
  items: z.array(priceListItemSchema).min(1, 'Add at least one item'),
});

export const customerDiscountSchema = z.object({
  customer: optionalString(),
  discountType: requiredString('Discount type'),
  productCode: optionalString(),
  productName: optionalString(),
  discountValue: percentage('Discount value'),
  validFrom: anyDate('Valid from'),
  validTo: anyDate('Valid to'),
  status: statusEnum(),
}).refine((data) => !data.validFrom || !data.validTo || data.validTo >= data.validFrom, {
  message: 'Valid To must be on or after Valid From',
  path: ['validTo'],
});
