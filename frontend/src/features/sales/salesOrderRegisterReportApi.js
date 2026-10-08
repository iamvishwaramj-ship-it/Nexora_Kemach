import { baseApi } from '../../store/baseApi';

// Bespoke read-only filtered listing for the Reports > Sales > Sales Order
// Register page — doesn't fit the generic CRUD shape, so it's injected
// directly onto the shared baseApi, same pattern as
// enquiryRegisterReportApi.js. Query params drive the filter bar; the
// response already contains the filtered rows (with a derived
// deliveryStatus per order) plus precomputed stat totals.
export const salesOrderRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalesOrderRegisterReport: builder.query({
      query: ({ fromDate, toDate, customer, salesPerson, status, source } = {}) => ({
        url: '/sales/orders/register/report',
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
      providesTags: [{ type: 'SalesOrder', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetSalesOrderRegisterReportQuery, useLazyGetSalesOrderRegisterReportQuery } = salesOrderRegisterReportApi;
