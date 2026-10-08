/**
 * Business rules that guard postings: credit control and master-data
 * integrity.
 *
 * Both address the same class of problem — the application captured a control
 * and then never applied it.
 */

const { round2 } = require('./documentTotals');

/** Statuses whose documents do not represent real exposure. */
const UNREALISED = ['Draft', 'Cancelled'];

/**
 * Enforce a customer's credit limit.
 *
 * `Customer.creditLimit` was captured on the master, displayed in the
 * outstanding report, and never once checked. An order or invoice could be
 * raised for any amount for any customer, however far past their limit they
 * already were — which is the entire point of having a credit limit.
 *
 * Exposure is measured the way a credit controller would: what the customer
 * already owes on open invoices, plus what this document is about to add. A
 * limit of zero or null means "no limit set", not "no credit allowed" —
 * treating an unconfigured master as a hard block would stop every sale on day
 * one.
 *
 * `excludeDocumentNo` lets an edit exclude its own prior contribution, so
 * re-saving an invoice does not count it twice.
 */
async function assertWithinCreditLimit(tx, {
  customerName,
  documentAmount,
  excludeInvoiceNo = null,
  documentLabel = 'document',
}) {
  if (!customerName) return null;

  const customer = await tx.businessPartner.findFirst({
    where: { partnerType: 'Customer', partnerName: customerName },
    select: { creditLimit: true, partnerName: true, status: true },
  });
  if (!customer) return null;

  const limit = Number(customer.creditLimit) || 0;
  if (limit <= 0) return null; // No limit configured.

  const openItems = await tx.customerOutstanding.findMany({
    where: {
      customerName,
      status: { not: 'Paid' },
      ...(excludeInvoiceNo ? { invoiceNo: { not: excludeInvoiceNo } } : {}),
    },
    select: { balanceAmount: true },
  });

  const currentExposure = round2(
    openItems.reduce((sum, i) => sum + (Number(i.balanceAmount) || 0), 0)
  );
  const newExposure = round2(currentExposure + (Number(documentAmount) || 0));

  if (newExposure > limit + 0.005) {
    const err = new Error(
      `${customerName} would exceed their credit limit. `
      + `Limit ${limit.toFixed(2)}, already outstanding ${currentExposure.toFixed(2)}, `
      + `this ${documentLabel} ${(Number(documentAmount) || 0).toFixed(2)} `
      + `— ${(newExposure - limit).toFixed(2)} over.`
    );
    err.status = 409;
    err.code = 'CREDIT_LIMIT_EXCEEDED';
    throw err;
  }

  return { limit, currentExposure, newExposure, available: round2(limit - newExposure) };
}

/**
 * Where each master record's identity appears across the transaction tables.
 *
 * Customers, suppliers and products are linked to every transaction by a plain
 * string with no foreign key, so the database cannot refuse a delete that
 * orphans history the way it would for a real relation. Deleting a customer
 * left their invoices pointing at a name that no longer existed: the
 * outstanding report still showed the debt, nothing could be collected against
 * it, and no screen explained where the customer had gone.
 *
 * These maps drive both the delete guard and the rename cascade.
 */
const REFERENCE_MAP = {
  customer: {
    label: 'customer',
    // Customer Master is retired — Business Partner (filtered to
    // partnerType 'Customer' via masterWhere, read by assertMasterExists
    // below) is the master these transaction documents are checked against
    // now.
    masterDelegate: (c) => c.businessPartner,
    masterWhere: { partnerType: 'Customer' },
    nameField: 'partnerName',
    references: [
      { delegate: (c) => c.salesQuotation, field: 'customer', label: 'sales quotation' },
      { delegate: (c) => c.salesOrder, field: 'customer', label: 'sales order' },
      { delegate: (c) => c.deliveryChallan, field: 'customer', label: 'delivery challan' },
      { delegate: (c) => c.salesInvoice, field: 'customer', label: 'sales invoice' },
      { delegate: (c) => c.customerOutstanding, field: 'customerName', label: 'outstanding invoice' },
      { delegate: (c) => c.collection, field: 'customerName', label: 'collection' },
      // PaymentReceipt shares one partyName column across Customer/Vendor/
      // Account (see schema.prisma) — extraWhere scopes the count/rename to
      // rows actually posted as a Customer, so a same-named Vendor or
      // Account row is never counted or renamed by mistake.
      { delegate: (c) => c.paymentReceipt, field: 'partyName', extraWhere: { partyType: 'Customer' }, label: 'payment receipt' },
      { delegate: (c) => c.salesPrice, field: 'customer', label: 'sales price' },
      { delegate: (c) => c.customerDiscount, field: 'customer', label: 'customer discount' },
    ],
  },
  supplier: {
    label: 'supplier',
    // Supplier Master is retired — same story as customer above, filtered
    // to partnerType 'Vendor'.
    masterDelegate: (c) => c.businessPartner,
    masterWhere: { partnerType: 'Vendor' },
    nameField: 'partnerName',
    references: [
      { delegate: (c) => c.purchaseQuotation, field: 'supplier', label: 'purchase quotation' },
      { delegate: (c) => c.purchaseOrder, field: 'supplier', label: 'purchase order' },
      { delegate: (c) => c.goodsReceivedNote, field: 'supplier', label: 'goods received note' },
      { delegate: (c) => c.purchaseInvoice, field: 'supplier', label: 'purchase invoice' },
      { delegate: (c) => c.supplierOutstanding, field: 'supplierName', label: 'outstanding invoice' },
      { delegate: (c) => c.supplierPayment, field: 'supplierName', label: 'payment' },
      // Same partyType scoping as the customer side above, so a same-named
      // Customer or Account row is never counted or renamed by mistake.
      { delegate: (c) => c.paymentReceipt, field: 'partyName', extraWhere: { partyType: 'Vendor' }, label: 'payment receipt' },
      // Same partyName-sharing story as PaymentReceipt, scoped to Vendor —
      // PaymentVoucher's Account rows are never counted or renamed here.
      { delegate: (c) => c.paymentVoucher, field: 'partyName', extraWhere: { partyType: 'Vendor' }, label: 'payment voucher' },
      { delegate: (c) => c.purchasePrice, field: 'supplier', label: 'purchase price' },
    ],
  },
  product: {
    label: 'product',
    masterDelegate: (c) => c.product,
    nameField: 'productCode',
    references: [
      { delegate: (c) => c.salesInvoiceItem, field: 'productCode', label: 'sales invoice' },
      { delegate: (c) => c.salesOrderItem, field: 'productCode', label: 'sales order' },
      { delegate: (c) => c.deliveryChallanItem, field: 'productCode', label: 'delivery challan' },
      { delegate: (c) => c.purchaseInvoiceItem, field: 'productCode', label: 'purchase invoice' },
      { delegate: (c) => c.purchaseOrderItem, field: 'productCode', label: 'purchase order' },
      { delegate: (c) => c.goodsReceivedNoteItem, field: 'productCode', label: 'goods received note' },
      { delegate: (c) => c.stockReceiptItem, field: 'productCode', label: 'stock receipt' },
      { delegate: (c) => c.stockIssueItem, field: 'productCode', label: 'stock issue' },
      { delegate: (c) => c.stockAdjustmentItem, field: 'productCode', label: 'stock adjustment' },
    ],
  },
  // Invoice Type — the "Other Details" card's Invoice Type CFL (Purchase
  // Order/Purchase GRN/Purchase Invoice all store it by name, same
  // cross-master-by-name convention as everything else in this map). Backs
  // both the real delete guard (masterGuard('invoiceType', 'name') in
  // routes/resources.js) and the frontend's up-front "already used, delete
  // disabled" flag on the Invoice Type option list (see getReferencedIdentitySet
  // usage on GET /invoice-types?includeUsage=true).
  invoiceType: {
    label: 'invoice type',
    masterDelegate: (c) => c.invoiceType,
    nameField: 'name',
    references: [
      { delegate: (c) => c.purchaseOrder, field: 'invoiceType', label: 'purchase order' },
      { delegate: (c) => c.goodsReceivedNote, field: 'invoiceType', label: 'goods received note' },
      { delegate: (c) => c.purchaseInvoice, field: 'invoiceType', label: 'purchase invoice' },
    ],
  },
};

/**
 * Where a product has actually been used, grouped by the flow it was used in.
 *
 * This backs the Sales Item / Purchase Item / Inventory Item checkboxes on
 * Product Master: a flag whose flow already has history cannot be unticked,
 * because doing so would drop the product out of that flow's picker while it
 * still sits on saved documents — the line would keep its stored product code
 * and name, but nobody could ever select that product again to correct or
 * repeat the document, and the master would be asserting the product was
 * never part of a flow it demonstrably was.
 *
 * Kept separate from REFERENCE_MAP.product above even though the two overlap.
 * That one answers "may this master be deleted at all", so a single flat list
 * is all it needs; this one has to say WHICH flow, and per-flow is the only
 * thing that makes a per-checkbox answer possible. It is also deliberately
 * more complete: REFERENCE_MAP predates the quotation, return, credit-memo and
 * stock-transfer tables and was never extended, so a product used only on, say,
 * a Sales Return is invisible to it. Missing a reference there is a delete that
 * should have been refused; missing one here is a checkbox that should have
 * been locked. Both are wrong, and the list below is the complete one.
 *
 * Status is deliberately NOT filtered. A cancelled document is still readable
 * history — the whole reason cancellation exists rather than deletion — and a
 * draft is a document someone is mid-way through writing. Either way the
 * product is on it, and unticking the flag would break the picker underneath
 * it.
 */
const PRODUCT_USAGE_MAP = {
  salesItem: {
    label: 'sales',
    references: [
      { delegate: (c) => c.salesQuotationItem, label: 'sales quotation' },
      { delegate: (c) => c.salesOrderItem, label: 'sales order' },
      { delegate: (c) => c.deliveryChallanItem, label: 'delivery challan' },
      { delegate: (c) => c.salesInvoiceItem, label: 'sales invoice' },
      { delegate: (c) => c.salesReturnItem, label: 'sales return' },
      { delegate: (c) => c.salesCreditMemoItem, label: 'sales credit memo' },
    ],
  },
  purchaseItem: {
    label: 'purchase',
    references: [
      { delegate: (c) => c.purchaseQuotationItem, label: 'purchase quotation' },
      { delegate: (c) => c.purchaseOrderItem, label: 'purchase order' },
      { delegate: (c) => c.goodsReceivedNoteItem, label: 'goods received note' },
      { delegate: (c) => c.purchaseInvoiceItem, label: 'purchase invoice' },
      { delegate: (c) => c.purchaseReturnItem, label: 'purchase return' },
      { delegate: (c) => c.purchaseCreditMemoItem, label: 'purchase credit memo' },
    ],
  },
  inventoryItem: {
    label: 'inventory',
    references: [
      { delegate: (c) => c.stockReceiptItem, label: 'stock receipt' },
      { delegate: (c) => c.stockIssueItem, label: 'stock issue' },
      { delegate: (c) => c.stockAdjustmentItem, label: 'stock adjustment' },
      { delegate: (c) => c.stockTransferItem, label: 'stock transfer' },
      // Not documents, but stock the warehouse is holding right now. A
      // product with an opening balance or a movement in the ledger is one
      // the business physically has, and calling that a non-inventory item
      // would be a claim contradicted by the shelf. `opening_balance` and
      // `Stock` key the product by a differently-named column, hence `field`.
      { delegate: (c) => c.openingBalance, field: 'itemCode', label: 'opening balance' },
      { delegate: (c) => c.stock, field: 'itemCode', label: 'stock ledger entry' },
    ],
  },
};

/** Human-readable name of each flag, for error messages and tooltips. */
const PRODUCT_USAGE_LABELS = {
  salesItem: 'Sales Item',
  purchaseItem: 'Purchase Item',
  inventoryItem: 'Inventory Item',
};

/**
 * Which of a product's three flow flags are pinned by existing history.
 *
 * Returns one entry per flag: whether it is used at all, and the per-document
 * counts behind that, so the UI can both disable the checkbox and say what is
 * holding it. A blank product code (a product being created) is used nowhere
 * by definition, so nothing is locked and every box stays editable.
 */
async function getProductUsage(tx, productCode) {
  const empty = () => ({ used: false, count: 0, detail: [] });
  const result = {
    salesItem: empty(), purchaseItem: empty(), inventoryItem: empty(),
  };
  if (!productCode) return result;

  await Promise.all(Object.entries(PRODUCT_USAGE_MAP).map(async ([flag, spec]) => {
    const counts = await Promise.all(spec.references.map(async (ref) => ({
      label: ref.label,
      count: await ref.delegate(tx).count({
        where: { [ref.field || 'productCode']: productCode },
      }),
    })));
    const detail = counts.filter((c) => c.count > 0);
    result[flag] = {
      used: detail.length > 0,
      count: detail.reduce((sum, c) => sum + c.count, 0),
      detail,
    };
  }));

  return result;
}

/** "3 sales orders, 1 sales invoice" — the tail of the messages below. */
function describeUsage(usage) {
  return usage.detail
    .slice(0, 3)
    .map((d) => `${d.count} ${d.label}${d.count === 1 ? '' : 's'}`)
    .join(', ')
    + (usage.detail.length > 3 ? `, and ${usage.detail.length - 3} more` : '');
}

/** Loose truthiness — a checkbox arrives as true, 1 or "true" depending on client. */
const isOn = (v) => v === true || v === 1 || v === 'true';

/**
 * A product must belong to at least one flow.
 *
 * A product with all three unticked can be selected nowhere: it would not
 * appear in a sales document, a purchase document or a stock document, which
 * makes it a master record that exists but cannot be used for anything. That
 * is never what someone means to save, so it is refused rather than stored.
 *
 * Only enforced when the request actually carries the flags. A client that
 * does not mention them at all — the seed scripts, an integration written
 * before the columns existed — is left alone, and the database defaults
 * (all three true) apply as they always have. Reading "absent" as "unticked"
 * would break every one of those callers on a field they have never heard of.
 *
 * Shaped as a crudFactory `validate` hook, so it runs on create and on update
 * alike. On update a partial body is resolved against the stored row first:
 * sending only `{ salesItem: false }` must be judged on what the product ends
 * up as, not on the one field that happened to be in the payload.
 */
async function validateProductUsageFlags({ data, id, delegate }) {
  const flags = Object.keys(PRODUCT_USAGE_MAP);
  if (!flags.some((flag) => data[flag] !== undefined)) return;

  let resolved = data;
  if (id != null && flags.some((flag) => data[flag] === undefined)) {
    const existing = await delegate.findUnique({ where: { id } });
    if (existing) resolved = { ...existing, ...data };
  }

  if (flags.some((flag) => isOn(resolved[flag]))) return;

  const err = new Error(
    'A product must be at least one of Sales Item, Purchase Item or Inventory Item — '
    + 'with none of them selected it could not be used on any document.'
  );
  err.status = 400;
  err.code = 'PRODUCT_USAGE_NONE';
  throw err;
}

/**
 * Item Category (General tab) — a product must be flagged Excisable or GST;
 * the two are mutually exclusive on the form (ticking one unchecks the
 * other) but leaving both unticked has no client-side control stopping it on
 * a direct API call, so it is re-checked here. Same resolve-against-stored-
 * row shape as validateProductUsageFlags above, for the same reason: a
 * partial update body must be judged on what the product ends up as.
 */
async function validateItemCategoryRequired({ data, id, delegate }) {
  const flags = ['excisable', 'gst'];
  if (!flags.some((flag) => data[flag] !== undefined)) return;

  let resolved = data;
  if (id != null && flags.some((flag) => data[flag] === undefined)) {
    const existing = await delegate.findUnique({ where: { id } });
    if (existing) resolved = { ...existing, ...data };
  }

  if (flags.some((flag) => isOn(resolved[flag]))) return;

  const err = new Error('A product must be either Excisable or GST — select one under Item Category.');
  err.status = 400;
  err.code = 'PRODUCT_ITEM_CATEGORY_NONE';
  throw err;
}

/**
 * Manage Item By (General tab) — now required on the frontend form (see
 * productSchemas.js's manageItemBy), which always sends 'None'/'Batch'/
 * 'Serial'. Re-checked here for the same reason as the two validators
 * above: a direct API call isn't bound by the form's own zod schema, and an
 * explicit blank/null in the request body would otherwise clear a column
 * several batch/serial business rules (getProductUsage and friends) key off
 * of. Same resolve-against-stored-row shape, so a partial PUT that doesn't
 * touch this field is judged on what's already saved, not treated as "was
 * never set".
 */
async function validateManageItemByRequired({ data, id, delegate }) {
  if (data.manageItemBy === undefined) return;

  let resolved = data;
  if (id != null) {
    const existing = await delegate.findUnique({ where: { id } });
    if (existing) resolved = { ...existing, ...data };
  }

  if (resolved.manageItemBy) return;

  const err = new Error('Manage Item By is required — select None, Batch, or Serial.');
  err.status = 400;
  err.code = 'PRODUCT_MANAGE_ITEM_BY_REQUIRED';
  throw err;
}

/**
 * Refuse to turn off a flow flag the product has already been used in.
 *
 * The checkbox is rendered disabled for exactly these cases, so under normal
 * use this never fires. It exists because the disable is a courtesy of one
 * client: the rule has to hold for a direct API call too, or the data it
 * protects is only protected by the UI remembering to.
 *
 * Only turning a flag OFF is checked. Turning one ON adds a flow the product
 * may now be used in, which contradicts nothing that has already happened.
 */
async function assertProductUsageUnchanged(tx, productCode, data) {
  const flags = Object.keys(PRODUCT_USAGE_MAP).filter(
    (flag) => data[flag] === false || data[flag] === 0 || data[flag] === 'false'
  );
  if (!flags.length || !productCode) return;

  const usage = await getProductUsage(tx, productCode);
  const blocked = flags.filter((flag) => usage[flag].used);
  if (!blocked.length) return;

  const detail = blocked
    .map((flag) => `${PRODUCT_USAGE_LABELS[flag]} (${describeUsage(usage[flag])})`)
    .join('; ');

  const err = new Error(
    `"${productCode}" is already used in ${blocked.length === 1 ? 'this flow' : 'these flows'}, `
    + `so ${blocked.length === 1 ? 'it' : 'they'} cannot be turned off: ${detail}. `
    + `Set the product's status to Inactive instead, so the history stays readable.`
  );
  err.status = 409;
  err.code = 'PRODUCT_USAGE_IN_USE';
  throw err;
}

/**
 * Refuse to delete a master record that transactions still refer to.
 *
 * Reports the first few document types that reference it, with counts, so the
 * user knows what to deal with rather than just being told "no".
 */
async function assertNotReferenced(tx, kind, identity) {
  const spec = REFERENCE_MAP[kind];
  if (!spec || !identity) return;

  const counts = await Promise.all(
    spec.references.map(async (ref) => ({
      label: ref.label,
      count: await ref.delegate(tx).count({ where: { [ref.field]: identity, ...(ref.extraWhere || {}) } }),
    }))
  );

  const used = counts.filter((c) => c.count > 0);
  if (!used.length) return;

  const detail = used
    .slice(0, 4)
    .map((u) => `${u.count} ${u.label}${u.count === 1 ? '' : 's'}`)
    .join(', ');
  const more = used.length > 4 ? `, and ${used.length - 4} more` : '';

  const err = new Error(
    `"${identity}" cannot be deleted — it is referenced by ${detail}${more}. `
    + `Set its status to Inactive instead, so the history stays readable.`
  );
  err.status = 409;
  err.code = 'MASTER_IN_USE';
  throw err;
}

/**
 * The full set of identity values (customer/supplier names, product codes,
 * ...) that any document currently references for `kind` — one `distinct`
 * query per entry in REFERENCE_MAP[kind].references, not one query per row.
 *
 * Backs a LIST endpoint's "is this row already used" flag (e.g. Business
 * Partner's delete button, disabled up front instead of only failing on
 * click) where calling assertNotReferenced per row would mean one query per
 * reference table per row — fine for assertNotReferenced's single-record
 * delete check, far too many round-trips across a whole list.
 
 * Carry a master rename across every transaction that names it.
 * Without this, renaming a customer detached them from their entire history in
 * one save: the invoices kept the old string, the customer master had the new
 * one, and nothing joined them again.
 */

async function getReferencedIdentitySet(tx, kind) {
      const spec = REFERENCE_MAP[kind];
      if (!spec) return new Set();

      const results = await Promise.all(
        spec.references.map(async (ref) => {
          try {
            const rows = await ref.delegate(tx).findMany({
              where: { [ref.field]: { not: null }, ...(ref.extraWhere || {}) },
              select: { [ref.field]: true },
              distinct: [ref.field],
            });
            return rows.map((r) => r[ref.field]).filter(Boolean);
          } catch (err) {
            console.warn(`[getReferencedIdentitySet] Warning: failed checking ${ref.label}:`, err?.message);
            return [];
          }
        })
      );

      return new Set(results.flat());
    }
async function cascadeRename(tx, kind, previousIdentity, nextIdentity) {
  const spec = REFERENCE_MAP[kind];
  if (!spec || !previousIdentity || !nextIdentity) return 0;
  if (previousIdentity === nextIdentity) return 0;

  let updated = 0;
  for (const ref of spec.references) {
    const result = await ref.delegate(tx).updateMany({
      where: { [ref.field]: previousIdentity, ...(ref.extraWhere || {}) },
      data: { [ref.field]: nextIdentity },
    });
    updated += result.count || 0;
  }
  return updated;
}

/**
 * Reject a transaction naming a party or product that does not exist.
 *
 * A typo in the customer field used to create a phantom customer that appeared
 * in every report grouped by customer name, with real money attached to it and
 * no master record behind it.
 */
async function assertMasterExists(tx, kind, identity, { allowBlank = true } = {}) {
  if (!identity) {
    if (allowBlank) return;
    const err = new Error(`A ${REFERENCE_MAP[kind]?.label || kind} is required`);
    err.status = 400;
    throw err;
  }

  const spec = REFERENCE_MAP[kind];
  if (!spec) return;

  const found = await spec.masterDelegate(tx).findFirst({
    where: { [spec.nameField]: identity, ...(spec.masterWhere || {}) },
    select: { id: true },
  });
  if (found) return;

  const err = new Error(
    `No ${spec.label} named "${identity}" exists. Create the ${spec.label} first, `
    + `or pick an existing one.`
  );
  err.status = 400;
  err.code = 'MASTER_NOT_FOUND';
  throw err;
}

/**
 * Reject a receipt whose Batch/Serial-tracked lines are not fully allocated.
 *
 * Product Master's "Manage Item By" select (None/Batch/Serial) is what makes
 * a GRN line ask for the "Batches - Setup" / "Serial Numbers - Setup"
 * dialog. This is the server-side half of that requirement — the UI already
 * blocks the save button on an incomplete line, but that check runs in the
 * browser and a client that skips it (a stale tab, a direct API call) must
 * not be able to receive stock nobody can find later because no batch or
 * serial number was ever recorded for it.
 *
 * `items` is the RAW request payload for this document's lines (before
 * mapLine collapses them to DB columns), because that is the shape carrying
 * each line's `batches` / `serials` arrays.
 */
async function assertBatchSerialAllocation(client, items, { quantityField = 'quantity', optional = false } = {}) {
  const codes = [...new Set((items || []).map((i) => i.productCode).filter(Boolean))];
  if (!codes.length) return;

  const products = await client.product.findMany({
    where: { productCode: { in: codes } },
    select: { productCode: true, manageItemBy: true },
  });
  const modeByCode = new Map(products.map((p) => [p.productCode, p.manageItemBy]));

  const problems = [];
  (items || []).forEach((item, idx) => {
    const mode = modeByCode.get(item.productCode);
    if (mode !== 'Batch' && mode !== 'Serial') return;
    const qty = Number(item[quantityField]) || 0;
    const rowLabel = item.productCode || item.productName || `line ${idx + 1}`;

    if (mode === 'Batch') {
      const allocated = (item.batches || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      // `optional` (Sales/Purchase Invoice raised directly, not off a base
      // GRN/Delivery Challan — see isDirectInvoice) skips ONLY this
      // completeness check, so Batch/Serial is a nice-to-have there instead
      // of blocking Save. Whatever IS entered still has to be internally
      // consistent — duplicate numbers on the same line are still rejected
      // below, and assertUniqueBatchesAndSerials/assertBatchSerialAvailability
      // (called separately, unaffected by this flag) still catch a batch/
      // serial number that's not real or already used elsewhere.
      if (!optional && Math.abs(allocated - qty) > 0.005) {
        problems.push(`${rowLabel}: receiving ${qty} but ${allocated} allocated across batches`);
      }
      const batchNos = (item.batches || []).map((b) => b.batchNo).filter(Boolean);
      if (new Set(batchNos).size !== batchNos.length) {
        problems.push(`${rowLabel}: duplicate batch numbers on this line`);
      }
    } else {
      const serialNos = (item.serials || []).map((s) => s.serialNo).filter(Boolean);
      if (!optional && (serialNos.length !== (item.serials || []).length || serialNos.length !== qty)) {
        problems.push(`${rowLabel}: receiving ${qty} but ${(item.serials || []).length} serial number(s) assigned`);
      }
      if (new Set(serialNos).size !== serialNos.length) {
        problems.push(`${rowLabel}: duplicate serial numbers on this line`);
      }
    }
  });

  if (problems.length) {
    const err = new Error(`Batch/Serial allocation incomplete — ${problems.join('; ')}`);
    err.status = 400;
    throw err;
  }
}

/**
 * Reject a GRN/Stock Receipt/(direct) Purchase Invoice that would create a
 * duplicate batch or serial number.
 *
 * Serial numbers are unique system-wide (see the schema comment on
 * ProductSerial) for all three document types.
 *
 * Batch numbers, though, are scoped differently via `batchScope`:
 *
 * - `batchScope: 'grn'` (Purchase GRN) / `batchScope: 'stockReceipt'`
 *   (Stock Receipt) / `batchScope: 'purchaseInvoice'` (Purchase Invoice,
 *   only ever reached when it is direct — no base GRN, see isDirectInvoice
 *   in routes/resources.js) — a batch number's uniqueness boundary is the
 *   document itself, not the item or warehouse. The same batch number may
 *   repeat freely across any lines of the SAME document (any item, any
 *   warehouse) — that is not a collision, because ProductBatch's own
 *   uniqueness is now (batchNo, warehouse, productCode) (see the schema
 *   comment on ProductBatch): two different products sharing a batch
 *   number and warehouse on one document are two different physical lots,
 *   not a collision at all. It becomes a collision only when that exact
 *   batch number already sits on a DIFFERENT document of the SAME type, in
 *   which case the offending document's own number is named in the error
 *   so the user knows exactly where it's already used (e.g. "Batch 2627 is
 *   already used in GRN 262700744." / "Batch 2627 is already used in Stock
 *   Receipt SR-000123." / "Batch 2627 is already used in Purchase Invoice
 *   PI-000045."). Item and warehouse never enter into this check, and each
 *   of the three document types has its own separate namespace — a GRN's
 *   batches are never compared against a Stock Receipt's or a Purchase
 *   Invoice's, and so on.
 *
 * - default (`batchScope: 'warehouse'`) — legacy behavior, kept for any
 *   caller that hasn't opted into per-document scoping: a batch number is
 *   only unique PER (WAREHOUSE, PRODUCT) — the same batch number already
 *   sitting in a different warehouse, or against a different product, is
 *   not a collision, only the exact same (batchNo, warehouse, productCode)
 *   triple is, whether repeated on the document itself or already saved
 *   against an earlier document.
 *
 * The DB's own unique index would catch the per-(warehouse, product) case
 * too, but as a raw constraint violation with no indication of which
 * number or line was the problem — this runs first so the error is one the
 * user can act on.
 *
 * `excludeGrnId` / `excludeStockReceiptId` / `excludePurchaseInvoiceId` is
 * the id of the document being updated (only one of the three is ever
 * passed, matching whichever document type is calling this), so re-saving
 * it with its own previously-saved numbers unchanged isn't flagged as a
 * collision with itself. All left null on create, where nothing to exclude
 * exists yet. `defaultWarehouse` is the document's own header-level
 * warehouse (Stock Receipt has one, GRN does not — see toGrnItemData's own
 * comment), used only when a line leaves its own warehouse blank, matching
 * exactly the fallback toBatchCreateData applies when it actually writes
 * the row (still needed for a per-document `batchScope` even though the
 * batch check itself is warehouse-agnostic there, since defaultWarehouse
 * also feeds the per-document serial rows below).
 */
async function assertUniqueBatchesAndSerials(client, items, {
  excludeGrnId = null, excludeStockReceiptId = null, excludePurchaseInvoiceId = null, defaultWarehouse = null, batchScope = 'warehouse',
} = {}) {
  const isGrnScope = batchScope === 'grn';
  const isStockReceiptScope = batchScope === 'stockReceipt';
  const isPurchaseInvoiceScope = batchScope === 'purchaseInvoice';
  const isDocumentScope = isGrnScope || isStockReceiptScope || isPurchaseInvoiceScope;
  const batchKeys = new Map(); // dedupe key -> { batchNo, warehouse, productCode }
  const serialNos = new Set();
  const withinDocument = [];

  (items || []).forEach((item) => {
    const warehouse = item.warehouse || defaultWarehouse || null;
    const productCode = item.productCode || null;
    (item.batches || []).forEach((b) => {
      const no = (b.batchNo || '').trim();
      if (!no) return;
      if (isDocumentScope) {
        // A document-scoped batch's uniqueness boundary is the whole
        // document, not (batchNo, warehouse, productCode) — so the same
        // batch number reused on another line/item/warehouse of THIS
        // document is never a collision, and nothing needs flagging here.
        // Just collect the distinct batch numbers so the DB check below
        // has something to query.
        batchKeys.set(no, { batchNo: no, warehouse, productCode });
        return;
      }
      const key = `${no}::${warehouse || ''}::${productCode || ''}`;
      if (batchKeys.has(key)) withinDocument.push(`Batch number "${no}" is used on more than one line of this document for the same warehouse and product`);
      batchKeys.set(key, { batchNo: no, warehouse, productCode });
    });
    (item.serials || []).forEach((s) => {
      const no = (s.serialNo || '').trim();
      if (!no) return;
      if (serialNos.has(no)) withinDocument.push(`Serial number "${no}" is used on more than one line of this document`);
      serialNos.add(no);
    });
  });

  if (withinDocument.length) {
    const err = new Error(withinDocument.join('; '));
    err.status = 400;
    throw err;
  }

  const excludeConditions = [];
  if (excludeGrnId) excludeConditions.push({ grnItem: { grnId: excludeGrnId } });
  if (excludeStockReceiptId) excludeConditions.push({ stockReceiptItem: { receiptId: excludeStockReceiptId } });
  if (excludePurchaseInvoiceId) excludeConditions.push({ purchaseInvoiceItem: { invoiceId: excludePurchaseInvoiceId } });
  const excludeClause = excludeConditions.length ? { NOT: { OR: excludeConditions } } : {};
  const problems = [];

  if (batchKeys.size) {
    if (isDocumentScope) {
      // Only another document of the SAME type counts as a collision (see
      // this function's doc comment) — GRN, Stock Receipt and (direct)
      // Purchase Invoice each have their own separate batch namespace, and
      // a plain per-(warehouse, product) row created some other way
      // (Opening Balance, a Stock Transfer split) that carries none of
      // grnItemId/stockReceiptItemId/purchaseInvoiceItemId is out of scope
      // for this check either way.
      const relationField = isGrnScope ? 'grnItemId' : (isStockReceiptScope ? 'stockReceiptItemId' : 'purchaseInvoiceItemId');
      const excludeRelation = isGrnScope
        ? (excludeGrnId ? { NOT: { grnItem: { grnId: excludeGrnId } } } : {})
        : (isStockReceiptScope
          ? (excludeStockReceiptId ? { NOT: { stockReceiptItem: { receiptId: excludeStockReceiptId } } } : {})
          : (excludePurchaseInvoiceId ? { NOT: { purchaseInvoiceItem: { invoiceId: excludePurchaseInvoiceId } } } : {}));
      const existing = await client.productBatch.findMany({
        where: {
          batchNo: { in: [...batchKeys.values()].map((v) => v.batchNo) },
          [relationField]: { not: null },
          ...excludeRelation,
        },
        select: isGrnScope
          ? { batchNo: true, grnItem: { select: { grn: { select: { grnNo: true } } } } }
          : (isStockReceiptScope
            ? { batchNo: true, stockReceiptItem: { select: { receipt: { select: { receiptNo: true } } } } }
            : { batchNo: true, purchaseInvoiceItem: { select: { invoice: { select: { invoiceNo: true } } } } }),
      });
      existing.forEach((row) => {
        const docNo = isGrnScope
          ? row.grnItem?.grn?.grnNo
          : (isStockReceiptScope ? row.stockReceiptItem?.receipt?.receiptNo : row.purchaseInvoiceItem?.invoice?.invoiceNo);
        const docLabel = isGrnScope ? 'GRN' : (isStockReceiptScope ? 'Stock Receipt' : 'Purchase Invoice');
        problems.push(`Batch ${row.batchNo} is already used in ${docLabel} ${docNo || 'another document'}.`);
      });
    } else {
      const existing = await client.productBatch.findMany({
        where: {
          OR: [...batchKeys.values()].map(({ batchNo, warehouse, productCode }) => ({ batchNo, warehouse, productCode })),
          ...excludeClause,
        },
        select: { batchNo: true, warehouse: true },
      });
      existing.forEach((row) => problems.push(`Batch number "${row.batchNo}" already exists${row.warehouse ? ` in warehouse "${row.warehouse}"` : ''}`));
    }
  }
  if (serialNos.size) {
    const existing = await client.productSerial.findMany({
      where: { serialNo: { in: [...serialNos] }, ...excludeClause },
      select: { serialNo: true },
    });
    existing.forEach((row) => problems.push(`Serial number "${row.serialNo}" already exists`));
  }

  if (problems.length) {
    const err = new Error(isDocumentScope ? problems.join('; ') : `Duplicate batch/serial number — ${problems.join('; ')}`);
    err.status = 400;
    throw err;
  }
}

/**
 * Reject an issue-type document (Delivery Challan / Stock Issue) whose
 * Batch/Serial-tracked lines don't select enough existing batches/serials to
 * cover the quantity going out.
 *
 * This is the "Selection" counterpart to assertBatchSerialAllocation above:
 * a GRN/Stock Receipt line CREATES new batches/serials via the "... - Setup"
 * dialog, but a Delivery Challan/Stock Issue line SELECTS from stock already
 * on hand via the "... - Selection" dialog — so the shape being checked is
 * `batchAllocations`/`serialAllocations` (an existing batchNo + how much of
 * it, or an existing serialNo) rather than `batches`/`serials` (a brand new
 * number with its own attributes).
 */
async function assertBatchSerialIssueAllocation(client, items, { quantityField = 'quantity', optional = false } = {}) {
  const codes = [...new Set((items || []).map((i) => i.productCode).filter(Boolean))];
  if (!codes.length) return;

  const products = await client.product.findMany({
    where: { productCode: { in: codes } },
    select: { productCode: true, manageItemBy: true },
  });
  const modeByCode = new Map(products.map((p) => [p.productCode, p.manageItemBy]));

  const problems = [];
  (items || []).forEach((item, idx) => {
    const mode = modeByCode.get(item.productCode);
    if (mode !== 'Batch' && mode !== 'Serial') return;
    const qty = Number(item[quantityField]) || 0;
    const rowLabel = item.productCode || item.productName || `line ${idx + 1}`;

    if (mode === 'Batch') {
      const allocated = (item.batchAllocations || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      // `optional` (Sales/Purchase Invoice raised directly, not off a base
      // Delivery Challan/GRN — see isDirectInvoice) skips ONLY this
      // completeness check, so Batch/Serial is a nice-to-have there instead
      // of blocking Save — see the matching comment on
      // assertBatchSerialAllocation above for what still stays enforced.
      if (!optional && Math.abs(allocated - qty) > 0.005) {
        problems.push(`${rowLabel}: issuing ${qty} but ${allocated} selected from batches`);
      }
    } else {
      const serialNos = (item.serialAllocations || []).map((s) => s.serialNo).filter(Boolean);
      if (!optional && serialNos.length !== qty) {
        problems.push(`${rowLabel}: issuing ${qty} but ${serialNos.length} serial number(s) selected`);
      }
      if (new Set(serialNos).size !== serialNos.length) {
        problems.push(`${rowLabel}: duplicate serial numbers selected on this line`);
      }
    }
  });

  if (problems.length) {
    const err = new Error(`Batch/Serial selection incomplete — ${problems.join('; ')}`);
    err.status = 400;
    throw err;
  }
}

/**
 * Reject an issue-type document that selects more of a batch than currently
 * exists, or a serial number that is not currently in stock.
 *
 * `excludeChallanId`/`excludeStockIssueId` is the id of the document being
 * updated (only one of the two is ever passed). Its own existing selections
 * are added back to the available pool before comparing, because the
 * quantity/status they hold in the database right now already reflects THIS
 * document having taken them — otherwise re-saving a document with its own
 * previously-selected batch/serial numbers unchanged would report them as
 * unavailable. The actual reversal happens in restoreBatchSerialIssueEffects,
 * which must run (elsewhere, inside the same save) before the new selection
 * is applied.
 */
/**
 * A batch number can now have more than one ProductBatch row — one per
 * (warehouse, product) it currently has stock in (see the schema comment on
 * ProductBatch): a Stock Transfer can move part of a batch's quantity into
 * a second warehouse while the remainder stays in the first, and a Purchase
 * GRN can legitimately receive the same batch number against more than one
 * product in the same warehouse (see assertUniqueBatchesAndSerials's 'grn'
 * batchScope). Every place that used to update "the" row for a batch number
 * now has to say which (warehouse, product) row it means. This resolves
 * that row: prefers the exact (warehouse, productCode) match, falls back to
 * (warehouse) alone when productCode isn't known at the call site or
 * doesn't match anything (a legacy row saved before product-scoping
 * existed), and falls back to any row for that batch number when there's
 * no warehouse to go on either — which also keeps this working for the
 * Issue/Restock document types, which never split a batch themselves and so
 * only ever expect one row.
 */
async function findBatchRow(client, batchNo, warehouse, productCode = null, { strict = false } = {}) {
  if (!batchNo) return null;
  if (warehouse && productCode) {
    const exact = await client.productBatch.findFirst({ where: { batchNo, warehouse, productCode } });
    if (exact) return exact;
  }
  if (warehouse) {
    const byWarehouse = await client.productBatch.findFirst({ where: { batchNo, warehouse } });
    if (byWarehouse) return byWarehouse;
  }
  // strict: a warehouse was named, so never fall back to another warehouse's row.
  if (strict && warehouse) return null;
  return client.productBatch.findFirst({ where: { batchNo } });
}

/** Increments (positive delta) or decrements (negative delta) the specific
 * (warehouse, product) row a batch number resolves to via findBatchRow
 * above. Silently does nothing if no row is found — callers that need
 * existence/sufficiency guaranteed check that themselves first
 * (assertBatchSerialAvailability, assertBatchRelocationAvailable); this is
 * the shared "just make the change" half used once that has already
 * happened. */
async function updateBatchQuantity(tx, batchNo, warehouse, delta, productCode = null, { strict = false } = {}) {
  const row = await findBatchRow(tx, batchNo, warehouse, productCode, { strict });
  if (!row) {
    if (strict && warehouse) {
      const err = new Error(`Batch number "${batchNo}" is not in warehouse "${warehouse}"`);
      err.status = 409;
      throw err;
    }
    return;
  }
  await tx.productBatch.update({ where: { id: row.id }, data: { quantity: { increment: delta } } });
}

/**
 * Build the "this document's own prior selection" where-clause used by
 * assertBatchSerialAvailability and restoreBatchSerialIssueEffects, from
 * whichever single exclude id was passed. Exactly one of the four is ever
 * set by a caller — see each of those functions' own doc comments.
 */
function issueExcludeWhere({
  excludeChallanId = null, excludeStockIssueId = null,
  excludePurchaseReturnId = null, excludePurchaseCreditMemoId = null,
  excludeSalesInvoiceId = null, excludeStockAdjustmentId = null,
} = {}) {
  if (excludeChallanId) return { deliveryChallanItem: { challanId: excludeChallanId } };
  if (excludeStockIssueId) return { stockIssueItem: { issueId: excludeStockIssueId } };
  if (excludePurchaseReturnId) return { purchaseReturnItem: { returnId: excludePurchaseReturnId } };
  if (excludePurchaseCreditMemoId) return { purchaseCreditMemoItem: { creditMemoId: excludePurchaseCreditMemoId } };
  if (excludeSalesInvoiceId) return { salesInvoiceItem: { invoiceId: excludeSalesInvoiceId } };
  if (excludeStockAdjustmentId) return { stockAdjustmentItem: { adjustmentId: excludeStockAdjustmentId } };
  return null;
}

async function assertBatchSerialAvailability(client, items, {
  excludeChallanId = null, excludeStockIssueId = null,
  excludePurchaseReturnId = null, excludePurchaseCreditMemoId = null,
  excludeSalesInvoiceId = null,
} = {}) {
  const batchNos = new Set();
  const serialNos = new Set();
  (items || []).forEach((item) => {
    (item.batchAllocations || []).forEach((b) => { if (b.batchNo) batchNos.add(b.batchNo); });
    (item.serialAllocations || []).forEach((s) => { if (s.serialNo) serialNos.add(s.serialNo); });
  });
  if (!batchNos.size && !serialNos.size) return;

  const previousBatchQty = new Map();
  const previousSerialNos = new Set();
  const where = issueExcludeWhere({
    excludeChallanId, excludeStockIssueId, excludePurchaseReturnId, excludePurchaseCreditMemoId,
    excludeSalesInvoiceId,
  });
  if (where) {
    const priorBatches = await client.batchAllocation.findMany({ where, select: { batchNo: true, quantity: true } });
    priorBatches.forEach((b) => previousBatchQty.set(b.batchNo, (previousBatchQty.get(b.batchNo) || 0) + Number(b.quantity)));
    const priorSerials = await client.serialAllocation.findMany({ where, select: { serialNo: true } });
    priorSerials.forEach((s) => previousSerialNos.add(s.serialNo));
  }

  const problems = [];

  if (batchNos.size) {
    // A batch number can now have more than one row — one per (warehouse,
    // product) it currently has stock in (see findBatchRow's doc comment)
    // — so "available" has to mean the specific warehouse+product row THIS
    // line is drawing from, not every row sharing the batch number blended
    // together (which would let stock genuinely sitting in a different
    // warehouse, or belonging to a different product, count towards this
    // line, and would silently drop all but one row's quantity from the
    // tally besides).
    const rows = await client.productBatch.findMany({
      where: { batchNo: { in: [...batchNos] } },
      select: { batchNo: true, warehouse: true, productCode: true, quantity: true },
    });
    const existsByNo = new Set(rows.map((r) => r.batchNo));
    const qtyByKey = new Map(rows.map((r) => [`${r.batchNo}::${r.warehouse || ''}::${r.productCode || ''}`, Number(r.quantity)]));

    const requested = new Map(); // `${batchNo}::${warehouse}::${productCode}` -> { batchNo, warehouse, qty }
    (items || []).forEach((item) => (item.batchAllocations || []).forEach((b) => {
      if (!b.batchNo) return;
      const warehouse = item.warehouse || null;
      const productCode = item.productCode || null;
      const key = `${b.batchNo}::${warehouse || ''}::${productCode || ''}`;
      const entry = requested.get(key) || { batchNo: b.batchNo, warehouse, qty: 0 };
      entry.qty += Number(b.quantity) || 0;
      requested.set(key, entry);
    }));

    for (const [key, { batchNo, warehouse, qty }] of requested) {
      if (!existsByNo.has(batchNo)) {
        problems.push(`Batch number "${batchNo}" does not exist`);
        continue;
      }
      const rowQty = qtyByKey.get(key);
      if (rowQty === undefined) {
        problems.push(`Batch number "${batchNo}" is not in warehouse "${warehouse || '—'}"`);
        continue;
      }
      const available = rowQty + (previousBatchQty.get(batchNo) || 0);
      if (qty > available + 0.005) {
        problems.push(`Batch number "${batchNo}": selecting ${qty} but only ${available} available`);
      }
    }
  }

  if (serialNos.size) {
    const rows = await client.productSerial.findMany({ where: { serialNo: { in: [...serialNos] } }, select: { serialNo: true, status: true } });
    const byNo = new Map(rows.map((r) => [r.serialNo, r.status]));
    for (const no of serialNos) {
      if (!byNo.has(no)) {
        problems.push(`Serial number "${no}" does not exist`);
      } else if (byNo.get(no) !== 'In Stock' && !previousSerialNos.has(no)) {
        problems.push(`Serial number "${no}" is not currently in stock`);
      }
    }
  }

  if (problems.length) {
    const err = new Error(`Batch/Serial selection unavailable — ${problems.join('; ')}`);
    err.status = 409;
    throw err;
  }
}

/**
 * Gives quantity back to the batch row an earlier issue took it from.
 *
 * Resolves the row by (batchNo, warehouse, productCode) -- the same key as
 * the table's unique index -- and NEVER falls back to another warehouse's row
 * for the same batch number. The old restore went through updateBatchQuantity's
 * default lookup, which does fall back to any warehouse, so when the row in the
 * issuing warehouse was missing the quantity was returned to a different
 * warehouse's row and batch totals drifted above stock. If the row is gone
 * (it was zeroed and removed, or never existed), it is recreated where the
 * stock was taken from.
 */
async function restoreBatchQuantity(tx, { batchNo, warehouse, productCode = null, quantity }) {
  const qty = Number(quantity) || 0;
  if (!batchNo || !(qty > 0)) return;
  if (!warehouse) {
    // No warehouse was recorded on the issuing line (legacy data): keep the
    // previous behaviour, there is nothing to scope the lookup by.
    await updateBatchQuantity(tx, batchNo, null, qty, productCode);
    return;
  }
  let row = null;
  if (productCode) {
    row = await tx.productBatch.findFirst({ where: { batchNo, warehouse, productCode } });
    // A legacy row that was saved without a warehouse: adopt it into this one.
    if (!row) {
      row = await tx.productBatch.findFirst({
        where: { batchNo, productCode, OR: [{ warehouse: null }, { warehouse: '' }] },
      });
      if (row) {
        await tx.productBatch.update({ where: { id: row.id }, data: { quantity: { increment: qty }, warehouse } });
        return;
      }
    }
  } else {
    row = await tx.productBatch.findFirst({ where: { batchNo, warehouse } });
  }
  if (row) {
    await tx.productBatch.update({ where: { id: row.id }, data: { quantity: { increment: qty } } });
  } else {
    await tx.productBatch.create({ data: { batchNo, productCode: productCode || '', warehouse, quantity: qty } });
  }
}

/**
 * Takes `quantity` out of a Batch-managed item's batches in one warehouse,
 * earliest expiry first (rows with no expiry last, then oldest row first), and
 * records one BatchAllocation per batch touched so restoreBatchSerialIssueEffects
 * can give it back when the document is edited, cancelled or deleted.
 *
 * Used for the part of a line the user did NOT pick batches for. Without it a
 * document that posts the full quantity to the stock ledger but only deducts
 * the batches it was told about leaves the rest sitting in product_batches
 * forever. Never drives a batch below zero: if the warehouse's batches hold
 * less than is being issued, what exists is taken and the remainder is left
 * alone (the ledger's own negative-stock guards decide whether the issue is
 * allowed; reconcileBatchesForWarehouse heals batch shortfalls).
 *
 * Returns the quantity actually allocated.
 */
async function autoAllocateBatchShortfall(tx, { productCode, warehouse, quantity, linkField, createdId }) {
  const round2 = (n) => Math.round(n * 100) / 100;
  let remaining = round2(Number(quantity) || 0);
  if (!productCode || !warehouse || !createdId || !(remaining > 0.005)) return 0;
  const rows = await tx.productBatch.findMany({ where: { productCode, warehouse, quantity: { gt: 0 } } });
  rows.sort((a, b) => {
    const ea = a.expirationDate ? new Date(a.expirationDate).getTime() : null;
    const eb = b.expirationDate ? new Date(b.expirationDate).getTime() : null;
    if (ea !== eb) {
      if (ea === null) return 1;
      if (eb === null) return -1;
      return ea - eb;
    }
    return a.id - b.id;
  });
  let allocated = 0;
  for (const row of rows) {
    if (remaining <= 0.005) break;
    const take = round2(Math.min(remaining, Number(row.quantity) || 0));
    if (!(take > 0)) continue;
    await tx.productBatch.update({ where: { id: row.id }, data: { quantity: { decrement: take } } });
    await tx.batchAllocation.create({
      data: { batchNo: row.batchNo, productCode, quantity: take, [linkField]: createdId },
    });
    remaining = round2(remaining - take);
    allocated = round2(allocated + take);
  }
  return allocated;
}

/**
 * Reverse the stock effect of a document's existing batch/serial selections
 * — adds the allocated quantity back onto each ProductBatch and flips each
 * ProductSerial back to 'In Stock'. Must run BEFORE that document's item
 * rows are replaced (update) or removed (delete): the BatchAllocation/
 * SerialAllocation rows recording what to reverse cascade away with their
 * parent item, so once the items are gone there is nothing left to look up.
 */
async function restoreBatchSerialIssueEffects(tx, {
  challanId = null, stockIssueId = null,
  purchaseReturnId = null, purchaseCreditMemoId = null,
  salesInvoiceId = null, stockAdjustmentId = null,
} = {}) {
  const where = issueExcludeWhere({
    excludeChallanId: challanId,
    excludeStockIssueId: stockIssueId,
    excludePurchaseReturnId: purchaseReturnId,
    excludePurchaseCreditMemoId: purchaseCreditMemoId,
    excludeSalesInvoiceId: salesInvoiceId,
    excludeStockAdjustmentId: stockAdjustmentId,
  });
  if (!where) return;

  // BatchAllocation itself carries no warehouse — pull it from whichever
  // of these five item relations is actually linked (see findBatchRow's
  // doc comment for why a warehouse is needed to resolve the right row).
  // It does carry its own productCode (stamped on it when it was created —
  // see applyBatchSerialIssueEffects), needed since findBatchRow now
  // disambiguates by product too.
  const batches = await tx.batchAllocation.findMany({
    where,
    select: {
      batchNo: true, quantity: true, productCode: true,
      deliveryChallanItem: { select: { warehouse: true } },
      stockIssueItem: { select: { warehouse: true } },
      purchaseReturnItem: { select: { warehouse: true } },
      purchaseCreditMemoItem: { select: { warehouse: true } },
      salesInvoiceItem: { select: { warehouse: true } },
      stockAdjustmentItem: { select: { warehouse: true } },
    },
  });
  for (const b of batches) {
    const warehouse = b.deliveryChallanItem?.warehouse || b.stockIssueItem?.warehouse
      || b.purchaseReturnItem?.warehouse || b.purchaseCreditMemoItem?.warehouse
      || b.salesInvoiceItem?.warehouse || b.stockAdjustmentItem?.warehouse || null;
    await restoreBatchQuantity(tx, {
      batchNo: b.batchNo, warehouse, productCode: b.productCode || null, quantity: b.quantity,
    });
  }

  const serials = await tx.serialAllocation.findMany({ where, select: { serialNo: true } });
  for (const s of serials) {
    await tx.productSerial.update({ where: { serialNo: s.serialNo }, data: { status: 'In Stock' } });
  }
}

/**
 * Apply the stock effect of a just-saved document's batch/serial selections
 * — decrements each selected ProductBatch's quantity, flips each selected
 * ProductSerial to 'Issued', and records the BatchAllocation/SerialAllocation
 * rows that link the selection to the item that consumed it (so
 * restoreBatchSerialIssueEffects can reverse it later).
 *
 * `items` (the raw request lines, carrying batchAllocations/serialAllocations)
 * and `createdItems` (what Prisma just created) must be the same length and
 * in the same order — matched by array position, which holds because
 * createdItems is fetched `orderBy: { id: 'asc' }` and ids are assigned in
 * the order the lines were created.
 */
async function applyBatchSerialIssueEffects(tx, items, createdItems, { linkField, autoAllocateQty = null }) {
  // `autoAllocateQty(rawLine, createdLine)` -> how many units of the line this
  // document actually issues from stock (0 = none). Whatever part of that the
  // user did not cover with explicit batch selections is taken automatically,
  // earliest expiry first, for Batch-managed items -- see autoAllocateBatchShortfall.
  // Leave it null for documents whose batch selection is mandatory.
  let batchManaged = null;
  if (autoAllocateQty) {
    const codes = [...new Set((items || []).map((it) => it.productCode).filter(Boolean))];
    const products = codes.length
      ? await tx.product.findMany({ where: { productCode: { in: codes } }, select: { productCode: true, manageItemBy: true } })
      : [];
    batchManaged = new Set(products.filter((p) => p.manageItemBy === 'Batch').map((p) => p.productCode));
  }
  for (let i = 0; i < (items || []).length; i++) {
    const raw = items[i];
    const createdId = createdItems[i]?.id;
    if (!createdId) continue;

    for (const b of raw.batchAllocations || []) {
      if (!b.batchNo || !(Number(b.quantity) > 0)) continue;
      await updateBatchQuantity(tx, b.batchNo, raw.warehouse || null, -Number(b.quantity), raw.productCode || null, { strict: true });
      await tx.batchAllocation.create({
        data: { batchNo: b.batchNo, productCode: raw.productCode || '', quantity: Number(b.quantity), [linkField]: createdId },
      });
    }
    for (const s of raw.serialAllocations || []) {
      if (!s.serialNo) continue;
      await tx.productSerial.update({ where: { serialNo: s.serialNo }, data: { status: 'Issued' } });
      await tx.serialAllocation.create({
        data: { serialNo: s.serialNo, productCode: raw.productCode || '', [linkField]: createdId },
      });
    }

    if (autoAllocateQty && batchManaged.has(raw.productCode)) {
      const issued = Number(autoAllocateQty(raw, createdItems[i])) || 0;
      const explicit = (raw.batchAllocations || []).reduce(
        (sum, b) => sum + (b.batchNo && Number(b.quantity) > 0 ? Number(b.quantity) : 0), 0
      );
      const shortfall = Math.round((issued - explicit) * 100) / 100;
      if (shortfall > 0.005) {
        await autoAllocateBatchShortfall(tx, {
          productCode: raw.productCode,
          warehouse: createdItems[i].warehouse || raw.warehouse || null,
          quantity: shortfall,
          linkField,
          createdId,
        });
      }
    }
  }
}

/**
 * Reject a Sales Return / Sales Credit Memo whose Batch/Serial-tracked lines
 * don't select enough existing batches/serials to cover the quantity coming
 * back — the "Restock" counterpart of assertBatchSerialIssueAllocation.
 * Same completeness check (allocated quantity/serial count must equal the
 * line's quantity, no duplicate serials on the document), kept as its own
 * function rather than a call-through so this module's Restock and Selection
 * sides stay independently readable, matching how assertBatchSerialAllocation
 * and assertBatchSerialIssueAllocation are already two separate functions
 * despite the same shape.
 *
 * `optional` (default false), mirroring assertBatchSerialAllocation/
 * assertBatchSerialIssueAllocation's own flag: when true, skips ONLY the
 * completeness check (allocated must equal quantity) — the caller no longer
 * offers any UI to allocate batches/serials at all, so that check can never
 * be satisfied. The duplicate-serial-number check still runs regardless,
 * since it protects data integrity for whatever partial allocation IS
 * submitted (there normally won't be any once the UI is gone, but a stale
 * or hand-crafted payload should still be caught).
 */
async function assertBatchSerialRestockAllocation(client, items, { quantityField = 'quantity', optional = false } = {}) {
  const codes = [...new Set((items || []).map((i) => i.productCode).filter(Boolean))];
  if (!codes.length) return;

  const products = await client.product.findMany({
    where: { productCode: { in: codes } },
    select: { productCode: true, manageItemBy: true },
  });
  const modeByCode = new Map(products.map((p) => [p.productCode, p.manageItemBy]));

  const problems = [];
  (items || []).forEach((item, idx) => {
    const mode = modeByCode.get(item.productCode);
    if (mode !== 'Batch' && mode !== 'Serial') return;
    const qty = Number(item[quantityField]) || 0;
    const rowLabel = item.productCode || item.productName || `line ${idx + 1}`;

    if (mode === 'Batch') {
      const allocated = (item.batchAllocations || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (!optional && Math.abs(allocated - qty) > 0.005) {
        problems.push(`${rowLabel}: returning ${qty} but ${allocated} selected to restock`);
      }
    } else {
      const serialNos = (item.serialAllocations || []).map((s) => s.serialNo).filter(Boolean);
      if (!optional && serialNos.length !== qty) {
        problems.push(`${rowLabel}: returning ${qty} but ${serialNos.length} serial number(s) selected`);
      }
      if (new Set(serialNos).size !== serialNos.length) {
        problems.push(`${rowLabel}: duplicate serial numbers selected on this line`);
      }
    }
  });

  if (problems.length) {
    const err = new Error(`Batch/Serial restock selection incomplete — ${problems.join('; ')}`);
    err.status = 400;
    throw err;
  }
}

/**
 * Reject a Sales Return / Sales Credit Memo that tries to restock a serial
 * number not currently 'Issued' (out with a customer) — a serial already
 * 'In Stock' cannot legitimately come back a second time. There is no
 * equivalent upper-bound check for batches: restocking only ever increments
 * ProductBatch.quantity, so the only requirement is that the named batch
 * exists.
 *
 * `excludeSalesReturnId`/`excludeSalesCreditMemoId` (only one ever passed)
 * treats this document's OWN previously-restocked serials as still eligible
 * — their status already reads 'In Stock' because of this document's own
 * prior save, which restoreBatchSerialRestockEffects reverses before this
 * runs again on the same save.
 */
async function assertBatchSerialRestockAvailability(client, items, {
  excludeSalesReturnId = null, excludeSalesCreditMemoId = null,
} = {}) {
  const batchNos = new Set();
  const serialNos = new Set();
  (items || []).forEach((item) => {
    (item.batchAllocations || []).forEach((b) => { if (b.batchNo) batchNos.add(b.batchNo); });
    (item.serialAllocations || []).forEach((s) => { if (s.serialNo) serialNos.add(s.serialNo); });
  });
  if (!batchNos.size && !serialNos.size) return;

  const previousSerialNos = new Set();
  if (excludeSalesReturnId || excludeSalesCreditMemoId) {
    const where = excludeSalesReturnId
      ? { salesReturnItem: { returnId: excludeSalesReturnId } }
      : { salesCreditMemoItem: { creditMemoId: excludeSalesCreditMemoId } };
    const priorSerials = await client.serialAllocation.findMany({ where, select: { serialNo: true } });
    priorSerials.forEach((s) => previousSerialNos.add(s.serialNo));
  }

  const problems = [];

  if (batchNos.size) {
    const rows = await client.productBatch.findMany({ where: { batchNo: { in: [...batchNos] } }, select: { batchNo: true } });
    const found = new Set(rows.map((r) => r.batchNo));
    for (const no of batchNos) {
      if (!found.has(no)) problems.push(`Batch number "${no}" does not exist`);
    }
  }

  if (serialNos.size) {
    const rows = await client.productSerial.findMany({ where: { serialNo: { in: [...serialNos] } }, select: { serialNo: true, status: true } });
    const byNo = new Map(rows.map((r) => [r.serialNo, r.status]));
    for (const no of serialNos) {
      if (!byNo.has(no)) {
        problems.push(`Serial number "${no}" does not exist`);
      } else if (byNo.get(no) !== 'Issued' && !previousSerialNos.has(no)) {
        problems.push(`Serial number "${no}" is not currently issued, so it cannot be returned`);
      }
    }
  }

  if (problems.length) {
    const err = new Error(`Batch/Serial restock unavailable — ${problems.join('; ')}`);
    err.status = 409;
    throw err;
  }
}

/**
 * Reverse a Sales Return / Sales Credit Memo's restock effect — the opposite
 * of restoreBatchSerialIssueEffects: takes the restocked quantity back OFF
 * each ProductBatch and flips each ProductSerial back to 'Issued'. Must run
 * before that document's item rows are replaced/removed, same ordering
 * requirement as the issue side.
 */
async function restoreBatchSerialRestockEffects(tx, { salesReturnId = null, salesCreditMemoId = null } = {}) {
  const where = salesReturnId
    ? { salesReturnItem: { returnId: salesReturnId } }
    : (salesCreditMemoId ? { salesCreditMemoItem: { creditMemoId: salesCreditMemoId } } : null);
  if (!where) return;

  // BatchAllocation carries no warehouse of its own — read it off
  // whichever of the two restock item relations is linked (see
  // findBatchRow's doc comment for why a warehouse is needed here). It
  // does carry its own productCode (see applyBatchSerialRestockEffects),
  // needed since findBatchRow now disambiguates by product too.
  const batches = await tx.batchAllocation.findMany({
    where,
    select: {
      batchNo: true, quantity: true, productCode: true,
      salesReturnItem: { select: { warehouse: true } },
      salesCreditMemoItem: { select: { warehouse: true } },
    },
  });
  for (const b of batches) {
    const warehouse = b.salesReturnItem?.warehouse || b.salesCreditMemoItem?.warehouse || null;
    await updateBatchQuantity(tx, b.batchNo, warehouse, -(Number(b.quantity) || 0), b.productCode || null);
  }

  const serials = await tx.serialAllocation.findMany({ where, select: { serialNo: true } });
  for (const s of serials) {
    await tx.productSerial.update({ where: { serialNo: s.serialNo }, data: { status: 'Issued' } });
  }
}

/**
 * Apply a just-saved Sales Return / Sales Credit Memo's restock effect —
 * increments each selected ProductBatch's quantity, flips each selected
 * ProductSerial to 'In Stock', and records the BatchAllocation/
 * SerialAllocation rows linking the restock to the item that received it.
 * Mirrors applyBatchSerialIssueEffects exactly, opposite direction.
 */
async function applyBatchSerialRestockEffects(tx, items, createdItems, { linkField }) {
  for (let i = 0; i < (items || []).length; i++) {
    const raw = items[i];
    const createdId = createdItems[i]?.id;
    if (!createdId) continue;

    for (const b of raw.batchAllocations || []) {
      if (!b.batchNo || !(Number(b.quantity) > 0)) continue;
      await updateBatchQuantity(tx, b.batchNo, raw.warehouse || null, Number(b.quantity), raw.productCode || null);
      await tx.batchAllocation.create({
        data: { batchNo: b.batchNo, productCode: raw.productCode || '', quantity: Number(b.quantity), [linkField]: createdId },
      });
    }
    for (const s of raw.serialAllocations || []) {
      if (!s.serialNo) continue;
      await tx.productSerial.update({ where: { serialNo: s.serialNo }, data: { status: 'In Stock' } });
      await tx.serialAllocation.create({
        data: { serialNo: s.serialNo, productCode: raw.productCode || '', [linkField]: createdId },
      });
    }
  }
}

/**
 * Reject a Stock Transfer whose Batch/Serial-tracked lines don't select
 * enough existing batches/serials to cover the quantity moving — the same
 * completeness check as the issue side, reused as-is because "relocate"
 * needs the identical rule (selected quantity/serial count must equal the
 * line's own quantity).
 */
async function assertBatchSerialRelocateAllocation(client, items, { quantityField = 'quantity' } = {}) {
  return assertBatchSerialIssueAllocation(client, items, { quantityField });
}

/**
 * A batch used to have to move ALL of its quantity on a Stock Transfer,
 * because ProductBatch only ever had one `warehouse` column per row and a
 * batch number was globally unique — a row could only ever be in one place.
 * Now that a batch number can have one row per warehouse (see the schema
 * comment on ProductBatch and applyBatchSerialRelocateEffects below), a
 * transfer line can move PART of a batch: this checks that whatever
 * quantity a line does select is actually sitting, right now, in that
 * line's own From Warehouse — the batch-side half of what
 * assertRelocateWarehouseMatches used to do, folded in here because they
 * were really the same lookup (find the row for this batch in this
 * warehouse) with two different names.
 */
async function assertBatchRelocationAvailable(client, items) {
  const requested = new Map(); // `${batchNo}::${fromWarehouse}::${productCode}` -> { batchNo, fromWarehouse, qty }
  (items || []).forEach((item) => (item.batchAllocations || []).forEach((b) => {
    if (!b.batchNo) return;
    const fromWarehouse = item.fromWarehouse || null;
    const productCode = item.productCode || null;
    const key = `${b.batchNo}::${fromWarehouse || ''}::${productCode || ''}`;
    const entry = requested.get(key) || { batchNo: b.batchNo, fromWarehouse, qty: 0 };
    entry.qty += Number(b.quantity) || 0;
    requested.set(key, entry);
  }));
  if (!requested.size) return;

  const batchNos = [...new Set([...requested.values()].map((r) => r.batchNo))];
  const rows = await client.productBatch.findMany({
    where: { batchNo: { in: batchNos } },
    select: { batchNo: true, warehouse: true, productCode: true, quantity: true },
  });
  const existsByNo = new Set(rows.map((r) => r.batchNo));
  // Same (batchNo, warehouse, productCode) scoping as findBatchRow — see
  // that function's doc comment for why productCode now matters here too.
  const qtyByKey = new Map(rows.map((r) => [`${r.batchNo}::${r.warehouse || ''}::${r.productCode || ''}`, Number(r.quantity)]));

  const problems = [];
  for (const [key, { batchNo, fromWarehouse, qty }] of requested) {
    if (!existsByNo.has(batchNo)) { problems.push(`Batch number "${batchNo}" does not exist`); continue; }
    const available = qtyByKey.get(key);
    if (available === undefined) {
      problems.push(`Batch number "${batchNo}" is not currently in warehouse "${fromWarehouse || '—'}"`);
      continue;
    }
    if (qty > available + 0.005) {
      problems.push(`Batch number "${batchNo}": moving ${qty} but only ${available} available in "${fromWarehouse || '—'}"`);
    }
  }
  if (problems.length) {
    const err = new Error(`Stock Transfer batch selection invalid — ${problems.join('; ')}`);
    err.status = 400;
    throw err;
  }
}

/**
 * Reject a Stock Transfer line whose selected serial does not currently sit
 * in the warehouse the line claims as its From Warehouse — a transfer can
 * only relocate stock that is actually where the document says it is.
 * Batches have their own, quantity-aware version of this same check now —
 * see assertBatchRelocationAvailable above — because a batch (unlike a
 * serial, one row per physical unit, never split) can sit in more than one
 * warehouse at once.
 */
async function assertRelocateWarehouseMatches(client, items) {
  const serialNos = new Set();
  (items || []).forEach((item) => {
    (item.serialAllocations || []).forEach((s) => { if (s.serialNo) serialNos.add(s.serialNo); });
  });
  if (!serialNos.size) return;

  const serialRows = await client.productSerial.findMany({ where: { serialNo: { in: [...serialNos] } }, select: { serialNo: true, warehouse: true } });
  const serialWarehouse = new Map(serialRows.map((r) => [r.serialNo, r.warehouse]));

  const problems = [];
  (items || []).forEach((item) => {
    (item.serialAllocations || []).forEach((s) => {
      if (!s.serialNo) return;
      const at = serialWarehouse.get(s.serialNo);
      if (at && item.fromWarehouse && at !== item.fromWarehouse) {
        problems.push(`Serial "${s.serialNo}" is currently at "${at}", not "${item.fromWarehouse}"`);
      }
    });
  });
  if (problems.length) {
    const err = new Error(`Stock Transfer selection unavailable — ${problems.join('; ')}`);
    err.status = 409;
    throw err;
  }
}

/**
 * Reverse a Stock Transfer's relocate effect. Serials: puts each moved
 * serial's `warehouse` column back to the line's fromWarehouse, same as
 * before. Batches: undoes the actual quantity split (see
 * applyBatchSerialRelocateEffects) — takes the moved quantity back OFF the
 * toWarehouse row and puts it back ON the fromWarehouse row, rather than
 * flipping one row's warehouse wholesale, since a batch can now be split
 * across both.
 *
 * Reads fromWarehouse/toWarehouse off the allocation's own
 * StockTransferItem, since the item row itself is about to be deleted/
 * replaced. Must run before the item rows are replaced/removed, same
 * ordering requirement as the issue and restock sides.
 */
async function restoreBatchSerialRelocateEffects(tx, { transferId = null } = {}) {
  if (!transferId) return;
  const where = { stockTransferItem: { transferId } };

  // BatchAllocation carries its own productCode too — see
  // applyBatchSerialRelocateEffects — needed since findBatchRow now
  // disambiguates by product as well as warehouse.
  const batches = await tx.batchAllocation.findMany({
    where, select: { batchNo: true, quantity: true, productCode: true, stockTransferItem: { select: { fromWarehouse: true, toWarehouse: true } } },
  });
  for (const b of batches) {
    const qty = Number(b.quantity) || 0;
    if (qty <= 0) continue;
    const fromWarehouse = b.stockTransferItem?.fromWarehouse || null;
    const toWarehouse = b.stockTransferItem?.toWarehouse || null;
    await updateBatchQuantity(tx, b.batchNo, toWarehouse, -qty, b.productCode || null);
    await updateBatchQuantity(tx, b.batchNo, fromWarehouse, qty, b.productCode || null);
  }

  const serials = await tx.serialAllocation.findMany({
    where, select: { serialNo: true, stockTransferItem: { select: { fromWarehouse: true } } },
  });
  for (const s of serials) {
    await tx.productSerial.update({ where: { serialNo: s.serialNo }, data: { warehouse: s.stockTransferItem?.fromWarehouse || null } });
  }
}

/**
 * Apply a just-saved Stock Transfer's relocate effect.
 *
 * Serials: still just flips the one row's `warehouse` column to the line's
 * toWarehouse — a serial is one row per physical unit and is never split.
 *
 * Batches: actually moves `quantity` of the batch from its fromWarehouse
 * row to a toWarehouse row — decrementing the source (which may still hold
 * a remainder afterwards, unlike the old whole-batch-only model) and
 * either incrementing an existing row already at the destination or
 * creating a new one there, copying the source row's own descriptive
 * fields (expiry, mfr date, location, ...) onto it. This is what makes a
 * transfer line able to move part of a batch instead of all of it.
 *
 * Known limitation: a row created this way (to receive a partial move) is
 * not linked back to the GRN/Stock Receipt that originally brought the
 * batch in (grnItemId/stockReceiptItemId are both left null on it, since
 * it wasn't created by either) — deleting that original receipt after
 * stock has moved on from it will not cascade-delete this row too.
 */
async function applyBatchSerialRelocateEffects(tx, items, createdItems, { linkField }) {
  for (let i = 0; i < (items || []).length; i++) {
    const raw = items[i];
    const createdId = createdItems[i]?.id;
    if (!createdId) continue;

    for (const b of raw.batchAllocations || []) {
      if (!b.batchNo) continue;
      const qty = Number(b.quantity) || 0;
      if (qty > 0) {
        const sourceRow = await findBatchRow(tx, b.batchNo, raw.fromWarehouse || null, raw.productCode || null);
        if (sourceRow) {
          await tx.productBatch.update({ where: { id: sourceRow.id }, data: { quantity: { decrement: qty } } });
          // Same product as the source row, not just the same batch number —
          // see findBatchRow's doc comment on why product now disambiguates
          // which row a (batchNo, warehouse) pair resolves to.
          const destRow = await tx.productBatch.findFirst({ where: { batchNo: b.batchNo, warehouse: raw.toWarehouse || null, productCode: sourceRow.productCode } });
          if (destRow) {
            await tx.productBatch.update({ where: { id: destRow.id }, data: { quantity: { increment: qty } } });
          } else {
            await tx.productBatch.create({
              data: {
                batchNo: sourceRow.batchNo,
                productCode: sourceRow.productCode,
                quantity: qty,
                batchAttribute1: sourceRow.batchAttribute1,
                batchAttribute2: sourceRow.batchAttribute2,
                expirationDate: sourceRow.expirationDate,
                mfrDate: sourceRow.mfrDate,
                admissionDate: sourceRow.admissionDate,
                location: sourceRow.location,
                details: sourceRow.details,
                status: sourceRow.status,
                warehouse: raw.toWarehouse || null,
              },
            });
          }
        }
      }
      await tx.batchAllocation.create({
        data: { batchNo: b.batchNo, productCode: raw.productCode || '', quantity: qty, [linkField]: createdId },
      });
    }
    for (const s of raw.serialAllocations || []) {
      if (!s.serialNo) continue;
      await tx.productSerial.update({ where: { serialNo: s.serialNo }, data: { warehouse: raw.toWarehouse || null } });
      await tx.serialAllocation.create({
        data: { serialNo: s.serialNo, productCode: raw.productCode || '', [linkField]: createdId },
      });
    }
  }
}

module.exports = {
  assertWithinCreditLimit,
  assertNotReferenced,
  getReferencedIdentitySet,
  cascadeRename,
  assertMasterExists,
  getProductUsage,
  validateProductUsageFlags,
  validateItemCategoryRequired,
  validateManageItemByRequired,
  assertProductUsageUnchanged,
  PRODUCT_USAGE_MAP,
  PRODUCT_USAGE_LABELS,
  findBatchRow,
  updateBatchQuantity,
  assertBatchSerialAllocation,
  assertUniqueBatchesAndSerials,
  assertBatchSerialIssueAllocation,
  assertBatchSerialAvailability,
  restoreBatchSerialIssueEffects,
  applyBatchSerialIssueEffects,
  assertBatchSerialRestockAllocation,
  assertBatchSerialRestockAvailability,
  restoreBatchSerialRestockEffects,
  applyBatchSerialRestockEffects,
  assertBatchSerialRelocateAllocation,
  assertBatchRelocationAvailable,
  assertRelocateWarehouseMatches,
  restoreBatchSerialRelocateEffects,
  applyBatchSerialRelocateEffects,
  REFERENCE_MAP,
};
