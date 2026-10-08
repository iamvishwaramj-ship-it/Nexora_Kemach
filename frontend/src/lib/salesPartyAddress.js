/**
 * Copy From / Copy To support for the Sales documents' Bill To / Ship To.
 *
 * A saved Sales document may carry a "different customer" Ship To
 * (shipToDifferentCustomer / shipToCustomer; the Bill To equivalent was
 * removed — Bill To now only picks among the main customer's own addresses) plus the GST Number, GST Type and PAN of the chosen address
 * (billToGstNo / billToGstType / billToPanNo and the shipTo* equivalents).
 *
 * When such a document is copied into the next one (Quotation -> Order ->
 * Challan -> Invoice, in either direction: Copy From or Copy To), the
 * target must keep exactly that address — NOT snap back to the customer's own
 * default. This writes both sides onto the target form:
 *   - source used a different customer for that side -> carry the flag, the
 *     customer, the address text and the GST / PAN snapshot across;
 *   - otherwise -> the main customer's own default address, with its GST / PAN.
 *
 * `source` is the document being copied (may lack these fields, e.g. a Sales
 * Enquiry or Sales Return — those simply resolve to the default branch).
 */
const SIDES = [
  {
    flag: 'billToDifferentCustomer', customer: 'billToCustomer', address: 'billingAddress',
    gst: 'billToGstNo', gstType: 'billToGstType', pan: 'billToPanNo', type: 'Billing', other: 'Shipping',
  },
  {
    flag: 'shipToDifferentCustomer', customer: 'shipToCustomer', address: 'shippingAddress',
    gst: 'shipToGstNo', gstType: 'shipToGstType', pan: 'shipToPanNo', type: 'Shipping', other: 'Billing',
  },
];

export function applySalesPartyAddresses(setValue, source, customerRecord, addressFor) {
  SIDES.forEach((S) => {
    // Bill To no longer supports "a different customer": it always belongs to
    // the main customer. A non-default Billing address the source had chosen
    // (same customer) is still carried across, with its GST / PAN snapshot.
    if (S.flag === 'billToDifferentCustomer') {
      setValue(S.flag, false);
      setValue(S.customer, '');
      const sameCustomer = !!(source && !source[S.flag] && source[S.address]
        && customerRecord && source.customer === customerRecord.customerName);
      if (sameCustomer) {
        setValue(S.address, source[S.address], { shouldValidate: true });
        setValue(S.gst, source[S.gst] || '');
        setValue(S.gstType, source[S.gstType] || '');
        setValue(S.pan, source[S.pan] || '');
        return;
      }
    }
    const different = S.flag !== 'billToDifferentCustomer' && !!(source && source[S.flag] && source[S.customer]);
    if (different) {
      setValue(S.flag, true);
      setValue(S.customer, source[S.customer] || '', { shouldValidate: true });
      setValue(S.address, source[S.address] || '', { shouldValidate: true });
      setValue(S.gst, source[S.gst] || '');
      setValue(S.gstType, source[S.gstType] || '');
      setValue(S.pan, source[S.pan] || '');
      return;
    }
    const rows = (t) => (customerRecord?.addresses || []).filter((a) => a.addressType === t);
    const pick = (t) => rows(t).find((a) => a.isDefault) || rows(t)[0] || null;
    const addr = pick(S.type) || pick(S.other);
    setValue(S.flag, false);
    setValue(S.customer, '');
    setValue(S.address, addressFor(customerRecord, S.type), { shouldValidate: true });
    setValue(S.gst, (addr?.gstNumber || '').trim());
    setValue(S.gstType, addr?.gstType || '');
    setValue(S.pan, (addr?.panNo || '').trim().toUpperCase());
  });
}
