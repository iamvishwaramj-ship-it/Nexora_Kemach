import { branchAddressLinesOrdered } from './addressFormat';

/**
 * The delivery ("Shipping Address") postal lines for a Branch Master row.
 *
 * Lives in lib/ rather than in components/print/purchaseStationery.jsx so all
 * three purchase prints can share ONE implementation: PurchaseOrderPrintable
 * is deliberately standalone and is not routed through purchaseStationery
 * (see that file's own header note), and triplicating this formatting across
 * PO/GRN/Invoice is exactly how the three sheets would drift apart again.
 *
 * Branch carries BOTH a free-text `address` line and the SAP-style
 * Street No / Building-Floor-Room / Block split that was added alongside it
 * later (see `model Branch` in schema.prisma) — older branch rows have only
 * the free-text one filled in, newer ones may use either or both. Every field
 * is optional and sparsely filled in practice, so each line is built from
 * whatever is actually set instead of assuming any of them is present, the
 * same way formatPartnerAddressLines() handles a Business Partner address.
 *
 * Returns [] for a missing branch, which is the caller's signal to fall back
 * to the company's own address rather than printing an empty box.
 */
export function branchAddressLines(branch) {
  if (!branch) return [];
  // Address, Street No, Building/Floor/Room, Block / City, State, Country,
  // Zip Code -- see lib/addressFormat.js (no double commas).
  return branchAddressLinesOrdered(branch);
}

export default branchAddressLines;
