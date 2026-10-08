import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Purchase >
// Pending Purchase Order page — same pattern as the other purchase report
// APIs in this folder. Query params drive the filter bar; the response
// contains one row per still-outstanding PurchaseOrder plus precomputed
// stats and three chart series (topSuppliers, buyingGroupContribution,
// expectedDateBuckets). `source` is accepted for filter-bar parity but is
// a no-op — PurchaseOrder has no source column.
export const pendingPurchaseOrderReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPendingPurchaseOrderReport: builder.query({
      query: ({ supplier, fromExpectedDate, toExpectedDate, buyingGroup, source } = {}) => ({
        url: '/purchase/orders/pending/report',
        params: {
          ...(supplier ? { supplier } : {}),
          ...(fromExpectedDate ? { fromExpectedDate } : {}),
          ...(toExpectedDate ? { toExpectedDate } : {}),
          ...(buyingGroup ? { buyingGroup } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'PurchaseOrder', id: 'PENDING_REPORT' }],
    }),
  }),
});

export const { useGetPendingPurchaseOrderReportQuery, useLazyGetPendingPurchaseOrderReportQuery } = pendingPurchaseOrderReportApi;
