import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Purchase >
// Vendor-wise Purchase page — doesn't fit the generic CRUD shape, so it's
// injected directly onto the shared baseApi, same pattern as
// customerWiseSalesReportApi.js (its Sales-side counterpart) and
// purchaseInvoiceRegisterReportApi.js. Query params drive the filter bar;
// the response already contains per-vendor summary rows plus chart-ready
// series (topVendors, contribution, trend) and precomputed stat totals.
export const vendorWisePurchaseReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendorWisePurchaseReport: builder.query({
      query: ({ fromDate, toDate, vendor, purchaseEmployee } = {}) => ({
        url: '/purchase/invoices/vendor-wise/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(vendor ? { vendor } : {}),
          ...(purchaseEmployee ? { purchaseEmployee } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'PurchaseInvoice', id: 'VENDOR_WISE_REPORT' }],
    }),
  }),
});

export const { useGetVendorWisePurchaseReportQuery, useLazyGetVendorWisePurchaseReportQuery } = vendorWisePurchaseReportApi;
