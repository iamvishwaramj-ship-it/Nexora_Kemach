// Fixed-option (CFL-style) select lists behind the "Other Details" card
// shared by Purchase Order, Purchase GRN and Purchase Invoice — see
// components/common/PurchaseOtherDetailsCard.jsx, which is the one place
// that renders them. Centralized here (rather than copy-pasted per page)
// so the three documents' Other Details card can never quietly drift out
// of sync with each other.
export const BILLING_TYPE_OPTIONS = ['B2B', 'B2C', 'Branch'].map((v) => ({ label: v, value: v }));
// 'Machine' / 'Parts' / 'Services' are the original values; the CFL group
// below (Tools, Lubes, Oil, Breakers, Furnitures, Stationaries, Computers)
// was added later as additional selectable values alongside them, not a
// replacement. FormSelect (see components/form/FormSelect.jsx) has no
// grouped-option rendering, so these stay flat entries like every other
// option list in this file rather than introducing a one-off grouping
// mechanism just for this field.
export const PURCHASE_TYPE_OPTIONS = [
  'Machine', 'Parts', 'Services',
  'Tools', 'Lubes', 'Oil', 'Breakers', 'Furnitures', 'Stationaries', 'Computers',
].map((v) => ({ label: v, value: v }));
export const SALES_TYPE_OPTIONS = ['Cash Purchase', 'Credit Purchase'].map((v) => ({ label: v, value: v }));
export const TYPE_OF_PURCHASE_OPTIONS = [
  'Breakdown with Warranty', 'Stock Order', 'Machine Order', 'Non Warranty Order',
  'Branch Transfer', 'Services', 'Standard Priority Order', 'Sales', 'Admin',
].map((v) => ({ label: v, value: v }));
export const TRANSPORT_MODE_OPTIONS = ['Road', 'Air', 'Rail', 'Ship'].map((v) => ({ label: v, value: v }));

// Sentinel value for Invoice Type's "Define New" option — never a real
// InvoiceType row's name, so it's safe to special-case in PurchaseOtherDetailsCard
// without colliding with anything a user could type.
export const INVOICE_TYPE_DEFINE_NEW = '__DEFINE_NEW__';
