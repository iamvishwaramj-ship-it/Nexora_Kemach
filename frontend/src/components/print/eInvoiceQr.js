// Renders the TaxPro GSP "SignedQRCode" e-invoice QR (SalesInvoice.qrCode --
// the raw signed-string payload the government's IRP returns, NOT an
// uploaded image the way a house bank's QR is) as an actual scannable QR
// code, for the printable/PDF stationery.
//
// Deliberately synchronous, using qrcode's create() (a pure bitmap
// generator) rather than its async toDataURL()/toString() helpers: the
// printable is captured into a PDF via html2canvas the moment the user
// clicks Print/WhatsApp (see purchaseStationery.jsx's makeScopedCapture),
// with no guaranteed delay for an async image to have finished loading
// first. A synchronous bitmap -> inline <svg><path> means the QR is already
// fully rendered in the same paint as everything else on the page, exactly
// like any other piece of text -- no race, no missing QR on a fast click.
//
// One <path> combining every dark module (rather than one <rect> per
// module) keeps this a single DOM node regardless of the QR's version --
// the signed QR string easily runs to 1000+ characters, which needs a
// higher-version/higher-density QR than a plain URL would.
import QRCode from 'qrcode';

/**
 * @param {string} text the raw signed QR payload (order.qrCode)
 * @returns {{ path: string, size: number } | null} `size` is the QR's
 *   module count per side -- the caller sets `viewBox="0 0 {size} {size}"`
 *   on its <svg> so `path` (drawn in 1-module units) scales correctly.
 *   null when there's nothing to encode, or the text is too long/invalid
 *   for any QR version (print blank rather than throwing).
 */
export function buildQrPath(text) {
  const value = (text || '').trim();
  if (!value) return null;

  let qr;
  try {
    qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  } catch (err) {
    return null;
  }

  const { size } = qr.modules;
  let d = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.get(row, col)) {
        d += `M${col} ${row}h1v1h-1z`;
      }
    }
  }
  return { path: d, size };
}
