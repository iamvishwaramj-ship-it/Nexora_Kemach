import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory >
// Reorder Level page. Query params drive the filter bar; the response
// contains one row per monitored product (scoped by reorderStatus, default
// "Below Reorder Level"), precomputed stat totals, and four chart series.
// `branch` filters via WarehouseMaster.branch — see the route comment in
// resources.js.
export const reorderLevelReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReorderLevelReport: builder.query({
      query: ({ branch, warehouse, productGroup, itemCategory, reorderStatus, asOnDate } = {}) => ({
        url: '/inventory/reorder-level/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(itemCategory ? { itemCategory } : {}),
          ...(reorderStatus ? { reorderStatus } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'REORDER_LEVEL_REPORT' }],
    }),
  }),
});

export const { useGetReorderLevelReportQuery, useLazyGetReorderLevelReportQuery } = reorderLevelReportApi;
