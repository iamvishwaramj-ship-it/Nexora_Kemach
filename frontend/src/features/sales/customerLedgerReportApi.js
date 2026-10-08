import { baseApi } from '../../store/baseApi';

// Bespoke read-only report endpoint for the Reports > Sales > Customer
// Ledger page — the Business Partner Ledger view for Customers. Doesn't fit
// the generic CRUD shape, so it's injected directly onto the shared
// baseApi, same pattern as customerWiseSalesReportApi.js. `customer` is
// required by the backend (400 without it); fromDate/toDate/reconciled/
// unreconciled are all optional and map straight onto the query string.
export const customerLedgerReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerLedgerReport: builder.query({
      query: ({ customer, fromDate, toDate, reconciled, unreconciled } = {}) => ({
        url: '/receivables/customer-ledger/report',
        params: {
          ...(customer ? { customer } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(reconciled ? { reconciled } : {}),
          ...(unreconciled ? { unreconciled } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'CUSTOMER_LEDGER_REPORT' }],
    }),
  }),
});

export const { useGetCustomerLedgerReportQuery, useLazyGetCustomerLedgerReportQuery } = customerLedgerReportApi;
