// One place that decides how an address reads, for every Sales and Purchase
// page and printable.
//
// Order:
//   Address Name, Street, Street No, Building/Floor/Room, Block,
//   City, State, Country, Zip Code
//
// Every field is optional and sparsely filled in practice, and some stored
// values carry their own stray trailing commas (e.g. "Ambalachal,"). Joining
// those naively produced "Ambalachal,, Kambalakkad PO,," on the printed
// sheet. So each part is cleaned (trimmed, leading/trailing commas removed,
// internal comma runs collapsed) and empty parts are dropped before joining —
// a missing field never leaves a double comma behind.

const cleanPart = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .replace(/\s*,(\s*,)+\s*/g, ', ')
  .replace(/\s+,/g, ',')
  .replace(/^[\s,]+|[\s,]+$/g, '');

export function joinAddressParts(parts, separator = ', ') {
  return (parts || []).map(cleanPart).filter(Boolean).join(separator);
}

// Cleans an already-composed (possibly stored, possibly multi-line) address
// string — used for text saved on older documents before this formatter
// existed, so their double commas disappear from pages and printables too.
export function cleanAddressText(text) {
  if (!text) return '';
  return String(text).split(/\r?\n/).map(cleanPart).filter(Boolean).join('\n');
}

// --- Business Partner address row ------------------------------------------
const partnerStreetParts = (a) => [a.addressName, a.street, a.streetNo, a.buildingFloorRoom, a.block];
const regionParts = (a, zip) => [a.city, a.state, a.country, zip];

export function formatPartnerAddress(addr) {
  if (!addr) return '';
  return joinAddressParts([...partnerStreetParts(addr), ...regionParts(addr, addr.zipCode)]);
}

// Same order, split into two printable lines (street part / region part).
export function partnerAddressLines(addr) {
  if (!addr) return [];
  return [
    joinAddressParts(partnerStreetParts(addr)),
    joinAddressParts(regionParts(addr, addr.zipCode)),
  ].filter(Boolean);
}

// --- Branch Master row ------------------------------------------------------
// Branch has no Address Name/Street columns; its free-text `address` takes
// that leading slot, followed by the same split fields in the same order.
const branchStreetParts = (b) => [b.address, b.streetNo, b.buildingFloorRoom, b.block];

export function formatBranchAddress(branch) {
  if (!branch) return '';
  return joinAddressParts([...branchStreetParts(branch), ...regionParts(branch, branch.zipCode)]);
}

export function branchAddressLinesOrdered(branch) {
  if (!branch) return [];
  return [
    joinAddressParts(branchStreetParts(branch)),
    joinAddressParts(regionParts(branch, branch.zipCode)),
  ].filter(Boolean);
}

// --- Company Details row (address, city, state, pincode, country) ----------
export function companyAddressLines(company) {
  if (!company) return [];
  return [
    cleanAddressText(company.address).replace(/\n/g, ', '),
    joinAddressParts(regionParts(company, company.pincode ?? company.zipCode)),
  ].filter(Boolean);
}

export function formatCompanyAddress(company) {
  return joinAddressParts(companyAddressLines(company));
}
