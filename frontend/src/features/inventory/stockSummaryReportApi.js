import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory >
// Stock Summary page. Query params drive the filter bar; the response
// contains one row per product (opening/inward/outward/closing qty and
// value, as of the given date), precomputed stat totals, and four chart
// series. `branch` now filters for real (Stock's own Branch column);
// `stockType` is still accepted for filter-bar parity but stays a no-op on
// the backend — see the route comment in resources.js.
export const stockSummaryReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStockSummaryReport: builder.query({
      query: ({ branch, warehouse, productGroup, product, itemCategory, stockType, stockStatus, asOnDate } = {}) => ({
        url: '/inventory/stock-summary/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(product ? { product } : {}),
          ...(itemCategory ? { itemCategory } : {}),
          ...(stockType ? { stockType } : {}),
          ...(stockStatus ? { stockStatus } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'STOCK_SUMMARY_REPORT' }],
    }),
  }),
});

export const { useGetStockSummaryReportQuery, useLazyGetStockSummaryReportQuery } = stockSummaryReportApi;
