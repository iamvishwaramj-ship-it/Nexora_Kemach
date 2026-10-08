import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory > Slow
// Moving Stock page. Query params drive the filter bar; the response
// contains one row per slow-moving product (on-hand qty, last sale/
// purchase date, days in stock, stock value), precomputed stat totals,
// and four chart series. `branch` filters via WarehouseMaster.branch.
// `stockType` is still accepted for filter-bar parity but is a no-op on
// the backend — see the route comment in resources.js.
export const slowMovingStockReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSlowMovingStockReport: builder.query({
      query: ({ branch, warehouse, productGroup, itemCategory, stockType, slowMovingBasedOn, daysThreshold, asOnDate } = {}) => ({
        url: '/inventory/slow-moving/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(itemCategory ? { itemCategory } : {}),
          ...(stockType ? { stockType } : {}),
          ...(slowMovingBasedOn ? { slowMovingBasedOn } : {}),
          ...(daysThreshold ? { daysThreshold } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'SLOW_MOVING_REPORT' }],
    }),
  }),
});

export const { useGetSlowMovingStockReportQuery, useLazyGetSlowMovingStockReportQuery } = slowMovingStockReportApi;
