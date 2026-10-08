import React from 'react';
import { cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import { buildDocument, round2, isInterState, computeFreightGross } from '../../lib/documentTotals';
import {
  StationerySheet, makeScopedPrint, buildStationeryCss, wordsInr, fmtDate,
  formatPartnerAddressLines, defaultAddressOf, lineDisplay, displayTaxRows,
  buildHsnGroups, buildTaxColWidths, DEFAULT_GST_TYPE, JURISDICTION_CITY,
} from './purchaseStationery';
import { useIsActiveTab } from '../navigation/TabPathContext';

const AREA_CLASS = 'ret2-print-area';
const PRINTING_CLASS = 'ret2-printing';
const PAGE_RULE_ID = 'ret2-print-page-rule';

/**
 * Print THIS Purchase Return. Call instead of window.print() from the
 * Purchase Return page's own Print controls.
 */
export const printPurchaseReturn = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

/**
 * The live, data-driven Purchase Return print — visual twin of
 * PurchaseOrderPrintable (see purchaseStationery.js). A return has no Ship
 * To of its own (goods are going back out of a warehouse, not being
 * delivered) — the right-hand box shows the return's own Warehouse instead
 * of a delivery address. Only ever rendered inside a `.ret2-print-area`
 * wrapper that's invisible on screen and shown exclusively via the shared
 * @media print rules.
 */
export default function PurchaseReturnPrintable({ order, company, supplierRecord, branchRecord, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // Legacy documents saved before supplierState existed fall back to Place of Supply.
  const interState = isInterState(order.supplierState || order.placeOfSupply, company?.state);
  const { totals } = buildDocument(items, order.discountPercent, { interState, roundOff: true, quantityField: 'returnQuantity' });
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
  const totalQty = items.reduce((sum, it) => sum + (Number(it.returnQuantity) || 0), 0);
  const opts = { quantityField: 'returnQuantity', headerDiscPercent: order.discountPercent };

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

  // Billing Address box shows the plain company name, no branch code — the
  // company has no billing-branch concept of its own (this document's
  // "Branch *" field is the delivery/shipping branch only; see
  // PurchaseOrderPrintable.jsx's identical note).
  const billingDisplayLines = [cleanAddressText(company?.address).replace(/\n/g, ', ')].filter(Boolean);

  // Return's own `supplier` field stores the supplier CODE (see
  // PartyCodeSelect on PurchaseReturn.jsx), unlike PO/GRN/Invoice where it
  // stores the name — supplierRecord is matched by code by the page, and
  // the display name is order.supplierName / the matched record's own name.
  const supplierBillingAddr = defaultAddressOf(supplierRecord, 'Billing');
  const supplierAddrLines = formatPartnerAddressLines(supplierBillingAddr);
  const supplierGstNumber = supplierBillingAddr?.gstNumber || supplierRecord?.gstin || '—';
  const supplierGstType = supplierBillingAddr?.gstType || DEFAULT_GST_TYPE;
  const supplierDisplayName = order.supplierName || supplierRecord?.supplierName || order.supplier;

  const taxColWidths = buildTaxColWidths(interState, totals.tcsAmount > 0);

  const sheet = (
    <div className={AREA_CLASS}>
      <style>{buildStationeryCss({ areaClass: AREA_CLASS, printingClass: PRINTING_CLASS })}</style>
      <StationerySheet
        title="PURCHASE RETURN"
        headLabel="Supplier :"
        stackedHead
        partyName={supplierDisplayName}
        partyCode={supplierRecord?.supplierCode}
        partyAddrLines={supplierAddrLines}
        partyGstNo={supplierGstNumber}
        partyGstType={supplierGstType}
        companyLogoUrl={company?.logoUrl}
        companyLogoAlt={company?.companyName}
        partyLogoUrl={supplierRecord?.logoUrl}
        partyLogoAlt={supplierDisplayName}
        leftBoxLabel="Billing Address :"
        leftBoxName={companyName}
        leftBoxAddrLines={billingDisplayLines}
        leftBoxGstNo={company?.gstin}
        leftBoxGstType={DEFAULT_GST_TYPE}
        rightBoxLabel="Returned From (Warehouse) :"
        rightBoxName={order.warehouse}
        rightBoxAddrLines={[]}
        rightBoxGstNo={company?.gstin}
        rightBoxGstType={DEFAULT_GST_TYPE}
        metaLeftRows={[
          { label: 'Return No', value: order.returnNo },
          { label: 'Document Date', value: fmtDate(order.documentDate) },
          { label: 'Due Date', value: fmtDate(order.dueDate) },
          // Only printed when actually entered — omitted outright rather
          // than falling back to metaLeftRows' usual "—" placeholder.
          ...(order.vendorRefNo ? [{ label: 'Vendor Ref No', value: order.vendorRefNo }] : []),
        ]}
        metaRightRows={[
          { label: 'Bill/DO No', value: order.billDoNo },
          { label: 'Bill/DO Date', value: fmtDate(order.billDoDate) },
          { label: 'Payment Terms', value: order.paymentTerms },
          { label: 'Place of Supply', value: order.placeOfSupply },
        ]}
        commentsLabel="Reason :"
        commentsValue={order.reason || order.comments}
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
