import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory > Dead
// Stock page. Query params drive the filter bar; the response contains
// one row per dead-stock product (never sold, last purchased more than N
// days ago), precomputed stat totals, and four chart series. `branch`
// filters via WarehouseMaster.branch. `stockType` is still accepted for
// filter-bar parity but is a no-op on the backend — see the route comment
// in resources.js.
export const deadStockReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDeadStockReport: builder.query({
      query: ({ branch, warehouse, productGroup, itemCategory, stockType, deadStockBasedOn, daysThreshold, asOnDate } = {}) => ({
        url: '/inventory/dead-stock/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(itemCategory ? { itemCategory } : {}),
          ...(stockType ? { stockType } : {}),
          ...(deadStockBasedOn ? { deadStockBasedOn } : {}),
          ...(daysThreshold ? { daysThreshold } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'DEAD_STOCK_REPORT' }],
    }),
  }),
});

export const { useGetDeadStockReportQuery, useLazyGetDeadStockReportQuery } = deadStockReportApi;
