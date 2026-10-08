import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Purchase >
// Purchase Order Register page — same pattern as the sales-side register
// reports (salesOrderRegisterReportApi.js). Query params drive the filter
// bar; the response already contains one row per PurchaseOrder plus
// precomputed stat totals. `source` is accepted for filter-bar parity but
// is a no-op on the backend — PurchaseOrder has no source column.
export const purchaseOrderRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPurchaseOrderRegisterReport: builder.query({
      query: ({ fromDate, toDate, supplier, status, source } = {}) => ({
        url: '/purchase/orders/register/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(supplier ? { supplier } : {}),
          ...(status ? { status } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'PurchaseOrder', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetPurchaseOrderRegisterReportQuery, useLazyGetPurchaseOrderRegisterReportQuery } = purchaseOrderRegisterReportApi;
