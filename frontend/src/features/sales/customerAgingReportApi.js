import { baseApi } from '../../store/baseApi';

// Bespoke read-only report endpoint for the Reports > Sales > Customer
// Aging Report page — SAP Business One's "Customer Receivables Aging"
// layout, grouped by (Customer, Invoice Document Sales Employee) with
// dynamic aging-bucket columns. Doesn't fit the generic CRUD shape, so it's
// injected directly onto the shared baseApi, same pattern as
// customerLedgerReportApi.js. `customers` (the multi-select Business
// Partner filter) is sent as a single comma-joined string rather than a
// repeated query key — fetchBaseQuery's URLSearchParams-based serializer
// would otherwise stringify an array param as one comma-joined value
// anyway (`customers=A,B`), so joining it explicitly here and splitting on
// the same comma server-side keeps the two sides honest about the wire
// format instead of relying on that implicit behaviour. `boundaries` is the
// same idea: a single comma-separated string of the 8 (or however many)
// interval boundaries.
export const customerAgingReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerAgingReport: builder.query({
      query: ({
        customers, branch, salesEmployee, agingDate, dateType, fromDate, toDate, boundaries,
      } = {}) => ({
        url: '/receivables/customer-aging/report',
        params: {
          ...(customers && customers.length ? { customers: customers.join(',') } : {}),
          ...(branch ? { branch } : {}),
          ...(salesEmployee ? { salesEmployee } : {}),
          ...(agingDate ? { agingDate } : {}),
          ...(dateType ? { dateType } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(boundaries ? { boundaries } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'CUSTOMER_AGING_REPORT' }],
    }),
  }),
});

export const { useGetCustomerAgingReportQuery, useLazyGetCustomerAgingReportQuery } = customerAgingReportApi;
