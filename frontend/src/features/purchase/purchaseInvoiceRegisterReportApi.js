import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Purchase >
// Purchase Invoice Register page — same pattern as
// purchaseOrderRegisterReportApi.js. Query params drive the filter bar;
// the response contains one row per PurchaseInvoice, precomputed stat
// totals, a Paid/Unpaid/Partial amount breakdown, and a SupplierOutstanding
// -based aging bucket summary. `source` is accepted for filter-bar parity
// but is a no-op on the backend — PurchaseInvoice has no source column.
export const purchaseInvoiceRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPurchaseInvoiceRegisterReport: builder.query({
      query: ({ fromDate, toDate, supplier, status, source } = {}) => ({
        url: '/purchase/invoices/register/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(supplier ? { supplier } : {}),
          ...(status ? { status } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'PurchaseInvoice', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetPurchaseInvoiceRegisterReportQuery, useLazyGetPurchaseInvoiceRegisterReportQuery } = purchaseInvoiceRegisterReportApi;
