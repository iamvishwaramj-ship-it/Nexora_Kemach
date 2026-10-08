# Nexora TradeOne — ERP Audit and Bug Log

Rolling log of defects found during a functional/technical review of the
application against standard ERP (SAP-style) expectations. Severity reflects
business impact, not code ugliness.

**Status:** 35 defects fixed across three rounds, 138 automated tests added
(all passing), frontend builds clean. The pre-existing numbering suites are
green too — 38,912 assertions.

All nine audit areas have been reviewed and everything previously logged as
open has now been fixed, other than two items that are deliberately left as
follow-ups (see the end of this file).

Run the suite with:

```
cd backend && npm run test:unit     # 158 tests, real PostgreSQL via PGlite
cd backend && npm test              # the above plus the numbering suites
```

---

## ⚠ Required before this code will run

The round-1 fixes add columns, so the generated Prisma client is now stale.
Until both of these are run, **every document save will fail** with
`Unknown argument 'igstAmount'`:

```
cd backend
npx prisma migrate deploy      # applies 20260807090000_tax_correctness_and_outstanding_integrity
npx prisma generate            # regenerates the client with the new columns
```

The migration is additive and idempotent (`IF NOT EXISTS` throughout), and its
only destructive step — collapsing duplicate outstanding rows — preserves the
largest recorded payment. It has been verified end to end against a real
PostgreSQL in `src/tests/migrations.test.js`.

---

## Fixed in round 1

### BUG-01 — GRN and Delivery Challan tax hard-coded at 18% · **Critical**

`computeGrnTotals` and `computeChallanTotals` did this:

```js
const cgstAmount = subtotal * 0.09;
const sgstAmount = subtotal * 0.09;
```

Neither line table had a tax rate column, so **every** goods receipt and every
delivery challan was taxed at a flat 18% regardless of what the goods actually
attract. A consignment of 5%-rated or zero-rated stock was over-taxed by up to
18% of its value, and the GRN could never be reconciled against the Purchase
Order above it or the Purchase Invoice below it. The same wrong arithmetic was
duplicated in the frontend, so the screen agreed with the ledger — and both
were wrong.

**Fixed:** `tax_percent` and `discount_percent` added to
`goods_received_note_items` and `delivery_challan_items`; both documents now
compute tax per line at each line's own rate through the shared engine. Tax %
inputs added to both item grids, populated from the product master on
selection.

### BUG-02 — Money was never rounded · **Critical**

No calculation rounded to paise. Raw binary floats were handed to Prisma and
truncated into `Decimal(15,2)` at the last moment, so stored headers routinely
failed to add up: `taxableAmount + cgstAmount + sgstAmount ≠ amount`, and
`cgstAmount + sgstAmount ≠ totalTax` whenever the tax was an odd number of
paise. Documents whose parts do not sum to their total cannot be filed and
block reconciliation.

**Fixed:** `backend/src/utils/documentTotals.js` — a single rounding-correct
engine used by all eight document types. Line amounts round to paise, the
CGST/SGST split assigns the remainder to one side so the halves always sum to
the total, and every stored figure is a legal `Decimal(15,2)` value. Verified
by a 500-document randomised invariant test.

### BUG-03 — Inter-state supply could not be represented · **High**

Tax was always split half CGST / half SGST. Indian GST requires the whole
amount as IGST when the place of supply is a different state. No document had
an `igst_amount` column and five of the eight had no `place_of_supply` either.

**Fixed:** `igst_amount` added to all eight transaction headers,
`place_of_supply` added where missing. The tax treatment is resolved per
document by comparing the place of supply against the company's registered
state. Blank on either side falls back to intra-state, so existing records and
unconfigured companies behave exactly as before.

### BUG-04 — Apply and reverse were asymmetric · **Critical**

`applyToCustomerOutstanding` floored the balance at zero; the matching
`reverse` capped it at the invoice amount. The two were not inverses.

Concretely: a ₹1,000 invoice, two receipts of ₹800 each. Apply both → balance
0. Reverse the first → balance returns as **₹800**, not the correct ₹200. The
second receipt's money vanished from the ledger with no way to tell it had
happened. Every edit, unpost or delete of a posted receipt could corrupt the
customer's balance, and the same defect existed verbatim on the supplier side.

**Fixed:** `backend/src/utils/openItemLedger.js`. `balanceAmount` is no longer
independently mutable — it is derived as `invoiceAmount − paidAmount`. Only
`paidAmount` moves, by exactly the amount applied, in both directions. Apply
then reverse is now an exact identity for any sequence in any order, proved by
test against a real database.

### BUG-05 — A receipt could settle more than it was worth · **Critical**

Nothing validated `sum(amountApplied) ≤ paymentAmount`. A ₹1,000 receipt could
be applied ₹10,000 across invoices, clearing receivables that had never been
paid.

**Fixed:** whole-document pre-flight validation before any line is written, so
a settlement either posts completely or is rejected.

### BUG-06 — A receipt could settle more than an invoice owed · **High**

Nothing validated `amountApplied ≤ outstanding balance`. `paidAmount` was
allowed to exceed `invoiceAmount`.

**Fixed:** validated per line, to the paisa.

### BUG-07 — A receipt could settle another party's invoice · **High**

No check that the invoice belonged to the customer paying. A receipt from
Customer A could clear Customer B's invoice.

**Fixed:** validated against the open item's party name.

### BUG-08 — Withdrawing an invoice destroyed its settlement history · **Critical**

Setting an invoice back to Draft, cancelling it, or deleting it **deleted the
outstanding row outright**, even when receipts had been applied. The money
stayed on the Collection documents, which still referenced an invoice number
that no longer had a ledger entry; reversing those collections afterwards
silently did nothing because the row they look for was gone. The customer's
balance was then permanently wrong with no audit trail explaining why.

**Fixed:** an invoice with settlements applied cannot be withdrawn, reduced
below what has been settled, or deleted. The error names the amount and tells
the user to reverse the receipts first — the sequence SAP enforces.

### BUG-09 — Duplicate outstanding rows per invoice · **High**

`customer_outstanding.invoice_no` had no unique constraint but was looked up
with `findFirst`. Duplicates (which the backfill scripts could produce) meant
settlements landed on one row while reports summed them all.

**Fixed:** duplicates collapsed keeping the largest recorded payment, then a
partial unique index added on both outstanding tables. On-account rows with a
null invoice number are still allowed to repeat.

### BUG-10 — Mass assignment on every bespoke route · **High**

Every master/detail route did `const { items, ...header } = req.body` and
spread `header` straight into Prisma's `data`. A client could post
`{"id": 1}` to repoint a record's primary key, forge `createdAt`, or submit
its own `subtotal`/`amount` to save an invoice whose total does not match its
lines.

**Fixed:** `sanitizeHeader()` strips `id`, audit timestamps and every computed
money column before the body reaches Prisma; totals are always recomputed
server-side. The generic CRUD factory got the same treatment.

### BUG-11 — Over-receipt against a purchase order was unchecked · **High**

A GRN could receive any quantity, with no comparison against
`poQuantity − previouslyReceived`. Over-receipt inflates stock and produces an
invoice the PO cannot cover.

**Fixed:** `assertNoOverReceipt()` rejects a receipt whose cumulative quantity
exceeds the ordered quantity. Lines with no PO quantity (a receipt raised
without a PO) are deliberately unconstrained.

### BUG-12 — Purchase quotations and orders lost line discounts · **Medium**

`PurchaseQuotationItem` and `PurchaseOrderItem` had no `discountPercent`, and
the mappers ignored it, while `PurchaseInvoiceItem` had one. A discount agreed
at quotation stage had nowhere to live and disappeared on the way to the
invoice.

**Fixed:** `discount_percent` added to both line tables and honoured by the
engine.

### BUG-13 — Purchase quotations and orders had no round-off · **Medium**

Both stored a raw unrounded `amount` while the invoice they turn into was
rounded, so the two documents could never be tied out to the paisa.

**Fixed:** `round_off` added to both, plus `taxable_amount` and `round_off` on
the GRN, which had neither.

### BUG-14 — Invalid route ids surfaced as 500s · **Low**

`Number(req.params.id)` meant `GET /customers/abc` reached Prisma as `NaN` and
returned an opaque 500 from the query engine instead of a 400.

**Fixed:** `parseId()` validates and returns a 400 with a clear message.

### BUG-15 — Unbounded list queries · **Medium**

The generic CRUD list did `findMany` with no limit. Fine on demo data; a
couple of years of invoices is tens of thousands of rows and a timed-out
request.

**Fixed:** results are capped at 500 by default, with opt-in `?page=`/`?limit=`
paging that returns `meta: { page, limit, total, pages }`.

---

## Fixed in round 2

### BUG-18 — Purchases and sales never moved stock · **Critical**

The largest defect in the application. `utils/stockLedger.js` derived on-hand
quantity from three documents only:

```
openingStock + Stock Receipts − Stock Issues ± Stock Adjustments
```

A Goods Received Note did not increase inventory. A Delivery Challan and a
Sales Invoice did not decrease it. Inventory was completely decoupled from
procure-to-pay and order-to-cash: goods could be received against a purchase
order and sold to a customer all day without on-hand stock changing by a
single unit, and the only correction was to key a manual stock document
duplicating a movement the system already knew about. Stock summary,
valuation, low stock, slow moving, dead stock, reorder level and the
dashboard's inventory alerts all inherited the error.

**Fixed:** the ledger was rebuilt around seven document types. The subtle part
is de-duplication — a GRN followed by a Purchase Invoice describes one
physical movement, not two. SAP has the delivery move stock and the invoice
carry only the financial posting; this application does not require a
delivery, so the rule adopted is **an invoice moves stock only when no
delivery document is linked to it**. A Purchase Invoice with a `grnNo` is
financial only; one without is the receipt. Same for a Sales Invoice and its
`deliveryChallanNo`. The one-step and two-step flows are asserted to reach the
same figure.

All six inventory reports were refactored onto the single ledger, so they can
no longer disagree with each other.

### BUG-19 — No negative stock control · **High**

A Stock Issue or Delivery Challan could despatch a hundred units of something
the warehouse held ten of. The only sign was a negative figure appearing in
the reports days later, and negative stock makes valuation meaningless — there
is no cost layer to value the shortfall against.

**Fixed:** `assertNoNegativeStock` blocks both write paths of both documents.
Products with no master record are left alone rather than blocked.

### BUG-20 — Stock adjustments trusted the client's system quantity · **High**

`toStockAdjustmentItemData` read `item.currentStock` straight from the request
body. An adjustment exists to reconcile a physical count against *the
system's* view — taking the system side from the same request that carries the
physical count meant the recorded difference was whatever the client said it
was. A stale form wrote a difference that moved stock by the wrong amount, and
because the adjustment is itself a stock movement, the error compounded at the
next count.

**Fixed:** the system quantity is read from the ledger inside the transaction.
On an update it is read after the document's own previous lines are cleared,
so an edit measures against stock excluding its own prior effect.

### BUG-21 — Draft and cancelled invoices counted as revenue · **Critical**

None of the sales analytics reports filtered on status. Customer-wise Sales,
Product-wise Sales, Salesman-wise Sales and Profitability Analysis all counted
invoices somebody was still typing, and invoices that had been withdrawn, as
real revenue. Sales figures, gross profit and salesman performance were
overstated by whatever happened to be sitting in draft.

**Fixed:** a shared `REALISED_ONLY` filter excludes Draft and Cancelled across
all four.

### BUG-22 — The dashboard had the same defect · **Critical**

Total Sales, Total Purchase, the month-on-month change and the monthly series
were all built from unfiltered invoice rows.

**Fixed:** same status filter.

### BUG-23 — Profitability ignored the header discount · **High**

Margin was computed from line quantity x price less the *line* discount only.
An invoice discounted 10% at header level was reported at 10% more revenue and
10% more gross profit than it earned.

**Fixed:** the header discount factor is applied per line.

### BUG-24 — Recent payments showed a blank amount · **Medium**

The dashboard read `pay.amount` from `SupplierPayment`, which has no such
column — the figure is `paymentAmount`. The row also hard-coded its status as
'Paid', so a payment still in Draft was presented as having paid somebody.

**Fixed:** correct field, and the document's own status.

### BUG-25 — Bank reconciliation lines attached to the wrong statement · **High**

`syncBankReconciliationTxn` looked for a voucher's existing line only in
whichever reconciliation had the highest id. Two faults followed. Editing a
receipt recorded during an earlier reconciliation did not find its line, so a
second was created and the voucher appeared twice. Unposting or deleting that
receipt deleted nothing, leaving an orphan line that could never be matched.
Worse, when the newest reconciliation happened to be **Completed**, new
activity was injected into a signed-off statement.

**Fixed:** the lookup spans the whole bank account; new activity goes to an
open reconciliation, creating one if needed; and a line already marked
Reconciled is never silently rewritten.

### BUG-26 — A pre-existing numbering test had been failing at HEAD · **Low**

`suggestSeriesName` fills the first free 'Series N' ordinal rather than
appending after the highest. The test asserted the old append-at-the-end
behaviour and had been red since the rule changed. Verified against a pristine
checkout: the failure predates this work.

**Fixed:** the expectation, not the code — the implementation matches its
documented contract. Two further cases added to pin the gap-filling rule.

### BUG-27 — `asyncHandler` discarded its promise · **Low**

Covered in round 1; repeated here because it is what let BUG-16 hide.

---

## Fixed in round 3

### BUG-28 — Orders never showed what had been fulfilled · **High**

A purchase order stayed `Open` no matter how many goods receipts were posted
against it; a sales order likewise. No line carried a delivered, invoiced or
received quantity, so partial fulfilment could not be represented at all.
Buyers had no way to see what was still on order, and the pending-order
reports re-derived delivery status by string-matching document numbers.

**Fixed:** `utils/documentFlow.js` recomputes each order from the documents
raised against it — `Open` / `Partially Delivered` / `Partially Received` /
`Closed` — and writes the fulfilled quantity onto every line. It runs on
create, edit **and delete** of every challan, receipt and invoice, so removing
a delivery reopens what it had closed. Repointing a document at a different
order recomputes both. A cancelled order is never reopened: cancellation is a
human decision and recomputing over it would silently undo somebody's work.

Two details worth knowing. A product appearing on two lines of the same order
has its fulfilment consumed line by line rather than credited in full to both,
which would otherwise close the whole order on a part delivery. And where no
delivery document exists at all, the invoice is treated as the fulfilling
document — the same de-duplication rule the stock ledger uses — so a one-step
sale does not leave its order open forever.

### BUG-29 — Over-delivery against a sales order was unchecked · **High**

The purchase side has had an over-receipt guard since round 1. The sales side
had nothing: an order for 10 could be delivered three times over in full.

**Fixed:** `assertNoOverDelivery` on both challan write paths, with an
exclusion so that editing a challan does not measure itself as extra.

### BUG-30 — Credit limits were captured and never enforced · **High**

`Customer.creditLimit` was on the master, shown in the outstanding report, and
checked nowhere. An order or invoice could be raised for any amount for any
customer, however far past their limit they already were.

**Fixed:** exposure is measured the way a credit controller would — what is
already owed on open invoices plus what this document adds — and the posting
is refused with the figures named. An unset or zero limit means *no limit*,
not *no credit*: treating an unconfigured master as a hard block would stop
every sale on day one. Editing an invoice excludes its own prior exposure.

### BUG-31 — Cheques never settled the invoices they listed · **High**

`ChequeInvoiceApplication` recorded an amount to pay per invoice and nothing
ever applied it. Paying a supplier by cheque left the debt standing in full.

**Fixed:** cheques settle through the same open-item ledger as Payment Entry,
with the same over-application, wrong-party and over-settlement guards.
Settlement follows the instrument rather than the keystroke: a `Pending`
cheque is a draft and clears nothing; issuing it applies the settlement;
cancelling, deleting or editing it reverses cleanly first, so re-saving cannot
double-settle.

### BUG-32 — Cash, Bank and Day Book ignored cheques and deposits · **High**

The balance was house-bank opening plus posted collections minus posted
supplier payments, and nothing else. Every cheque written and every deposit
banked was invisible to all three reports.

**Fixed:** both are included, de-duplicated against what is already counted —
a cheque whose number matches a Payment Entry's instrument number is not
debited twice, and a deposit banking an already-credited collection is not
credited twice.

### BUG-33 — Deleting a master record orphaned its history · **Medium**

Customers, suppliers and products are linked to transactions by a plain string
with no foreign key, so the database could not refuse a delete that orphaned
history the way it would for a real relation. Deleting a customer left their
invoices pointing at a name that no longer existed: the outstanding report
still showed the debt, nothing could be collected against it, and no screen
explained where the customer had gone. Renaming one detached it from
everything it had ever done, in a single save.

**Fixed:** deleting a referenced master is refused, naming the document types
and counts involved and suggesting Inactive instead. Renaming cascades across
every transaction table in the same transaction. And a document naming a
party or product that does not exist is rejected, so a typo can no longer
create a phantom customer with real money attached to it.

### BUG-34 — Cost of sales moved with the product master · **Medium**

Sales invoice lines carried no cost, so margin was valued against the product
master's *present* cost price. Changing a cost price silently restated every
historic margin the business had already reported.

**Fixed:** `cost_price` is stamped on each sales invoice and delivery challan
line at the moment it is saved. Profitability uses the stamped figure and
falls back to the master only for lines written before the column existed.

### BUG-35 — Any user could delete anything · **Medium**

`auth()` was called with no roles anywhere, so any authenticated user could
delete invoices, remove master data and post payments. The middleware had
supported roles from the start and nothing had ever used them.

**Fixed:** all 15 destructive routes and the generic CRUD delete now require
the admin role. Reads and day-to-day document creation stay open to every
authenticated user.

### BUG-36 — Placeholder signing secrets could reach production · **Medium**

`backend/.env` shipped `change_me_access_secret_dev_only`. Anyone holding that
string could mint a valid admin token for any deployment still using it, and
nothing would notice. A *missing* secret was worse: jsonwebtoken throws only
when somebody tries to log in, so the service starts, looks healthy, and fails
at the first request.

**Fixed:** production boot now refuses to start on a missing, placeholder,
too-short or duplicated secret, and prints the command to generate a good one.
`.env` is gitignored, and `cleanup-repo.ps1` walks through untracking it.
**The exposed credentials still need rotating by hand.**

---

## Remaining follow-ups

Everything previously listed here has been fixed. Two items are deliberately
left, both because they are design decisions rather than defects.

### Foreign keys for master data · *design change, costed follow-up*

Round 3 added integrity guards — delete is refused when referenced, renames
cascade, and unknown parties are rejected on save — which fixes the damage the
string linkage was causing. The linkage itself is still a string.

Converting to real foreign keys means adding id columns to roughly a dozen
transaction tables and backfilling them by matching names. That backfill will
fail loudly on any historic transaction whose party name no longer matches a
master record, and on this data there will be some. It needs a data-cleansing
pass first and a maintenance window, so it is a planned piece of work rather
than something to fold into a bug-fix round.

The guards mean nothing new can drift while that is scheduled.

### Historic cost of sales is an approximation · *unrecoverable*

From now on every invoice line carries the cost that applied when it was
raised. For invoices written before the column existed, the true cost at the
time of sale was never recorded anywhere — that is precisely the defect being
fixed — so the backfill stamps the current master cost and says so in its
output. Historic margins are therefore approximate; going forward they are
exact. No amount of engineering recovers a number that was never written down.

---

---

## Auto-generated master codes

Twelve master records — Branch, Tax Code, Sales Employee, Product Group,
Product Sub Group, Brand, Unit of Measure, Product, Product Catalog,
Customer, Supplier and Transporter — had a UNIQUE code column that the user
typed by hand. Two people creating a customer at the same time picked the
same code and the second save failed on the constraint; more often the codes
were simply inconsistent, because nothing enforced a pattern.

They now draw from the same numbering engine the sixteen transaction
documents use, and appear in Company Setup → Document Numbering alongside
them, with the same prefix / separator / length / start / end / manual-entry
controls.

### Why master series carry no financial year

This is the one place the two kinds of numbering genuinely differ, and it is
worth being explicit about.

A transaction series is scoped per financial year: invoice numbers restart
each April and usually carry the year token, which is what an auditor
expects. A master code is the opposite. `CUS-000001` identifies one customer
for as long as that customer exists. If the counter reset each April, the
next new customer would be issued a code that already belongs to somebody —
and because the column is UNIQUE, the save would simply fail.

Master series are therefore **perpetual**: `financial_year_id` is NULL, the
FY token is never included, and the counter never resets. Three consequences
fall out of that:

- `document_numbering.financial_year_id` became nullable.
- Uniqueness for those rows needed **partial indexes**. Postgres treats NULLs
  as distinct, so the existing composite unique keys would have allowed two
  "Series 1" rows, and two defaults, for the same master.
- A CHECK constraint rejects any perpetual series that claims to reset or to
  carry the year token, so the rule is structural rather than a convention
  somebody has to remember.

### Reset to Default excludes masters

`POST /company/document-numbers/reset` rebuilds a financial year's standard
series. It iterated the whole catalog, so once the twelve masters were added
it would have created FY-scoped copies of them — giving each master a second
default series and reissuing codes that records already hold. It now resets
only the sixteen transaction documents. Caught by the existing CRUD suite,
which asserted the reset produces exactly the catalog's worth of series.

### Existing data

Nothing is renumbered. Codes already keyed by hand stay exactly as they are;
this governs codes issued from now on. Each series starts at 1, so if a
generated code collides with a legacy hand-typed one the UNIQUE constraint
rejects the save with a clear "already exists" message rather than
overwriting anything — raise that series' Current No. under Document
Numbering to step past the collision.

Any master can be switched back to hand-keyed codes by turning Manual Entry
on for its series; the field then unlocks and the typed value is validated
against the series pattern instead of generated.

## Test coverage added

| Suite | Tests | What it protects |
|---|---|---|
| `documentTotals.test.js` | 23 | Rounding, mixed tax rates, discounts, IGST, round-off, degenerate input, 500-document randomised invariant |
| `frontendParity.test.js` | 6 | Frontend and backend engines agree across 2,000 randomised documents |
| `migrations.test.js` | 8 | Every migration applies in order to a real PostgreSQL; de-duplication preserves payments |
| `schemaParity.test.js` | 8 | `schema.prisma` and the migrated database agree on every column, type, precision and nullability |
| `openItemLedger.test.js` | 17 | Settlement arithmetic, apply/reverse identity, over-application guards |
| `stockLedger.test.js` | 20 | All seven stock-moving documents, invoice de-duplication, status handling, filters |
| `documentFlow.test.js` | 23 | Order fulfilment, partial delivery, status propagation, over-delivery guard |
| `businessRules.test.js` | 18 | Credit limits, delete guards, rename cascade, unknown-party rejection |
| `routeWiring.test.js` | 4 | All ~200 routes mount, every handler is reachable, none is unauthenticated |
| `headerSanitization.test.js` | 17 | What reaches the database on a write; cheque settlement; cost stamping; admin-only deletes; negative-amount and party guards |
| `masterNumbering.test.js` | 14 | Perpetual master series: scope, seeding, partial-unique enforcement, no-reset CHECK, sequential allocation |
| **Total** | **158** | |

Every database-backed suite runs against a real PostgreSQL (PGlite) with this
repository's own migrations applied — not a mock.

Plus the pre-existing numbering suites, all green: 192 + 139 + 38,550 + 31 =
**38,912 assertions**.

## Audit coverage

| Area | Status |
|---|---|
| Core infrastructure (schema, CRUD factory, auth, error handling) | Reviewed |
| Document calculation — all 8 sales/purchase types | Reviewed |
| Sales: quotation, order, challan, invoice, outstanding | Reviewed |
| Purchase: quotation, order, GRN, invoice | Reviewed |
| Receivables/Payables: collections, payments, settlement | Reviewed |
| Inventory: receipts, issues, adjustments, the stock ledger | Reviewed |
| Banking: deposits, cheques, reconciliation, cash/day/bank book | Reviewed |
| Masters and document numbering | Reviewed |
| Reports and Dashboard | Reviewed |
| Document flow, credit control, roles, secrets | Reviewed |
