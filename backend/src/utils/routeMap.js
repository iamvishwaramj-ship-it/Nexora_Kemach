/**
 * Route Map — the whole document chain a single document belongs to.
 *
 * Given any one purchase or sales document, this resolves every other document
 * in the same chain and returns them as an ordered set of stages, so the UI can
 * draw the SAP-style flow diagram:
 *
 *   Purchase:  Quotation > Order > GRN > Invoice
 *              GRN > Return          (only while the GRN is not yet invoiced)
 *              Invoice > Credit Memo
 *
 *   Sales:     Enquiry > Quotation > Order > Delivery Challan > Invoice
 *              Delivery Challan > Return   (only while not yet invoiced)
 *              Invoice > Credit Memo
 *
 * ## How the chain is joined
 *
 * There are no foreign keys between these tables. Every document references
 * the one before it by DOCUMENT NUMBER, in a column of its own
 * (delivery_challans.order_no, sales_invoices.delivery_challan_no,
 * purchase_invoices.grn_no, and so on). That is the convention the rest of this
 * schema uses and it is what this module walks.
 *
 * Two of those columns did not exist until the migration that accompanied this
 * file — sales_quotations.enquiry_no and sales_orders.quotation_no — so the
 * sales chain used to be unjoinable before the Delivery Challan. Documents
 * created before that migration have those columns null and will show a chain
 * that begins at the Order; that is missing history, not a bug in the walk.
 *
 * ## Why it resolves in both directions
 *
 * The map has to look the same whichever document it was opened from. Opening
 * it on the Invoice must show the Quotation that started things, and opening it
 * on the Quotation must show the Invoice it ended at. So rather than walking
 * one way from the anchor, this fills in a set of known document numbers and
 * keeps resolving — upward to parents, downward to children — until a pass
 * changes nothing. Fan-out is real (one order can be delivered on three
 * challans), so each stage holds every document found for it, and the caller
 * decides how to present the extras.
 */

/** Documents that are not real links in the chain — a draft is not history. */
const IGNORED_STATUSES = ['Cancelled'];

const notCancelled = { status: { notIn: IGNORED_STATUSES } };

/**
 * A document counts as "invoiced" — and therefore closed to returns — only
 * once a live invoice exists for it. A cancelled invoice must not lock the
 * GRN/challan out of being returned, and a draft one has not been issued to
 * the customer yet, so neither is treated as invoicing the document.
 */
const LIVE_INVOICE_STATUSES = { status: { notIn: ['Draft', 'Cancelled'] } };

const asNumber = (v) => (v == null ? null : Number(v));

/** First non-null of several possible date columns. */
const pickDate = (...values) => values.find((v) => v != null) ?? null;

/**
 * What a document in the chain actually DID: moved stock, posted to the
 * ledger, both, or neither.
 *
 * Inventory and finance are separate impacts and most documents carry only one
 * of them, so the diagram must not imply that reaching a stage means both
 * happened. An order commits to a purchase without receiving a single unit or
 * owing a single rupee; a goods receipt moves stock and owes nothing; an
 * invoice raised against that receipt owes money and must NOT move that stock
 * a second time.
 *
 * That last rule is the one worth being careful about, and it is why the
 * invoice cases below read `doc.grnNo` / `doc.deliveryChallanNo` instead of
 * returning a fixed answer. An invoice moves stock only when it is the first
 * document to do so — billed straight off the order with no goods receipt or
 * delivery challan in between. The moment one of those exists, the invoice is
 * finance-only.
 *
 * This mirrors, deliberately and exactly, the `headerFilter` on the
 * purchaseInvoice / salesInvoice entries in utils/stockLedger.js, which is what
 * actually decides whether an invoice contributes to on-hand quantity. The two
 * have to agree: this badge is a claim about what the ledger did, and one that
 * contradicted it would be worse than showing nothing at all.
 */
function documentImpact(label, doc) {
  const NONE = { inventory: null, finance: false, isReturn: false };
  if (!doc) return NONE;

  // Return and Credit Memo nodes are labelled generically by branchState, so
  // which side of the business they belong to is read off the document
  // itself: only the purchase-side ones carry a supplier or a GRN.
  const isPurchaseSide = doc.supplier != null || doc.supplierName != null || doc.grnNo != null;

  switch (label) {
    // Orders, and everything before them, are intent — not movement.
    case 'Sales Enquiry':
    case 'Sales Quotation':
    case 'Purchase Quotation':
    case 'Sales Order':
    case 'Purchase Order':
      return NONE;

    // Goods in / goods out. Neither posts to the ledger.
    case 'Purchase GRN':
      return { inventory: 'in', finance: false, isReturn: false };
    case 'Delivery Challan':
      return { inventory: 'out', finance: false, isReturn: false };

    // Always finance. Inventory only when nothing upstream already moved it.
    case 'Purchase Invoice':
      return { inventory: doc.grnNo ? null : 'in', finance: true, isReturn: false };
    case 'Sales Invoice':
      return { inventory: doc.deliveryChallanNo ? null : 'out', finance: true, isReturn: false };

    // A return raised before the invoice exists is inventory-only: it puts the
    // goods back where they came from, and there is no billed value to credit
    // yet. The purchase side sends goods back OUT to the supplier; the sales
    // side takes them back IN from the customer.
    case 'Return':
      return { inventory: isPurchaseSide ? 'out' : 'in', finance: false, isReturn: true };

    // The after-invoicing counterpart: it moves goods the same way a return
    // does AND corrects the money, because by then there is an invoice to
    // correct.
    case 'Credit Memo':
      return { inventory: isPurchaseSide ? 'out' : 'in', finance: true, isReturn: true };

    default:
      return NONE;
  }
}

/**
 * One card in the diagram.
 *
 * `total` is deliberately allowed to be null rather than coerced to 0 — an
 * enquiry with no expected budget has no total, and printing 0.00 would state
 * a figure nobody entered.
 */
function node(label, doc, { no, date, total, status, parentNo }) {
  return {
    stage: label,
    docNo: no ?? null,
    docDate: date ?? null,
    docTotal: asNumber(total),
    status: status ?? null,
    id: doc?.id ?? null,
    // Inventory / finance / return impact — see documentImpact above. Derived
    // here rather than in the UI so there is a single answer to "what did this
    // document do", shared by the diagram and by anything else that asks.
    impact: documentImpact(label, doc),
    // Which document at the PREVIOUS stage this one was raised from. Null on
    // the first stage, and on any document whose parent column is empty. The
    // diagram uses it to draw a real tree when a stage fanned out — two GRNs
    // off one PO have to join back to that PO, not to each other.
    parentNo: parentNo ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

async function resolveSalesChain(prisma, anchor) {
  // Known document numbers, filled in as they are discovered. `undefined`
  // means "not looked for yet", null means "looked for and there is none" —
  // the difference is what stops the fixpoint loop from re-querying forever.
  const key = {
    enquiryNo: undefined,
    quotationNo: undefined,
    orderNo: undefined,
    challanNo: undefined,
    invoiceNo: undefined,
  };

  const found = {
    enquiry: null, quotation: null, order: null,
    challan: null, invoice: null, return: null, creditMemo: null, payment: null,
  };

  // Every document found per stage, not just the one the walk followed —
  // an order delivered on three challans has three, and hiding two of them
  // would make the map claim a completeness it does not have.
  const all = {
    quotation: [], order: [], challan: [], invoice: [], return: [], creditMemo: [], payment: [],
  };

  // --- seed from whichever document the map was opened on -------------------
  switch (anchor.type) {
    case 'enquiry': key.enquiryNo = anchor.no; break;
    case 'quotation': key.quotationNo = anchor.no; break;
    case 'order': key.orderNo = anchor.no; break;
    case 'challan': key.challanNo = anchor.no; break;
    case 'invoice': key.invoiceNo = anchor.no; break;
    case 'return': {
      const ret = await prisma.salesReturn.findFirst({ where: { returnNo: anchor.no } });
      found.return = ret;
      if (ret) all.return = [ret];
      key.challanNo = ret?.challanNo || null;
      break;
    }
    case 'creditMemo': {
      const cm = await prisma.salesCreditMemo.findFirst({ where: { creditNo: anchor.no } });
      found.creditMemo = cm;
      if (cm) all.creditMemo = [cm];
      key.invoiceNo = cm?.invoiceNo || null;
      break;
    }
    case 'payment': {
      // A payment is not a spine document — it settles against one or more
      // invoices through its own applications rows rather than a field of its
      // own (see the branch-expansion comment below). Seeding just takes the
      // first applied invoice and lets the ordinary upward walk resolve the
      // rest of the chain from there; the branch-expansion step further down
      // re-reads every payment against that invoice, so this pick does not
      // need to be the "right" one when several payments exist.
      const pay = await prisma.paymentReceipt.findFirst({
        where: { paymentReceiptNo: anchor.no },
        include: { applications: true },
      });
      found.payment = pay;
      if (pay) all.payment = [pay];
      key.invoiceNo = pay?.applications?.[0]?.invoiceNo || null;
      break;
    }
    default: break;
  }

  // --- resolve until a full pass changes nothing ----------------------------
  // Bounded rather than `while (true)`: the chain is five stages deep, so five
  // passes is already generous, and a bound means a data cycle (an invoice
  // whose challan points back at it) cannot hang the request.
  for (let pass = 0; pass < 6; pass += 1) {
    const before = JSON.stringify(key);

    // Upward: child -> parent.
    if (key.invoiceNo && !found.invoice) {
      found.invoice = await prisma.salesInvoice.findFirst({ where: { invoiceNo: key.invoiceNo } });
      if (found.invoice) {
        all.invoice = [found.invoice];
        if (key.challanNo === undefined) key.challanNo = found.invoice.deliveryChallanNo || null;
        if (key.orderNo === undefined) key.orderNo = found.invoice.orderNo || null;
      }
    }
    if (key.challanNo && !found.challan) {
      found.challan = await prisma.deliveryChallan.findFirst({ where: { challanNo: key.challanNo } });
      if (found.challan) {
        all.challan = [found.challan];
        if (key.orderNo === undefined) key.orderNo = found.challan.orderNo || null;
      }
    }
    if (key.orderNo && !found.order) {
      found.order = await prisma.salesOrder.findFirst({ where: { orderNo: key.orderNo } });
      if (found.order) {
        all.order = [found.order];
        if (key.quotationNo === undefined) key.quotationNo = found.order.quotationNo || null;
      }
    }
    if (key.quotationNo && !found.quotation) {
      found.quotation = await prisma.salesQuotation.findFirst({ where: { quotationNo: key.quotationNo } });
      if (found.quotation) {
        all.quotation = [found.quotation];
        if (key.enquiryNo === undefined) key.enquiryNo = found.quotation.enquiryNo || null;
      }
    }
    if (key.enquiryNo && !found.enquiry) {
      found.enquiry = await prisma.enquiry.findFirst({ where: { enquiryNo: key.enquiryNo } });
    }

    // Downward: parent -> child.
    if (key.enquiryNo && key.quotationNo === undefined) {
      const rows = await prisma.salesQuotation.findMany({
        where: { enquiryNo: key.enquiryNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.quotation = rows;
      found.quotation = rows[0] || null;
      key.quotationNo = rows[0]?.quotationNo || null;
    }
    if (key.quotationNo && key.orderNo === undefined) {
      const rows = await prisma.salesOrder.findMany({
        where: { quotationNo: key.quotationNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.order = rows;
      found.order = rows[0] || null;
      key.orderNo = rows[0]?.orderNo || null;
    }
    if (key.orderNo && key.challanNo === undefined) {
      const rows = await prisma.deliveryChallan.findMany({
        where: { orderNo: key.orderNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.challan = rows;
      found.challan = rows[0] || null;
      key.challanNo = rows[0]?.challanNo || null;
    }
    if (key.challanNo && key.invoiceNo === undefined) {
      // Every challan at this stage, not just the one the walk followed: an
      // order delivered on three challans and billed on one invoice per
      // challan has three invoices, and keying off rows[0] alone would find
      // one of them and silently drop the rest from the map.
      const challanNos = all.challan.map((c) => c.challanNo).filter(Boolean);
      const rows = await prisma.salesInvoice.findMany({
        where: {
          deliveryChallanNo: { in: challanNos.length ? challanNos : [key.challanNo] },
          ...notCancelled,
        },
        orderBy: { id: 'asc' },
      });
      all.invoice = rows;
      found.invoice = rows[0] || null;
      key.invoiceNo = rows[0]?.invoiceNo || null;
    }
    // One-step sale: invoiced straight off the order with no challan in
    // between. Without this the map would stop at the order and imply the sale
    // was never billed.
    if (key.orderNo && !key.challanNo && key.invoiceNo === undefined) {
      const rows = await prisma.salesInvoice.findMany({
        where: { orderNo: key.orderNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.invoice = rows;
      found.invoice = rows[0] || null;
      key.invoiceNo = rows[0]?.invoiceNo || null;
    }

    if (JSON.stringify(key) === before) break;
  }

  // --- branches -------------------------------------------------------------
  // --- sibling expansion ----------------------------------------------------
  // See the purchase equivalent: the walk follows one document per stage so it
  // can terminate, so a stage reached from below holds only the document the
  // walk came through. Re-read each stage in full now the parent keys are
  // settled, leaving `found` (the representative) alone.
  const expand = (rows, fallback) => (rows.length ? rows : (fallback ? [fallback] : []));

  if (key.enquiryNo) {
    all.quotation = expand(await prisma.salesQuotation.findMany({
      where: { enquiryNo: key.enquiryNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.quotation);
  }
  if (key.quotationNo) {
    all.order = expand(await prisma.salesOrder.findMany({
      where: { quotationNo: key.quotationNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.order);
  }
  if (key.orderNo) {
    all.challan = expand(await prisma.deliveryChallan.findMany({
      where: { orderNo: key.orderNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.challan);
  }
  const allChallanNos = all.challan.map((c) => c.challanNo).filter(Boolean);
  if (allChallanNos.length) {
    all.invoice = expand(await prisma.salesInvoice.findMany({
      where: { deliveryChallanNo: { in: allChallanNos }, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.invoice);
  } else if (key.orderNo) {
    all.invoice = expand(await prisma.salesInvoice.findMany({
      where: { orderNo: key.orderNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.invoice);
  }

  // Branches fan out the same way the spine does — a return per challan, a
  // credit memo per invoice — so both are collected across every document at
  // the stage they hang off, not just the one the walk followed.
  if (key.challanNo && !found.return) {
    const challanNos = all.challan.map((c) => c.challanNo).filter(Boolean);
    all.return = await prisma.salesReturn.findMany({
      where: {
        challanNo: { in: challanNos.length ? challanNos : [key.challanNo] },
        ...notCancelled,
      },
      orderBy: { id: 'asc' },
    });
    found.return = all.return[0] || null;
  }
  if (key.invoiceNo && !found.creditMemo) {
    const invoiceNos = all.invoice.map((i) => i.invoiceNo).filter(Boolean);
    all.creditMemo = await prisma.salesCreditMemo.findMany({
      where: {
        invoiceNo: { in: invoiceNos.length ? invoiceNos : [key.invoiceNo] },
        ...notCancelled,
      },
      orderBy: { id: 'asc' },
    });
    found.creditMemo = all.creditMemo[0] || null;
  }

  // Incoming Payment (Payment Receipt) — the money side of billing. Unlike
  // every other branch this is not a single document field pointing back at
  // its source: a payment settles against one or more invoices through its
  // own applications rows, and one invoice can be settled across several
  // payments (partial payment), so the join has to go through that table.
  if (all.invoice.length) {
    const invoiceNos = all.invoice.map((i) => i.invoiceNo).filter(Boolean);
    if (invoiceNos.length) {
      all.payment = await prisma.paymentReceipt.findMany({
        where: { ...notCancelled, applications: { some: { invoiceNo: { in: invoiceNos } } } },
        include: { applications: true },
        orderBy: { id: 'asc' },
      });
      found.payment = all.payment[0] || null;
    }
  }

  const partyName = found.invoice?.customer || found.challan?.customer || found.order?.customer
    || found.quotation?.customer || found.return?.customer || found.creditMemo?.customer
    || found.enquiry?.customerName || null;

  return { found, all, partyName };
}

// ---------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------

async function resolvePurchaseChain(prisma, anchor) {
  const key = {
    quotationNo: undefined, poNo: undefined, grnNo: undefined, invoiceNo: undefined,
  };
  const found = {
    quotation: null, order: null, grn: null, invoice: null, return: null, creditMemo: null, payment: null,
  };
  const all = {
    quotation: [], order: [], grn: [], invoice: [], return: [], creditMemo: [], payment: [],
  };

  switch (anchor.type) {
    case 'quotation': key.quotationNo = anchor.no; break;
    case 'order': key.poNo = anchor.no; break;
    case 'grn': key.grnNo = anchor.no; break;
    case 'invoice': key.invoiceNo = anchor.no; break;
    case 'return': {
      const ret = await prisma.purchaseReturn.findFirst({ where: { returnNo: anchor.no } });
      found.return = ret;
      if (ret) all.return = [ret];
      key.grnNo = ret?.grnNo || null;
      break;
    }
    case 'creditMemo': {
      const cm = await prisma.purchaseCreditMemo.findFirst({ where: { creditNo: anchor.no } });
      found.creditMemo = cm;
      if (cm) all.creditMemo = [cm];
      key.invoiceNo = cm?.invoiceNo || null;
      break;
    }
    case 'payment': {
      // See the sales equivalent in resolveSalesChain for why this seeds from
      // the first applied invoice rather than a field of its own.
      const pay = await prisma.paymentVoucher.findFirst({
        where: { paymentVoucherNo: anchor.no },
        include: { applications: true },
      });
      found.payment = pay;
      if (pay) all.payment = [pay];
      key.invoiceNo = pay?.applications?.[0]?.invoiceNo || null;
      break;
    }
    default: break;
  }

  for (let pass = 0; pass < 6; pass += 1) {
    const before = JSON.stringify(key);

    if (key.invoiceNo && !found.invoice) {
      found.invoice = await prisma.purchaseInvoice.findFirst({ where: { invoiceNo: key.invoiceNo } });
      if (found.invoice) {
        all.invoice = [found.invoice];
        if (key.grnNo === undefined) key.grnNo = found.invoice.grnNo || null;
        if (key.poNo === undefined) key.poNo = found.invoice.poNo || null;
      }
    }
    if (key.grnNo && !found.grn) {
      found.grn = await prisma.goodsReceivedNote.findFirst({ where: { grnNo: key.grnNo } });
      if (found.grn) {
        all.grn = [found.grn];
        if (key.poNo === undefined) key.poNo = found.grn.poNo || null;
      }
    }
    if (key.poNo && !found.order) {
      found.order = await prisma.purchaseOrder.findFirst({ where: { poNo: key.poNo } });
      if (found.order) {
        all.order = [found.order];
        // The purchase side stores the quotation it came from in
        // `referenceNo` — the column is literally labelled "Reference
        // (Quotation No.)" on the form — rather than in a column of its own.
        if (key.quotationNo === undefined) key.quotationNo = found.order.referenceNo || null;
      }
    }
    if (key.quotationNo && !found.quotation) {
      found.quotation = await prisma.purchaseQuotation.findFirst({
        where: { quotationNo: key.quotationNo },
      });
      if (found.quotation) all.quotation = [found.quotation];
    }

    if (key.quotationNo && key.poNo === undefined) {
      const rows = await prisma.purchaseOrder.findMany({
        where: { referenceNo: key.quotationNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.order = rows;
      found.order = rows[0] || null;
      key.poNo = rows[0]?.poNo || null;
    }
    if (key.poNo && key.grnNo === undefined) {
      const rows = await prisma.goodsReceivedNote.findMany({
        where: { poNo: key.poNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.grn = rows;
      found.grn = rows[0] || null;
      key.grnNo = rows[0]?.grnNo || null;
    }
    if (key.grnNo && key.invoiceNo === undefined) {
      // Every GRN at this stage, not just the one the walk followed: a PO
      // received on three GRNs and billed per GRN has three invoices, and
      // keying off rows[0] alone would drop the rest from the map.
      const grnNos = all.grn.map((g) => g.grnNo).filter(Boolean);
      const rows = await prisma.purchaseInvoice.findMany({
        where: {
          grnNo: { in: grnNos.length ? grnNos : [key.grnNo] },
          ...notCancelled,
        },
        orderBy: { id: 'asc' },
      });
      all.invoice = rows;
      found.invoice = rows[0] || null;
      key.invoiceNo = rows[0]?.invoiceNo || null;
    }
    // Invoiced straight off the PO with no goods receipt in between.
    if (key.poNo && !key.grnNo && key.invoiceNo === undefined) {
      const rows = await prisma.purchaseInvoice.findMany({
        where: { poNo: key.poNo, ...notCancelled }, orderBy: { id: 'asc' },
      });
      all.invoice = rows;
      found.invoice = rows[0] || null;
      key.invoiceNo = rows[0]?.invoiceNo || null;
    }

    if (JSON.stringify(key) === before) break;
  }

  // --- sibling expansion ----------------------------------------------------
  // The walk above follows ONE document per stage so it can terminate, which
  // leaves `all` holding just that one whenever a stage was reached from
  // BELOW: anchoring on an invoice records the GRN it came from and never
  // looks for that GRN's siblings, because `key.grnNo` is already set and the
  // downward query is guarded on it being unknown. Now that the parent keys
  // are settled, re-read each stage in full so a fan-out comes out complete
  // whichever document the map was opened on. `found` is left alone — it is
  // the representative, and the anchor's own document should stay it.
  const expand = (rows, fallback) => (rows.length ? rows : (fallback ? [fallback] : []));

  if (key.quotationNo) {
    all.order = expand(await prisma.purchaseOrder.findMany({
      where: { referenceNo: key.quotationNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.order);
  }
  if (key.poNo) {
    all.grn = expand(await prisma.goodsReceivedNote.findMany({
      where: { poNo: key.poNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.grn);
  }
  const allGrnNos = all.grn.map((g) => g.grnNo).filter(Boolean);
  if (allGrnNos.length) {
    all.invoice = expand(await prisma.purchaseInvoice.findMany({
      where: { grnNo: { in: allGrnNos }, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.invoice);
  } else if (key.poNo) {
    all.invoice = expand(await prisma.purchaseInvoice.findMany({
      where: { poNo: key.poNo, ...notCancelled }, orderBy: { id: 'asc' },
    }), found.invoice);
  }

  // Branches fan out the same way the spine does — see the sales equivalent.
  if (key.grnNo && !found.return) {
    const grnNos = all.grn.map((g) => g.grnNo).filter(Boolean);
    all.return = await prisma.purchaseReturn.findMany({
      where: {
        grnNo: { in: grnNos.length ? grnNos : [key.grnNo] },
        ...notCancelled,
      },
      orderBy: { id: 'asc' },
    });
    found.return = all.return[0] || null;
  }
  if (key.invoiceNo && !found.creditMemo) {
    const invoiceNos = all.invoice.map((i) => i.invoiceNo).filter(Boolean);
    all.creditMemo = await prisma.purchaseCreditMemo.findMany({
      where: {
        invoiceNo: { in: invoiceNos.length ? invoiceNos : [key.invoiceNo] },
        ...notCancelled,
      },
      orderBy: { id: 'asc' },
    });
    found.creditMemo = all.creditMemo[0] || null;
  }

  // Outgoing Payment (Payment Voucher) — see the sales equivalent in
  // resolveSalesChain for why this goes through a join instead of a field.
  if (all.invoice.length) {
    const invoiceNos = all.invoice.map((i) => i.invoiceNo).filter(Boolean);
    if (invoiceNos.length) {
      all.payment = await prisma.paymentVoucher.findMany({
        where: { ...notCancelled, applications: { some: { invoiceNo: { in: invoiceNos } } } },
        include: { applications: true },
        orderBy: { id: 'asc' },
      });
      found.payment = all.payment[0] || null;
    }
  }

  const partyName = found.invoice?.supplier || found.grn?.supplier || found.order?.supplier
    || found.quotation?.supplier || found.return?.supplier || found.creditMemo?.supplier || null;

  return { found, all, partyName };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Turn the resolved documents into the stage list the diagram draws.
 *
 * The spine is always returned in full, including stages with no document, so
 * the diagram can show the shape of the flow and where it stopped rather than
 * silently collapsing. `present: false` marks a stage nothing has reached yet.
 */
function buildSalesStages({ found, all }) {
  // Each stage names its label, every document found at it, and how to read a
  // document's fields. `docs` is what lets the diagram draw a tree when a
  // stage fanned out; the flat `docNo`/`docDate`/... on the stage itself stay
  // as the representative document so nothing that reads the old shape breaks.
  const defs = [
    {
      label: 'Sales Enquiry',
      // An enquiry is the root — there is no `all` list for it, and nothing
      // upstream for it to hang off.
      rows: found.enquiry ? [found.enquiry] : [],
      map: (d) => ({
        no: d.enquiryNo,
        date: d.enquiryDate,
        // An enquiry has no document total — the nearest thing it records is
        // the budget the customer expects to spend.
        total: d.expectedBudget,
        status: d.status,
        parentNo: null,
      }),
    },
    {
      label: 'Sales Quotation',
      rows: all.quotation,
      map: (d) => ({
        no: d.quotationNo, date: d.quotationDate, total: d.amount, status: d.status,
        parentNo: d.enquiryNo || null,
      }),
    },
    {
      label: 'Sales Order',
      rows: all.order,
      map: (d) => ({
        no: d.orderNo, date: d.orderDate, total: d.amount, status: d.status,
        parentNo: d.quotationNo || null,
      }),
    },
    {
      label: 'Delivery Challan',
      rows: all.challan,
      map: (d) => ({
        no: d.challanNo,
        date: pickDate(d.challanDate, d.deliveryDate),
        total: d.amount,
        status: d.status,
        parentNo: d.orderNo || null,
      }),
    },
    {
      label: 'Sales Invoice',
      rows: all.invoice,
      map: (d) => ({
        no: d.invoiceNo, date: d.invoiceDate, total: d.amount, status: d.status,
        // A one-step sale is billed straight off the order, so the challan
        // reference is empty and the order is the real parent.
        parentNo: d.deliveryChallanNo || d.orderNo || null,
      }),
    },
  ];

  return finishStages(defs, [
    found.enquiry, found.quotation, found.order, found.challan, found.invoice,
  ]);
}

/**
 * Shared tail of both stage builders.
 *
 * Produces one entry per stage carrying `docs` (every document at that stage,
 * as nodes) alongside the representative document's own fields, so a caller
 * that only knows about the flat shape still works and one that draws the
 * tree has what it needs.
 */
function finishStages(defs, representatives) {
  return defs.map((def, i) => {
    const docs = def.rows.map((d) => node(def.label, d, def.map(d)));
    const rep = representatives[i];
    const repNode = rep
      ? node(def.label, rep, def.map(rep))
      : node(def.label, null, {});

    return {
      ...repNode,
      present: Boolean(repNode.docNo),
      docs,
      // Kept for anything still reading the collapsed form; the diagram now
      // draws every document instead of counting the hidden ones.
      moreCount: Math.max(0, docs.length - 1),
    };
  });
}

function buildPurchaseStages({ found, all }) {
  const defs = [
    {
      label: 'Purchase Quotation',
      rows: all.quotation,
      map: (d) => ({
        no: d.quotationNo, date: d.quotationDate, total: d.amount, status: d.status,
        parentNo: null,
      }),
    },
    {
      label: 'Purchase Order',
      rows: all.order,
      map: (d) => ({
        no: d.poNo, date: d.poDate, total: d.amount, status: d.status,
        // A PO references its quotation through `referenceNo`.
        parentNo: d.referenceNo || null,
      }),
    },
    {
      label: 'Purchase GRN',
      rows: all.grn,
      map: (d) => ({
        no: d.grnNo,
        date: pickDate(d.receivedDate, d.deliveryDate),
        total: d.amount,
        status: d.status,
        parentNo: d.poNo || null,
      }),
    },
    {
      label: 'Purchase Invoice',
      rows: all.invoice,
      map: (d) => ({
        no: d.invoiceNo, date: d.invoiceDate, total: d.amount, status: d.status,
        // Invoiced straight off the PO when there was no goods receipt.
        parentNo: d.grnNo || d.poNo || null,
      }),
    },
  ];

  return finishStages(defs, [found.quotation, found.order, found.grn, found.invoice]);
}

/**
 * The chain's whole point, expressed as data the UI does not have to re-derive.
 *
 * Return and Credit Memo are alternatives, not siblings: a goods receipt or
 * delivery challan can be returned right up until it is invoiced, and from
 * that moment the only way to give value back is a credit memo against the
 * invoice. `returnAllowed` and `creditMemoAllowed` say which door is open, and
 * the same two flags are what the write guards in resources.js enforce — so the
 * diagram and the validation can never drift apart.
 */
function branchState({ found, all }, { invoiced, anchorStage, isPurchase }) {
  const returnNode = (d) => node('Return', d, {
    no: d.returnNo,
    date: pickDate(d.documentDate, d.postingDate),
    total: d.amount,
    status: d.status,
    parentNo: (isPurchase ? d.grnNo : d.challanNo) || null,
  });
  const creditMemoNode = (d) => node('Credit Memo', d, {
    no: d.creditNo,
    date: pickDate(d.documentDate, d.postingDate),
    total: d.amount,
    status: d.status,
    parentNo: d.invoiceNo || null,
  });

  // A payment settles against invoices through its own applications rows
  // rather than a single field, and one payment can settle several invoices
  // at once — so its parent is whichever invoice IN THIS CHAIN one of its
  // applications actually names, not just the first application on the row.
  const invoiceNos = (all.invoice || []).map((d) => d.invoiceNo).filter(Boolean);
  const paymentLabel = isPurchase ? 'Outgoing Payment' : 'Incoming Payment';
  const paymentNode = (d) => {
    const applied = (d.applications || []).find((a) => invoiceNos.includes(a.invoiceNo));
    return node(paymentLabel, d, {
      no: isPurchase ? d.paymentVoucherNo : d.paymentReceiptNo,
      date: pickDate(d.postingDate, d.documentDate),
      total: d.appliedAmount,
      status: d.status,
      parentNo: applied?.invoiceNo || null,
    });
  };

  return {
    invoiced,
    returnAllowed: Boolean(anchorStage) && !invoiced,
    creditMemoAllowed: invoiced,
    returnDoc: found.return ? returnNode(found.return) : null,
    creditMemoDoc: found.creditMemo ? creditMemoNode(found.creditMemo) : null,
    paymentDoc: found.payment ? paymentNode(found.payment) : null,
    // Every branch document, so several returns against different GRNs each
    // draw against the one they actually came from instead of collapsing to
    // whichever the walk happened to reach first.
    returnDocs: (all.return || []).map(returnNode),
    creditMemoDocs: (all.creditMemo || []).map(creditMemoNode),
    paymentDocs: (all.payment || []).map(paymentNode),
  };
}

/**
 * Resolve the partner card at the top of the diagram.
 *
 * Documents hold the party by NAME (there is no FK), so the code has to be
 * looked back up from the master. A party that has since been renamed or
 * deleted will not match — the name is still shown, with no code, rather than
 * the card being dropped: the document did have a customer, and hiding that
 * would be a worse answer than an incomplete one.
 */
async function resolvePartner(prisma, flow, partyName) {
  if (!partyName) return null;
  if (flow === 'purchase') {
    const s = await prisma.businessPartner.findFirst({ where: { partnerType: 'Vendor', partnerName: partyName } });
    return { kind: 'Supplier', code: s?.partnerCode || null, name: partyName };
  }
  const c = await prisma.businessPartner.findFirst({ where: { partnerType: 'Customer', partnerName: partyName } });
  return { kind: 'Customer', code: c?.partnerCode || null, name: partyName };
}

/**
 * @param {object} prisma
 * @param {'sales'|'purchase'} flow
 * @param {{type: string, no: string}} anchor  the document the map was opened on
 */
async function buildRouteMap(prisma, flow, anchor) {
  const isPurchase = flow === 'purchase';
  const resolved = isPurchase
    ? await resolvePurchaseChain(prisma, anchor)
    : await resolveSalesChain(prisma, anchor);

  const stages = isPurchase ? buildPurchaseStages(resolved) : buildSalesStages(resolved);

  // "Invoiced" is decided on the same terms the write guards use: a live
  // invoice, not a draft or a cancelled one.
  const invoiceStage = stages[stages.length - 1];
  const invoiced = Boolean(invoiceStage.docNo)
    && !['Draft', 'Cancelled'].includes(invoiceStage.status);

  const anchorStage = isPurchase ? resolved.found.grn : resolved.found.challan;

  return {
    flow,
    anchor,
    partner: await resolvePartner(prisma, flow, resolved.partyName),
    stages,
    branch: branchState(resolved, { invoiced, anchorStage, isPurchase }),
  };
}

/**
 * Is this goods receipt / delivery challan already covered by a live invoice?
 *
 * Shared by the Route Map and by the write guards that refuse a return after
 * invoicing, so both answer the question the same way.
 */
async function isChallanInvoiced(tx, challanNo) {
  if (!challanNo) return false;
  const hit = await tx.salesInvoice.findFirst({
    where: { deliveryChallanNo: challanNo, ...LIVE_INVOICE_STATUSES },
    select: { invoiceNo: true },
  });
  return hit ? hit.invoiceNo : false;
}

async function isGrnInvoiced(tx, grnNo) {
  if (!grnNo) return false;
  const hit = await tx.purchaseInvoice.findFirst({
    where: { grnNo, ...LIVE_INVOICE_STATUSES },
    select: { invoiceNo: true },
  });
  return hit ? hit.invoiceNo : false;
}

/**
 * Refuse a return once the goods have been invoiced.
 *
 * The business rule: a delivery challan or goods receipt can be returned right
 * up until it is invoiced. From the moment an invoice exists, the money has
 * been billed, and unwinding it by returning the goods document would leave the
 * invoice standing against stock that has gone back — the ledger and the
 * receivable would disagree. A credit memo against the invoice is the correct
 * instrument from then on, and the error says so rather than just refusing.
 *
 * Nothing enforced this before: a return could be raised against an invoiced
 * challan or GRN with no complaint at all.
 *
 * A return with no challan/GRN behind it is left alone — a free-standing return
 * is not covered by this rule and blocking it would break existing documents.
 */
async function assertReturnAllowed(tx, { kind, docNo, unchangedFrom = null }) {
  if (!docNo) return;

  // On edit, only the act of pointing the return at a DIFFERENT source document
  // is checked. A return that was raised legitimately — while its challan/GRN
  // was still uninvoiced — must stay editable afterwards; otherwise invoicing
  // would freeze a document the user may simply need to correct a typo on, and
  // the rule would be punishing history instead of governing new work.
  if (unchangedFrom != null && String(unchangedFrom) === String(docNo)) return;

  const invoiceNo = kind === 'purchase'
    ? await isGrnInvoiced(tx, docNo)
    : await isChallanInvoiced(tx, docNo);

  if (!invoiceNo) return;

  const source = kind === 'purchase' ? 'GRN' : 'delivery challan';
  const memo = kind === 'purchase' ? 'Purchase Credit Memo' : 'Sales Credit Memo';
  const err = new Error(
    `${source} ${docNo} has already been invoiced on ${invoiceNo}, so it can no longer be returned. `
    + `Raise a ${memo} against ${invoiceNo} instead.`
  );
  err.status = 400;
  throw err;
}

/**
 * Refuse a credit memo that is not against a real invoice.
 *
 * The mirror of the rule above: a credit memo exists to reverse value that was
 * billed, so there has to be a bill. Without this, a credit memo could be
 * raised with the invoice field left blank — reducing what a customer owes with
 * nothing to point at — which is exactly the hole the return guard would
 * otherwise push people towards.
 *
 * A cancelled invoice does not count: there is nothing left to credit.
 */
async function assertCreditMemoAllowed(tx, { kind, invoiceNo }) {
  const label = kind === 'purchase' ? 'Purchase' : 'Sales';

  if (!invoiceNo || !String(invoiceNo).trim()) {
    const err = new Error(
      `A ${label} Credit Memo must be raised against an invoice — select the invoice being credited.`
    );
    err.status = 400;
    throw err;
  }

  const delegate = kind === 'purchase' ? tx.purchaseInvoice : tx.salesInvoice;
  const invoice = await delegate.findFirst({
    where: { invoiceNo: String(invoiceNo).trim() },
    select: { invoiceNo: true, status: true },
  });

  if (!invoice) {
    const err = new Error(`Invoice ${invoiceNo} does not exist.`);
    err.status = 400;
    throw err;
  }
  if (invoice.status === 'Cancelled') {
    const err = new Error(`Invoice ${invoiceNo} is cancelled — there is nothing left to credit.`);
    err.status = 400;
    throw err;
  }
}

module.exports = {
  buildRouteMap,
  isChallanInvoiced,
  isGrnInvoiced,
  assertReturnAllowed,
  assertCreditMemoAllowed,
  LIVE_INVOICE_STATUSES,
};
