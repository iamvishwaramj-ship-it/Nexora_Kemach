/**
 * Document flow — how far an order has been fulfilled, and what that makes its
 * status.
 *
 * Nothing tracked this before. A purchase order stayed 'Open' no matter how
 * many goods receipts were posted against it; a sales order stayed 'Draft' or
 * whatever it was last saved as, however much had been delivered and invoiced.
 * Partial fulfilment could not be represented at all, so:
 *
 *   - the pending-order reports re-derived delivery status by string-matching
 *     document numbers and could not distinguish a part-delivered order from
 *     an untouched one;
 *   - nothing stopped a second full delivery being raised against an order
 *     that had already been delivered in full;
 *   - buyers had no way to see what was still on order.
 *
 * SAP models this with a quantity ledger per order line: ordered, delivered,
 * invoiced, and the open quantity that is the difference. This module does the
 * same thing with the linkage this schema actually has — a plain document
 * number on the follow-on document, since no foreign key exists between them.
 *
 * ## The rule for status
 *
 *   nothing fulfilled            -> 'Open'
 *   some but not all fulfilled   -> 'Partially Delivered' / 'Partially Received'
 *   every line fully fulfilled   -> 'Closed'
 *
 * A cancelled order is left alone: cancellation is a human decision and
 * recomputing over it would silently reopen something somebody closed.
 */

const { round2 } = require('./documentTotals');

/**
 * True unless a line was attached with inventoryItem === false — mirrors
 * routes/resources.js's own isInventoryLine (see attachInventoryItemFlag
 * there for how/why the flag gets onto a line). Kept as a small local copy
 * rather than an import: this module has no other dependency on
 * routes/resources.js and the predicate is one line.
 */
function isInventoryLine(item) {
  return !item || item.inventoryItem !== false;
}

/** Statuses whose documents are not real movements. */
const NON_MOVING_STATUSES = ['Draft', 'Cancelled', 'Pending'];

/** Order statuses this module will never overwrite. */
const TERMINAL_ORDER_STATUSES = ['Cancelled', 'Closed - Short', 'Rejected'];

/**
 * Sum a quantity field per product code across a set of documents' lines.
 *
 * Follow-on documents are matched to the order by document number. Lines with
 * no product code cannot be matched to an order line and are ignored rather
 * than being attributed to an arbitrary one.
 */
function sumByProduct(documents, { itemsKey = 'items', quantityField = 'quantity' } = {}) {
  const totals = new Map();
  for (const doc of documents) {
    for (const line of doc[itemsKey] || []) {
      const code = line.productCode;
      if (!code) continue;
      const qty = Number(line[quantityField]) || 0;
      if (qty === 0) continue;
      totals.set(code, round2((totals.get(code) || 0) + qty));
    }
  }
  return totals;
}

/**
 * Work out each order line's fulfilled quantity and the resulting header
 * status.
 *
 * @param {object[]} orderItems  the order's own lines (productCode, quantity)
 * @param {Map}      fulfilled   quantity fulfilled per product code
 * @param {string}   partialLabel status to use when some but not all is done
 */
function reconcileOrder(orderItems, fulfilled, partialLabel) {
  const lines = [];
  let anyFulfilled = false;
  let allFulfilled = true;

  // A product can appear on more than one line of the same order. Fulfilled
  // quantity is tracked per product, so it is consumed line by line in order
  // rather than being credited in full against every line that mentions it.
  const remaining = new Map(fulfilled);

  for (const item of orderItems) {
    const ordered = Number(item.quantity) || 0;
    const code = item.productCode;
    const available = code ? (remaining.get(code) || 0) : 0;
    const applied = round2(Math.min(ordered, available));

    if (code) remaining.set(code, round2(available - applied));

    if (applied > 0.005) anyFulfilled = true;
    if (applied + 0.005 < ordered) allFulfilled = false;

    lines.push({ id: item.id, productCode: code, ordered, fulfilled: applied });
  }

  // An order with no lines is not "fully delivered" — it is untouched.
  if (!orderItems.length) allFulfilled = false;

  let status = 'Open';
  if (allFulfilled) status = 'Closed';
  else if (anyFulfilled) status = partialLabel;

  return { lines, status, anyFulfilled, allFulfilled };
}

/**
 * Recompute one sales order's delivered/invoiced quantities and status.
 *
 * Delivery drives the status: an order is closed when everything ordered has
 * been despatched, which is what the warehouse and the customer care about.
 * Invoiced quantity is tracked alongside for the billing view, but a fully
 * delivered order that has not been invoiced yet is still 'Closed' on the
 * delivery side — matching how the challan is the fulfilling document.
 *
 * When no delivery challan exists at all, the invoice is treated as the
 * fulfilling document, exactly as the stock ledger does — otherwise a one-step
 * sale (invoice, no challan) would leave its order open forever.
 */
async function recomputeSalesOrder(tx, orderNo) {
  if (!orderNo) return null;

  const order = await tx.salesOrder.findFirst({
    where: { orderNo },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!order) return null;
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) return order;

  const [challans, invoices] = await Promise.all([
    tx.deliveryChallan.findMany({
      where: { orderNo, status: { notIn: NON_MOVING_STATUSES } },
      include: { items: true },
    }),
    tx.salesInvoice.findMany({
      where: { orderNo, status: { notIn: ['Draft', 'Cancelled'] } },
      include: { items: true },
    }),
  ]);

  const delivered = sumByProduct(challans);
  const invoiced = sumByProduct(invoices);

  // One-step flow: no challan was ever raised, so the invoice is what
  // fulfilled the order.
  const fulfilment = challans.length ? delivered : invoiced;

  const { lines, status } = reconcileOrder(order.items, fulfilment, 'Partially Delivered');
  const invoicedLines = reconcileOrder(order.items, invoiced, 'Partially Invoiced').lines;
  const invoicedById = new Map(invoicedLines.map((l) => [l.id, l.fulfilled]));

  await Promise.all(
    lines.map((line) =>
      tx.salesOrderItem.update({
        where: { id: line.id },
        data: {
          deliveredQuantity: challans.length ? line.fulfilled : 0,
          invoicedQuantity: invoicedById.get(line.id) || 0,
        },
      })
    )
  );

  await tx.salesOrder.update({ where: { id: order.id }, data: { status } });
  return { ...order, status };
}

/**
 * Recompute one purchase order's received/invoiced quantities and status.
 *
 * Mirrors the sales side: the goods receipt is the fulfilling document, and
 * the purchase invoice stands in for it when no GRN exists.
 */
async function recomputePurchaseOrder(tx, poNo) {
  if (!poNo) return null;

  const order = await tx.purchaseOrder.findFirst({
    where: { poNo },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!order) return null;
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) return order;

  const [grns, invoices] = await Promise.all([
    tx.goodsReceivedNote.findMany({
      where: { poNo, status: { notIn: NON_MOVING_STATUSES } },
      include: { items: true },
    }),
    tx.purchaseInvoice.findMany({
      where: { poNo, status: { notIn: ['Draft', 'Cancelled'] } },
      include: { items: true },
    }),
  ]);

  const received = sumByProduct(grns, { quantityField: 'receivedQuantity' });
  const invoiced = sumByProduct(invoices);
  const fulfilment = grns.length ? received : invoiced;

  const { lines, status } = reconcileOrder(order.items, fulfilment, 'Partially Received');
  const invoicedLines = reconcileOrder(order.items, invoiced, 'Partially Invoiced').lines;
  const invoicedById = new Map(invoicedLines.map((l) => [l.id, l.fulfilled]));

  await Promise.all(
    lines.map((line) =>
      tx.purchaseOrderItem.update({
        where: { id: line.id },
        data: {
          receivedQuantity: grns.length ? line.fulfilled : 0,
          invoicedQuantity: invoicedById.get(line.id) || 0,
        },
      })
    )
  );

  await tx.purchaseOrder.update({ where: { id: order.id }, data: { status } });
  return { ...order, status };
}

// --- Document-flow Open/Closed ---------------------------------------------
//
// Everything below is the SECOND kind of status in this module, and it is
// deliberately simpler than the quantity ledger above. Sales/Purchase Order
// keep their Open -> Partially Delivered/Received -> Closed vocabulary,
// because an order is the thing whose remaining quantity people actually
// need to see. Every OTHER document in the two chains only has to answer one
// question — has the next document in the flow been raised against it — and
// answers it as plain Open/Closed:
//
//   Enquiry            -> Closed once a Sales Quotation quotes it
//   Sales Quotation    -> Closed once a Sales Order is raised from it
//   Purchase Quotation -> Closed once a Purchase Order is raised from it
//   Delivery Challan   -> Closed once fully invoiced
//   GRN                -> Closed once fully invoiced
//
// The first three close on the mere existence of the follow-on document:
// quoting an enquiry answers it, and ordering against a quotation accepts
// it, whatever quantities are involved. The last two close on QUANTITY,
// because a challan or receipt can legitimately be billed across several
// invoices and is not finished until all of it has been.

/**
 * Statuses these functions must never overwrite.
 *
 * 'Pending' (Delivery Challan) and 'Draft' (GRN) are the pre-movement staging
 * states behind each form's "Save as Draft" button: nothing has physically
 * shipped or been received, and no stock has posted (see movesStock in
 * utils/stockTable.js), so "has it been invoiced yet" is not a meaningful
 * question about them. 'Cancelled' is a human decision everywhere, and
 * recomputing over it would silently revive a document somebody withdrew.
 */
const CHALLAN_PROTECTED_STATUSES = ['Pending', 'Cancelled'];
const GRN_PROTECTED_STATUSES = ['Draft', 'Cancelled'];
const REFERENCE_PROTECTED_STATUSES = ['Cancelled'];

/**
 * Follow-on statuses that do NOT count as having been raised against the
 * source document.
 *
 * Deliberately narrower than NON_MOVING_STATUSES, which also excludes 'Draft'
 * and 'Pending'. Those two are about STOCK — a draft document has not moved
 * anything — and that is the wrong question here. A Sales Order is created
 * with status 'Draft' by default (see getEmptyValues in SalesOrder.jsx), so
 * excluding drafts would mean ordering against a quotation almost never
 * closed it: the quotation would sit Open until somebody happened to deliver
 * against the order. Raising the order is the act that answers the quotation,
 * whatever state that order is in afterwards.
 *
 * Cancelling or rejecting the follow-on document undoes it, and the source
 * reopens — which is why this is recomputed rather than latched on once.
 */
const REFERENCE_IGNORED_CONSUMER_STATUSES = ['Cancelled', 'Rejected'];

/**
 * Open/Closed for a document that closes when a follow-on document simply
 * EXISTS against it — no quantities involved.
 *
 * Cancel or delete that follow-on document and the count drops back to zero
 * and the source reopens by itself, which is why this is recomputed from
 * scratch every time rather than being a flag latched on at creation.
 */
async function recomputeReferenceStatus(tx, {
  model, docField, docNo, consumerModel, consumerField,
  protectedStatuses = REFERENCE_PROTECTED_STATUSES,
}) {
  if (!docNo) return null;

  const doc = await model.findFirst({ where: { [docField]: docNo } });
  if (!doc) return null;
  if (protectedStatuses.includes(doc.status)) return doc;

  const referencing = await consumerModel.count({
    where: {
      [consumerField]: docNo,
      status: { notIn: REFERENCE_IGNORED_CONSUMER_STATUSES },
    },
  });

  const status = referencing > 0 ? 'Closed' : 'Open';
  if (status === doc.status) return doc;

  await model.update({ where: { id: doc.id }, data: { status } });
  return { ...doc, status };
}

/**
 * Open/Closed for a document that closes only when every line of it has been
 * invoiced — Delivery Challan and GRN.
 *
 * Reuses the same reconcileOrder ledger the sales/purchase orders use, with
 * the partial label set to 'Open': a part-invoiced challan is not a third
 * state here, it is simply not finished. Draft and cancelled invoices are
 * excluded, matching how recomputeSalesOrder/recomputePurchaseOrder already
 * count invoiced quantity.
 */
async function recomputeInvoicedStatus(tx, {
  model, docField, docNo, quantityField, invoiceModel, invoiceField, protectedStatuses,
}) {
  if (!docNo) return null;

  const doc = await model.findFirst({
    where: { [docField]: docNo },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!doc) return null;
  if (protectedStatuses.includes(doc.status)) return doc;

  const invoices = await invoiceModel.findMany({
    where: { [invoiceField]: docNo, status: { notIn: ['Draft', 'Cancelled'] } },
    include: { items: true },
  });

  const invoiced = sumByProduct(invoices);
  // reconcileOrder measures each line against `.quantity`; a GRN line calls
  // that same figure receivedQuantity, so it is mapped rather than the
  // shared helper being taught a second field name.
  const lines = doc.items.map((item) => ({
    id: item.id,
    productCode: item.productCode,
    quantity: item[quantityField],
  }));

  const { status } = reconcileOrder(lines, invoiced, 'Open');
  if (status === doc.status) return doc;

  await model.update({ where: { id: doc.id }, data: { status } });
  return { ...doc, status };
}

/** Enquiry -> Closed once a Sales Quotation quotes it. */
async function recomputeEnquiryStatus(tx, enquiryNo) {
  return recomputeReferenceStatus(tx, {
    model: tx.enquiry,
    docField: 'enquiryNo',
    docNo: enquiryNo,
    consumerModel: tx.salesQuotation,
    consumerField: 'enquiryNo',
  });
}

/** Sales Quotation -> Closed once a Sales Order is raised from it. */
async function recomputeSalesQuotationStatus(tx, quotationNo) {
  return recomputeReferenceStatus(tx, {
    model: tx.salesQuotation,
    docField: 'quotationNo',
    docNo: quotationNo,
    consumerModel: tx.salesOrder,
    consumerField: 'quotationNo',
  });
}

/** Purchase Quotation -> Closed once a Purchase Order is raised from it. */
async function recomputePurchaseQuotationStatus(tx, quotationNo) {
  return recomputeReferenceStatus(tx, {
    model: tx.purchaseQuotation,
    docField: 'quotationNo',
    docNo: quotationNo,
    consumerModel: tx.purchaseOrder,
    consumerField: 'quotationNo',
  });
}

/** Delivery Challan -> Closed once every despatched line has been invoiced. */
async function recomputeDeliveryChallanStatus(tx, challanNo) {
  return recomputeInvoicedStatus(tx, {
    model: tx.deliveryChallan,
    docField: 'challanNo',
    docNo: challanNo,
    quantityField: 'quantity',
    invoiceModel: tx.salesInvoice,
    invoiceField: 'deliveryChallanNo',
    protectedStatuses: CHALLAN_PROTECTED_STATUSES,
  });
}

/** GRN -> Closed once every received line has been invoiced. */
async function recomputeGrnStatus(tx, grnNo) {
  return recomputeInvoicedStatus(tx, {
    model: tx.goodsReceivedNote,
    docField: 'grnNo',
    docNo: grnNo,
    quantityField: 'receivedQuantity',
    invoiceModel: tx.purchaseInvoice,
    invoiceField: 'grnNo',
    protectedStatuses: GRN_PROTECTED_STATUSES,
  });
}

/**
 * Reject a delivery that would despatch more than the order calls for.
 *
 * The purchase side has had this check since round 1 (assertNoOverReceipt);
 * the sales side had nothing, so an order for 10 could be delivered three
 * times over without complaint. `excludeChallanNo` lets an edit exclude its
 * own previous lines, so re-saving a challan does not measure itself as extra.
 */
async function assertNoOverDelivery(tx, { orderNo, items, excludeChallanNo = null }) {
  if (!orderNo) return;

  const order = await tx.salesOrder.findFirst({
    where: { orderNo },
    include: { items: true },
  });
  if (!order) return; // A challan raised without an order is unconstrained.

  const priorChallans = await tx.deliveryChallan.findMany({
    where: {
      orderNo,
      status: { notIn: NON_MOVING_STATUSES },
      ...(excludeChallanNo ? { challanNo: { not: excludeChallanNo } } : {}),
    },
    include: { items: true },
  });

  const ordered = sumByProduct([order]);
  const alreadyDelivered = sumByProduct(priorChallans);
  const nowDelivering = sumByProduct([{ items }]);

  const offending = [];
  for (const [code, qty] of nowDelivering) {
    const orderedQty = ordered.get(code) || 0;
    if (orderedQty <= 0) continue; // Not on the order — treat as a free line.
    const cumulative = round2((alreadyDelivered.get(code) || 0) + qty);
    if (cumulative > orderedQty + 0.005) {
      offending.push(`${code}: delivering ${cumulative} against an ordered quantity of ${orderedQty}`);
    }
  }

  if (offending.length) {
    const err = new Error(
      `Delivered quantity exceeds the order — ${offending.join('; ')}`
    );
    err.status = 400;
    throw err;
  }
}

/**
 * Reject a return / credit memo whose lines would take more of a product
 * than is actually left on its source document, once every OTHER
 * non-cancelled document of the same kind already raised against that
 * source is subtracted.
 *
 * Generic over the four (source -> consumer) pairs that share this shape:
 * GRN -> Purchase Return, Delivery Challan -> Sales Return, Purchase Invoice
 * -> Purchase Credit Memo, Sales Invoice -> Sales Credit Memo. The frontend
 * already computes the same "remaining after other documents" quantity to
 * cap what it offers the user and to pre-fill the line — see
 * returnedByGrnProductOther / returnedByChallanProductOther /
 * creditedByInvoiceProductOther in the corresponding pages. That client-side
 * cap is only as fresh as the page load it came from, though: two people
 * (or two tabs) working from the same source document at once can each pass
 * the client check and still overshoot it between them. This is the
 * server-side backstop that makes the rule actually hold.
 *
 * On an EDIT, `previousItems` is this same document's own lines as they
 * stood before the edit (pass it whenever `excludeConsumerDocNo` is set — the
 * two go together). Only an INCREASE over what this document already held is
 * counted against the shared pool; resaving a line unchanged, or reducing it,
 * always succeeds. Without this, a document that predates this guard (or one
 * that legitimately became oversubscribed for any other reason) could never
 * be saved again at all — every edit, even one that touches nothing about
 * its quantities, would be rejected for a problem it did not create and
 * cannot fix by itself. The cap on genuine increases still holds: raising
 * this document's own share is only allowed as far as what is actually left
 * once every OTHER document's consumption is subtracted.
 */
async function assertNoOverConsumption(tx, {
  sourceModel,
  sourceDocField,
  sourceDocNo,
  sourceQuantityField,
  consumerModel,
  consumerDocField,
  consumerQuantityField,
  consumerDocNoField,
  items,
  excludeConsumerDocNo = null,
  previousItems = null,
  label = 'return',
}) {
  if (!sourceDocNo) return;

  const source = await sourceModel.findFirst({
    where: { [sourceDocField]: sourceDocNo },
    include: { items: true },
  });
  if (!source) return; // A document raised without a valid source is unconstrained here.

  const priorConsumers = await consumerModel.findMany({
    where: {
      [consumerDocField]: sourceDocNo,
      status: { notIn: NON_MOVING_STATUSES },
      ...(excludeConsumerDocNo ? { [consumerDocNoField]: { not: excludeConsumerDocNo } } : {}),
    },
    include: { items: true },
  });

  // A non-inventory line (Product Master's Inventory Item unchecked — see
  // attachInventoryItemFlag in routes/resources.js) is accepted on the
  // return/credit memo but never draws down a shared "how much is left to
  // return" pool, so it must never be flagged as over-consuming it either.
  // Excluding it from `nowConsuming` is enough: the per-code loop below only
  // ever looks at codes that appear there, so a non-inventory code never
  // reaches the availability comparison at all. `previousItems` is left
  // unfiltered — if it never had the flag attached, `isInventoryLine`'s
  // permissive default keeps it a no-op; and any code missing from
  // `nowConsuming` is skipped regardless of what `previouslyOwn` says.
  const trackedItems = (items || []).filter(isInventoryLine);
  const available = sumByProduct([source], { quantityField: sourceQuantityField });
  const alreadyConsumed = sumByProduct(priorConsumers, { quantityField: consumerQuantityField });
  const nowConsuming = sumByProduct([{ items: trackedItems }], { quantityField: consumerQuantityField });
  const previouslyOwn = previousItems
    ? sumByProduct([{ items: previousItems.filter(isInventoryLine) }], { quantityField: consumerQuantityField })
    : new Map();

  const offending = [];
  for (const [code, qty] of nowConsuming) {
    const ownBefore = previouslyOwn.get(code) || 0;
    if (qty <= ownBefore + 0.005) continue; // Not an increase — always allowed.

    const availableQty = available.get(code) || 0;
    const cumulative = round2((alreadyConsumed.get(code) || 0) + qty);
    if (cumulative > availableQty + 0.005) {
      offending.push(`${code}: ${cumulative} against ${availableQty} available`);
    }
  }

  if (offending.length) {
    const Label = label.charAt(0).toUpperCase() + label.slice(1);
    const err = new Error(`${Label} quantity exceeds what is available — ${offending.join('; ')}`);
    err.status = 400;
    throw err;
  }
}

module.exports = {
  sumByProduct,
  reconcileOrder,
  recomputeSalesOrder,
  recomputePurchaseOrder,
  recomputeEnquiryStatus,
  recomputeSalesQuotationStatus,
  recomputePurchaseQuotationStatus,
  recomputeDeliveryChallanStatus,
  recomputeGrnStatus,
  assertNoOverDelivery,
  assertNoOverConsumption,
  NON_MOVING_STATUSES,
  TERMINAL_ORDER_STATUSES,
  CHALLAN_PROTECTED_STATUSES,
  GRN_PROTECTED_STATUSES,
  REFERENCE_IGNORED_CONSUMER_STATUSES,
};
