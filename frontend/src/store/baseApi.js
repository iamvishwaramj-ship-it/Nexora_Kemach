import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';
import { accessTokenRefreshed, loggedOut } from './authSlice';
// Only ever read inside a function body below (never at module-eval time) --
// store.js imports baseApi.js to register its reducer/middleware, so this is
// a circular import that's safe exactly because of that deferral: by the
// time ensureFreshAccessToken() actually runs, both modules have long since
// finished initialising.
import { store } from './store';

// Exported so a handful of call sites that can't go through RTK Query (a
// plain <a>/window.open() download, or a component like BulkImportDialog
// that has to build its own fetch to a URL its caller only hands it as a
// string) can still resolve the same API origin instead of hardcoding it.
//
// Two names are accepted, in priority order, because the deployments don't
// agree on one. This read VITE_API_URL alone, while the Kemach_India
// pipeline exports VITE_API_BASE_URL to the build — so that build produced a
// bundle with no API URL at all, fell through to the localhost default
// below, and every request from the deployed site went to
// http://localhost:5001. The browser reported that as a CORS failure, which
// is misleading: localhost means the VISITOR'S machine, so no
// Access-Control-Allow-Origin header could ever have fixed it.
//
// Accepting both is deliberately additive rather than renaming one side:
// VITE_API_URL is still checked first, so any deployment already setting it
// keeps its exact current behaviour, and no pipeline YAML has to change. An
// undefined variable in an Azure Pipelines `env:` block expands to the
// literal string "$(NAME)" rather than to nothing, so renaming in the YAML
// risked feeding a working deployment a garbage URL.
//
// Trailing slashes are stripped because every consumer concatenates onto
// this (`${BASE_URL}/api` just below, and the download call sites noted
// above), so a value typed with one — which is what hand-entering a URL into
// a pipeline variable invites — would yield "https://host//api", a 404 that
// looks nothing like its cause.
export const BASE_URL = (
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || 'http://localhost:5001'
).replace(/\/+$/, '');

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${BASE_URL}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const mutex = new Mutex();

// Decodes a JWT's payload without verifying the signature (verification is
// the server's job) just to read `exp`. Never throws -- a malformed/missing
// token just looks "expired" so the normal 401+refresh path handles it.
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    if (!exp) return false;
    // 5s skew so we refresh slightly ahead of the real expiry instead of
    // racing it -- avoids firing a request we already know will 401.
    return Date.now() >= exp * 1000 - 5000;
  } catch {
    return true;
  }
}

// A handful of call sites (BulkImportDialog, ImportItemsDialog) can't go
// through an injected RTK Query endpoint -- they build their own
// authenticated `fetch` to a URL their caller only hands them as a string
// (an upload endpoint, a template download). Those raw fetches never went
// through baseQueryWithReauth below, so they never got its proactive-refresh
// treatment: a user who spent more than the access token's lifetime (15
// minutes by default) filling in/reviewing an import sheet would have the
// upload itself go out on an already-expired token, 401 with "Token
// expired", and have no recovery path at all (no retry, no redirect to
// login) -- unlike every other screen in the app, which silently refreshes
// and the user never notices.
//
// Call this immediately before building such a fetch's Authorization header
// and use the token it returns (not whatever you read from Redux earlier) --
// it refreshes first if the current token is already expired or about to be,
// same as baseQueryWithReauth's own proactive check, sharing the same mutex
// so a refresh already in flight (triggered by some other RTK Query call)
// is awaited instead of duplicated.
export async function ensureFreshAccessToken() {
  const { accessToken, refreshToken } = store.getState().auth;
  if (!accessToken || !refreshToken) return accessToken || null;
  if (!isTokenExpired(accessToken)) return accessToken;

  if (mutex.isLocked()) {
    await mutex.waitForUnlock();
    return store.getState().auth.accessToken;
  }

  const release = await mutex.acquire();
  try {
    const refreshResult = await rawBaseQuery(
      { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
      { getState: store.getState, dispatch: store.dispatch },
      {}
    );
    if (refreshResult.data?.accessToken) {
      store.dispatch(accessTokenRefreshed({ accessToken: refreshResult.data.accessToken }));
      return refreshResult.data.accessToken;
    }
    store.dispatch(loggedOut());
    return null;
  } finally {
    release();
  }
}

// Single source of truth for every network call in the app — RTK Query.
// Never hand-roll fetch/axios calls inside components; inject endpoints
// onto this baseApi per domain (see features/<domain>/<domain>Api.js).
const baseQueryWithReauth = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();

  // Proactively refresh an already-expired access token *before* firing the
  // request. Without this, every call made right after the token lapses
  // (e.g. the auth/me + company/details calls that fire on Dashboard mount)
  // hits the API, gets a 401, and only *then* refreshes and retries -- which
  // works, but spams the console with 401s for a failure we could see coming.
  const { accessToken, refreshToken } = api.getState().auth;
  if (accessToken && refreshToken && isTokenExpired(accessToken)) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshResult = await rawBaseQuery(
          { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
          api,
          extraOptions
        );
        if (refreshResult.data?.accessToken) {
          api.dispatch(accessTokenRefreshed({ accessToken: refreshResult.data.accessToken }));
        } else {
          api.dispatch(loggedOut());
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
    }
  }

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshToken = api.getState().auth.refreshToken;
        if (refreshToken) {
          const refreshResult = await rawBaseQuery(
            { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
            api,
            extraOptions
          );
          if (refreshResult.data?.accessToken) {
            api.dispatch(accessTokenRefreshed({ accessToken: refreshResult.data.accessToken }));
            result = await rawBaseQuery(args, api, extraOptions);
          } else {
            api.dispatch(loggedOut());
          }
        } else {
          api.dispatch(loggedOut());
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  // Every tag a resource uses must be declared here. RTK Query silently
  // ignores an undeclared tag — no warning in production — so a resource
  // whose type is missing from this list still *provides* and *invalidates*
  // as far as the calling code is concerned, but nothing ever refetches.
  // SalesPrice, CustomerDiscount, Transport, AppUser, Enquiry and FollowUp
  // were all in that state: creating, editing or deleting one left its list
  // showing the pre-change data until a hard reload.
  tagTypes: [
    'Health', 'Me',
    'Company', 'Branch', 'FinancialYear', 'TaxCode', 'DocumentNumbering',
    'BankName', 'HouseBank', 'SalesEmployee', 'ApprovalFlow',
    'AccountGroup', 'AccountType', 'ChartOfAccount', 'GlAccountDetermination',
    // JournalEntry was in exactly the same missing-tag state as the ones
    // documented below: createCrudApi({ tagType: 'JournalEntry', ... })
    // declares it, but it was never listed here, so posting/editing a
    // journal entry left its own list showing the pre-change data until a
    // hard reload.
    'JournalEntry',
    'ProductGroup', 'ProductSubGroup', 'Brand', 'Uom', 'Product',
    // Currency, HsnMaster, InvoiceType and PriceList: same missing-tag bug —
    // each has a createCrudApi() call with this exact tagType, just never
    // added to this array.
    'Currency', 'HsnMaster', 'InvoiceType', 'PriceList',
    'PurchasePrice', 'SalesPrice', 'CustomerDiscount',
    'Customer', 'Supplier', 'Transport', 'Warehouse', 'Location', 'AppUser',
    // BusinessPartner: same bug — the resource that replaced the retired
    // Customer/Supplier masters was never added here either.
    'BusinessPartner',
    'WarehouseMaster', 'LocationMaster', 'DepartmentMaster', 'OpeningBalance',
    'PurchaseQuotation', 'PurchaseOrder', 'GoodsReceivedNote', 'PurchaseInvoice',
    'SalesQuotation', 'SalesOrder', 'DeliveryChallan', 'SalesInvoice',
    // Returns and credit memos were in exactly the state described above:
    // createCrudApi declares these four tag types, but they were never listed
    // here, so saving or deleting one left its own list stale until a reload.
    'SalesReturn', 'SalesCreditMemo', 'PurchaseReturn', 'PurchaseCreditMemo',
    'Enquiry', 'FollowUp',
    'StockReceipt', 'StockIssue', 'StockAdjustment', 'StockTransfer',
    // StockTransferRequest/StockTransferReceipt: the newest two documents in
    // this module, added along with the rest of Stock Transfer — same
    // missing-tag bug as everything else called out above.
    'StockTransferRequest', 'StockTransferReceipt',
    'CustomerOutstanding', 'Collection', 'SupplierOutstanding', 'SupplierPayment',
    'BankDeposit', 'BankReconciliation', 'Cheque', 'PaymentReceipt', 'PaymentVoucher',
    'Dashboard',
    // Notification bell feature.
    'Notification',
    // Settings > "E-Invoice / E-Way Bill Settings" card.
    'EInvoiceSettings',
  ],
  endpoints: () => ({}),
});
