import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Sales >
// Product-wise Sales page — same pattern as customerWiseSalesReportApi.js.
// Query params drive the filter bar; the response already contains
// per-product summary rows plus chart-ready series (topProducts,
// categoryContribution, trend) and precomputed stat totals.
export const productWiseSalesReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProductWiseSalesReport: builder.query({
      query: ({ fromDate, toDate, product, category, salesPerson, source } = {}) => ({
        url: '/sales/invoices/product-wise/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(product ? { product } : {}),
          ...(category ? { category } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'PRODUCT_WISE_REPORT' }],
    }),
  }),
});

export const { useGetProductWiseSalesReportQuery, useLazyGetProductWiseSalesReportQuery } = productWiseSalesReportApi;
