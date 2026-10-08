import { baseApi } from '../../store/baseApi';

// Bespoke read-only filtered listing for the Reports > Sales > Sales
// Invoice Register page — doesn't fit the generic CRUD shape, so it's
// injected directly onto the shared baseApi, same pattern as
// salesOrderRegisterReportApi.js. Query params drive the filter bar; the
// response already contains the filtered rows (with per-row tax/discount/
// net amounts computed server-side) plus precomputed stat totals.
export const salesInvoiceRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalesInvoiceRegisterReport: builder.query({
      query: ({ fromDate, toDate, customer, salesPerson, status, source } = {}) => ({
        url: '/sales/invoices/register/report',
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
      providesTags: [{ type: 'SalesInvoice', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetSalesInvoiceRegisterReportQuery, useLazyGetSalesInvoiceRegisterReportQuery } = salesInvoiceRegisterReportApi;
