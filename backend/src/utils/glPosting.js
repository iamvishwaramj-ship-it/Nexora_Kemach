/**
 * Automatic G/L posting — the accounting document behind every business
 * document.
 *
 * Nothing generated the books before this. A sales invoice moved stock and
 * updated the customer's outstanding balance, but no debit ever reached
 * Revenue and no credit ever reached Accounts Receivable; the only way an
 * amount entered the ledger was somebody typing it into the Journal Entry
 * screen by hand. That is not a bookkeeping system, it is a stock system with
 * a notepad attached: the trial balance could never be produced from the
 * documents, and any figure in it was only as reliable as whoever remembered
 * to key it.
 *
 * SAP solves this with automatic account determination (OBYC / VKOA): a
 * logistics or financial document posts, and the system *derives* the
 * accounting document from it. The user never types those journal lines and
 * cannot get them wrong, because they were never a matter of opinion — the
 * accounts come from configuration and the amounts come from the document.
 * This module is that layer.
 *
 * ## Two kinds of journal entry now exist
 *
 *   Manual        — typed on the Journal Entry screen. transactionType is
 *                   always 'Manual', sourceType/sourceDocNo are null, and the
 *                   user owns every line. Adjustments, accruals, corrections.
 *
 *   System        — generated here. transactionType names the process
 *                   ('Sales Invoice', 'Purchase GRN', …), sourceType and
 *                   sourceDocNo point back at the document that caused it,
 *                   and it is READ-ONLY: editing the books behind a document's
 *                   back is exactly what an audit trail exists to prevent. It
 *                   is corrected by correcting (or cancelling) the source
 *                   document, which reverses and regenerates it.
 *
 * ## Exactly once, or the books double
 *
 * Every document route re-saves its whole record on edit. Without an
 * idempotency key, re-saving a posted invoice would post its journal entry a
 * second time and the ledger would quietly drift by the invoice amount, with
 * nothing on screen to show it had happened.
 *
 * (sourceType, sourceDocNo) is that key, enforced by a FILTERED unique index
 * — filtered so that manual entries, which carry NULL on both, stay exempt.
 * This is the same guarantee `hasPostedAlready(transType, transNum)` gives
 * the stock subledger in utils/stockTable.js, and it is deliberately the same
 * shape: the two subledgers are answering the same question about the same
 * documents, and they should be wrong or right together, never separately.
 *
 * ## Missing configuration parks the entry, it never blocks the document
 *
 * Account determination is configuration, and configuration has gaps —
 * a Product Group created last week with no Revenue account on it, a new
 * financial year whose determination row was never filled in. The choice
 * when that happens is between two failures:
 *
 *   - refuse the document (SAP ECC's behaviour): the books stay perfect and
 *     nobody can invoice until an administrator is found;
 *   - post the document and park the journal entry: invoicing continues, and
 *     the ledger carries a visible, named debt that has to be settled.
 *
 * This module does the second. A journal entry is still created — status
 * 'Pending G/L', no lines, and `glError` naming the exact account that is
 * missing — so the gap is a row somebody can see and act on rather than a
 * silent omission. Fixing the configuration and calling
 * POST /journal-entries/:id/post-to-gl generates the lines. Nothing is ever
 * skipped quietly, which is the property that actually matters: an unposted
 * entry you can list is recoverable, an entry that never existed is not.
 *
 * ## Perpetual inventory
 *
 * Goods movements hit the G/L the moment they happen — a delivery posts COGS
 * against Inventory, a goods receipt posts Inventory against Goods Clearing.
 * Inventory value in the books therefore always agrees with the stock ledger,
 * which is the whole point of running FIFO/Moving-Average costing (see
 * utils/stockValuation.js) rather than valuing stock once a quarter.
 */

const { round2, normaliseLine, isInterState, computeLineTaxBreakdown } = require('./documentTotals');
const { BASE_NON_MOVING_STATUSES } = require('./stockTable');

// Splits an array into fixed-size slices — same shape (and same reason) as
// the chunkArray helper in routes/resources.js: SQL Server caps a single
// query at ~2100 bind parameters, so a bulk createMany/deleteMany against a
// large array has to go in slices rather than one call. journal_entry_lines
// rows carry ~11 columns each when built here (see createPosting().build()
// plus the journalEntryId stamped on below), so 150 rows/chunk (1650
// params) stays comfortably under that cap — same margin as the sibling
// BPOB_CREATE_CHUNK_SIZE in resources.js.
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
const JOURNAL_LINE_CREATE_CHUNK_SIZE = 150;

// Writes a built/balanced set of journal entry lines for one journal entry,
// in chunks, instead of a single nested `lines: { create: lines } }` write.
// Prisma's nested `create` on a to-many relation issues one INSERT per row,
// sequentially, with no batching at all — fine for an ordinary handful-of-
// lines document, but a large BP Opening Balance import (the same
// thousands-of-distinct-Business-Partners case that made resources.js chunk
// its own inserts — see BPOB_CREATE_CHUNK_SIZE/BP_OUTSTANDING_CREATE_CHUNK_SIZE)
// can produce thousands of distinct journal lines (each BP has its own
// control account, so createPosting().build() has nothing to merge them
// into), which turned this one nested write into thousands of sequential
// round trips inside the same transaction. createMany batches those into a
// handful of round trips per chunk instead, matching the chunking concept
// already used for the BP lines and Outstanding rows themselves.
async function createJournalEntryLines(tx, journalEntryId, lines) {
  if (!lines || !lines.length) return;
  for (const chunk of chunkArray(lines, JOURNAL_LINE_CREATE_CHUNK_SIZE)) {
    await tx.journalEntryLine.createMany({
      data: chunk.map((line) => ({ ...line, journalEntryId })),
    });
  }
}

/**
 * Every process that can produce a journal entry.
 *
 * The string values are what land in JournalEntry.transactionType and
 * JournalEntry.sourceType, and they are also the option list on the Journal
 * Entry screen — one list, so a value can never exist in the UI that the
 * engine does not understand, or vice versa.
 */
const JOURNAL_SOURCE_TYPES = {
  MANUAL: 'Manual',
  PURCHASE_GRN: 'Purchase GRN',
  PURCHASE_INVOICE: 'Purchase Invoice',
  PURCHASE_RETURN: 'Purchase Return',
  PURCHASE_CREDIT_MEMO: 'Purchase Credit Memo',
  DELIVERY_CHALLAN: 'Delivery Challan',
  SALES_INVOICE: 'Sales Invoice',
  SALES_RETURN: 'Sales Return',
  SALES_CREDIT_MEMO: 'Sales Credit Memo',
  STOCK_ISSUE: 'Stock Issue',
  STOCK_RETURN: 'Stock Return',
  PAYMENT_RECEIPT: 'Payment Receipt (Incoming Payment)',
  PAYMENT_VOUCHER: 'Payment Voucher (Outgoing Payment)',
  STOCK_TRANSFER: 'Stock Transfer',
  BP_OPENING_BALANCE: 'BP Opening Balance',
  INVENTORY_OPENING_BALANCE: 'Inventory Opening Balance',
};

/**
 * Where each source document type keeps its own posting/document/due dates.
 *
 * The obvious approach — `doc.postingDate || doc.date || doc.documentDate`
 * — silently produced a blank date on the journal entry for Goods Received
 * Note, Purchase Invoice, Sales Invoice and Delivery Challan, because none
 * of those models has a column by any of those three names: a GRN's date is
 * `receivedDate`, an invoice's is `invoiceDate`, a challan's is
 * `challanDate`. Naming the real field per source type here, instead of
 * guessing, is what makes every journal entry actually carry the date its
 * source document was raised on.
 *
 * `dueDate: null` means the source document has no concept of a due date at
 * all (a goods movement, not something anyone owes money against) — the
 * journal entry leaves it blank rather than inventing one.
 */
const SOURCE_DATE_FIELDS = {
  [JOURNAL_SOURCE_TYPES.PURCHASE_GRN]: { postingDate: 'receivedDate', documentDate: 'receivedDate', dueDate: null },
  [JOURNAL_SOURCE_TYPES.PURCHASE_INVOICE]: { postingDate: 'invoiceDate', documentDate: 'invoiceDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.PURCHASE_RETURN]: { postingDate: 'postingDate', documentDate: 'documentDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.PURCHASE_CREDIT_MEMO]: { postingDate: 'postingDate', documentDate: 'documentDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.DELIVERY_CHALLAN]: { postingDate: 'challanDate', documentDate: 'challanDate', dueDate: null },
  [JOURNAL_SOURCE_TYPES.SALES_INVOICE]: { postingDate: 'invoiceDate', documentDate: 'invoiceDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.SALES_RETURN]: { postingDate: 'postingDate', documentDate: 'documentDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.SALES_CREDIT_MEMO]: { postingDate: 'postingDate', documentDate: 'documentDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.STOCK_ISSUE]: { postingDate: 'postingDate', documentDate: 'date', dueDate: null },
  [JOURNAL_SOURCE_TYPES.STOCK_RETURN]: { postingDate: 'postingDate', documentDate: 'date', dueDate: null },
  [JOURNAL_SOURCE_TYPES.STOCK_TRANSFER]: { postingDate: 'documentDate', documentDate: 'documentDate', dueDate: null },
  [JOURNAL_SOURCE_TYPES.PAYMENT_RECEIPT]: { postingDate: 'postingDate', documentDate: 'documentDate', dueDate: 'dueDate' },
  [JOURNAL_SOURCE_TYPES.PAYMENT_VOUCHER]: { postingDate: 'postingDate', documentDate: 'documentDate', dueDate: 'dueDate' },
  // One journal entry per BP Opening Balance document (not per line — see
  // the builder below), so there is exactly one documentDate to carry and no
  // single due date makes sense across lines that can each have their own.
  [JOURNAL_SOURCE_TYPES.BP_OPENING_BALANCE]: { postingDate: 'documentDate', documentDate: 'documentDate', dueDate: null },
  // One journal entry per Inventory Opening Balance document (all its item lines).
  [JOURNAL_SOURCE_TYPES.INVENTORY_OPENING_BALANCE]: { postingDate: 'documentDate', documentDate: 'documentDate', dueDate: null },
};

/**
 * Resolve {postingDate, documentDate, dueDate} for a journal entry from its
 * source document, using SOURCE_DATE_FIELDS above. Falls back to the old
 * generic guess for any source type not listed there, so a schema added
 * later without an entry here degrades to the previous behaviour instead of
 * throwing.
 */
function resolveSourceDates(sourceType, doc) {
  const map = SOURCE_DATE_FIELDS[sourceType];
  if (!map) {
    const fallback = doc.postingDate || doc.date || doc.documentDate || null;
    return { postingDate: fallback, documentDate: doc.documentDate || doc.date || doc.postingDate || null, dueDate: null };
  }
  return {
    postingDate: (map.postingDate && doc[map.postingDate]) || null,
    documentDate: (map.documentDate && doc[map.documentDate]) || null,
    dueDate: (map.dueDate && doc[map.dueDate]) || null,
  };
}

/** Journal entry statuses. */
const JOURNAL_STATUS = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  PENDING_GL: 'Pending G/L',
  // The original entry behind a document that has been cancelled -- see
  // reverseJournalEntry. Superseded, not deleted: `reversedEntryId` points at
  // the entry that reverses it.
  REVERSED: 'Reversed',
};

/**
 * The JournalEntry row that currently represents a source document's OWN
 * forward accounting -- never a reversal of some other entry (`isReversal`),
 * and never one that has itself already been superseded by a reversal
 * (`Reversed`). Both postJournalEntry's idempotency check and
 * reverseJournalEntry's own lookup key off exactly this shape, so a
 * cancelled-then-reopened document's history (original -> Reversed, its
 * reversal, then a fresh original once reposted) can never have either of
 * them mistake a reversal row, or an already-reversed original, for "the"
 * live entry.
 */
function activeJournalEntryFilter(sourceType, sourceDocNo) {
  return { sourceType, sourceDocNo, isReversal: false, status: { not: JOURNAL_STATUS.REVERSED } };
}

/**
 * Does a document in this status belong in the ledger yet?
 *
 * Deliberately the same predicate as `movesStock` in utils/stockTable.js,
 * over the same per-type exclusion, and that is a decision rather than an
 * accident: under perpetual inventory a movement of goods IS a movement of
 * value, so a document that posts stock must post value and one that does
 * not must not. Letting the two drift would produce the one bug this module
 * exists to make impossible — an inventory balance in the books that
 * disagrees with the warehouse.
 *
 * The list is an exclusion rather than an inclusion because each document
 * type has its own vocabulary for "live": a GRN is 'Open', a purchase invoice
 * is 'Posted', a sales invoice is 'Sent', a delivery challan is 'Pending'
 * until it is 'Open'. What they share is which statuses mean *not yet*.
 *
 * 'Open' USED to mean "not yet posted" for Stock Transfer only (see
 * NON_MOVING_STATUSES_BY_TRANS_TYPE's history in stockTable.js) — every
 * other sourceType has always used 'Open' as its ordinary active/saved
 * status. Stock Transfer's own G/L entry (Dr Inventory destination / Cr
 * Inventory source) now posts in lockstep with its stock movement — as soon
 * as the transfer is raised, or as soon as a Request-linked one is approved
 * — rather than waiting for a later Stock Transfer Receipt to close it (see
 * routes/resources.js's stockTransferPostable/syncStockTransferMovement), so
 * there is no longer a per-sourceType override here at all: this status-only
 * predicate now only decides Draft/Cancelled/Pending for every source type,
 * same as stockTable.js's movesStock.
 *
 * Whether a given Open Stock Transfer is ACTUALLY ready to post (approved,
 * and every line's From/To Warehouse resolved) is business policy this
 * module has no business knowing about — exactly like the stock side, that
 * gate lives entirely in routes/resources.js, which simply never calls
 * syncJournalEntry for a transfer that is not yet ready (instead calling
 * reverseJournalEntry directly, so no stale entry is ever left behind).
 */
const GL_NON_MOVING_STATUSES_BY_SOURCE_TYPE = {};

function postsToGl(status, sourceType) {
  const nonMoving = GL_NON_MOVING_STATUSES_BY_SOURCE_TYPE[sourceType] || BASE_NON_MOVING_STATUSES;
  return !nonMoving.includes(status);
}

/**
 * Raised when account determination cannot supply an account the posting
 * needs. Carries the human-readable remedy, which is what ends up in
 * JournalEntry.glError and on the user's screen — "no account configured" is
 * useless, "no Revenue account for Product Group 'Electronics'" is a
 * five-second fix.
 */
class AccountDeterminationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccountDeterminationError';
    this.isAccountDetermination = true;
  }
}

/**
 * ProductGroup / WarehouseMaster account column -> the GLAccountDetermination
 * column that backs it when neither master carries one.
 *
 * The two masters store account CODES (NVarChar) and the determination stores
 * FK IDS into ChartOfAccounts — an inconsistency that predates this module,
 * so resolution always ends by converting an id to a code.
 *
 * This mirrors PRODUCT_GROUP_ACCOUNT_MAP in frontend ProductGroup.jsx, which
 * uses the same pairing to pre-fill a new product group's accounting tab.
 */
const ROLE_TO_DETERMINATION = {
  expenseAccount: 'expenseAccountId',
  revenueAccount: 'revenueAccountId',
  inventoryAccount: 'inventoryAccountId',
  costOfGoodsSoldAccount: 'costOfGoodsSoldAccountId',
  allocationAccount: 'allocationAccountId',
  varianceAccount: 'varianceAccountId',
  priceDifferenceAccount: 'priceDifferenceAccountId',
  negativeInventoryAdjustmentAccount: 'negativeInventoryAdjAcctId',
  inventoryOffsetDecreaseAccount: 'inventoryOffsetDecrAcctId',
  inventoryOffsetIncreaseAccount: 'inventoryOffsetIncrAcctId',
  salesReturnsAccount: 'salesReturnsAccountId',
  purchaseAccount: 'purchaseAccountId',
  purchaseReturnAccount: 'purchaseReturnAccountId',
  costOfGoodsPurchasedAccount: 'costOfGoodsPurchasedAccountId',
  exchangeRateDifferencesAccount: 'exchangeRateDifferencesAccountId',
  goodsClearingAccount: 'goodsClearingAccountId',
  glDecreaseAccount: 'glDecreaseAccountId',
  glIncreaseAccount: 'glIncreaseAccountId',
  wipInventoryAccount: 'wipInventoryAccountId',
  wipInventoryVarianceAccount: 'wipInventoryVarianceAccountId',
  wipOffsetPnlAccount: 'wipOffsetPLAccountId',
  inventoryOffsetPnlAccount: 'inventoryOffsetPnlAccountId',
  expenseClearingAccount: 'expenseClearingAccountId',
  shippedGoodsAccount: 'shippedGoodsAccountId',
  salesCreditAccount: 'salesCreditAccountId',
  purchaseCreditAccount: 'purchaseCreditAccountId',
  purchaseBalanceAccount: 'purchaseBalanceAccountId',
  incomingCenvatAccount: 'incomingCenvatClearingActId',
  outgoingCenvatAccount: 'outgoingCenvatClearingActId',
};

/** Labels used in error messages, so a gap names itself in plain English. */
const ROLE_LABELS = {
  expenseAccount: 'Expense',
  revenueAccount: 'Revenue',
  inventoryAccount: 'Inventory',
  costOfGoodsSoldAccount: 'Cost of Goods Sold',
  goodsClearingAccount: 'Goods Clearing (GRNI)',
  salesReturnsAccount: 'Sales Returns',
  purchaseReturnAccount: 'Purchase Return',
  inventoryOffsetDecreaseAccount: 'Inventory Offset — Decrease',
  inventoryOffsetIncreaseAccount: 'Inventory Offset — Increase',
  varianceAccount: 'Variance',
  priceDifferenceAccount: 'Price Difference',
  purchaseAccount: 'Purchase',
  costOfGoodsPurchasedAccount: 'Cost of Goods Purchased',
  paymentModeAccount: 'Payment Mode',
  bankChargesGlAccount: 'Bank Charges',
};

const roleLabel = (role) => ROLE_LABELS[role] || role;

// ---------------------------------------------------------------------------
// Determination context
// ---------------------------------------------------------------------------

/**
 * A per-posting cache over every master the resolver reads.
 *
 * A 40-line invoice would otherwise issue several hundred queries — a Product
 * lookup, a Warehouse or Product Group lookup and a ChartOfAccounts lookup
 * per line — inside the document's own transaction, holding its locks the
 * whole time. Everything here is read-only reference data that cannot change
 * during a single posting, so it is fetched once and memoised.
 */
function createDeterminationContext(tx) {
  const cache = {
    products: new Map(),
    warehouses: new Map(),
    productGroups: new Map(),
    accountsById: new Map(),
    accountsByCode: new Map(),
    customers: new Map(),
    suppliers: new Map(),
    taxCodesById: new Map(),
    determination: undefined,
  };

  return {
    tx,

    /**
     * The G/L Account Determination row for the open financial year.
     *
     * Determination is per financial year by design (accounts get restructured
     * between years), so the active year decides which row applies. When no
     * year is flagged active, fall back to whichever single row exists rather
     * than failing — a company that never set up financial years still needs
     * its books.
     */
    async determination() {
      if (cache.determination !== undefined) return cache.determination;
      let row = null;
      const activeFy = await tx.financialYear.findFirst({ where: { status: 'Active' } });
      if (activeFy) {
        row = await tx.glAccountDetermination.findFirst({ where: { financialYearId: activeFy.id } });
      }
      if (!row) row = await tx.glAccountDetermination.findFirst();
      cache.determination = row;
      return row;
    },

    async product(productCode) {
      if (!productCode) return null;
      if (cache.products.has(productCode)) return cache.products.get(productCode);
      const row = await tx.product.findFirst({ where: { productCode } });
      cache.products.set(productCode, row);
      return row;
    },

    /**
     * Warehouse master by name or code — documents store the warehouse
     * inconsistently (some screens write whsName, some whsCode), so both are
     * accepted rather than making the caller guess which one it holds.
     */
    async warehouse(nameOrCode) {
      if (!nameOrCode) return null;
      if (cache.warehouses.has(nameOrCode)) return cache.warehouses.get(nameOrCode);
      const row = await tx.warehouseMaster.findFirst({
        where: { OR: [{ whsName: nameOrCode }, { whsCode: nameOrCode }] },
      });
      cache.warehouses.set(nameOrCode, row);
      return row;
    },

    async productGroup(groupName) {
      if (!groupName) return null;
      if (cache.productGroups.has(groupName)) return cache.productGroups.get(groupName);
      const row = await tx.productGroup.findFirst({ where: { groupName } });
      cache.productGroups.set(groupName, row);
      return row;
    },

    async accountById(id) {
      if (!id) return null;
      if (cache.accountsById.has(id)) return cache.accountsById.get(id);
      const row = await tx.chartOfAccount.findUnique({ where: { id } });
      cache.accountsById.set(id, row);
      return row;
    },

    /**
     * TaxCode by id, for postGst's per-line account priority (a line's own
     * Tax Code account before GlAccountDetermination's company-wide
     * default). Mirrors accountById's cache-or-fetch shape.
     */
    async taxCode(id) {
      if (!id) return null;
      if (cache.taxCodesById.has(id)) return cache.taxCodesById.get(id);
      const row = await tx.taxCode.findUnique({ where: { id } });
      cache.taxCodesById.set(id, row);
      return row;
    },

    async accountByCode(accountCode) {
      if (!accountCode) return null;
      if (cache.accountsByCode.has(accountCode)) return cache.accountsByCode.get(accountCode);
      const row = await tx.chartOfAccount.findFirst({ where: { accountCode } });
      cache.accountsByCode.set(accountCode, row);
      return row;
    },

    // Customer/Supplier Master are retired — both now resolve against
    // Business Partner, filtered by partnerType, matched by name or code the
    // same way the old Customer/Supplier lookups were.
    async customer(name) {
      if (!name) return null;
      if (cache.customers.has(name)) return cache.customers.get(name);
      const row = await tx.businessPartner.findFirst({
        where: { partnerType: 'Customer', OR: [{ partnerName: name }, { partnerCode: name }] },
      });
      cache.customers.set(name, row);
      return row;
    },

    async supplier(name) {
      if (!name) return null;
      if (cache.suppliers.has(name)) return cache.suppliers.get(name);
      const row = await tx.businessPartner.findFirst({
        where: { partnerType: 'Vendor', OR: [{ partnerName: name }, { partnerCode: name }] },
      });
      cache.suppliers.set(name, row);
      return row;
    },

    /**
     * Bulk-primes the customer cache for a whole batch of names in one
     * query per 500 (SQL Server's ~2100-parameter cap on the `IN` list),
     * instead of paying customer()'s own per-name lookup one row at a
     * time. Built for a posting that can carry thousands of distinct
     * Business Partners on a single document — see the BP Opening Balance
     * builder below, which calls this before its own per-line loop rather
     * than letting customer()/resolveArAccount discover each one cold.
     * A name with no match is cached as null too, so a later customer(name)
     * call for it is a cache hit, not another round trip.
     */
    async primeCustomers(names) {
      const missing = Array.from(new Set((names || []).filter(Boolean))).filter((n) => !cache.customers.has(n));
      if (!missing.length) return;
      const PRIME_CHUNK = 500;
      const found = [];
      for (let i = 0; i < missing.length; i += PRIME_CHUNK) {
        const slice = missing.slice(i, i + PRIME_CHUNK);
        // eslint-disable-next-line no-await-in-loop
        const rows = await tx.businessPartner.findMany({
          where: { partnerType: 'Customer', OR: [{ partnerName: { in: slice } }, { partnerCode: { in: slice } }] },
        });
        found.push(...rows);
      }
      missing.forEach((name) => {
        cache.customers.set(name, found.find((r) => r.partnerName === name || r.partnerCode === name) || null);
      });
    },

    /** Supplier-side counterpart to primeCustomers above. */
    async primeSuppliers(names) {
      const missing = Array.from(new Set((names || []).filter(Boolean))).filter((n) => !cache.suppliers.has(n));
      if (!missing.length) return;
      const PRIME_CHUNK = 500;
      const found = [];
      for (let i = 0; i < missing.length; i += PRIME_CHUNK) {
        const slice = missing.slice(i, i + PRIME_CHUNK);
        // eslint-disable-next-line no-await-in-loop
        const rows = await tx.businessPartner.findMany({
          where: { partnerType: 'Vendor', OR: [{ partnerName: { in: slice } }, { partnerCode: { in: slice } }] },
        });
        found.push(...rows);
      }
      missing.forEach((name) => {
        cache.suppliers.set(name, found.find((r) => r.partnerName === name || r.partnerCode === name) || null);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Account determination
// ---------------------------------------------------------------------------

/**
 * Resolve an item-level account (Inventory, Revenue, COGS, Expense, …) for
 * one document line, following SAP B1's determination hierarchy.
 *
 * The hierarchy is a real business rule, not a fallback chain of
 * convenience. `Product.glAccountsBy` — "Set G/L Accounts By" on the product
 * master — says which dimension owns this product's accounts:
 *
 *   'Warehouse'     — accounts follow WHERE the stock is. Used when different
 *                     sites must be reported separately (a bonded warehouse,
 *                     a branch with its own inventory account).
 *   'Product Group' — accounts follow WHAT the item is. The common case:
 *                     electronics revenue and consumables revenue land in
 *                     different accounts regardless of which shed they sit in.
 *
 * Whichever dimension owns it is asked first. Only when that master leaves
 * the column blank does the company-wide G/L Account Determination answer,
 * which is exactly the role it plays on the Product Group screen, where it
 * pre-fills a new group's accounting tab.
 *
 * Throws AccountDeterminationError naming the specific gap when nothing
 * answers — that message reaches the user, so it names the master and the
 * account rather than saying something failed.
 */
async function resolveItemAccount(ctx, { productCode, warehouse, role }) {
  const product = await ctx.product(productCode);

  // A line whose product is not in the master at all cannot be determined by
  // product group or warehouse — fall straight through to the company
  // default rather than pretending to know more than we do.
  const by = product?.glAccountsBy || 'Warehouse';

  let code = null;
  let searchedIn = null;

  if (by === 'Product Group') {
    const group = await ctx.productGroup(product?.productGroup);
    code = group?.[role] || null;
    searchedIn = product?.productGroup
      ? `Product Group "${product.productGroup}"`
      : `Product Group (product "${productCode}" has no group set)`;
  } else {
    const whs = await ctx.warehouse(warehouse);
    code = whs?.[role] || null;
    searchedIn = warehouse ? `Warehouse "${warehouse}"` : 'Warehouse (none on the document)';
  }

  if (code) return resolveAccountByCode(ctx, code, role, searchedIn);

  // Company-wide default.
  return resolveDeterminationAccount(ctx, role, {
    extraContext: `neither ${searchedIn} nor G/L Account Determination supplies it`,
  });
}

/** Turn an account code held on a master into a real ChartOfAccounts row. */
async function resolveAccountByCode(ctx, accountCode, role, searchedIn) {
  const account = await ctx.accountByCode(accountCode);
  if (!account) {
    throw new AccountDeterminationError(
      `${searchedIn} names "${accountCode}" as its ${roleLabel(role)} account, but no such account exists in the Chart Of Accounts.`
    );
  }
  assertPostable(account, role);
  return account;
}

/** Resolve a role straight from the company-wide G/L Account Determination. */
async function resolveDeterminationAccount(ctx, role, { extraContext = null } = {}) {
  const determination = await ctx.determination();
  if (!determination) {
    throw new AccountDeterminationError(
      'No G/L Account Determination has been set up. Configure it under Accounting > G/L Account Determination before documents can post to the ledger.'
    );
  }

  const field = ROLE_TO_DETERMINATION[role] || role;
  const id = determination[field];
  if (!id) {
    throw new AccountDeterminationError(
      `No ${roleLabel(role)} account is configured${extraContext ? ` — ${extraContext}` : ''}. Set it under Accounting > G/L Account Determination.`
    );
  }

  const account = await ctx.accountById(id);
  if (!account) {
    throw new AccountDeterminationError(
      `The ${roleLabel(role)} account configured in G/L Account Determination no longer exists in the Chart Of Accounts.`
    );
  }
  assertPostable(account, role);
  return account;
}

/**
 * A Title account is a heading in the chart, not somewhere value can sit, and
 * an inactive account has been deliberately retired. Posting to either
 * produces a balance nobody is looking at, so both are refused here rather
 * than discovered later in a reconciliation.
 */
function assertPostable(account, role) {
  if (account.accountNature === 'T') {
    throw new AccountDeterminationError(
      `"${account.accountName}" (${account.accountCode}) is configured as the ${roleLabel(role)} account, but it is a Title account. Titles group other accounts and cannot be posted to — point this at an Active Account.`
    );
  }
  if (account.status === 'I') {
    throw new AccountDeterminationError(
      `"${account.accountName}" (${account.accountCode}) is configured as the ${roleLabel(role)} account, but it is inactive.`
    );
  }
}

/**
 * The customer's Accounts Receivable control account.
 *
 * A customer may carry its own (an overseas customer reporting into Foreign
 * AR, a group company into an inter-company account); otherwise the company
 * default applies. Same shape on the supplier side below.
 */
async function resolveArAccount(ctx, customerName) {
  const customer = await ctx.customer(customerName);
  if (customer?.controlAccount) {
    return resolveAccountByCode(ctx, customer.controlAccount, 'accountsReceivable', `Customer "${customerName}"`);
  }
  const determination = await ctx.determination();
  const id = determination?.domesticAccountsReceivableId || determination?.accountsReceivableId;
  if (!id) {
    throw new AccountDeterminationError(
      'No Accounts Receivable control account is configured. Set Domestic Accounts Receivable under Accounting > G/L Account Determination, or give this customer its own Control Account on Business Partner.'
    );
  }
  const account = await ctx.accountById(id);
  if (!account) {
    throw new AccountDeterminationError('The configured Accounts Receivable account no longer exists in the Chart Of Accounts.');
  }
  assertPostable(account, 'accountsReceivable');
  return account;
}

/**
 * The supplier's Accounts Payable control account.
 *
 * Reads Business Partner's single controlAccount column (its label switches
 * between "Accounts Receivable"/"Accounts Payable" in the UI based on
 * partnerType — see the schema comment on BusinessPartner.controlAccount).
 * The old Supplier Master column was, confusingly, also called
 * `accountsReceivable`; that oddity went away with the table.
 */
async function resolveApAccount(ctx, supplierName) {
  const supplier = await ctx.supplier(supplierName);
  if (supplier?.controlAccount) {
    return resolveAccountByCode(ctx, supplier.controlAccount, 'accountsPayable', `Supplier "${supplierName}"`);
  }
  const determination = await ctx.determination();
  const id = determination?.domesticAccountsPayableId;
  if (!id) {
    throw new AccountDeterminationError(
      'No Accounts Payable control account is configured. Set Domestic Accounts Payable under Accounting > G/L Account Determination, or give this supplier its own Control Account on Business Partner.'
    );
  }
  const account = await ctx.accountById(id);
  if (!account) {
    throw new AccountDeterminationError('The configured Accounts Payable account no longer exists in the Chart Of Accounts.');
  }
  assertPostable(account, 'accountsPayable');
  return account;
}

/**
 * Resolves a role directly off a Warehouse Master row — bypassing the
 * Product Group vs. Warehouse routing resolveItemAccount/
 * resolveItemAccountForDocument apply for ordinary item lines. Goods
 * Clearing (GRNI) is about WHERE the goods physically sit pending invoice,
 * never about what kind of product they are, so a Purchase Invoice's
 * clearing line always reads a warehouse's own account — falling back to
 * G/L Account Determination's company-wide default exactly the way Edit
 * Warehouse's own Accounting tab already fills an unset row for display.
 */
async function resolveWarehouseAccount(ctx, warehouseNameOrCode, role) {
  const label = warehouseNameOrCode ? `Warehouse "${warehouseNameOrCode}"` : 'Warehouse (none on the document or its GRN)';
  const warehouse = await ctx.warehouse(warehouseNameOrCode);
  const code = warehouse?.[role];
  if (code) return resolveAccountByCode(ctx, code, role, label);
  return resolveDeterminationAccount(ctx, role, {
    extraContext: `neither ${label} nor G/L Account Determination supplies it`,
  });
}

/**
 * Which warehouse a Purchase Invoice's goods actually sit in.
 *
 * A direct invoice (no GRN) carries its own `warehouse` — the only case
 * that column is required/populated on this document (see
 * assertInvoiceWarehouse in routes/resources.js: warehouse is required only
 * when the invoice itself moves the stock). One raised against a GRN
 * instead is finance-only and the form never collects a warehouse for it
 * (see PurchaseInvoice.jsx's isDirectInvoice gate), so the GRN it bills is
 * asked instead: its own header warehouse, falling back
 * to its first line's — the same fallback POSTING_SCHEMAS[PURCHASE_GRN]
 * above applies when a line names none.
 */
async function resolveInvoiceWarehouse(ctx, doc) {
  if (doc.warehouse) return doc.warehouse;
  if (!doc.grnNo) return null;
  const grn = await ctx.tx.goodsReceivedNote.findFirst({
    where: { grnNo: doc.grnNo },
    include: { items: true },
  });
  if (!grn) return null;
  return grn.warehouse || (grn.items || []).find((i) => i.warehouse)?.warehouse || null;
}

/** The cash/bank account money physically moves through. */
async function resolveCashAccount(ctx) {
  return resolveDeterminationAccount(ctx, 'cashOnHandId');
}

const GST_FIELDS = {
  output: { cgst: 'outputCgstPayableId', sgst: 'outputSgstPayableId', igst: 'outputIgstPayableId' },
  input: { cgst: 'inputCgstReceivableId', sgst: 'inputSgstReceivableId', igst: 'inputIgstReceivableId' },
};

const GST_LABELS = {
  output: { cgst: 'Output CGST Payable', sgst: 'Output SGST Payable', igst: 'Output IGST Payable' },
  input: { cgst: 'Input CGST Receivable', sgst: 'Input SGST Receivable', igst: 'Input IGST Receivable' },
};

/**
 * Resolve the GST account for one component, on the given side.
 *
 * Only called for components that actually carry an amount — an intra-state
 * document has no IGST, so it must not demand an IGST account be configured
 * before it can post.
 */
async function resolveGstAccount(ctx, side, component) {
  const determination = await ctx.determination();
  const id = determination?.[GST_FIELDS[side][component]];
  if (!id) {
    throw new AccountDeterminationError(
      `No ${GST_LABELS[side][component]} account is configured. Set it under Accounting > G/L Account Determination.`
    );
  }
  const account = await ctx.accountById(id);
  if (!account) {
    throw new AccountDeterminationError(`The configured ${GST_LABELS[side][component]} account no longer exists in the Chart Of Accounts.`);
  }
  assertPostable(account, GST_LABELS[side][component]);
  return account;
}

// ---------------------------------------------------------------------------
// Line building
// ---------------------------------------------------------------------------

/**
 * A posting under construction. Lines are accumulated per account and side,
 * then consolidated — a 40-line invoice whose items all share one revenue
 * account produces one Revenue credit, not forty identical ones. SAP calls
 * this summarised posting; the per-item detail already lives on the document
 * itself, and repeating it in the ledger only makes the ledger harder to read.
 */
function createPosting(branch) {
  const entries = [];
  return {
    // warehouse is optional and only meaningful for a document whose own
    // lines are warehouse-scoped (Purchase GRN's per-item warehouse — see
    // POSTING_SCHEMAS[PURCHASE_GRN] below). businessPartner is optional too
    // — an { code, name } tag for a control-account line (Accounts
    // Receivable/Payable — see resolveArAccount/resolveApAccount callers),
    // read straight off JournalEntryLine.businessPartnerCode/Name in
    // build() below. Every other call site passes neither, same as before
    // either parameter existed, and gets warehouse: null / businessPartner:
    // null throughout.
    debit(account, amount, description, warehouse = null, businessPartner = null) {
      const value = round2(amount);
      if (value === 0) return;
      // A negative debit is a credit. Amounts arrive from documents that
      // allow negative lines (a discount line, a corrective quantity), and
      // silently dropping the sign would unbalance the entry.
      if (value < 0) entries.push({ account, description, warehouse, businessPartner, debit: 0, credit: -value });
      else entries.push({ account, description, warehouse, businessPartner, debit: value, credit: 0 });
    },
    credit(account, amount, description, warehouse = null, businessPartner = null) {
      const value = round2(amount);
      if (value === 0) return;
      if (value < 0) entries.push({ account, description, warehouse, businessPartner, debit: -value, credit: 0 });
      else entries.push({ account, description, warehouse, businessPartner, debit: 0, credit: value });
    },
    build() {
      const merged = new Map();
      for (const e of entries) {
        // Warehouse and Business Partner both join the merge key alongside
        // account+side: two lines that share a resolved account but come
        // from different warehouses (possible when two warehouses are
        // configured to post to the same G/L account), or belong to
        // different business partners, must not collapse into one line with
        // an ambiguous tag. Same-warehouse/same-partner duplicates still
        // merge exactly as before.
        const key = `${e.account.accountCode}|${e.debit > 0 ? 'D' : 'C'}|${e.warehouse || ''}|${e.businessPartner?.code || ''}`;
        const existing = merged.get(key);
        if (existing) {
          existing.debit = round2(existing.debit + e.debit);
          existing.credit = round2(existing.credit + e.credit);
        } else {
          merged.set(key, { ...e });
        }
      }
      return [...merged.values()].map((e, i) => ({
        lineNo: i + 1,
        accountCode: e.account.accountCode,
        accountName: e.account.accountName,
        description: e.description || null,
        branch: branch || null,
        warehouse: e.warehouse || null,
        businessPartnerCode: e.businessPartner?.code || null,
        businessPartnerName: e.businessPartner?.name || null,
        debit: e.debit,
        credit: e.credit,
      }));
    },
  };
}

/**
 * The taxable (post-discount, pre-tax) value of one document line.
 *
 * Reuses normaliseLine from documentTotals.js — the same function that
 * computed the document's own totals — so a line's contribution to the
 * ledger and its contribution to the invoice total can never be computed two
 * different ways and disagree.
 */
function lineTaxableValue(item, quantityField) {
  return normaliseLine(item, { quantityField }).amount;
}

/** Cost value of a line, for the inventory/COGS side of a goods movement. */
function lineCostValue(item, quantityField, { costField = 'costPrice' } = {}) {
  const qty = Number(item[quantityField]) || 0;
  const cost = Number(item[costField]);
  // Returns and credit memos carry no stamped cost, so the transaction price
  // stands in — the same fallback postStockEntries uses when it values a
  // movement, so stock value and ledger value stay consistent.
  const unit = Number.isFinite(cost) && cost > 0 ? cost : (Number(item.unitPrice) || 0);
  return round2(qty * unit);
}

/**
 * Post each line's inventory value to its own determined account.
 * Returns the total posted, so the caller can put the balancing figure on the
 * offsetting account without recomputing it and risking a rounding drift.
 */
async function postPerLine(ctx, posting, { items, quantityField, warehouse, role, side, description, valuer }) {
  let total = 0;
  for (const item of items) {
    if (!item.productCode) continue;
    const value = valuer(item, quantityField);
    if (round2(value) === 0) continue;
    const account = await resolveItemAccount(ctx, {
      productCode: item.productCode,
      warehouse: item.warehouse || warehouse,
      role,
    });
    posting[side](account, value, description);
    total = round2(total + value);
  }
  return total;
}

// TaxCode's own account fields are named <component>SalesAccountId /
// <component>PurchaseAccountId — 'output' (a sales-side posting) reads the
// Sales fields, 'input' (a purchase-side posting) reads the Purchase ones.
// See the Mapping Priority note on the TaxCode model in schema.prisma.
const TAX_CODE_SIDE_FIELD = { output: 'Sales', input: 'Purchase' };

/**
 * Post the CGST/SGST/IGST split. Returns the total tax posted.
 *
 * `opts.items` is OPTIONAL and additive: pass the document's line items
 * (Sales Invoice / Purchase Invoice only, today) to let a line whose
 * TaxCode has its own Sales/Purchase account for a component post there
 * instead of GlAccountDetermination's company-wide default — see the
 * Mapping Priority note on TaxCode in schema.prisma. Every caller that omits
 * `opts` (Purchase/Sales Credit Memo) gets EXACTLY the original behavior:
 * one line per nonzero component, on the default account. Even when `items`
 * IS supplied, any component none of the lines override still posts exactly
 * as before — the per-line path only ever activates for a component that
 * actually has an override, and even then the un-overridden remainder still
 * posts to the same default account for the same leftover amount, so the
 * total posted per component always equals doc[`${component}Amount`]
 * exactly, same as today.
 */
async function postGst(ctx, posting, doc, sideOfBooks, entrySide, description, opts = {}) {
  const { items, quantityField = 'quantity' } = opts;
  const sideField = TAX_CODE_SIDE_FIELD[sideOfBooks];
  let total = 0;

  // Computed lazily, once, only if some component actually needs it (a line
  // carries a taxCodeId) — most postings never touch this.
  let lineBreakdownCache = null;
  const lineBreakdown = () => {
    if (lineBreakdownCache) return lineBreakdownCache;
    const interState = Number(doc.igstAmount) > 0;
    const lines = items.map((item) => normaliseLine(item, { quantityField }));
    lineBreakdownCache = computeLineTaxBreakdown(lines, doc.discountPercent, { interState });
    return lineBreakdownCache;
  };

  for (const component of ['cgst', 'sgst', 'igst']) {
    const docAmount = round2(Number(doc[`${component}Amount`]) || 0);
    if (docAmount === 0) continue;

    // Which lines (if any) carry a Tax Code with its own account for this
    // component/side?
    const overrides = [];
    if (items && items.length) {
      const breakdown = lineBreakdown();
      for (let i = 0; i < items.length; i += 1) {
        const taxCodeId = items[i].taxCodeId;
        if (!taxCodeId) continue;
        const taxCode = await ctx.taxCode(taxCodeId);
        const overrideId = taxCode?.[`${component}${sideField}AccountId`];
        if (!overrideId) continue;
        const account = await ctx.accountById(overrideId);
        // A stale id (account since deleted) falls through to the default
        // below, same as a line with no override at all — never silently
        // drops the amount.
        if (!account) continue;
        const amount = round2(breakdown[i][component]);
        if (amount === 0) continue;
        overrides.push({ account, amount });
      }
    }

    if (!overrides.length) {
      // No line overrides this component — identical to the original
      // single-line-per-component behavior.
      const account = await resolveGstAccount(ctx, sideOfBooks, component);
      posting[entrySide](account, docAmount, description);
      total = round2(total + docAmount);
      continue;
    }

    // Merge overrides that share an account into one journal line each, then
    // send whatever's left (the un-overridden lines' share) to the same
    // default account as before — so the sum posted for this component is
    // always exactly docAmount, regardless of how many lines override it.
    const byAccount = new Map();
    let overriddenSum = 0;
    for (const { account, amount } of overrides) {
      const key = account.accountCode;
      const existing = byAccount.get(key);
      byAccount.set(key, { account, amount: round2((existing?.amount || 0) + amount) });
      overriddenSum = round2(overriddenSum + amount);
    }
    for (const { account, amount } of byAccount.values()) {
      posting[entrySide](account, amount, description);
      total = round2(total + amount);
    }
    const remainder = round2(docAmount - overriddenSum);
    if (remainder !== 0) {
      const account = await resolveGstAccount(ctx, sideOfBooks, component);
      posting[entrySide](account, remainder, description);
      total = round2(total + remainder);
    }
  }
  return total;
}

/**
 * Post the document's TCS to the TCS account set on the Tax Code (Sales / Purchase
 * column of the "TCS" row in Company > Tax Code). TCS is a flat document-level
 * amount (see computeTotals), so it is posted once, to the account of the first
 * line whose Tax Code has one. Returns the amount posted (0 when nothing is
 * configured -- the document then posts exactly as it did before, never failing
 * for want of a TCS account).
 */
async function postTcs(ctx, posting, doc, sideOfBooks, entrySide, description, items) {
  const amount = round2(Number(doc.tcsAmount) || 0);
  if (amount === 0 || !items || !items.length) return 0;
  const sideField = TAX_CODE_SIDE_FIELD[sideOfBooks];
  for (const item of items) {
    if (!item.taxCodeId) continue;
    const taxCode = await ctx.taxCode(item.taxCodeId);
    const accountId = taxCode?.[`tcs${sideField}AccountId`];
    if (!accountId) continue;
    const account = await ctx.accountById(accountId);
    if (!account) continue;
    posting[entrySide](account, amount, description);
    return amount;
  }
  return 0;
}

/**
 * Absorb the document's round-off into the rounding account.
 *
 * computeTotals produces `amount = taxableAmount + totalTax + roundOff`, so
 * the round-off is a real component of what the customer pays and needs a
 * home of its own — folding it into revenue would misstate revenue by a few
 * paise on every document, which compounds into a figure nobody can explain.
 */
async function postRoundOff(ctx, posting, roundOff, side) {
  const value = round2(Number(roundOff) || 0);
  if (value === 0) return 0;
  const account = await resolveDeterminationAccount(ctx, 'roundingAccountId');
  posting[side](account, value, 'Rounding difference');
  return value;
}

// ---------------------------------------------------------------------------
// Posting schemas — one per document type
// ---------------------------------------------------------------------------

/**
 * Each builder receives the document (with its items) and returns nothing,
 * having pushed its lines onto `posting`. Every one of them is a standard
 * double-entry schema; the comments state the accounting reasoning rather
 * than restating the code, because the reasoning is the part that has to be
 * checked by someone who knows accounting rather than JavaScript.
 */
const POSTING_SCHEMAS = {
  /**
   * Purchase GRN — goods received, not yet invoiced.
   *
   * Per LINE, at that line's own purchase value:
   *   Dr  Inventory                    Cr  Goods Clearing (GRNI)
   *   Dr  Purchase Account             Cr  Cost of Goods Purchased Account
   *
   * Goods Clearing is the classic goods-received-not-invoiced liability: the
   * stock is ours and on the books the moment it arrives, but the supplier's
   * invoice has not been received, so the credit cannot go to Accounts
   * Payable yet. The purchase invoice later clears this account against AP.
   * Tax is deliberately NOT posted here — input GST is recoverable against
   * the supplier's tax invoice, which is a document that does not exist yet.
   *
   * The Purchase / Cost of Goods Purchased pair is a deliberate,
   * independently-balanced mirror of the first — it does not touch Inventory
   * or Goods Clearing, and both pairs post the identical line value. It
   * exists purely so these two accounts carry a running purchase-register
   * figure of their own, for reporting that wants "purchases by
   * warehouse/product group" without walking the stock ledger. Whether they
   * net off against each other or feed a separate MIS report is a
   * chart-of-accounts design decision for whoever configured them, not
   * something this function decides — it only posts what was asked for.
   *
   * All four accounts are resolved PER LINE, independently, via
   * resolveItemAccount(ctx, { productCode: item.productCode, warehouse,
   * role }) — never once for the whole document. That function already
   * reads THIS item's own Product.glAccountsBy and looks in Product Group or
   * Warehouse Master accordingly (falling back to company-wide G/L Account
   * Determination if that master leaves the role blank), so a GRN mixing
   * products from different groups, or products configured differently
   * ('Warehouse' vs 'Product Group'), posts each line to its own correct
   * accounts rather than borrowing another line's.
   *
   * `warehouse` is item.warehouse (GoodsReceivedNoteItem — a single GRN can
   * receive different lines into different warehouses) falling back to the
   * document's own warehouse for a line that names none — same fallback
   * toGrnItemData already applies when the line is saved. This only matters
   * when the line's Product resolves 'Warehouse' mode; a 'Product Group'
   * line ignores warehouse entirely.
   */
  async [JOURNAL_SOURCE_TYPES.PURCHASE_GRN](ctx, posting, doc) {
    for (const item of doc.items || []) {
      if (!item.productCode) continue;
      const value = lineTaxableValue(item, 'receivedQuantity');
      if (round2(value) === 0) continue;

      const warehouse = item.warehouse || doc.warehouse;
      const description = `Goods received — ${doc.grnNo}`;

      try {
        const inventory = await resolveItemAccount(ctx, { productCode: item.productCode, warehouse, role: 'inventoryAccount' });
        const clearing = await resolveItemAccount(ctx, { productCode: item.productCode, warehouse, role: 'goodsClearingAccount' });
        const purchase = await resolveItemAccount(ctx, { productCode: item.productCode, warehouse, role: 'purchaseAccount' });
        const costOfGoodsPurchased = await resolveItemAccount(ctx, { productCode: item.productCode, warehouse, role: 'costOfGoodsPurchasedAccount' });

        posting.debit(inventory, value, description, warehouse);
        posting.credit(clearing, value, `Goods received not invoiced — ${doc.grnNo}`, warehouse);
        posting.debit(purchase, value, `Purchase — ${doc.grnNo}`, warehouse);
        posting.credit(costOfGoodsPurchased, value, `Cost of goods purchased — ${doc.grnNo}`, warehouse);
      } catch (err) {
        if (!err.isAccountDetermination) throw err;
        // Re-thrown with the item this gap was found on named up front — the
        // underlying message (from resolveItemAccount/resolveDeterminationAccount
        // above) already names the role and which master it looked in
        // (Warehouse "X" / Product Group "Y" / neither), so this only adds
        // which line triggered it.
        const product = await ctx.product(item.productCode);
        throw new AccountDeterminationError(
          [
            'G/L Account configuration missing.',
            `Item: ${item.productName || item.productCode}`,
            warehouse ? `Warehouse: ${warehouse}` : null,
            product?.productGroup ? `Product Group: ${product.productGroup}` : null,
            `Account Source: ${product?.glAccountsBy || 'Warehouse'}`,
            '',
            err.message,
          ].filter((line) => line !== null).join('\n')
        );
      }
    }
  },

  /**
   * Purchase Invoice — the supplier's bill.
   *
   * With a GRN behind it (the two-step flow):
   *   Dr  Goods Clearing (GRNI)   clears what the receipt parked there
   *   Dr  Input CGST/SGST/IGST    recoverable tax
   *     Cr  Accounts Payable      what we now owe, inclusive of tax
   *
   * Direct invoice (no GRN — see isDirectInvoice in resources.js, the same
   * test the stock ledger uses to decide whether this invoice moves stock):
   *   Dr  Inventory / Expense     per line; the goods never passed through a
   *   Dr  Input CGST/SGST/IGST    receipt, so this document books them
   *     Cr  Accounts Payable
   *
   * The Inventory-vs-Expense split follows Product.inventoryItem: a stocked
   * item becomes an asset, a service or consumable becomes an expense
   * immediately. Booking a service to Inventory would leave a balance that
   * can never be relieved because there is nothing to issue.
   */
  async [JOURNAL_SOURCE_TYPES.PURCHASE_INVOICE](ctx, posting, doc) {
    let goodsTotal;

    if (doc.grnNo) {
      goodsTotal = round2(Number(doc.taxableAmount) || 0);
      if (goodsTotal !== 0) {
        // Goods Clearing is resolved straight off the warehouse the goods
        // sit in (see resolveInvoiceWarehouse/resolveWarehouseAccount
        // above) — never via the first item's Product Group, which is what
        // resolveItemAccountForDocument would otherwise route through for a
        // product configured "Set G/L Accounts By: Product Group",
        // silently ignoring the warehouse's own configured account.
        const warehouse = await resolveInvoiceWarehouse(ctx, doc);
        const clearing = await resolveWarehouseAccount(ctx, warehouse, 'goodsClearingAccount');
        posting.debit(clearing, goodsTotal, `Invoice against GRN ${doc.grnNo}`);
      }
    } else {
      goodsTotal = 0;
      for (const item of doc.items || []) {
        if (!item.productCode) continue;
        const value = lineTaxableValue(item, 'quantity');
        if (round2(value) === 0) continue;
        const product = await ctx.product(item.productCode);
        const role = product && product.inventoryItem === false ? 'expenseAccount' : 'inventoryAccount';
        const account = await resolveItemAccount(ctx, {
          productCode: item.productCode,
          warehouse: doc.warehouse,
          role,
        });
        posting.debit(account, value, `Purchase — ${doc.invoiceNo}`);
        goodsTotal = round2(goodsTotal + value);
      }
    }

    const tax = await postGst(ctx, posting, doc, 'input', 'debit', `Input GST — ${doc.invoiceNo}`, { items: doc.items || [] });
    const tcs = await postTcs(ctx, posting, doc, 'input', 'debit', `Input TCS — ${doc.invoiceNo}`, doc.items || []);
    const rounding = await postRoundOff(ctx, posting, doc.roundOff, 'debit');

    const payable = round2(goodsTotal + tax + tcs + rounding);
    if (payable === 0) return;
    const ap = await resolveApAccount(ctx, doc.supplier);
    // Tags this line with the actual Business Partner (code + name), for
    // the Journal Entry Lines view's own Business Partner column and for
    // AP control-account reconciliation — separate from the resolved GL
    // account itself (ap.accountCode/accountName), which is what G/L
    // Acct/BP No. and Name already show.
    const supplierPartner = await ctx.supplier(doc.supplier);
    posting.credit(
      ap, payable, `${doc.supplier || 'Supplier'} — ${doc.invoiceNo}`, null,
      supplierPartner ? { code: supplierPartner.partnerCode, name: supplierPartner.partnerName } : null
    );
  },

  /**
   * Purchase Return — goods sent back to the supplier.
   *
   *   Dr  Goods Clearing (GRNI)
   *     Cr  Inventory             (per line)
   *
   * The mirror image of the receipt. It reverses the goods side only: the
   * financial claim against the supplier is raised by a Purchase Credit Memo,
   * which is a separate document precisely because returning goods and being
   * credited for them are separate events that can happen days apart.
   */
  async [JOURNAL_SOURCE_TYPES.PURCHASE_RETURN](ctx, posting, doc) {
    const inventoryTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'returnQuantity',
      warehouse: doc.warehouse,
      role: 'inventoryAccount',
      side: 'credit',
      description: `Goods returned — ${doc.returnNo}`,
      valuer: (item, qf) => lineTaxableValue(item, qf),
    });
    if (inventoryTotal === 0) return;

    const clearing = await resolveItemAccountForDocument(ctx, doc, 'goodsClearingAccount');
    posting.debit(clearing, inventoryTotal, `Return to supplier — ${doc.returnNo}`);
  },

  /**
   * Purchase Credit Memo — the supplier credits us.
   *
   *   Dr  Accounts Payable        we owe less
   *     Cr  Inventory             (per line) stock value comes back out
   *     Cr  Input CGST/SGST/IGST  the tax we reclaimed is reversed with it
   */
  async [JOURNAL_SOURCE_TYPES.PURCHASE_CREDIT_MEMO](ctx, posting, doc) {
    const goodsTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.warehouse,
      role: 'inventoryAccount',
      side: 'credit',
      description: `Credit memo — ${doc.creditNo}`,
      valuer: (item, qf) => lineTaxableValue(item, qf),
    });

    // Items are passed so each line's Tax Code account (Company > Tax Code) is used,
    // exactly as on the Purchase Invoice this credit memo reverses.
    const tax = await postGst(ctx, posting, doc, 'input', 'credit', `Input GST reversed — ${doc.creditNo}`, { items: doc.items || [] });
    const tcs = await postTcs(ctx, posting, doc, 'input', 'credit', `Input TCS reversed — ${doc.creditNo}`, doc.items || []);
    const rounding = await postRoundOff(ctx, posting, doc.roundOff, 'credit');

    const total = round2(goodsTotal + tax + tcs + rounding);
    if (total === 0) return;
    const ap = await resolveApAccount(ctx, doc.supplierName);
    posting.debit(ap, total, `${doc.supplierName || 'Supplier'} — ${doc.creditNo}`);
  },

  /**
   * Delivery Challan — goods despatched to the customer.
   *
   *   Dr  Cost of Goods Sold      at COST, not at selling price
   *     Cr  Inventory
   *
   * This is the perpetual-inventory posting and the reason costPrice is
   * stamped on every challan line at save time (stampCostPrices in
   * resources.js). No revenue and no receivable appear here: the customer has
   * the goods but has not been billed, and recognising revenue on despatch
   * rather than on invoice would overstate it for anything delivered and
   * never invoiced. The invoice books the revenue side.
   */
  async [JOURNAL_SOURCE_TYPES.DELIVERY_CHALLAN](ctx, posting, doc) {
    // Claims move no stock, so there is no goods/COGS side to post.
    if (doc.salesCategory === 'Claims') return;
    const cogsTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.fromWarehouse,
      role: 'inventoryAccount',
      side: 'credit',
      description: `Goods despatched — ${doc.challanNo}`,
      valuer: (item, qf) => lineCostValue(item, qf),
    });
    if (cogsTotal === 0) return;

    const cogs = await resolveItemAccountForDocument(ctx, doc, 'costOfGoodsSoldAccount', doc.fromWarehouse);
    posting.debit(cogs, cogsTotal, `Cost of goods sold — ${doc.challanNo}`);
  },

  /**
   * Sales Invoice — the customer is billed.
   *
   *   Dr  Accounts Receivable     gross, inclusive of tax
   *     Cr  Revenue               (per line, net of tax and discount)
   *     Cr  Output CGST/SGST/IGST tax collected on the government's behalf
   *
   * Plus, when the invoice was raised directly with no delivery challan
   * behind it, the goods side that the challan would otherwise have posted:
   *
   *   Dr  Cost of Goods Sold
   *     Cr  Inventory
   *
   * The isDirectInvoice test is the same one the stock ledger uses to decide
   * whether this invoice moves stock — so stock and value are always booked
   * by the same document, and never twice.
   */
  async [JOURNAL_SOURCE_TYPES.SALES_INVOICE](ctx, posting, doc) {
    const revenueTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.warehouse,
      role: 'revenueAccount',
      side: 'credit',
      description: `Sales — ${doc.invoiceNo}`,
      valuer: (item, qf) => lineTaxableValue(item, qf),
    });

    const tax = await postGst(ctx, posting, doc, 'output', 'credit', `Output GST — ${doc.invoiceNo}`, { items: doc.items || [] });
    const tcs = await postTcs(ctx, posting, doc, 'output', 'credit', `Output TCS — ${doc.invoiceNo}`, doc.items || []);
    const rounding = await postRoundOff(ctx, posting, doc.roundOff, 'credit');

    const receivable = round2(revenueTotal + tax + tcs + rounding);
    if (receivable !== 0) {
      const ar = await resolveArAccount(ctx, doc.customer);
      // Tags this line with the actual Business Partner (code + name) —
      // see the matching comment on the Purchase Invoice AP line above.
      const customerPartner = await ctx.customer(doc.customer);
      posting.debit(
        ar, receivable, `${doc.customer || 'Customer'} — ${doc.invoiceNo}`, null,
        customerPartner ? { code: customerPartner.partnerCode, name: customerPartner.partnerName } : null
      );
    }

    // Direct invoice: no challan despatched these goods, so this document
    // carries the cost side too.
    // Claims move no stock, so no cost side either.
    if (!doc.deliveryChallanNo && doc.salesCategory !== 'Claims') {
      const cogsTotal = await postPerLine(ctx, posting, {
        items: doc.items || [],
        quantityField: 'quantity',
        warehouse: doc.warehouse,
        role: 'inventoryAccount',
        side: 'credit',
        description: `Goods sold — ${doc.invoiceNo}`,
        valuer: (item, qf) => lineCostValue(item, qf),
      });
      if (cogsTotal !== 0) {
        const cogs = await resolveItemAccountForDocument(ctx, doc, 'costOfGoodsSoldAccount');
        posting.debit(cogs, cogsTotal, `Cost of goods sold — ${doc.invoiceNo}`);
      }
    }
  },

  /**
   * Sales Return — goods come back from the customer.
   *
   *   Dr  Inventory               (per line, at cost)
   *     Cr  Cost of Goods Sold
   *
   * Goods side only, mirroring the delivery challan. The customer's account
   * is credited by a Sales Credit Memo — again a separate event: goods can be
   * returned and inspected before anyone agrees what credit is due.
   */
  async [JOURNAL_SOURCE_TYPES.SALES_RETURN](ctx, posting, doc) {
    // Claims move no stock, so there is no goods side to post.
    if (doc.salesCategory === 'Claims') return;
    const costTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'returnQuantity',
      warehouse: doc.warehouse,
      role: 'inventoryAccount',
      side: 'debit',
      description: `Goods returned — ${doc.returnNo}`,
      valuer: (item, qf) => lineCostValue(item, qf),
    });
    if (costTotal === 0) return;

    const cogs = await resolveItemAccountForDocument(ctx, doc, 'costOfGoodsSoldAccount');
    posting.credit(cogs, costTotal, `Cost of goods returned — ${doc.returnNo}`);
  },

  /**
   * Sales Credit Memo — the customer is credited.
   *
   *   Dr  Sales Returns           a contra-revenue account, NOT a debit to
   *   Dr  Output CGST/SGST/IGST   Revenue itself: gross sales and returns are
   *     Cr  Accounts Receivable   separate figures on the P&L, and netting
   *                               them off hides the return rate entirely
   *
   * Plus the goods side when stock physically comes back with it:
   *   Dr  Inventory
   *     Cr  Cost of Goods Sold
   */
  async [JOURNAL_SOURCE_TYPES.SALES_CREDIT_MEMO](ctx, posting, doc) {
    const returnsTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.warehouse,
      role: 'salesReturnsAccount',
      side: 'debit',
      description: `Credit memo — ${doc.creditNo}`,
      valuer: (item, qf) => lineTaxableValue(item, qf),
    });

    // Items are passed so each line's Tax Code account (Company > Tax Code) is used,
    // exactly as on the Sales Invoice this credit memo reverses.
    const tax = await postGst(ctx, posting, doc, 'output', 'debit', `Output GST reversed — ${doc.creditNo}`, { items: doc.items || [] });
    const tcs = await postTcs(ctx, posting, doc, 'output', 'debit', `Output TCS reversed — ${doc.creditNo}`, doc.items || []);
    const rounding = await postRoundOff(ctx, posting, doc.roundOff, 'debit');

    const total = round2(returnsTotal + tax + tcs + rounding);
    if (total !== 0) {
      const ar = await resolveArAccount(ctx, doc.customerName);
      posting.credit(ar, total, `${doc.customerName || 'Customer'} — ${doc.creditNo}`);
    }

    // Claims move no stock, so no goods side on a Claims credit memo.
    if (doc.salesCategory === 'Claims') return;
    const costTotal = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.warehouse,
      role: 'inventoryAccount',
      side: 'debit',
      description: `Goods returned — ${doc.creditNo}`,
      valuer: (item, qf) => lineCostValue(item, qf),
    });
    if (costTotal !== 0) {
      const cogs = await resolveItemAccountForDocument(ctx, doc, 'costOfGoodsSoldAccount');
      posting.credit(cogs, costTotal, `Cost of goods returned — ${doc.creditNo}`);
    }
  },

  /**
   * Stock Issue — stock consumed internally (production, samples, scrap).
   *
   *   Dr  Inventory Offset — Decrease
   *     Cr  Inventory
   *
   * The offset account is where value goes when stock leaves for a reason
   * that is not a sale. Keeping it out of COGS matters: COGS is compared
   * against revenue to produce gross margin, and consumption that earned no
   * revenue would distort that comparison.
   */
  async [JOURNAL_SOURCE_TYPES.STOCK_ISSUE](ctx, posting, doc) {
    const total = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.toWarehouse,
      role: 'inventoryAccount',
      side: 'credit',
      description: `Stock issued — ${doc.issueNo}`,
      valuer: (item, qf) => lineCostValue(item, qf),
    });
    if (total === 0) return;

    const offset = await resolveItemAccountForDocument(ctx, doc, 'inventoryOffsetDecreaseAccount', doc.toWarehouse);
    posting.debit(offset, total, `Stock issued — ${doc.issueNo}`);
  },

  /**
   * Stock Return — stock coming back in without a purchase behind it
   * (unused issue returned to store, production output, found stock).
   * Backed by the Stock Receipt document.
   *
   *   Dr  Inventory
   *     Cr  Inventory Offset — Increase
   */
  async [JOURNAL_SOURCE_TYPES.STOCK_RETURN](ctx, posting, doc) {
    const total = await postPerLine(ctx, posting, {
      items: doc.items || [],
      quantityField: 'quantity',
      warehouse: doc.warehouse,
      role: 'inventoryAccount',
      side: 'debit',
      description: `Stock received — ${doc.receiptNo}`,
      valuer: (item, qf) => lineCostValue(item, qf),
    });
    if (total === 0) return;

    const offset = await resolveItemAccountForDocument(ctx, doc, 'inventoryOffsetIncreaseAccount');
    posting.credit(offset, total, `Stock received — ${doc.receiptNo}`);
  },

  /**
   * Stock Transfer — stock moves between warehouses.
   *
   *   Dr  Inventory (destination warehouse)
   *     Cr  Inventory (source warehouse)
   *
   * Worth posting only when the two warehouses determine to DIFFERENT
   * inventory accounts — which happens when products are set to
   * "G/L Accounts By: Warehouse". When both sides land on the same account
   * the entry is a debit and a credit to one account for the same amount:
   * arithmetically nothing, and noise in the ledger. `createPosting` merges
   * by account and side, so those cancel to an empty entry and the posting is
   * skipped as a no-op.
   */
  async [JOURNAL_SOURCE_TYPES.STOCK_TRANSFER](ctx, posting, doc) {
    for (const item of doc.items || []) {
      if (!item.productCode) continue;
      const value = lineCostValue(item, 'quantity');
      if (round2(value) === 0) continue;

      const from = await resolveItemAccount(ctx, {
        productCode: item.productCode,
        warehouse: item.fromWarehouse,
        role: 'inventoryAccount',
      });
      const to = await resolveItemAccount(ctx, {
        productCode: item.productCode,
        warehouse: item.toWarehouse,
        role: 'inventoryAccount',
      });
      if (from.accountCode === to.accountCode) continue;

      posting.credit(from, value, `Transfer out — ${doc.transferNo}`);
      posting.debit(to, value, `Transfer in — ${doc.transferNo}`);
    }
  },

  /**
   * Payment Receipt (Incoming Payment) — money in.
   *
   *   Dr  Cash / Bank            (the account chosen on Payment Modes, or
   *                               the cashOnHand determination account when
   *                               none was chosen)
   *     Cr  Accounts Receivable   (Customer — settles what they owed)
   *     Cr  Accounts Payable      (Vendor — a refund from a supplier)
   *     Cr  the nominated account (Account — a receipt with no business partner)
   *
   * With bank charges (Bank Charges G/L Account + Amount set on the Payment
   * Modes dialog — a fee the bank deducted before crediting the account):
   *
   *   Dr  Bank Charges account   bankChargesAmount
   *   Dr  Cash / Bank            appliedAmount - bankChargesAmount
   *     Cr  <party contra>        appliedAmount
   *
   * The party is still settled for the full appliedAmount (that is what
   * they paid); only the cash/bank line actually received is reduced by
   * the fee, with the difference booked as an expense.
   *
   * Valued at appliedAmount rather than totalAmountDue: the applied figure is
   * what actually settled against the ledger, which is the amount that moved.
   */
  async [JOURNAL_SOURCE_TYPES.PAYMENT_RECEIPT](ctx, posting, doc) {
    const amount = round2(Number(doc.appliedAmount) || 0);
    if (amount === 0) return;

    const charges = await resolveBankCharges(ctx, doc);
    const cash = await resolvePaymentModeCashAccount(ctx, doc);
    if (charges) {
      posting.debit(charges.account, charges.amount, `Bank charges — ${doc.paymentReceiptNo}`);
    }
    posting.debit(cash, round2(amount - (charges?.amount || 0)), `Receipt — ${doc.paymentReceiptNo}`);

    const contra = await resolvePartyContraAccount(ctx, doc.partyType, doc.partyCode, doc.partyName);
    posting.credit(contra, amount, `${doc.partyName || 'Party'} — ${doc.paymentReceiptNo}`);
  },

  /**
   * Payment Voucher (Outgoing Payment) — money out.
   *
   *   Dr  Accounts Payable        (Vendor — settles what we owed)
   *   Dr  the nominated account   (Account — a payment with no business partner)
   *     Cr  Cash / Bank           (the account chosen on Payment Modes, or
   *                                the cashOnHand determination account when
   *                                none was chosen)
   *
   * With bank charges (a fee the bank deducted when the payment went out):
   *
   *   Dr  <party contra>         appliedAmount
   *   Dr  Bank Charges account   bankChargesAmount
   *     Cr  Cash / Bank           appliedAmount + bankChargesAmount
   *
   * Here the extra amount actually left the bank account alongside the
   * payment, so it adds to the cash/bank credit rather than reducing it.
   */
  async [JOURNAL_SOURCE_TYPES.PAYMENT_VOUCHER](ctx, posting, doc) {
    const amount = round2(Number(doc.appliedAmount) || 0);
    if (amount === 0) return;

    const contra = await resolvePartyContraAccount(ctx, doc.partyType, doc.partyCode, doc.partyName);
    posting.debit(contra, amount, `${doc.partyName || 'Party'} — ${doc.paymentVoucherNo}`);

    const charges = await resolveBankCharges(ctx, doc);
    if (charges) {
      posting.debit(charges.account, charges.amount, `Bank charges — ${doc.paymentVoucherNo}`);
    }
    const cash = await resolvePaymentModeCashAccount(ctx, doc);
    posting.credit(cash, round2(amount + (charges?.amount || 0)), `Payment — ${doc.paymentVoucherNo}`);
  },

  /**
   * BP Opening Balance (Company Setup > BP Opening Balance) — one journal
   * entry for the WHOLE document, not one per line: `doc.lines` is every BP
   * row saved together on that document, and each line gets its own Dr/Cr
   * pair here because each BP is a different control account. createPosting()
   * above already merges same-account/same-side/same-partner lines and
   * balances the result, so a document with five customer lines and one
   * vendor line still comes out as one clean, balanced entry.
   *
   *   Customer line (they owe us):
   *     Dr  Accounts Receivable (this customer's own control account)
   *       Cr  Opening Balance Account (the header's nominated G/L account)
   *
   *   Vendor line (we owe them):
   *     Dr  Opening Balance Account
   *       Cr  Accounts Payable (this vendor's own control account)
   *
   * A negative Opening Balance (a customer who is actually in credit, or a
   * vendor we have overpaid) is not special-cased — posting.debit()/credit()
   * already flip a negative amount to the opposite side themselves (see
   * createPosting() above), so the sides above stay correct either way.
   */
  async [JOURNAL_SOURCE_TYPES.BP_OPENING_BALANCE](ctx, posting, doc) {
    const openingAccount = await ctx.accountByCode(doc.openingBalanceAccount);
    if (!openingAccount) {
      throw new AccountDeterminationError(
        `Opening Balance Account "${doc.openingBalanceAccount}" does not exist in the Chart Of Accounts.`
      );
    }
    assertPostable(openingAccount, 'openingBalanceAccount');

    // One bulk lookup per BP type instead of resolveArAccount/
    // resolveApAccount discovering each customer/vendor cold, one at a
    // time, the first time its name comes up below. ctx.customer/
    // ctx.supplier already cache per name across repeats of the SAME name,
    // but a large BP Opening Balance import is exactly the case where most
    // names are distinct — a 20,000-line, 20,000-distinct-customer import
    // would otherwise still cost 20,000 sequential round trips here alone.
    const lines = doc.lines || [];
    //
    // The partner is looked up by BP CODE (unique), falling back to the name
    // only for a legacy row with no code. Looking it up by name alone picked
    // whichever of two same-named partners the database returned first —
    // and therefore possibly the wrong partner's Control Account — and broke
    // outright for a partner renamed since the line was saved.
    const partnerKey = (l) => l.bpCode || l.bpName;
    await ctx.primeCustomers(lines.filter((l) => l.bpType !== 'Vendor').map(partnerKey));
    await ctx.primeSuppliers(lines.filter((l) => l.bpType === 'Vendor').map(partnerKey));

    for (const line of doc.lines || []) {
      const amount = round2(Number(line.openingBalance) || 0);
      if (amount === 0) continue;

      const isVendor = line.bpType === 'Vendor';
      const contra = isVendor
        ? await resolveApAccount(ctx, partnerKey(line))
        : await resolveArAccount(ctx, partnerKey(line));
      // Tags the control-account line with the actual Business Partner (code
      // + name), same as every other AR/AP posting — see the matching
      // comment on the Sales Invoice AR line above.
      const partner = { code: line.bpCode, name: line.bpName };
      const description = `Opening balance — ${line.bpName}`;

      if (isVendor) {
        posting.debit(openingAccount, amount, description);
        posting.credit(contra, amount, description, null, partner);
      } else {
        posting.debit(contra, amount, description, null, partner);
        posting.credit(openingAccount, amount, description);
      }
    }
  },

  /**
   * Inventory Opening Balance (Company Setup > Inventory Opening Balance) — one
   * journal entry for the whole document, driven by each line's Stock Value
   * (Stock x Unit Cost):
   *
   *   Dr  Inventory            (per line, on that item's own Inventory account)
   *     Cr  Opening Balance Account   (the header's account, total of all lines)
   *
   * This is what makes the books agree with the stock ledger under perpetual
   * inventory: the opening stock position is already in [dbo].[Stock] (see
   * syncStockPosting), and this entry puts the same value on the Inventory
   * account against the equity/opening-balance account picked on the form.
   * Inactive lines are not stock and post nothing.
   */
  async [JOURNAL_SOURCE_TYPES.INVENTORY_OPENING_BALANCE](ctx, posting, doc) {
    const openingAccount = await ctx.accountByCode(doc.openingBalanceAccount);
    if (!openingAccount) {
      throw new AccountDeterminationError(
        `Opening Balance Account "${doc.openingBalanceAccount}" does not exist in the Chart Of Accounts.`
      );
    }
    assertPostable(openingAccount, 'openingBalanceAccount');

    let total = 0;
    for (const line of doc.lines || []) {
      if (line.status && line.status !== 'Active') continue;
      const value = round2(Number(line.stockValue) || 0);
      if (value === 0) continue;
      const inventory = await resolveItemAccount(ctx, {
        productCode: line.itemCode,
        warehouse: line.warehouse,
        role: 'inventoryAccount',
      });
      posting.debit(inventory, value, `Opening stock — ${line.itemCode}`, line.warehouse);
      total = round2(total + value);
    }
    if (total === 0) return;
    posting.credit(openingAccount, total, `Opening stock — ${doc.documentNumber}`);
  },
};

/**
 * The cash/bank account a Payment Receipt/Voucher actually moved through,
 * as chosen on the Payment Modes dialog's Cash/Cheque/Bank Transfer tab
 * (see components/banking/PaymentModesDialog.jsx). Falls back to the fixed
 * cashOnHand determination account when doc.paymentGlAccount is empty —
 * every record saved before this existed, or saved without ever opening
 * the dialog, keeps posting exactly as it did before this field existed.
 */
async function resolvePaymentModeCashAccount(ctx, doc) {
  if (!doc.paymentGlAccount) return resolveCashAccount(ctx);
  const docNo = doc.paymentReceiptNo || doc.paymentVoucherNo || '';
  return resolveAccountByCode(
    ctx,
    doc.paymentGlAccount,
    'paymentModeAccount',
    docNo ? `The Payment Modes dialog on "${docNo}"` : 'The Payment Modes dialog'
  );
}

/**
 * The Bank Charges line from the Payment Modes dialog, resolved and
 * validated — or null when no charge was recorded. Only bankChargesAccount
 * *and* a positive bankChargesAmount together produce a line; either alone
 * is treated as "no charge" rather than a half-entered error.
 */
async function resolveBankCharges(ctx, doc) {
  const amount = round2(Number(doc.bankChargesAmount) || 0);
  if (!doc.bankChargesAccount || amount <= 0) return null;
  const docNo = doc.paymentReceiptNo || doc.paymentVoucherNo || '';
  const account = await resolveAccountByCode(
    ctx,
    doc.bankChargesAccount,
    'bankChargesGlAccount',
    docNo ? `The Payment Modes dialog on "${docNo}"` : 'The Payment Modes dialog'
  );
  return { account, amount };
}

/**
 * The account on the other side of a payment, chosen by the party type the
 * user picked on the voucher.
 *
 * 'Account' means the user nominated a G/L account directly — the party code
 * IS the account code, so it is used as given rather than determined.
 */
async function resolvePartyContraAccount(ctx, partyType, partyCode, partyName) {
  if (partyType === 'Account') {
    const account = await ctx.accountByCode(partyCode);
    if (!account) {
      throw new AccountDeterminationError(
        `This payment posts against account "${partyCode}", which does not exist in the Chart Of Accounts.`
      );
    }
    assertPostable(account, 'payment account');
    return account;
  }
  if (partyType === 'Vendor') return resolveApAccount(ctx, partyName);
  return resolveArAccount(ctx, partyName);
}

/**
 * A document-level (rather than line-level) account — the offsetting side of
 * a posting, where there is one account for the whole document.
 *
 * Determined from the document's first item so that a company running
 * "G/L Accounts By: Product Group" still gets the group's own COGS or
 * clearing account rather than only the company default. With no items to go
 * on, the company-wide determination answers.
 */
async function resolveItemAccountForDocument(ctx, doc, role, warehouseOverride) {
  const firstItem = (doc.items || []).find((i) => i.productCode);
  if (!firstItem) return resolveDeterminationAccount(ctx, role);
  return resolveItemAccount(ctx, {
    productCode: firstItem.productCode,
    warehouse: warehouseOverride || doc.warehouse || firstItem.warehouse,
    role,
  });
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

/**
 * The last line of defence: an entry that does not balance never reaches the
 * database.
 *
 * A residual of a paisa or two is real — every schema above rounds each line
 * to two decimals independently, and the roundings do not have to cancel. It
 * is absorbed onto the rounding account, which is what that account is for.
 *
 * Anything larger is not a rounding artefact, it is a defect in a posting
 * schema, and the correct response is to refuse rather than to force it
 * balanced with a plug. A plug would hide the bug in an account nobody reads
 * and leave the books arithmetically correct but meaningless.
 */
const ROUNDING_TOLERANCE = 0.02;

async function balanceLines(ctx, lines) {
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  const difference = round2(totalDebit - totalCredit);

  if (difference === 0) return { lines, totalDebit, totalCredit };

  if (Math.abs(difference) > ROUNDING_TOLERANCE) {
    throw new Error(
      `Journal entry does not balance: debit ${totalDebit.toFixed(2)} vs credit ${totalCredit.toFixed(2)}. This is a defect in the posting schema, not a configuration problem.`
    );
  }

  const account = await resolveDeterminationAccount(ctx, 'roundingAccountId');
  lines.push({
    lineNo: lines.length + 1,
    accountCode: account.accountCode,
    accountName: account.accountName,
    description: 'Rounding difference',
    branch: lines[0]?.branch || null,
    debit: difference < 0 ? -difference : 0,
    credit: difference > 0 ? difference : 0,
  });

  return {
    lines,
    totalDebit: round2(lines.reduce((s, l) => s + l.debit, 0)),
    totalCredit: round2(lines.reduce((s, l) => s + l.credit, 0)),
  };
}

/**
 * Generate and store the accounting document for one business document.
 *
 * MUST be called with the transaction the document itself was written in.
 * Enlisting in the caller's transaction is what makes the document and its
 * journal entry atomic: a save that fails after posting rolls the entry back
 * with it, and there is never a ledger entry for a document that does not
 * exist. This is the same contract postStockEntries declares.
 *
 * `strict` (default false) changes what happens when account determination
 * fails: normally (see the module doc comment, "Missing configuration parks
 * the entry, it never blocks the document") the entry is parked as
 * 'Pending G/L' and the caller's transaction commits anyway. A caller that
 * passes `strict: true` gets the AccountDeterminationError instead — thrown,
 * not caught — so it propagates out of the caller's `prisma.$transaction`
 * and rolls back everything in it: the source document, its stock postings,
 * all of it. Purchase GRN is the one caller that opts into this (see
 * routes/resources.js): a receipt with an unconfigured warehouse account
 * must not save at all, by explicit product decision, rather than parking
 * like every other document type does.
 *
 * @returns {{ posted: boolean, journalEntryNo: string|null, skipped: string|null, glError: string|null }}
 */
async function postJournalEntry(tx, { sourceType, sourceDocNo, status, doc, strict = false }) {
  if (!POSTING_SCHEMAS[sourceType]) return { posted: false, journalEntryNo: null, skipped: 'no-schema', glError: null };
  if (!sourceDocNo) return { posted: false, journalEntryNo: null, skipped: 'no-document-number', glError: null };
  if (!postsToGl(status, sourceType)) return { posted: false, journalEntryNo: null, skipped: 'not-posted', glError: null };

  // Idempotency. The filtered unique index is the real guarantee; this check
  // exists so a re-save returns quietly instead of surfacing a constraint
  // violation to the user, who did nothing wrong by pressing Save twice.
  // Filtered the same way the index is (see activeJournalEntryFilter) --
  // otherwise, once a cancelled document's original entry sticks around as
  // Reversed instead of disappearing, this would mistake that leftover row
  // (or its reversal) for "already posted" and refuse to create the fresh
  // entry a reopened/resaved document needs.
  const existing = await tx.journalEntry.findFirst({
    where: activeJournalEntryFilter(sourceType, sourceDocNo),
    orderBy: { id: 'desc' },
  });
  if (existing) {
    return { posted: false, journalEntryNo: existing.journalEntryNo, skipped: 'already-posted', glError: null };
  }

  const ctx = createDeterminationContext(tx);
  const branch = doc.branch || null;
  const posting = createPosting(branch);

  let lines = [];
  let totals = { totalDebit: 0, totalCredit: 0 };
  let glError = null;

  try {
    await POSTING_SCHEMAS[sourceType](ctx, posting, doc);
    const built = posting.build();
    // A schema that legitimately produced nothing — an uncosted goods
    // movement, a transfer within one inventory account — is not an error and
    // must not leave a parked entry behind for someone to chase.
    if (!built.length) return { posted: false, journalEntryNo: null, skipped: 'no-postable-lines', glError: null };
    const balanced = await balanceLines(ctx, built);
    lines = balanced.lines;
    totals = { totalDebit: balanced.totalDebit, totalCredit: balanced.totalCredit };
  } catch (err) {
    // Configuration gaps park the entry. Anything else is a real fault and
    // must take the document down with it rather than being written off as a
    // configuration problem.
    if (!err.isAccountDetermination) throw err;
    // ...unless the caller opted into strict mode (Purchase GRN — see the
    // doc comment above), in which case the gap must block the document
    // itself rather than being parked. Stamp a 400 so it reaches the user as
    // a plain validation message, not a generic 500, then let it propagate:
    // the caller's prisma.$transaction rolls everything back with it.
    if (strict) {
      err.status = 400;
      throw err;
    }
    glError = err.message;
    lines = [];
    totals = { totalDebit: 0, totalCredit: 0 };
  }

  const { resolveDocumentNumber } = require('./documentNumber');
  const { documentNumber, syncManual } = await resolveDocumentNumber('JE', null, tx);
  const dates = resolveSourceDates(sourceType, doc);

  // Header first, lines in chunked createMany calls after — see
  // createJournalEntryLines' own doc comment for why this replaced a single
  // nested `lines: { create: lines }` write (unchunked, one round trip per
  // line).
  const created = await tx.journalEntry.create({
    data: {
      journalEntryNo: documentNumber,
      branch,
      transactionType: sourceType,
      sourceType,
      sourceDocNo,
      postingDate: dates.postingDate,
      documentDate: dates.documentDate,
      dueDate: dates.dueDate,
      referenceNo: sourceDocNo,
      currency: doc.currency || 'INR',
      exchangeRate: doc.exchangeRate != null ? doc.exchangeRate : 1,
      remarks: `Automatically generated from ${sourceType} ${sourceDocNo}`,
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      status: glError ? JOURNAL_STATUS.PENDING_GL : JOURNAL_STATUS.POSTED,
      glError,
    },
  });
  await createJournalEntryLines(tx, created.id, lines);
  if (syncManual) await syncManual();

  return {
    posted: !glError,
    journalEntryNo: created.journalEntryNo,
    skipped: glError ? 'pending-gl' : null,
    glError,
  };
}

/**
 * Retry a parked entry after its configuration gap has been closed.
 *
 * Reloads the source document rather than trusting anything cached on the
 * parked row: time has passed, and the document may have been edited since.
 * The entry keeps its number — it is the same accounting document, finally
 * completed, and renumbering it would break any reference already made to it.
 */
async function repostJournalEntry(tx, journalEntryId, loadSourceDocument) {
  const entry = await tx.journalEntry.findUnique({ where: { id: journalEntryId } });
  if (!entry) {
    const err = new Error('Journal entry not found');
    err.status = 404;
    throw err;
  }
  if (entry.status !== JOURNAL_STATUS.PENDING_GL) {
    const err = new Error('Only an entry awaiting G/L posting can be posted this way.');
    err.status = 400;
    throw err;
  }

  const doc = await loadSourceDocument(tx, entry.sourceType, entry.sourceDocNo);
  if (!doc) {
    const err = new Error(`The source document ${entry.sourceType} ${entry.sourceDocNo} no longer exists.`);
    err.status = 400;
    throw err;
  }

  const ctx = createDeterminationContext(tx);
  const posting = createPosting(entry.branch);

  try {
    await POSTING_SCHEMAS[entry.sourceType](ctx, posting, doc);
    const built = posting.build();
    if (!built.length) {
      const err = new Error('This document produces no postable journal lines.');
      err.status = 400;
      throw err;
    }
    const balanced = await balanceLines(ctx, built);

    // Same chunked-createMany rebuild as postJournalEntry above, instead of
    // a single nested `lines: { create: balanced.lines } }` write — a
    // parked entry being reposted can carry just as many distinct BP lines
    // as one created fresh.
    await tx.journalEntryLine.deleteMany({ where: { journalEntryId: entry.id } });
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        totalDebit: balanced.totalDebit,
        totalCredit: balanced.totalCredit,
        status: JOURNAL_STATUS.POSTED,
        glError: null,
      },
    });
    await createJournalEntryLines(tx, entry.id, balanced.lines);
    return tx.journalEntry.findUnique({
      where: { id: entry.id },
      include: { lines: { orderBy: { id: 'asc' } } },
    });
  } catch (err) {
    if (!err.isAccountDetermination) throw err;
    // Still not configured. Update the message — the gap may be a different
    // one now that the first was closed — and leave it parked.
    await tx.journalEntry.update({ where: { id: entry.id }, data: { glError: err.message } });
    const parked = new Error(err.message);
    parked.status = 400;
    throw parked;
  }
}

/**
 * Undo the accounting document behind a business document.
 *
 * Two different things can trigger this, and they are handled differently:
 *
 *   - An ordinary edit/resave of a document that is still live (`asReversal`
 *     false, the default): the entry is deleted outright and
 *     postJournalEntry (see syncJournalEntry) rebuilds it fresh from what the
 *     document now says. Nothing in this app has a period-close or a lock
 *     date, so there is no closed period a deletion could corrupt, and
 *     delete-and-regenerate is simpler than a reversal pair for a routine
 *     correction that was never "wrong", just out of date.
 *
 *   - The document is being CANCELLED (`asReversal` true, passed by
 *     syncJournalEntry when the new status is 'Cancelled'): a real, already-
 *     posted entry must not just vanish — cancelling a document is supposed
 *     to leave a trail, not erase one. The original entry is kept and
 *     flipped to `Reversed`, and a brand-new entry is created that mirrors
 *     every line with debit/credit swapped, linked back to the original via
 *     `reversedEntryId`.
 *
 * Either way, a `Pending G/L` entry (parked because account determination
 * failed — see postJournalEntry) is always just deleted: it never wrote a
 * single real line, so there is nothing in the ledger for a reversal to
 * undo.
 */
async function reverseJournalEntry(tx, sourceType, sourceDocNo, { asReversal = false } = {}) {
  if (!sourceType || !sourceDocNo) return { removed: 0, reversed: 0 };

  const existing = await tx.journalEntry.findFirst({
    where: activeJournalEntryFilter(sourceType, sourceDocNo),
    include: { lines: true },
    orderBy: { id: 'desc' },
  });
  if (!existing) return { removed: 0, reversed: 0 };

  if (existing.status === JOURNAL_STATUS.PENDING_GL || !asReversal) {
    // JournalEntryLine.journalEntry is onDelete: Cascade, so lines go with it.
    await tx.journalEntry.delete({ where: { id: existing.id } });
    return { removed: 1, reversed: 0 };
  }

  // A real, previously-posted entry, and the source document is being
  // cancelled — mirror it into a new reversing entry instead of deleting it.
  const { resolveDocumentNumber } = require('./documentNumber');
  const { documentNumber, syncManual } = await resolveDocumentNumber('JE', null, tx);

  const reversal = await tx.journalEntry.create({
    data: {
      journalEntryNo: documentNumber,
      branch: existing.branch,
      transactionType: `${existing.transactionType} Reversal`,
      sourceType: existing.sourceType,
      sourceDocNo: existing.sourceDocNo,
      postingDate: existing.postingDate,
      documentDate: existing.documentDate,
      dueDate: existing.dueDate,
      referenceNo: existing.referenceNo,
      currency: existing.currency,
      exchangeRate: existing.exchangeRate,
      remarks: `Reversal of ${existing.journalEntryNo} (${existing.sourceType} ${existing.sourceDocNo} cancelled)`,
      totalDebit: existing.totalCredit,
      totalCredit: existing.totalDebit,
      status: JOURNAL_STATUS.POSTED,
      isReversal: true,
    },
  });

  // Exact mirror of every original line — same accounts, same amounts, same
  // everything else — with debit and credit (and their SC equivalents)
  // swapped.
  await createJournalEntryLines(
    tx,
    reversal.id,
    existing.lines.map((l) => ({
      lineNo: l.lineNo,
      accountCode: l.accountCode,
      accountName: l.accountName,
      description: l.description,
      branch: l.branch,
      debit: l.credit,
      credit: l.debit,
      businessPartnerCode: l.businessPartnerCode,
      businessPartnerName: l.businessPartnerName,
      debitSc: l.creditSc,
      creditSc: l.debitSc,
      baseAmount: l.baseAmount,
      ref1: l.ref1,
      ref2: l.ref2,
      ref3: l.ref3,
      warehouse: l.warehouse,
    }))
  );
  if (syncManual) await syncManual();

  await tx.journalEntry.update({
    where: { id: existing.id },
    data: { status: JOURNAL_STATUS.REVERSED, reversedEntryId: reversal.id },
  });

  return { removed: 0, reversed: 1, reversalId: reversal.id, reversalNo: reversal.journalEntryNo };
}

/**
 * The whole lifecycle in one call, for a document route's POST/PUT.
 *
 * Re-saving a document must be able to CHANGE its journal entry, not only
 * create one: an invoice whose lines were corrected has different accounting,
 * and an invoice pulled back to Draft should have no accounting at all. So an
 * existing entry is dropped and rebuilt from what the document now says,
 * which also means a document that was saved while its configuration was
 * incomplete heals itself the next time it is saved.
 *
 * A document moving to 'Cancelled' is the one exception to "drop and
 * rebuild": there is no "rebuilt" forward entry to post for a document that
 * no longer exists in an active status, so this stops at the reversal
 * (reverseJournalEntry, asReversal: true) and never calls postJournalEntry —
 * which would in any case immediately refuse via postsToGl('Cancelled', ...),
 * but stopping here says so, instead of relying on that to be true.
 */
async function syncJournalEntry(tx, { sourceType, sourceDocNo, status, doc, strict = false }) {
  const cancelling = status === 'Cancelled';
  await reverseJournalEntry(tx, sourceType, sourceDocNo, { asReversal: cancelling });
  if (cancelling) {
    return { posted: false, journalEntryNo: null, skipped: 'cancelled', glError: null };
  }
  return postJournalEntry(tx, { sourceType, sourceDocNo, status, doc, strict });
}

module.exports = {
  JOURNAL_SOURCE_TYPES,
  JOURNAL_STATUS,
  POSTING_SCHEMAS,
  AccountDeterminationError,
  ROLE_TO_DETERMINATION,
  postsToGl,
  postJournalEntry,
  syncJournalEntry,
  repostJournalEntry,
  reverseJournalEntry,
  createDeterminationContext,
  resolveItemAccount,
  resolveDeterminationAccount,
};
