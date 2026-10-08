// Country / State / City reference data for address-style forms.
// Always sourced from the `country-state-city` npm package — never hand-roll
// or hardcode country/state/city lists. See tempmem.md.
//
// getCityOptions deliberately does NOT live here: `City` drags in
// country-state-city's ~150,000-row city.json, which builds into an 8.6 MB
// chunk (10x the rest of the app’s vendor bundle put together), and three of
// the nine pages that use this module — SalesInvoice, PurchaseInvoice and
// PurchaseGRN — only ever need the states list. It lives in the sibling
// ./locationsCities module instead, so only the six pages that actually have
// a City dropdown pull that dataset in. The package ships an ESM build
// ("module": "./lib/index.js") and declares "sideEffects": false, and
// lib/state.js does not import lib/city.js, so Rollup can drop city.json
// entirely from this module's graph.
import { Country, State } from 'country-state-city';

// Options keep `value` as the human-readable name (what we store on the
// record — companyDetails.country, branch.state, etc.) while `isoCode` is
// kept around internally to look up child regions (state -> city).
export const countries = Country.getAllCountries().map((c) => ({
  label: c.name,
  value: c.name,
  isoCode: c.isoCode,
}));

const countryIsoByName = Object.fromEntries(countries.map((c) => [c.value, c.isoCode]));

// Exported for ./locationsCities, which needs a country’s ISO code to look
// up its cities but must not import `City` from here — see the note on the
// import above.
export function getCountryIsoCode(countryName) {
  return countryIsoByName[countryName];
}

// getStateOptions delegates to country-state-city, whose getStatesOfCountry
// does a filter + sort over the whole global state dataset (~5k rows) on
// every call. Pages call it directly in render with a value that comes from
// watch(), so an uncached call meant that filter + sort ran on every
// keystroke. The result is a pure function of the argument and the dataset is
// static for the life of the tab, so the first call per country is the only
// one that pays. No caller mutates the returned array (checked: every
// consumer only map/find/filters it), so handing back the same array
// reference is safe — and it also lets MUI’s Select/Autocomplete
// memoization actually hold.
const stateOptionsCache = new Map();

export function getStateOptions(countryName) {
  if (stateOptionsCache.has(countryName)) return stateOptionsCache.get(countryName);
  const countryIso = countryIsoByName[countryName];
  const options = countryIso
    ? State.getStatesOfCountry(countryIso).map((s) => ({
      label: s.name,
      value: s.name,
      isoCode: s.isoCode,
    }))
    : [];
  stateOptionsCache.set(countryName, options);
  return options;
}
