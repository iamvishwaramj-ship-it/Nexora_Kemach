import { useMemo } from 'react';
import { useGetActivePriceListRatesQuery } from '../features/resources';

/**
 * Auto-fill source for the Unit Price column's fresh product-selection path
 * (see each form's ProductCell): fetches the Active DLP/CLP price list with
 * the latest effective date once per form mount, and hands back a plain
 * Map<productCode, price> so ProductCell can do a synchronous `.get(code)`
 * lookup instead of juggling query state itself.
 *
 * type: 'DLP' (Purchase forms) | 'CLP' (Sales forms). Pass a falsy value to
 * skip the fetch entirely (e.g. a form still deciding its type).
 *
 * When there is no Active price list of that type (404) or the endpoint
 * errors, `rates` comes back as an empty Map — callers fall back to
 * Product.unitPrice, then 0, same as the "no price list" case.
 */
export default function usePriceListRates(type, { alwaysRefetch = false } = {}) {
  const { data, isLoading, isFetching, error } = useGetActivePriceListRatesQuery(type, {
    skip: !type,
    // The rates only need to be current as of when the form was opened —
    // re-fetching mid-edit would change what the field autofills to under
    // the user while they're still on the page.
    refetchOnMountOrArgChange: alwaysRefetch,
  });

  const listName = data?.data?.priceListName || '';
  const effectiveDate = data?.data?.effectiveDate ? String(data.data.effectiveDate).slice(0, 10) : '';

  const rates = useMemo(() => {
    const map = new Map();
    const source = data?.data?.rates;
    if (source) {
      Object.entries(source).forEach(([productCode, price]) => {
        map.set(productCode, Number(price));
        // Also keyed trimmed + upper-cased so a stray space / case
        // difference between the price list line and Product Master's code
        // can't make the lookup miss.
        const norm = String(productCode).trim().toUpperCase();
        if (!map.has(norm)) map.set(norm, Number(price));
      });
    }
    return map;
  }, [data]);

  return { rates, isLoading: isLoading || isFetching, error, listName, effectiveDate };
}

/**
 * Human-readable reason an item got no price from the price list — shown as
 * a warning when Unit Price falls back to Product Master, so a missing DLP
 * price is explained on screen instead of silently becoming 0.
 */
export function dlpMissMessage(info, productCode, label = 'DLP') {
  if (info?.isLoading) return `The ${label} price list is still loading — Unit Price for ${productCode} was taken from Product Master.`;
  if (info?.error) {
    const status = info.error.status;
    return status === 404
      ? `No Active ${label} price list found. In Price List, set a list's Type to ${label} and Status to Active. Unit Price for ${productCode} was taken from Product Master.`
      : `Could not load the ${label} price list (${status || 'network error'}). Unit Price for ${productCode} was taken from Product Master.`;
  }
  return `Item ${productCode} is not in the Active ${label} price list "${info?.listName || ''}" (effective ${info?.effectiveDate || '—'}), the newest-dated one. Unit Price was taken from Product Master.`;
}
