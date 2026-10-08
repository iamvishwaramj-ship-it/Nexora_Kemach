// Which products a document may offer, given the flow it belongs to.
//
// Product Master carries three independent flags — Sales Item, Purchase Item,
// Inventory Item (see productSchema and the products.sales_item /
// purchase_item / inventory_item columns). Every document's product picker
// offers only the products flagged for its own flow, so a raw material never
// turns up on a sales invoice and a service charge never turns up on a goods
// receipt.
//
// The flags are independent rather than exclusive: an ordinary traded good is
// bought AND sold and carries both, so filtering is driven by the flag for
// THIS flow being on — never by the flag for the other flow being off.

export const PRODUCT_USAGE = {
  SALES: 'salesItem',
  PURCHASE: 'purchaseItem',
  INVENTORY: 'inventoryItem',
};

/**
 * Products selectable in one flow.
 *
 * A product with the flag missing entirely counts as usable. Every row
 * written before these columns existed comes back from an older cache or an
 * older API build without them, and the columns themselves default to true —
 * so treating absent as false would empty every picker in the app the moment
 * a stale response arrived. Absent means "not stated", and the honest reading
 * of "not stated" here is the default the database itself applies.
 */
export function filterProductsFor(products, usage) {
  const base = (products || []).filter((p) => p?.status !== 'Inactive');
  if (!usage) return base;
  return base.filter((p) => p?.[usage] !== false);
}

/**
 * Options for a picker, keeping any product the document ALREADY references.
 *
 * The filter above governs what may be newly selected. It must not govern
 * what an existing document can display: a purchase order raised last year
 * against a product since re-flagged sales-only still names that product on
 * its line, and dropping it from the options would blank the field the moment
 * the order is reopened — silently rewriting a saved document by doing
 * nothing more than looking at it.
 *
 * So `keepCodes` (the product codes already on the form) are always included,
 * however they are flagged now — and that same exemption is why an Inactive
 * product is filtered out here too (see below) rather than only at the
 * source: it has to survive on documents that already reference it, which a
 * blanket "don't even fetch Inactive rows" filter one layer up could not do.
 */
export function productOptionsFor(products, usage, keepCodes = []) {
  const keep = new Set((keepCodes || []).filter(Boolean));
  return (products || []).filter(
    (p) => (p?.[usage] !== false && p?.status !== 'Inactive') || keep.has(p?.productCode)
  );
}
