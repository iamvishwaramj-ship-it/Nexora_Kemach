// Shared by TaxCode.jsx (the Tax Code Master screen) and
// GLAccountDeterminationForm.jsx (Sales/Purchase > Tax tabs) -- both need the
// exact same "which tax-group rows does this Tax Code expand into" logic, so
// it lives here once rather than being duplicated and risking drift.
//
// A Tax Code's taxType is one of 'GST', 'IGST', 'GST+TCS' or 'IGST+TCS' (see
// the TaxCode model comment in backend/src/prisma/schema.prisma):
//   - GST      -> two rows, SGST and CGST, each at half the Tax Code's rate.
//   - IGST     -> one row, IGST, at the Tax Code's full rate.
//   - GST+TCS  -> three rows: SGST/CGST split the Tax Code's full typed rate
//                 half each (same as plain GST), PLUS a flat 1% TCS row added
//                 ON TOP — TCS is a separate 1% of (Subtotal + CGST + SGST +
//                 IGST), never carved out of the typed rate. Typed Rate 18%
//                 -> SGST 9% + CGST 9% + TCS 1% (of the different TCS base),
//                 21 total percentage points, not 19.
//   - IGST+TCS -> two rows, same addition: IGST at the full typed rate, TCS
//                 the flat 1% on top.
// Each row carries the three field names (on the TaxCode record) its own
// Sales/Purchase/RCM account lives in, e.g. SGST's account fields are
// sgstSalesAccountId / sgstPurchaseAccountId / sgstRcmAccountId.
export const TAX_GROUP_FIELD_PREFIX = { SGST: 'sgst', CGST: 'cgst', IGST: 'igst', TCS: 'tcs' };

// TCS is always this flat rate, ADDED ON TOP of the Tax Code's own Rate % —
// see backend/src/utils/documentTotals.js's computeTotals for the actual
// document-level formula (1% of Subtotal + CGST + SGST + IGST).
const TCS_RATE = 1;

function round2(n) {
  // Round to 2dp same as every other rate/amount in this app (see
  // backend/src/utils/documentTotals.js's round2) -- avoids a 4-decimal
  // half-rate for an odd-tenths input like 8.75%.
  return Math.round(n * 100) / 100;
}

function halfRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return null;
  return round2(n / 2);
}

// Returns [] for a Tax Code with no taxType/taxRate yet (e.g. a blank
// in-progress create form) rather than guessing.
export function buildTaxGroupRows(taxCode) {
  const type = String(taxCode?.taxType || '').trim().toUpperCase();
  const rate = taxCode?.taxRate;
  if (rate == null || rate === '') return [];

  const rowFor = (group, groupRate) => {
    const prefix = TAX_GROUP_FIELD_PREFIX[group];
    return {
      group,
      rate: groupRate,
      salesField: `${prefix}SalesAccountId`,
      purchaseField: `${prefix}PurchaseAccountId`,
      rcmField: `${prefix}RcmAccountId`,
    };
  };

  if (type === 'GST') {
    const half = halfRate(rate);
    return [rowFor('SGST', half), rowFor('CGST', half)];
  }
  if (type === 'IGST') {
    return [rowFor('IGST', Number(rate))];
  }
  if (type === 'GST+TCS') {
    const half = halfRate(rate);
    return [rowFor('SGST', half), rowFor('CGST', half), rowFor('TCS', TCS_RATE)];
  }
  if (type === 'IGST+TCS') {
    return [rowFor('IGST', Number(rate)), rowFor('TCS', TCS_RATE)];
  }
  return [];
}
