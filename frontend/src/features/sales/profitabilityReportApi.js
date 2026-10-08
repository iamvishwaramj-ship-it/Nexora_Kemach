import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Sales >
// Profitability Analysis page — same pattern as the other sales report
// APIs in this folder. Query params drive the filter bar; the response
// contains the Profitability Details rows (keyed by `basis`), Top-5
// Customer/Product panels, a daily profit trend, and precomputed stats.
export const profitabilityReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfitabilityReport: builder.query({
      query: ({ fromDate, toDate, basis, customer, product, salesPerson } = {}) => ({
        url: '/sales/invoices/profitability/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(basis ? { basis } : {}),
          ...(customer ? { customer } : {}),
          ...(product ? { product } : {}),
          ...(salesPerson ? { salesPerson } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'PROFITABILITY_REPORT' }],
    }),
  }),
});

export const { useGetProfitabilityReportQuery, useLazyGetProfitabilityReportQuery } = profitabilityReportApi;
