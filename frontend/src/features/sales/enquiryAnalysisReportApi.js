import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Sales > Enquiry
// Analysis dashboard page — doesn't fit the generic CRUD shape, so it's
// injected directly onto the shared baseApi, same pattern as
// enquiryRegisterReportApi.js / dashboardApi.js. Query params drive the
// filter bar; the response already contains every chart-ready series plus
// the flat row list for the bottom summary table.
export const enquiryAnalysisReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEnquiryAnalysisReport: builder.query({
      query: ({ fromDate, toDate, customerName, assignedTo, sourceOfEnquiry } = {}) => ({
        url: '/sales/enquiries/analysis/report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(customerName ? { customerName } : {}),
          ...(assignedTo ? { assignedTo } : {}),
          ...(sourceOfEnquiry ? { sourceOfEnquiry } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Enquiry', id: 'ANALYSIS_REPORT' }],
    }),
  }),
});

export const { useGetEnquiryAnalysisReportQuery, useLazyGetEnquiryAnalysisReportQuery } = enquiryAnalysisReportApi;
