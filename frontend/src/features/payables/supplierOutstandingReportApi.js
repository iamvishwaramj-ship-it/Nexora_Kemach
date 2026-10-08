import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Supplier Outstanding aging
// report — doesn't fit the generic CRUD shape (createCrudApi), so it's
// injected directly onto the shared baseApi, mirroring
// receivables/customerOutstandingReportApi.js. Query params drive the
// filter bar; the whole aggregated rows array is returned and paginated
// client-side on the page. `branch` and `currency` are accepted for
// filter-bar parity but are no-ops on the backend — see the route comment
// in resources.js.
export const supplierOutstandingReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSupplierOutstandingReport: builder.query({
      query: ({
        branch, supplierGroup, supplier, currency, include, showPaidInvoices, asOnDate, agingBasedOn,
      } = {}) => ({
        url: '/payables/outstanding/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(supplierGroup ? { supplierGroup } : {}),
          ...(supplier ? { supplier } : {}),
          ...(currency ? { currency } : {}),
          ...(include ? { include } : {}),
          ...(showPaidInvoices ? { showPaidInvoices } : {}),
          ...(asOnDate ? { asOnDate } : {}),
          ...(agingBasedOn ? { agingBasedOn } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SupplierOutstanding', id: 'REPORT' }],
    }),
  }),
});

export const { useGetSupplierOutstandingReportQuery, useLazyGetSupplierOutstandingReportQuery } = supplierOutstandingReportApi;
