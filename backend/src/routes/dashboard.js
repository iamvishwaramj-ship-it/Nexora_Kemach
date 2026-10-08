const router = require('express').Router();
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { getStockMovementByProductCode } = require('../utils/stockLedger');
const { buildAvailableBalanceReportData } = require('./resources');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Builds a 6-month trailing series (oldest -> newest) of summed `amount` from a
// list of rows that each have a `date` (Date) and `amount` (Decimal|null).
function monthlySeries(rows, dateField, amountField, months = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, name: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), value: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  rows.forEach((r) => {
    const d = r[dateField];
    if (!d) return;
    const dt = new Date(d);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (byKey[key]) byKey[key].value += Number(r[amountField] || 0);
  });
  // `value` stays in Lakhs (chart axis scale); `rawValue` is the exact
  // rupee total for that month, undone from the Lakhs rounding, so the
  // drill-down popup can show real figures instead of a rounded chart value.
  return buckets.map((b) => ({
    name: b.name,
    year: b.year,
    month: b.month,
    value: Math.round((b.value / 100000) * 100) / 100,
    rawValue: Math.round(b.value * 100) / 100,
  }));
}

// % change of current calendar month sum vs previous calendar month sum.
function momChange(rows, dateField, amountField) {
  const now = new Date();
  const curKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${prev.getMonth()}`;
  let cur = 0;
  let prv = 0;
  rows.forEach((r) => {
    const d = r[dateField];
    if (!d) return;
    const dt = new Date(d);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    const amt = Number(r[amountField] || 0);
    if (key === curKey) cur += amt;
    else if (key === prevKey) prv += amt;
  });
      if (prv === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prv) / prv) * 1000) / 10;
    }

// % change of a running-balance figure (like Total Inventory Value) between
// "as of now" and "as of the end of last month" — unlike momChange above,
// this isn't a period flow you sum per month, it's a balance you re-derive as
// of two different cutoff dates, so it needs the journal rows themselves
// (via valueAsOf) rather than a plain amount/date list. `valueAsOf` may
// return a plain number or a Promise<number> — awaiting either works.
async function balanceMomChange(valueAsOf) {
  const now = new Date();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const cur = await valueAsOf(null);
  const prv = await valueAsOf(prevMonthEnd);
  if (prv === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prv) / prv) * 1000) / 10;
}

// router.get('/stats', auth(), asyncHandler(async (req, res) => {
//   const now = new Date();
//   const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    let cachedDashboardData = null;
    let lastCacheTime = 0;
    const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// getStockMovementByProductCode() with no filters is a row-level scan across
// every document line-item table there is, and it sits on the landing page.
// The whole-response cache above already limits how often it runs, but its TTL
// is about the response as a whole; this second, longer-lived cache is about
// the scan itself, so the heaviest query on the page runs at most once a
// minute however the response TTL is tuned later.
//
// 60s and the same shape as '/products/current-stock' in routes/resources.js
// deliberately — that route already makes exactly this trade (time-based only,
// NOT invalidated on writes), so the staleness characteristics here are ones
// the team has already accepted rather than a new one.
//
// Note this caches the raw movement Map, not '/products/current-stock's
// finished figure: that route adds the Inventory > Opening Balance component
// (getOpeningBalanceByProductCode) which this route's currentStock arithmetic
// below does not, so borrowing its result would have quietly changed the
// dashboard's inventory numbers. Consumers only ever .get() this Map.
let stockMovementCache = { timestamp: 0, data: null };
const STOCK_MOVEMENT_CACHE_TTL_MS = 60 * 1000;

async function getCachedStockMovementByProductCode() {
  const now = Date.now();
  if (stockMovementCache.data && (now - stockMovementCache.timestamp) < STOCK_MOVEMENT_CACHE_TTL_MS) {
    return stockMovementCache.data;
  }
  const data = await getStockMovementByProductCode();
  stockMovementCache = { timestamp: now, data };
  return data;
}


    router.get('/stats', auth(), asyncHandler(async (req, res) => {
      const currentTime = Date.now();
      if (cachedDashboardData && (currentTime - lastCacheTime < CACHE_TTL_MS)) {
        return res.json({ success: true, data: cachedDashboardData });
      }
    
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const [
    salesAggregate,
    purchaseAggregate,
    recentSalesInvoices,
    recentPurchaseInvoices,
    activeSalesInvoices,
    activePurchaseInvoices,
    postedCollectionApplications,
    postedPaymentApplications,
    postedPaymentReceiptApplications,
    postedPaymentVoucherApplications,
    products,
    customers,
    suppliers,
    branches,
    users,
    companies,
    recentSales,
    recentPurchases,
    recentCollections,
    recentPayments,
  ] = await Promise.all([
    prisma.salesInvoice.aggregate({
      _sum: { amount:true },
      where: { status: { notIn : ['Draft', 'Cancelled'] } },
    }),
    prisma.purchaseInvoice.aggregate({
      _sum: { amount: true },
      where: { status: { notIn: ['Draft', 'Cancelled'] } },
    }),

    // Draft and cancelled invoices are not revenue or spend. Without this
    // filter the headline Total Sales figure — and the month-on-month change
    // and monthly series built from the same rows — counted every invoice
    // somebody was still typing, and every one that had been withdrawn.
    prisma.salesInvoice.findMany({
      where: { status: { notIn: ['Draft', 'Cancelled'] },
      invoiceDate: { gte: sixMonthsAgo } 
    },
      select: { amount: true, invoiceDate: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: { status: { notIn: ['Draft', 'Cancelled'] },
      invoiceDate: { gte: sixMonthsAgo },
     },
      select: { amount: true, invoiceDate: true },
    }),
    // All four Receivables/Payables cards are computed straight from the
    // real invoice + payment-allocation records, NOT from CustomerOutstanding
    // / SupplierOutstanding's own paidAmount/balanceAmount columns. Those two
    // tables are an incrementally-updated cache (see openItemLedger.js) that
    // can drift stale — see recomputeOutstanding.js's own doc comment, which
    // documents exactly this: paidAmount silently stuck at 0 while real,
    // Posted receipts/payments existed against the invoice, e.g. after a
    // migration/seed, a manual DB edit, or any write path that touched the
    // invoice or the payment document without going through applyTo*
    // Outstanding. Recomputing directly from source here means the dashboard
    // is correct even when that cache is out of sync, exactly like running
    // recompute:outstanding would fix the cached tables themselves.
    //
    // Source of truth, mirrored from recomputeOutstanding.js, EXTENDED to
    // cover every document type that can actually settle an invoice in this
    // app — not just Collection/Supplier Payment. Collection (Receivables)
    // and Supplier Payment (Payables) are one pair of documents that settle
    // through customerLedger/supplierLedger; Payment Receipt ("Incoming
    // Payment") and Payment Voucher ("Outgoing Payment") under Banking
    // settle through the exact same shared ledger (see
    // ledgerForPaymentReceipt/ledgerForPaymentVoucher in resources.js) when
    // posted against a Customer/Vendor party with Payment on Account
    // unchecked. Leaving those two out — as an earlier version of this
    // route did — meant posting a real Payment Receipt/Payment Voucher had
    // no effect on these cards at all, even though it correctly updated
    // CustomerOutstanding/SupplierOutstanding under the hood. All four
    // application tables are summed together per invoice, then:
    //   paid per invoice = total applied across every one of these four
    //   tables whose PARENT document is Posted (a Draft hasn't actually
    //   settled anything yet), capped at the invoice's own amount.
    //   balance = invoice amount - that paid figure. Only Sales/Purchase
    // Invoices not in Draft/Cancelled count — those aren't real receivables/
    // payables either.
    prisma.salesInvoice.findMany({
      where: { status: { notIn: ['Draft', 'Cancelled'] } },
      select: { invoiceNo: true, amount: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: { status: { notIn: ['Draft', 'Cancelled'] } },
      select: { invoiceNo: true, amount: true },
    }),
    prisma.collectionInvoiceApplication.findMany({
      where: { collection: { status: 'Posted' } },
      select: { invoiceNo: true, amountApplied: true },
    }),
    prisma.paymentInvoiceApplication.findMany({
      where: { payment: { status: 'Posted' } },
      select: { invoiceNo: true, amountApplied: true },
    }),
    // paymentOnAccount excluded — that path is explicitly "don't settle
    // anything" and never reaches customerLedger/supplierLedger (see
    // ledgerForPaymentReceipt/ledgerForPaymentVoucher), so including it here
    // would count money that never actually applied to any invoice.
    prisma.paymentReceiptApplication.findMany({
      where: { paymentReceipt: { status: 'Posted', partyType: 'Customer', paymentOnAccount: false } },
      select: { invoiceNo: true, amountApplied: true },
    }),
    prisma.paymentVoucherApplication.findMany({
      where: { paymentVoucher: { status: 'Posted', partyType: 'Vendor', paymentOnAccount: false } },
      select: { invoiceNo: true, amountApplied: true },
    }),
    prisma.product.findMany({ select: { productCode: true, productName: true, openingStock: true, costPrice: true, unitPrice: true, reorderLevel: true } }),
    prisma.businessPartner.count({ where: { partnerType: 'Customer' } }),
    prisma.businessPartner.count({ where: { partnerType: 'Vendor' } }),
    prisma.branch.count({ where: { status: 'Active' } }),
    prisma.appUser.count(),
    prisma.companyDetails.count(),
    prisma.salesInvoice.findMany({ orderBy: { invoiceDate: 'desc' }, take: 5 }),
    prisma.purchaseInvoice.findMany({ orderBy: { invoiceDate: 'desc' }, take: 5 }),
    prisma.collection.findMany({ orderBy: { receiptDate: 'desc' }, take: 5 }),
    prisma.supplierPayment.findMany({ orderBy: { paymentDate: 'desc' }, take: 5 }),
  ]);

  const totalSales = Number(salesAggregate._sum.amount || 0);
  const totalPurchase = Number(purchaseAggregate._sum.amount || 0);

  // Builds invoiceNo -> total amountApplied, merging one or more Posted-only
  // application lists together (e.g. Collection's own applications AND
  // Payment Receipt's — the same invoice can legitimately be settled a bit
  // by each).
  function sumAppliedByInvoice(...applicationLists) {
    const byInvoice = {};
    applicationLists.forEach((applications) => {
      applications.forEach((app) => {
        if (!app.invoiceNo) return;
        byInvoice[app.invoiceNo] = (byInvoice[app.invoiceNo] || 0) + Number(app.amountApplied || 0);
      });
    });
    return byInvoice;
  }

  // For every active (non-Draft/Cancelled) invoice, paid = what's actually
  // been applied against it by a Posted receipt/payment (capped at the
  // invoice's own amount — a receipt can't settle more than the invoice is
  // worth), balance = whatever's left. Returns the two grand totals across
  // every invoice passed in.
  function totalPaidAndBalance(invoices, appliedByInvoice) {
    let paidTotal = 0;
    let balanceTotal = 0;
    invoices.forEach((inv) => {
      if (!inv.invoiceNo) return;
      const invoiceAmount = Number(inv.amount || 0);
      const paid = Math.min(invoiceAmount, appliedByInvoice[inv.invoiceNo] || 0);
      paidTotal += paid;
      balanceTotal += Math.max(0, invoiceAmount - paid);
    });
    return { paidTotal, balanceTotal };
  }

  // Customer side: Collection ("Receipt Entry") + Payment Receipt
  // ("Incoming Payment") against a Customer party both settle the same
  // invoices, so both feed the same map.
  const appliedByCustomerInvoice = sumAppliedByInvoice(postedCollectionApplications, postedPaymentReceiptApplications);
  // Vendor side: Supplier Payment + Payment Voucher ("Outgoing Payment").
  const appliedByVendorInvoice = sumAppliedByInvoice(postedPaymentApplications, postedPaymentVoucherApplications);
  // "Total Receivables" / "Total Receivables Balance": what's actually come
  // in from customers to date, and what's still owed, straight from every
  // active Sales Invoice and every Posted Collection/Payment Receipt applied
  // against it.
  const { paidTotal: totalReceivables, balanceTotal: totalReceivablesBalance } = totalPaidAndBalance(activeSalesInvoices, appliedByCustomerInvoice);
  // "Total Payables" / "Total Payables Balance": same, on the vendor side —
  // every active Purchase Invoice and every Posted Supplier Payment/Payment
  // Voucher applied against it.
  const { paidTotal: totalPayables, balanceTotal: totalPayablesBalance } = totalPaidAndBalance(activePurchaseInvoices, appliedByVendorInvoice);

  // Live stock, not the static opening-stock field: openingStock plus every
  // posted Stock Receipt (+), Stock Issue (−), and Stock Adjustment (±) for
  // that product, so this reflects actual warehouse activity instead of
  // whatever was typed in on product creation.
  const stockMovement = await getCachedStockMovementByProductCode();
  const productsWithStock = products.map((p) => ({
    ...p,
    currentStock: Number(p.openingStock || 0) + (stockMovement.get(p.productCode) || 0),
  }));

  // Total Inventory Value card: mirrors Reports -> Inventory -> Available
  // Balance's "Total Stock Value" stat exactly (a plain sum of each on-hand
  // row's Active DLP unit price) instead of the stock journal's own running
  // balance (Opening Stock Value + Inward Value - Outward Value), so the two
  // pages always agree -- see buildAvailableBalanceReportData() in
  // resources.js, which this now calls directly rather than re-deriving its
  // own figure from the Stock journal. Fetched once "as of now" and reused
  // below for Top Selling Products too, instead of a second separate query.
  const currentAvailableBalance = await buildAvailableBalanceReportData({});
  const totalInventoryValue = Number(currentAvailableBalance.stats.totalStockValue || 0);

  // cutoff === null means "as of now" (the fetch above); a Date re-derives
  // the same figure as of that date (via Available Balance's own asOnDate
  // filter) so the MoM change below compares apples to apples.
  async function availableBalanceStockValueAsOf(cutoff) {
    if (!cutoff) return totalInventoryValue;
    const { stats } = await buildAvailableBalanceReportData({ asOnDate: cutoff.toISOString() });
    return Number(stats.totalStockValue || 0);
  }

  // Top selling products — proxy via current on-hand STOCK VALUE (same
  // per-transaction Stock.stockPrice/itemCost pricing Available Balance's
  // own On-Hand Value column uses), summed per product across every
  // warehouse it sits in. Deliberately NOT currentStock * Product.costPrice/
  // unitPrice (what this used to do): those two Product-master fields are
  // frequently left at their DB default (costPrice = 0) or entirely unset
  // (unitPrice) for this dataset -- most of it arrived via bulk import,
  // which doesn't touch the Product Master form's buried Purchase-tab Cost
  // Price field or its Price-List-driven Unit Price -- so ranking by them
  // silently emptied this chart even though real, populated per-transaction
  // pricing already exists on the Stock journal and already powers the
  // Total Inventory Value card right above.
  const productValueByName = new Map();
  for (const row of currentAvailableBalance.rows) {
    productValueByName.set(row.productName, (productValueByName.get(row.productName) || 0) + Number(row.onHandValue || 0));
  }
  const productValues = [...productValueByName.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalProductValue = productValues.reduce((s, p) => s + p.value, 0) || 1;
  const topFour = productValues.slice(0, 4);
  const othersValue = productValues.slice(4).reduce((s, p) => s + p.value, 0);
  const topSellingProducts = [
    ...topFour.map((p) => ({ name: p.name, value: Math.round(p.value), percent: Math.round((p.value / totalProductValue) * 1000) / 10 })),
    ...(othersValue > 0 ? [{ name: 'Others', value: Math.round(othersValue), percent: Math.round((othersValue / totalProductValue) * 1000) / 10 }] : []),
  ];

  const inventoryStockAlert = productsWithStock
    .map((p) => ({
      name: p.productName,
      currentStock: p.currentStock,
      reorderLevel: Number(p.reorderLevel || 0),
      status: p.currentStock <= Number(p.reorderLevel || 0) ? 'Low Stock' : 'OK',
    }))
    .sort((a, b) => (a.status === b.status ? b.currentStock - a.currentStock : a.status === 'Low Stock' ? -1 : 1))
    .slice(0, 6);

  const recentTransactions = [
    ...recentSales.map((s) => ({ type: 'Sales Invoice', refNo: s.invoiceNo, party: s.customer, amount: s.amount, date: s.invoiceDate, status: s.status })),
    ...recentPurchases.map((p) => ({ type: 'Purchase Invoice', refNo: p.invoiceNo, party: p.supplier, amount: p.amount, date: p.invoiceDate, status: p.status })),
    ...recentCollections.map((c) => ({ type: 'Receipt', refNo: c.collectionNo, party: c.customerName, amount: c.paymentAmount, date: c.receiptDate, status: c.status === 'Posted' ? 'Received' : 'Draft' })),
    // SupplierPayment stores the figure as paymentAmount; there is no `amount`
    // column on the model, so this row rendered a blank amount in Recent
    // Transactions. The status is the document's own, not a hard-coded 'Paid'
    // — a payment still in Draft has not paid anybody.
    ...recentPayments.map((pay) => ({ type: 'Payment', refNo: pay.paymentNo, party: pay.supplierName, amount: pay.paymentAmount, date: pay.paymentDate, status: pay.status === 'Posted' ? 'Paid' : 'Draft' })),
  ]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 10);

  const responseData = {
        totalSales,
        totalPurchase,
        totalReceivables,
        totalReceivablesBalance,
        totalPayables,
        totalPayablesBalance,
        totalInventoryValue,
        changes: {
          totalSales: momChange(recentSalesInvoices, 'invoiceDate', 'amount'),
          totalPurchase: momChange(recentPurchaseInvoices, 'invoiceDate', 'amount'),
          totalReceivables: 8.3,
          totalPayables: -5.2,
          totalInventoryValue: await balanceMomChange(availableBalanceStockValueAsOf),
        },
        salesOverview: monthlySeries(recentSalesInvoices, 'invoiceDate', 'amount'),
        purchaseOverview: monthlySeries(recentPurchaseInvoices, 'invoiceDate', 'amount'),
        businessSummary: {
          totalCompanies: companies,
          totalProducts: products.length,
          totalCustomers: customers,
          totalSuppliers: suppliers,
          totalUsers: users,
          activeBranches: branches,
        },
        recentTransactions,
        topSellingProducts,
        inventoryStockAlert,
        topProducts: productsWithStock
          .slice()
          .sort((a, b) => b.currentStock - a.currentStock)
          .slice(0, 5)
          .map((p) => ({ name: p.productName, value: p.currentStock })),
      };

      // Save to memory cache
      cachedDashboardData = responseData;
      lastCacheTime = Date.now();

      res.json({
        success: true,
        data: responseData,
      });
    }));

    module.exports = router;