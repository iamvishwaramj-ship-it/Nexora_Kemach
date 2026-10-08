import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Sales >
// Salesman-wise Sales page — same pattern as customerWiseSalesReportApi.js
// and productWiseSalesReportApi.js. Query params drive the filter bar; the
// response already contains per-salesperson summary rows plus chart-ready
// series (topSalespersons, contribution, trend) and precomputed stat totals.
export const salesmanWiseSalesReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalesmanWiseSalesReport: builder.query({
      query: ({ fromDate, toDate, salesPerson, customer, documentType, source } = {}) => ({
        url: '/sales/invoices/salesman-wise/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(customer ? { customer } : {}),
          // documentType is currently a filter-bar-only field (no-op on the
          // backend) — see the route comment in resources.js.
          ...(documentType ? { documentType } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'SALESMAN_WISE_REPORT' }],
    }),
  }),
});

export const { useGetSalesmanWiseSalesReportQuery, useLazyGetSalesmanWiseSalesReportQuery } = salesmanWiseSalesReportApi;
