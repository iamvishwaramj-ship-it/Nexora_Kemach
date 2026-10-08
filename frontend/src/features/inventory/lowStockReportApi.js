import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory > Low
// Stock Report page. Query params drive the filter bar; the response
// contains one row per low-stock product (on-hand qty, reorder/min-stock
// thresholds, shortage qty, stock value, last purchase date), precomputed
// stat totals, and four chart series. `branch` filters via
// WarehouseMaster.branch.
export const lowStockReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLowStockReport: builder.query({
      query: ({ branch, warehouse, productGroup, itemCategory, lowStockBasedOn, showItems, asOnDate } = {}) => ({
        url: '/inventory/low-stock/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(itemCategory ? { itemCategory } : {}),
          ...(lowStockBasedOn ? { lowStockBasedOn } : {}),
          ...(showItems ? { showItems } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'LOW_STOCK_REPORT' }],
    }),
  }),
});

export const { useGetLowStockReportQuery, useLazyGetLowStockReportQuery } = lowStockReportApi;
