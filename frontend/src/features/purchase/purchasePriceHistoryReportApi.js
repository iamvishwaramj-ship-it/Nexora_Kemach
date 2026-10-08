import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Purchase > Price
// History page — same pattern as the other purchase report APIs in this
// folder. Unlike the others, `product` is required: with no product
// selected the backend returns an empty shape rather than querying
// anything. `branch` filters against the parent PurchaseInvoice /
// GoodsReceivedNote header's branch column server-side.
export const purchasePriceHistoryReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPurchasePriceHistoryReport: builder.query({
      query: ({ product, supplier, branch, fromDate, toDate, historyView } = {}) => ({
        url: '/purchase/products/price-history/report',
        params: {
          ...(product ? { product } : {}),
          ...(supplier ? { supplier } : {}),
          ...(branch ? { branch } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(historyView ? { historyView } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'PRICE_HISTORY_REPORT' }],
    }),
  }),
});

export const { useGetPurchasePriceHistoryReportQuery, useLazyGetPurchasePriceHistoryReportQuery } = purchasePriceHistoryReportApi;
