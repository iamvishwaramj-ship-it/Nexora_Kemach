import React from 'react';
import { cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import { buildDocument, round2, isInterState, computeFreightGross } from '../../lib/documentTotals';
import {
  StationerySheet, makeScopedPrint, buildStationeryCss, wordsInr, fmtDate,
  formatPartnerAddressLines, defaultAddressOf, lineDisplay, displayTaxRows,
  buildHsnGroups, buildTaxColWidths, DEFAULT_GST_TYPE, JURISDICTION_CITY,
} from './purchaseStationery';
import { branchAddressLines } from '../../lib/branchAddress';
import { useIsActiveTab } from '../navigation/TabPathContext';

// This document's own print-activation class names — see
// purchaseStationery.js's makeScopedPrint for why each document in the
// family needs its own (KeepAliveOutlet keeps every open tab mounted, so an
// Invoice print must never fight a GRN/Return/Credit Memo/PO print job
// mounted in a background tab).
const AREA_CLASS = 'pinv2-print-area';
const PRINTING_CLASS = 'pinv2-printing';
const PAGE_RULE_ID = 'pinv2-print-page-rule';

/**
 * Print THIS Purchase Invoice. Call instead of window.print() from the
 * Purchase Invoice page's own Print controls.
 */
export const printPurchaseInvoice = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

/**
 * The live, data-driven Purchase Invoice print — visual twin of
 * PurchaseOrderPrintable (see purchaseStationery.js), adapted for
 * invoice-specific fields (GRN/PO cross-references, due date, payment
 * terms). Only ever rendered inside a `.pinv2-print-area` wrapper that's
 * invisible on screen and shown exclusively via the shared @media print
 * rules.
 */
export default function PurchaseInvoicePrintable({ order, company, supplierRecord, grnRecord, poRecord, branchRecord, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // Purchase Invoice has no Place of Supply field any more — GST treatment
  // derives from the supplier's own state instead (see resources.js).
  const interState = isInterState(order.supplierState, company?.state);
  const { totals } = buildDocument(items, order.discountPercent, { interState, roundOff: true });
  // Freight Charges (Net + Tax) is folded into the printed Grand Total
  // exactly as it is in the saved amount. See backend/src/routes/resources.js's
  // compute*Totals for this document. Road Tax Amount has been removed from
  // Purchase documents' UI/print and no longer feeds this total.
  const freightGrossAmount = order.freightGrossAmount != null
    ? round2(Number(order.freightGrossAmount) || 0)
    : computeFreightGross(order.freightNetAmount, order.freightTaxAmount);
  const grandTotal = round2(totals.amount + freightGrossAmount);
  const ratio = totals.subtotal !== 0 ? totals.taxableAmount / totals.subtotal : 0;
  const itemsTotal = round2(totals.taxableAmount + totals.totalTax);
  const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const opts = { quantityField: 'quantity', headerDiscPercent: order.discountPercent };

  // Machine Serial No / Model print below PO Date (left box); Machine Engine
  // No. prints below Vendor Reference No. (right box). Machine purchases
  // only; blank values skipped.
  const machineRowsFor = (defs) => (order.purchaseType === 'Machine'
    ? items.flatMap((it) => defs
      .map(([label, key]) => ({ label, value: it[key] }))
      .filter((r) => r.value != null && String(r.value).trim() !== ''))
    : []);
  const machineLeftRows = machineRowsFor([['Machine Serial No', 'machineSerialNo'], ['Machine Model', 'machineModel']]);
  const machineRightRows = machineRowsFor([['Machine Engine No.', 'machineEngineNo']]);

  const rows = items.map((it) => {
    const d = lineDisplay(it, ratio, opts);
    return {
      itemCode: it.productCode,
      description: it.description || it.productName,
      hsnSac: it.hsnCode,
      um: it.uom,
      qty: d.qty,
      unitPrice: d.unitPrice,
      discPercent: d.discPercent,
      taxable: d.taxable,
      taxRows: displayTaxRows(d.taxPercent, d.trueTax, interState, { taxable: d.taxable, taxType: it.taxType }),
      amount: d.amount,
    };
  });

  const hsnGroups = buildHsnGroups(items, ratio, opts).map((g) => ({
    hsnCode: g.hsnCode,
    taxable: g.taxable,
    taxRows: displayTaxRows(g.taxPercent, g.trueTax, interState),
  }));

  const companyName = (company?.companyName || 'Nexora KEMACH').toUpperCase();

  const supplierBillingAddr = defaultAddressOf(supplierRecord, 'Billing');
  const supplierAddrLines = formatPartnerAddressLines(supplierBillingAddr);
  const supplierGstNumber = supplierBillingAddr?.gstNumber || supplierRecord?.gstin || '—';
  const supplierGstType = supplierBillingAddr?.gstType || DEFAULT_GST_TYPE;

  // Shipping Address box.
  //
  // Address lines: whatever text is actually saved in shipTo, verbatim,
  // split on newlines — covers every case that fills it today (the
  // ordinary branch default, a "ship to a different customer" selection, or
  // a hand-typed edit of either) with no need for this template to know or
  // branch on which. Falls back to the selected branch's own address only
  // when shipTo is empty (a document saved before Branch was mandatory, or
  // before this field could be filled at all), then the company's own
  // address. shipTo taking priority over branchRecord (the reverse of this
  // box's original fallback order) is the fix that makes editing Shipping
  // To -- by hand, or via "ship to a different customer" -- actually change
  // what prints; before, this box read branchRecord unconditionally
  // whenever a branch resolved (i.e. on every document, Branch being
  // required), so shipTo's own text never reached the page. In practice
  // this is a no-op for every invoice saved before this feature existed:
  // their shipTo already holds exactly the branch's own address (it was the
  // only thing that could ever auto-fill it), so shipTo-first reproduces
  // the same lines byte for byte.
  //
  // Name line: NOT parsed out of shipTo's own text (a document's address
  // may or may not carry a name line of its own, and guessing wrong would
  // print an address fragment as a name for the many older invoices whose
  // shipTo is address-only lines with nothing to identify whose address it
  // is) -- resolved instead from order.shipToCustomer, the customer this
  // invoice was explicitly saved as shipping to, when "ship to a different
  // customer" was used, exactly the same way order.supplier/order.poNo etc.
  // are already read straight off the saved header elsewhere on this sheet.
  // Falls back to the company + branch name exactly as before this feature
  // existed when shipToCustomer is blank (every pre-existing invoice, and
  // any invoice left on the ordinary branch-default path).
  const branchLines = branchAddressLines(branchRecord);
  const shipToLines = cleanAddressText(order.shipTo).split('\n').filter(Boolean);
  // Company name + branch code, e.g. "KEMACH EQUIPMENTS PRIVATE LIMITED -
  // BR001" (kept in sync with PurchaseQuotationPrintable / PurchaseGRNPrintable).
  const companyNameWithBranch = `${companyName || ''}${branchRecord?.branchCode ? ` - ${branchRecord.branchCode}` : ''}`;
  const deliveryName = order.shipToCustomer || companyNameWithBranch;
  const deliveryLinesRaw = shipToLines.length
    ? shipToLines
    : (branchLines.length ? branchLines : [cleanAddressText(company?.address).replace(/\n/g, ', ')].filter(Boolean));
  // A missing/unresolved shipTo/branch address (and no company fallback
  // either) used to silently print an empty box — make that obvious on the
  // printed page instead.
  const deliveryLines = deliveryLinesRaw.length ? deliveryLinesRaw : ['Branch address not set'];

  const billingDisplayLines = [cleanAddressText(company?.address).replace(/\n/g, ', ')].filter(Boolean);
  const shippingDisplayLines = deliveryLines;

  const taxColWidths = buildTaxColWidths(interState, totals.tcsAmount > 0);

  const poDate = poRecord?.poDate || grnRecord?.poDate;
  const grnDate = grnRecord?.receivedDate;

  const sheet = (
    <div className={AREA_CLASS}>
      <style>{buildStationeryCss({ areaClass: AREA_CLASS, printingClass: PRINTING_CLASS })}</style>
      {/* Purchase Invoice only: the shared .po3-to-line/.po3-vendor-block
      rules (in purchaseStationery.jsx, used by every purchase document's
      print) show "To :" and the party name on one line, then indent the
      address/GST lines below to sit under where the name used to start.
      Scoped to this document's own AREA_CLASS so PO/GRN/Quotation/Return/
      Credit Memo keep their existing layout untouched — this puts the party
      name on its own line under "To :" and the address/GST lines flush
      left under IT, all starting at the same left edge, on the Purchase
      Invoice print only. Higher specificity than the shared rules (two
      classes vs. one) so these win regardless of <style> tag order. */}
      <style>{`
        .${AREA_CLASS} .po3-to-line span { display: block; margin-bottom: 2px; }
        .${AREA_CLASS} .po3-vendor-block { padding-left: 0; }
      `}</style>
      <StationerySheet
        title="PURCHASE INVOICE"
        headLabel="To :"
        partyName={order.supplier}
        partyCode={supplierRecord?.supplierCode}
        partyAddrLines={supplierAddrLines}
        partyGstNo={supplierGstNumber}
        partyGstType={supplierGstType}
        companyLogoUrl={company?.logoUrl}
        companyLogoAlt={company?.companyName}
        partyLogoUrl={supplierRecord?.logoUrl}
        partyLogoAlt={order.supplier}
        leftBoxLabel="Billing Address :"
        leftBoxName={companyName}
        leftBoxAddrLines={billingDisplayLines}
        leftBoxGstNo={company?.gstin}
        leftBoxGstType={DEFAULT_GST_TYPE}
        rightBoxLabel="Shipping Address :"
        rightBoxName={deliveryName}
        rightBoxAddrLines={shippingDisplayLines}
        rightBoxGstNo={company?.gstin}
        rightBoxGstType={DEFAULT_GST_TYPE}
        metaLeftRows={[
          { label: 'Invoice No', value: order.invoiceNo },
          { label: 'Invoice Date', value: fmtDate(order.invoiceDate) },
          { label: 'PO No', value: order.poNo },
          { label: 'PO Date', value: fmtDate(poDate) },
          ...machineLeftRows,
        ]}
        metaRightLabelWidth="42%"
        metaRightRows={[
          { label: 'GRN Date', value: fmtDate(grnDate) },
          { label: 'Due Date', value: fmtDate(order.dueDate) },
          { label: 'Payment Terms', value: order.paymentTerms },
          // Always printed (falls back to metaRightRows' usual "—"
          // placeholder like every other row here) rather than being
          // omitted outright when blank.
          { label: 'Vendor Reference No.', value: order.vendorRefNo },
          // Machine Serial No / Model / Engine No -- printed below Vendor
          // Reference No. (Machine purchases only; blank values skipped).
          ...machineRightRows,
        ]}
        commentsLabel="Comments :"
        commentsValue={order.notes}
        items={rows}
        totalQty={totalQty}
        itemsTotal={itemsTotal}
        amountInWords={wordsInr(grandTotal)}
        freightCharges={freightGrossAmount}
        roundOff={totals.roundOff}
        grandTotal={grandTotal}
        taxColWidths={taxColWidths}
        hsnRows={hsnGroups}
        interState={interState}
        tcsAmount={totals.tcsAmount}
        taxAmountInWords={wordsInr(totals.totalTax)}
        termsTitle="Terms & Conditions :"
        termsValue={order.termsConditions}
        signFor={companyName}
        footerJurisdiction={JURISDICTION_CITY}
        footerPhone={company?.phone}
        footerEmail={company?.email}
        approverSignatureUrl={approverSignatureUrl}
        machineType={order.purchaseType === 'Machine'}
      />
    </div>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}
