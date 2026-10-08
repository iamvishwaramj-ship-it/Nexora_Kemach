import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory >
// Available Balance page (Phase 1: core table + KPIs). One row per
// (item, warehouse) — see the route comment in resources.js for why
// warehouse is its own grouping dimension here, unlike Stock Summary.
// `branch` is accepted for filter-bar parity but is a no-op on rows that
// have no Branch recorded on their Stock journal entries — see the route.
export const availableBalanceReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAvailableBalanceReport: builder.query({
      query: ({ branch, warehouse, productGroup, product, itemCategory, balanceStatus, asOnDate } = {}) => ({
        url: '/inventory/available-balance/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(product ? { product } : {}),
          ...(itemCategory ? { itemCategory } : {}),
          ...(balanceStatus ? { balanceStatus } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'AVAILABLE_BALANCE_REPORT' }],
    }),

    // Drill-down for one (item, warehouse) row --- the individual Stock
    // ledger entries behind its On-Hand Qty, oldest first with a running
    // balance. `warehouse` is optional (omitted = all warehouses, used by
    // Stock Summary). `asOnDate`/`branch` are passed through so the drill-down
    // matches the same cutoff and scope the parent report row was computed
    // under, rather than showing today's full history for a row the user
    // filtered to an earlier date.
    getAvailableBalanceStockLedger: builder.query({
      query: ({ productCode, warehouse, branch, asOnDate } = {}) => ({
        url: '/inventory/available-balance/stock-ledger',
        params: {
          productCode,
          ...(warehouse ? { warehouse } : {}),
          ...(branch ? { branch } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'AVAILABLE_BALANCE_STOCK_LEDGER' }],
    }),
  }),
});

export const {
  useGetAvailableBalanceReportQuery, useLazyGetAvailableBalanceReportQuery,
  useGetAvailableBalanceStockLedgerQuery,
} = availableBalanceReportApi;
