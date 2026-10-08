# Implementation prompt — make the Purchase Order printout match the reference PDF

## Context

`frontend/src/components/print/PurchaseOrderPrintable.jsx` renders the Purchase Order
print layout (triggered by `window.print()` from `frontend/src/pages/purchase/PurchaseOrder.jsx`).
A working-tree redesign of this template is already in progress (bordered-table layout,
dual logos, HSN summary, `lib/documentTotals.js` for the maths). The Business-Partner
logo feature it depends on is also already implemented (schema `logo_key`, migration
`20260903100000_add_business_partner_logo_key`, `POST/DELETE /business-partners/:id/logo`
in `backend/src/routes/resources.js`, `useUploadBusinessPartnerLogoMutation` in
`frontend/src/features/resources.js`, upload UI in `BusinessPartner.jsx`).

Two reference files:
- **Target** (what the output must look like): `262740026 BETA 30 KANNUR BRANCH DTD_05_06_26.pdf`
  — a single-page A4 **portrait** PO from the legacy system, real data
  (INDUS MOTOR COMPANY / KEM/PO/ BETA-30 / 262740026 / BETA 30 Rock Breaker / ₹3,00,000).
- **Current output**: `purchaseorder.pdf` — landscape, spills to 2 pages, `(INR)`-prefixed
  amounts with Indian comma grouping, `DEFAULT_TERMS` boilerplate, placeholder company data.

Goal: close the layout/formatting gaps below so a real PO renders like the target.
Do **not** change `lib/numberToWords.js`'s exported `amountToWords` (Cheque Print depends
on it) — add a local formatter in the template instead.

## Required changes — `PurchaseOrderPrintable.jsx`

### 1. Number formatting — drop `(INR)` and comma grouping where the reference does

The target never shows thousands separators. It uses two distinct money formats:

| Place | Target shows | Currently shows |
|---|---|---|
| Item table (Unit Price, Ass. Value, Tax Amount, Amount), Total row | `254237.28`, `299999.99` | ok (`fmt2`) |
| Freight charges / Round off / **Grand Total** box | `0.00`, `0.01`, `300000.00` | `(INR)0.00` … `(INR)3,00,000.00` |
| HSN/SAC summary table (Taxable Value, tax amounts) | `(INR)254237.28`, `(INR)22881.36` | `(INR)2,54,237.28` |

- Change `fmtMoney` so it is `(INR)` + `Number(n).toFixed(2)` — **no** `toLocaleString`
  grouping. Keep it only on the HSN/SAC table.
- In the Freight / Round off / Grand Total `<table class="po2-grand-table">`, use plain
  `fmt2(...)` (no `(INR)` prefix), matching the target.

### 2. Amount-in-words — match the legacy wording exactly

Target strings:
- Amount in Words: `Three lakhs only`
- Tax Amount in Words: `Forty-Five Thousand Seven Hundred Sixty-Two and Seventy-One Pisa only`

Differences from the current `wordsInr` (which calls `amountToWords`):
- Compound tens are **hyphenated**: `Forty-Five`, `Sixty-Two`, `Seventy-One`
  (current: `Forty Five`).
- Lower-case `only` (current: `Only`).
- Fractional part label is **`Pisa`**, not `Paise` (this is a legacy misspelling in the
  source system — replicate it verbatim per the match requirement; see Open question 1).
- `lakhs` lower-case and pluralised in the amount case (`Three lakhs only`).

Add a local `wordsInr(value)` in this file that produces this exact style; do not touch
the shared module. Keep feeding it `totals.grandTotal` for the amount line and
`totals.totalTax` for the tax line (already correct).

### 3. Add the "Comments :" row

The target has a `Comments :` line directly under the Ref No / Order Date / Transport
meta table. The template currently omits it. Render `order.remarks` (the PO form's
"Comments" field is `remarks` — see `PurchaseOrder.jsx:76`, `:97`). Show the label even
when empty, matching the target.

### 4. Shipping party name = company legal name, not the branch name

Target "Shipping Address" block shows the **company legal name**
(`KEMACH EQUIPMENTS PRIVATE LIITED`) with the **delivery branch's address**
(2199-13 Hazat Palaza … Kannur 670002 / Kerala. India.).

Currently `deliveryName = order.shipTo || company?.companyName` — when `shipTo` is a
branch name this prints the branch label instead of the company name. Change so:
- Shipping name → `company?.companyName` (same as Billing side).
- Shipping address lines → `branchRecord` address when resolved, else company address
  (the `deliveryAddr` / `deliveryLine2` logic already does this).

### 5. GSTIN label text in the Billing/Shipping boxes

Target uses `GSTN No: … / GSTN Type: …` (both boxes). Template currently prints
`GSTIN No: … / GST Type: …`. Change the two labels to `GSTN No:` and `GSTN Type:`.

### 6. Per-line CGST/SGST halves — show equal halves

Target line 1: CGST `22881.36` **and** SGST `22881.36` (both equal), and the HSN table
shows STATE TAX AMT `(INR)22881.36`. The current `lineTaxSplit` puts the rounding
remainder on the second half (`round2(tax - half)`), which would render SGST as
`22881.35`.

For the **displayed** Tax Amount column and the HSN/SAC summary rows, show each half as
`round2(tax / 2)` (equal halves). Keep the true summed tax (`totals.totalTax`,
`45762.71`) for the Amount column, Total row, Round off and Grand Total maths — those
already produce the target's `299999.99 → +0.01 → 300000.00`.

### 7. Orientation / single page

The current output printed landscape across 2 pages (old template). Verify the new
template:
- Add explicit portrait: `@page { size: A4 portrait; margin: 8mm; }`.
- Confirm the whole document fits one A4 page in Chrome print preview with a realistic
  single-line and a ~4-line item order. Tighten `.po2-terms` / `.po2-sign-block`
  bottom margins if it spills.

### 8. Minor whitespace nits (match target, low priority)

- Vendor address line under `To:` — target reads `Kerala India` (no comma between
  state and country) and `Ernakulam, - 682015`. Current `formatPartnerAddressLines`
  joins state/country with `', '`. Align if trivial; otherwise leave.
- Item-table `Tax %` cell: target's `CGST 9.0 %` / `SGST 9 0%` is legacy OCR noise —
  keep the clean `CGST 9.00` / `SGST 9.00`. Do **not** replicate the noise.

## Out of scope / already correct

- Dual logos (company + supplier `logoUrl`) — already wired; renders once the Indus
  Motor business partner has a logo uploaded.
- Title, meta table (Ref No / Order Date / Transport / Carrier Name), item columns,
  HSN grouping, footer (`Subject to "Coimbatore Jurisdiction"` + Ph/Email),
  `For <COMPANY>` signatory block — already match.
- `order.termsConditions` renders as-is; the target's `DELIVERY AT OUR KANNUR BRANCH.`
  is user-entered data. Note `PurchaseOrder.jsx` seeds new forms with `DEFAULT_TERMS`
  boilerplate — not this template's concern.

## Verification

1. `cd frontend && npm run lint` (or the repo's lint script) — no new warnings; remove
   the now-unused `taxRows` local if it stays unused.
2. Load a real PO (Indus Motor supplier, Kannur ship-to, the BETA-30 line) and
   `window.print()` → Save as PDF in Chrome. Compare side by side with
   `262740026 BETA 30 KANNUR BRANCH DTD_05_06_26.pdf`:
   - portrait, one page
   - amounts: `254237.28`, `299999.99`, Grand Total `300000.00`, Round off `0.01`
   - words: `Three lakhs only` / `… Sixty-Two and Seventy-One Pisa only`
   - `Comments :` row present
   - both address boxes say `GSTN No:` / `GSTN Type:`
   - HSN table: `(INR)254237.28`, CGST/SGST both `(INR)22881.36`

## Open questions

1. **`Pisa` vs `Paise`** — the reference misspells "Paise" as "Pisa". Replicate verbatim
   for a pixel match, or use the correct `Paise`? (Default: replicate, since the ask is
   an exact match.)
2. Amount-in-words casing (`Three lakhs only` — lower-case, pluralised) is unusual.
   Confirm this exact casing is wanted for every amount, or only mimic the structure.
