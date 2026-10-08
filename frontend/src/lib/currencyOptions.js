import { useMemo } from 'react';
import { currencyApi } from '../features/resources';

/**
 * Every currency dropdown in the app reads live from Currency Master (Product
 * Setup > Currency Master — see the CurrencyMaster model doc comment in
 * schema.prisma) instead of a hardcoded list. This replaces the old
 * hardcoded CURRENCY_OPTIONS constants (accountingSchemas.js,
 * partnerSchemas.js) and the page-local hardcoded currency arrays that used
 * to duplicate the same four values everywhere.
 *
 * Options come back in the same {label, value} shape those hardcoded lists
 * used — value is the currency CODE ('INR', 'USD', ...), never the name or a
 * combined string — so every field that already stores a code on a saved
 * document keeps resolving without a data migration. Inactive currencies are
 * left out of the offered list (same convention as filterProductsFor in
 * productUsage.js) but are not scrubbed from anywhere they are already saved.
 */
export function useCurrencyOptions() {
  const { data } = currencyApi.useList();
  return useMemo(() => (
    (data || [])
      .filter((c) => c?.isActive !== false)
      .map((c) => ({ label: `${c.currencyCode} - ${c.currencyName}`, value: c.currencyCode }))
  ), [data]);
}

/**
 * Business Partner's Currency field additionally offers "All" (no currency
 * restriction) alongside every currency useCurrencyOptions lists — mirrors
 * the old BP_CURRENCY_OPTIONS export, kept as a separate hook (rather than a
 * flag on useCurrencyOptions) for the same reason BP_CURRENCY_OPTIONS was
 * kept as a separate constant: only Business Partner's Currency field needs
 * the "All" choice, every other currency picker in the app must not offer it.
 */
export function useBpCurrencyOptions() {
  const base = useCurrencyOptions();
  return useMemo(() => ([{ label: 'All', value: 'All' }, ...base]), [base]);
}
