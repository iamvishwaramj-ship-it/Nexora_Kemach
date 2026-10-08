import { baseApi } from '../../store/baseApi';

// Bespoke read-only filtered listing for the Reports > Sales > Enquiry
// Register page — doesn't fit the generic CRUD shape (createCrudApi) since
// it needs multi-field filtering (date range + exact customer/salesperson/
// status/source match) that crudRouter's generic '?q=' search doesn't
// support, so it's injected directly onto the shared baseApi, same pattern
// as customerOutstandingReportApi.js / taxCodeExtraApi.js. Query params
// drive the filter bar; the whole filtered rows array is returned and
// paginated client-side on the page.
export const enquiryRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEnquiryRegisterReport: builder.query({
      query: ({ fromDate, toDate, customerName, assignedTo, status, sourceOfEnquiry } = {}) => ({
        url: '/sales/enquiries/register/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(customerName ? { customerName } : {}),
          ...(assignedTo ? { assignedTo } : {}),
          ...(status ? { status } : {}),
          ...(sourceOfEnquiry ? { sourceOfEnquiry } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Enquiry', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetEnquiryRegisterReportQuery, useLazyGetEnquiryRegisterReportQuery } = enquiryRegisterReportApi;
