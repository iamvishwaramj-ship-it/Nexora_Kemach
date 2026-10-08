// City reference data for address-style forms, split out of ./locations.
//
// `City` is the one import in the country-state-city package that pulls its
// ~150,000-row city.json (an 8.6 MB build chunk — 10x the rest of the app's
// vendor bundle put together). Three of the nine pages that need location
// data — SalesInvoice, PurchaseInvoice and PurchaseGRN — only ever render a
// state dropdown, so keeping this in its own module means they no longer
// carry the city dataset. getCityOptions is unchanged and still synchronous:
// nothing about the six City dropdowns behaves differently, only which
// chunk the data lands in.
import { State, City } from 'country-state-city';
import { getCountryIsoCode } from './locations';

// City.getCitiesOfState does a filter + sort over that entire 150,000-row
// dataset on every call, and the six pages below call getCityOptions
// directly in render with values that come from watch() — so uncached, a
// 150,000-element filter + sort ran on every keystroke. The result is a pure
// function of the arguments and the dataset is static for the life of the
// tab, so the first call per (country, state) pair is the only one that
// pays. No caller mutates the returned array (checked: every consumer only
// map/find/filters it), so handing back the same array reference is safe.
const cityOptionsCache = new Map();

// U+0001 cannot appear in a country or state name, so it is an unambiguous
// separator for the composite cache key.
const cityCacheKey = (countryName, stateName) => `${countryName}\u0001${stateName}`;

export function getCityOptions(countryName, stateName) {
  const key = cityCacheKey(countryName, stateName);
  if (cityOptionsCache.has(key)) return cityOptionsCache.get(key);
  const countryIso = getCountryIsoCode(countryName);
  const state = countryIso
    ? State.getStatesOfCountry(countryIso).find((s) => s.name === stateName)
    : undefined;
  const options = state
    ? City.getCitiesOfState(countryIso, state.isoCode).map((c) => ({
      label: c.name,
      value: c.name,
    }))
    : [];
  cityOptionsCache.set(key, options);
  return options;
}
