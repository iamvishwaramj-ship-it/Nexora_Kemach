// Backend twin of frontend/src/lib/addressFormat.js — same order, same
// cleaning. Order: Address Name, Street, Street No, Building/Floor/Room,
// Block, City, State, Country, Zip Code. Empty fields are dropped and stray
// commas inside stored values are cleaned, so no double commas ever appear.

const cleanPart = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .replace(/\s*,(\s*,)+\s*/g, ', ')
  .replace(/\s+,/g, ',')
  .replace(/^[\s,]+|[\s,]+$/g, '');

function joinAddressParts(parts, separator = ', ') {
  return (parts || []).map(cleanPart).filter(Boolean).join(separator);
}

function cleanAddressText(text) {
  if (!text) return '';
  return String(text).split(/\r?\n/).map(cleanPart).filter(Boolean).join('\n');
}

const regionParts = (a, zip) => [a.city, a.state, a.country, zip];

function formatPartnerAddress(a) {
  if (!a) return '';
  return joinAddressParts([a.addressName, a.street, a.streetNo, a.buildingFloorRoom, a.block, ...regionParts(a, a.zipCode)]);
}

function branchAddressLines(b) {
  if (!b) return [];
  return [
    joinAddressParts([b.address, b.streetNo, b.buildingFloorRoom, b.block]),
    joinAddressParts(regionParts(b, b.zipCode)),
  ].filter(Boolean);
}

module.exports = { joinAddressParts, cleanAddressText, formatPartnerAddress, branchAddressLines };
