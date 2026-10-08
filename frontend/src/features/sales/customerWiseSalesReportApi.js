import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Sales >
// Customer-wise Sales page — doesn't fit the generic CRUD shape, so it's
// injected directly onto the shared baseApi, same pattern as
// salesInvoiceRegisterReportApi.js. Query params drive the filter bar; the
// response already contains per-customer summary rows plus chart-ready
// series (topCustomers, contribution, trend) and precomputed stat totals.
export const customerWiseSalesReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerWiseSalesReport: builder.query({
      query: ({ fromDate, toDate, customer, salesPerson, source } = {}) => ({
        url: '/sales/invoices/customer-wise/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(customer ? { customer } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(source ? { source } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'CUSTOMER_WISE_REPORT' }],
    }),
  }),
});

export const { useGetCustomerWiseSalesReportQuery, useLazyGetCustomerWiseSalesReportQuery } = customerWiseSalesReportApi;
