/**
 * Party State lookup for GST treatment.
 *
 * Every purchase document decides CGST/SGST vs IGST from the SUPPLIER's state,
 * every sales document from the CUSTOMER's state -- the state of the Business
 * Partner's default Billing address -- never from Place of Supply (which
 * tracks the branch / ship-to). The document forms send it already
 * (auto-filled, read-only); bulk imports and API callers that don't are
 * looked up here so every path agrees.
 *
 * NOTE: State is NOT a column on business_partners -- it only lives on each
 * row of its addresses.
 */

/** Same pick the forms make: default Billing address's state, else the first Billing's. */
function billingStateOf(partner) {
  const billing = (partner?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = billing.find((a) => a.isDefault) || billing[0];
  return String(chosen?.state || '').trim();
}

const PARTNER_STATE_SELECT = { addresses: { select: { addressType: true, isDefault: true, state: true } } };

/**
 * @param {object} client       Prisma client or transaction
 * @param {'Vendor'|'Customer'} partnerType
 * @param {*} givenState        the state the document itself carried, if any
 * @param {*} name              the party's name as stored on the document
 * @returns {Promise<string>}   '' when unknown -> treated as intra-state
 */
async function resolvePartnerState(client, partnerType, givenState, name) {
  const given = String(givenState || '').trim();
  if (given) return given;
  const partyName = String(name || '').trim();
  if (!partyName) return '';
  const bp = await client.businessPartner.findFirst({
    where: { partnerType, partnerName: partyName },
    select: PARTNER_STATE_SELECT,
  });
  return billingStateOf(bp);
}

const resolveSupplierState = (client, header) => resolvePartnerState(client, 'Vendor', header?.supplierState, header?.supplier);
const resolveCustomerState = (client, header) => resolvePartnerState(client, 'Customer', header?.customerState, header?.customer);

module.exports = { billingStateOf, PARTNER_STATE_SELECT, resolvePartnerState, resolveSupplierState, resolveCustomerState };
