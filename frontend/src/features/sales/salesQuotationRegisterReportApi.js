import { baseApi } from '../../store/baseApi';

// Bespoke read-only filtered listing for the Reports > Sales > Sales
// Quotation Register page — doesn't fit the generic CRUD shape, so it's
// injected directly onto the shared baseApi, same pattern as
// enquiryRegisterReportApi.js. Replaces the former Sales Order Register
// report (this page now reads Sales Quotation instead of Sales Order).
// Query params drive the filter bar; the response already contains the
// filtered rows (with a derived conversionStatus + convertedOrderNo per
// quotation) plus precomputed stat totals.
export const salesQuotationRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalesQuotationRegisterReport: builder.query({
      query: ({ fromDate, toDate, customer, salesPerson, status } = {}) => ({
        url: '/sales/quotations/register/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(customer ? { customer } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(status ? { status } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesQuotation', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetSalesQuotationRegisterReportQuery, useLazyGetSalesQuotationRegisterReportQuery } = salesQuotationRegisterReportApi;
