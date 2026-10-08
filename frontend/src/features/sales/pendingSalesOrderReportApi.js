import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Sales > Pending
// Sales Order page — same pattern as salesOrderRegisterReportApi.js. Query
// params drive the filter bar; the response already contains one row per
// outstanding order (delivered/pending amounts, an aging status bucket,
// days pending) plus precomputed stat totals.
export const pendingSalesOrderReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPendingSalesOrderReport: builder.query({
      query: ({ fromDate, toDate, customer, salesPerson, status, source } = {}) => ({
        url: '/sales/orders/pending/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(customer ? { customer } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(status ? { status } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesOrder', id: 'PENDING_REPORT' }],
    }),
  }),
});

export const { useGetPendingSalesOrderReportQuery, useLazyGetPendingSalesOrderReportQuery } = pendingSalesOrderReportApi;
