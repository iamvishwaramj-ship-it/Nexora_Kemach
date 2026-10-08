// Indian-system number to words ("Rupees Fifteen Thousand Two Hundred Fifty
// Only") — shared by the Cheque Print preview and document print templates.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${ONES[h]} Hundred` : ''}${h && rest ? ' ' : ''}${rest ? twoDigits(rest) : ''}`;
}

export function amountToWords(value) {
  const num = Math.floor(Math.abs(Number(value) || 0));
  const paise = Math.round((Math.abs(Number(value) || 0) - num) * 100);
  if (num === 0 && paise === 0) return '';
  const parts = [];
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  const rupees = parts.length ? `Rupees ${parts.join(' ')}` : 'Rupees Zero';
  return paise ? `${rupees} and ${twoDigits(paise)} Paise Only` : `${rupees} Only`;
}
