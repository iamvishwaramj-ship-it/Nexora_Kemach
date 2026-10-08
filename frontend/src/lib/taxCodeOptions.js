// Shared "Tax (%)" option builder for every transaction line-item table
// (Purchase Quotation/Order/GRN/Invoice, Sales Quotation/Order/Delivery
// Challan/Invoice). Every one of those tables used to carry its own
// hardcoded [0, 5, 12, 18, 28] rate list (or, on Delivery Challan/GRN, a
// plain free-typed number field) — none of them reflected the Tax Code
// master page, so a rate added/changed/retired there never showed up on a
// document. This is the single source those tables now all read from.
//
// The line-item field itself is still just a plain `taxPercent` number
// (unchanged data model — see purchaseSchemas.js/salesSchemas.js), so the
// value stored on the row is the tax code's rate, not its code. If two Tax
// Code records share a rate (e.g. two different GST slabs that happen to
// both be 18%), they collapse to one option by default — the option list is
// keyed by rate because that's what the row actually stores.
// `taxType`, when passed, restricts the result to Tax Codes of that type —
// 'GST' (the CGST+SGST intra-state pair) or 'IGST' (inter-state) — see the
// TaxCode model comment in schema.prisma. Sales/Purchase Invoice pass this
// so the Tax (%) dropdown only ever offers the type the document's own
// Place of Supply vs. Company State comparison calls for, instead of mixing
// both types' rates together as it did before. That taxType narrowing is
// also what quietly avoided the collapse-by-rate collision there: GST and
// IGST codes never appear side by side on those two documents, so two
// same-rate codes of DIFFERENT types never had to compete for one option.
//
// Sales Quotation/Order/Delivery Challan/Return/Credit Memo don't have a
// Place of Supply concept to filter by, so they pass every active code
// through regardless of type — which is exactly when a GST code and an
// IGST code sharing a rate (e.g. GST 18% and IGST-18, both 18%) used to
// collapse into a single option, silently hiding one of them from the
// dropdown (Tax Code master shows 4 codes, the dropdown showed 3). Pass
// `dedupe: false` there to list one option per Tax Code instead — the
// option's `value` is still the plain rate (unchanged storage/totals
// calculation), so two same-rate codes do still share a value and can't be
// told apart again once picked, but the dropdown itself no longer drops one
// of the master's configured codes from the list.
// `taxType` may also be an array of types — the "family" case: Kerala's
// GST family is ['GST', 'GST+TCS'] and every other state's IGST family is
// ['IGST', 'IGST+TCS'] (see taxTypeFamilyFor below). A single string still
// works exactly as before for any caller that only ever wants one exact type.
function matchesTaxType(t, taxType) {
  if (!taxType) return true;
  if (Array.isArray(taxType)) return taxType.includes(t.taxType);
  return t.taxType === taxType;
}

// This application's home state is Kerala. Every document here compares some
// state against Company Setup's own State via isInterState (documentTotals.js)
// rather than a hardcoded 'Kerala' literal, but since that Company State IS
// Kerala for this application, the result is exactly: a Kerala state match ->
// GST family (GST, GST+TCS) is offered in the Tax (%)/Tax Code column; any
// other state -> IGST family (IGST, IGST+TCS) is offered instead. Callers
// pass `isInterState(...)` straight in as `interState`.
//
// WHICH state is compared differs by document family — this file only cares
// that it's *some* state, not which one:
// - Sales documents (Sales Invoice, etc.) still compare the document's own
//   Place of Supply against Company State — there is no supplier on a sales
//   document to derive anything from.
// - Purchase Order/GRN/Invoice compare `supplierState` instead — the
//   selected SUPPLIER's own Business Partner Billing address state, auto-
//   filled the same way `shipFrom` is (see supplierState in those pages).
//   Their own Place of Supply field is auto-filled from the BRANCH's state
//   and stays on the form (still saved, still printed) but is deliberately
//   NOT what feeds this comparison any more — a purchase's GST/IGST split
//   depends on where the SUPPLIER is registered, not which branch bought the
//   goods. Do not "fix" those three pages back to Place of Supply.
export const GST_FAMILY_TAX_TYPES = ['GST', 'GST+TCS'];
export const IGST_FAMILY_TAX_TYPES = ['IGST', 'IGST+TCS'];
export function taxTypeFamilyFor(interState) {
  return interState ? IGST_FAMILY_TAX_TYPES : GST_FAMILY_TAX_TYPES;
}

export function buildTaxPercentOptions(taxCodes, { taxType, dedupe = true } = {}) {
  const active = (taxCodes || []).filter((t) => t.status === 'Active' && matchesTaxType(t, taxType));

  if (!dedupe) {
    return active
      .slice()
      .sort((a, b) => Number(a.taxRate ?? 0) - Number(b.taxRate ?? 0))
      .map((t) => {
        const rate = t.taxRate == null ? 0 : Number(t.taxRate);
        return { label: `${t.taxName} (${rate}%)`, value: rate };
      });
  }

  const byRate = new Map();
  for (const t of active) {
    const rate = t.taxRate == null ? 0 : Number(t.taxRate);
    if (!byRate.has(rate)) byRate.set(rate, t.taxName);
  }
  return Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, name]) => ({ label: `${name} (${rate}%)`, value: rate }));
}

// Tax-Code-keyed options for line grids that want to remember WHICH Tax Code
// was picked, not just its rate — Sales Invoice / Purchase Invoice use this
// so GL posting (backend/src/utils/glPosting.js) can prefer that Tax Code's
// own Sales/Purchase account over GlAccountDetermination's company-wide
// default (see the Mapping Priority note on the TaxCode model in
// schema.prisma). `value` is the TaxCode id — the caller is responsible for
// also writing `rate` into the line's own taxPercent field, since taxPercent
// (not taxCodeId) is still what computeTotals/documentTotals.js read; this
// is purely an additive companion to buildTaxPercentOptions above, not a
// replacement — a document/table that has no reason to track the specific
// Tax Code (Delivery Challan, GRN, etc.) can keep using the plain rate list.
export function buildTaxCodeOptions(taxCodes, { taxType } = {}) {
  const active = (taxCodes || []).filter((t) => t.status === 'Active' && matchesTaxType(t, taxType));
  return active
    .slice()
    .sort((a, b) => Number(a.taxRate ?? 0) - Number(b.taxRate ?? 0))
    .map((t) => {
      const rate = t.taxRate == null ? 0 : Number(t.taxRate);
      // taxType rides along so a caller that only has the option list (not
      // the raw taxCodes array) can still tell a 'GST+TCS'/'IGST+TCS' pick
      // apart from a plain 'GST'/'IGST' one — see documentTotals.js's TCS
      // carve-out, which needs exactly this per-line.
      return { label: `${t.taxName} (${rate}%)`, value: t.id, rate, taxType: t.taxType || '' };
    });
}

// Rate -> taxType lookup for the plain-rate "Tax (%)" tables (Purchase
// Quotation/Order/GRN/Invoice/Return/Credit Memo, Sales Invoice) that store
// only a line's taxPercent, not a taxCodeId, on the row itself while it's
// being edited (a taxCodeId is resolved separately at submit time — see
// taxCodeIdByRate/PurchaseInvoice.jsx). Those pages still need to know,
// live, whether the picked rate belongs to a '+TCS' Tax Code so the totals
// panel can show the TCS carve-out as the user types, before that submit-
// time resolution ever runs.
//
// Deliberately mirrors buildTaxPercentOptions's own dedupe-by-rate loop
// (same filter, same "first match wins" order) so the taxType this returns
// for a given rate is always the SAME Tax Code that rate's option/label came
// from — the two can never disagree about which Tax Code a picked rate
// means.
// Best-effort reverse lookup for rows saved before taxCodeId existed (or a
// row whose Tax Code was since made Inactive/retired): picks the first
// active Tax Code with a matching rate so the field isn't just left blank.
// If more than one active code shares that rate, which one comes back here
// is genuinely a guess — that ambiguity is exactly the bug taxCodeId exists
// to prevent going forward; it can't be resolved retroactively for a line
// the app never recorded a Tax Code against in the first place. Shared by
// every document page's rowToFormValues-equivalent so this migration
// fallback is written once, not once per page.
export function buildTaxCodeIdByRate(taxCodes) {
  const map = new Map();
  for (const t of (taxCodes || [])) {
    if (t.status !== 'Active') continue;
    const rate = t.taxRate == null ? 0 : Number(t.taxRate);
    if (!map.has(rate)) map.set(rate, t.id);
  }
  return map;
}

// Default Tax Code for a brand-new, blank item row (the "Add Item" button,
// or a new document's very first row) — see every document page's own
// getEmptyValues/"Add Item" onClick. The Tax (%) column on every one of
// these tables is actually a Tax Code CFL keyed by taxCodeId, not a free
// rate input (see buildTaxCodeOptions above), so a brand-new row that leaves
// taxCodeId null shows as an EMPTY box until the user manually opens the
// dropdown and picks something — even though taxPercent may already carry a
// numeric default like 18, nothing in the row names WHICH Tax Code that is.
// This picks the same "plain" 18% GST Tax Code this app's home state
// (Kerala) offers everywhere (e.g. "Kerala GST@18%"), not the "+TCS" combo
// variant (e.g. "Kerala GST@18% + TCS@1%") — so a new line starts pre-filled
// with a real Tax Code instead of blank. Only ever used to seed a BRAND-NEW
// row: a row loaded from a saved document, or copied in via Copy From/Smart
// Add/Import, keeps whatever Tax Code it already has (or doesn't) untouched.
//
// `taxType`/`rate` narrow the search the same way buildTaxCodeOptions/
// buildTaxPercentOptions do — pass `taxTypeFamilyFor(interState)` from a
// document that already tracks interState; every other document (GRN,
// Quotation, Order, Delivery Challan, Return, Credit Memo — none of which
// filter their own Tax (%) dropdown by type at all) can call this with no
// options, since a brand-new document has no supplier/customer chosen yet
// and so is always intra-state (GST) by default.
export function pickDefaultTaxCode(taxCodes, { taxType = 'GST', rate = 18 } = {}) {
  const active = (taxCodes || []).filter((t) => t.status === 'Active');
  const family = Array.isArray(taxType) ? taxType : [taxType];
  // Prefer the plain (non-"+TCS") member of the family at the target rate.
  const plainTypes = family.filter((t) => !String(t).includes('+'));
  let match = active.find((t) => Number(t.taxRate ?? 0) === rate && plainTypes.includes(t.taxType));
  // Fall back to ANY active code at that rate within the family (even a
  // "+TCS" one) rather than leaving the field blank.
  if (!match) match = active.find((t) => Number(t.taxRate ?? 0) === rate && family.includes(t.taxType));
  // Last resort: any active code at that rate, whatever its type.
  if (!match) match = active.find((t) => Number(t.taxRate ?? 0) === rate);
  if (!match) return null;
  return { id: match.id, rate: Number(match.taxRate ?? 0), taxType: match.taxType || '' };
}

// Applies pickDefaultTaxCode's result to a brand-new item row — the small
// bit every document page's getEmptyValues/"Add Item" onClick repeats.
// Returns `item` unchanged when no default was found (see pickDefaultTaxCode's
// own fallback chain — this can only happen if no active Tax Code exists at
// the target rate at all), so a page never regresses to worse-than-before.
export function withDefaultTaxCode(item, defaultTaxCode) {
  if (!defaultTaxCode) return item;
  return { ...item, taxCodeId: defaultTaxCode.id, taxPercent: defaultTaxCode.rate };
}

export function buildTaxTypeByRate(taxCodes, { taxType } = {}) {
  const active = (taxCodes || []).filter((t) => t.status === 'Active' && matchesTaxType(t, taxType));
  const byRate = new Map();
  for (const t of active) {
    const rate = t.taxRate == null ? 0 : Number(t.taxRate);
    if (!byRate.has(rate)) byRate.set(rate, t.taxType || '');
  }
  return byRate;
}
