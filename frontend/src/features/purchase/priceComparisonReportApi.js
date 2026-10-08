import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Purchase > Price
// Comparison page — same pattern as the other purchase report APIs in
// this folder. Query params drive the filter bar; the response contains
// one row per (quotation, item) quote line, precomputed stat totals, and
// three chart series. `branch` filters against PurchaseQuotation.branch
// server-side.
export const priceComparisonReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPriceComparisonReport: builder.query({
      query: ({ fromDate, toDate, productGroup, product, supplier, branch } = {}) => ({
        url: '/purchase/quotations/price-comparison/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(product ? { product } : {}),
          ...(supplier ? { supplier } : {}),
          ...(branch ? { branch } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'PurchaseQuotation', id: 'PRICE_COMPARISON_REPORT' }],
    }),
  }),
});

export const { useGetPriceComparisonReportQuery, useLazyGetPriceComparisonReportQuery } = priceComparisonReportApi;
