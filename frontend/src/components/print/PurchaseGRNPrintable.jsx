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

const AREA_CLASS = 'grn2-print-area';
const PRINTING_CLASS = 'grn2-printing';
const PAGE_RULE_ID = 'grn2-print-page-rule';

/**
 * Print THIS Purchase GRN. Call instead of window.print() from the Purchase
 * GRN page's own Print controls.
 */
export const printPurchaseGRN = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

/**
 * The live, data-driven Purchase GRN (Goods Receipt Note) print — visual
 * twin of PurchaseOrderPrintable (see purchaseStationery.js). A GRN item has
 * no line-level Discount % field at all (nor does the GRN header), so every
 * line's Ass. Value is its gross value with no discount applied. Only ever
 * rendered inside a `.grn2-print-area` wrapper that's invisible on screen
 * and shown exclusively via the shared @media print rules.
 */
export default function PurchaseGRNPrintable({ order, company, supplierRecord, poRecord, branchRecord, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // GST treatment (CGST/SGST vs IGST) is decided by the SUPPLIER's state vs
  // the company's own registered state -- supplierState, not placeOfSupply
  // (which tracks the receiving BRANCH's state, for ITC purposes, and is
  // usually the same as the company's own state). This must match exactly
  // what the create/edit form uses (see the `interState` computation in
  // PurchaseGRN.jsx) so a line's printed tax split always matches the Tax
  // Code actually selected on that line -- using placeOfSupply here made an
  // interstate purchase (different supplier state) print as CGST+SGST
  // whenever the receiving branch happened to be in the company's own state,
  // even though IGST was the tax code actually chosen and saved.
  const interState = isInterState(order.supplierState, company?.state);
  // GRN carries no discountPercent anywhere (header or line) — 0 throughout.
  const { totals } = buildDocument(items, 0, { interState, roundOff: true, quantityField: 'receivedQuantity' });
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
  const totalQty = items.reduce((sum, it) => sum + (Number(it.receivedQuantity) || 0), 0);
  const opts = { quantityField: 'receivedQuantity', headerDiscPercent: 0 };

  // Machine Serial No, Machine Model and Machine Engine No. print (in that
  // order) below the right-hand meta rows — Machine purchases only; blank
  // values skipped.
  const machineEngineRows = order.purchaseType === 'Machine'
    ? items.flatMap((it) => [
      ['Machine Serial No', it.machineSerialNo],
      ['Machine Model', it.machineModel],
      ['Machine Engine No.', it.machineEngineNo],
    ]
      .map(([label, value]) => ({ label, value }))
      .filter((r) => r.value != null && String(r.value).trim() !== ''))
    : [];

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
  // split on newlines — covers every case that fills it today (the ordinary
  // branch default, a "ship to a different customer" selection, or a
  // hand-typed edit of either) with no need for this template to know or
  // branch on which. Falls back to the selected branch's own address only
  // when shipTo is empty (a GRN saved before Branch was mandatory, or before
  // this field could be filled at all), then the company's own address.
  // shipTo taking priority over branchRecord (the reverse of this box's
  // original fallback order) is the fix that makes editing Ship To -- by
  // hand, or via "ship to a different customer" -- actually change what
  // prints; before, this box read branchRecord unconditionally whenever a
  // branch resolved (i.e. on every GRN, Branch being required), so shipTo's
  // own text never reached the page. In practice this is a no-op for every
  // GRN saved before this feature existed: their shipTo already holds
  // exactly the branch's own address (it was the only thing that could ever
  // auto-fill it), so shipTo-first reproduces the same lines byte for byte.
  // See the identical fix/comment on PurchaseInvoicePrintable.
  //
  // Name line: NOT parsed out of shipTo's own text (see the identical
  // reasoning on PurchaseInvoicePrintable) -- resolved instead from
  // order.shipToCustomer, the customer this GRN was explicitly saved as
  // shipping to, when "ship to a different customer" was used. Falls back to
  // the company + branch name exactly as before this feature existed when
  // shipToCustomer is blank (every pre-existing GRN, and any GRN left on the
  // ordinary branch-default path).
  const branchLines = branchAddressLines(branchRecord);
  const shipToLines = cleanAddressText(order.shipTo).split('\n').filter(Boolean);
  // Company name + branch code merged into the address box name line, e.g.
  // "KEMACH EQUIPMENTS PRIVATE LIMITED - BR001", so the branch is identified
  // right on the name line instead of as a separate line below the address.
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

  const poDate = order.poDate || poRecord?.poDate;

  const sheet = (
    <div className={AREA_CLASS}>
      <style>{buildStationeryCss({ areaClass: AREA_CLASS, printingClass: PRINTING_CLASS })}</style>
      {/* Purchase GRN only: the shared .po3-to-line/.po3-vendor-block rules
      (in purchaseStationery.jsx, used by every purchase document's print)
      show "To :" and the party name on one line, then indent the
      address/GST lines below to sit under where the name used to start.
      Scoped to this document's own AREA_CLASS so PO/Quotation/Return/Credit
      Memo keep their existing layout untouched — this puts the party name
      on its own line under "To :" and the address/GST lines flush left
      under it, all starting at the same left edge, on the Purchase GRN
      print only. Higher specificity than the shared rules (two classes vs.
      one) so these win regardless of <style> tag order. Same alignment fix
      already applied to Purchase Invoice's own print (see the matching
      comment on PurchaseInvoicePrintable.jsx) — per the request: "only
      change this alignment do not change others". */}
      <style>{`
        .${AREA_CLASS} .po3-to-line span { display: block; margin-bottom: 2px; }
        .${AREA_CLASS} .po3-vendor-block { padding-left: 0; }
      `}</style>
      <StationerySheet
        title="GOODS RECEIPT NOTE"
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
          { label: 'GRN No', value: order.grnNo },
          { label: 'GRN Date', value: fmtDate(order.receivedDate) },
          { label: 'PO No', value: order.poNo },
          { label: 'PO Date', value: fmtDate(poDate) },
          // Only printed when actually entered — omitted outright rather
          // than falling back to metaLeftRows' usual "—" placeholder.
          ...(order.vendorRefNo ? [{ label: 'Vendor Ref No', value: order.vendorRefNo }] : []),
        ]}
        metaRightRows={[
          { label: 'Place of Supply', value: order.placeOfSupply },
          { label: 'Transport Mode', value: order.transportMode },
          ...machineEngineRows,
        ]}
        commentsLabel="Comments :"
        commentsValue=""
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
