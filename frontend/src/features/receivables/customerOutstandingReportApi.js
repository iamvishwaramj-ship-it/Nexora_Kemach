import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Customer Outstanding aging
// report — doesn't fit the generic CRUD shape (createCrudApi), so it's
// injected directly onto the shared baseApi, same pattern as
// taxCodeExtraApi.js / dashboardApi.js. Query params drive the filter bar;
// the whole aggregated rows array is returned and paginated client-side on
// the page. `branch` filters against BusinessPartner.branch on the server.
// `outstandingType` and `currency` are accepted for filter-bar parity but
// are no-ops on the backend — see the route comment in resources.js.
export const customerOutstandingReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOutstandingReport: builder.query({
      query: ({
        branch, customerGroup, salesPerson, customerName, outstandingType, include,
        showInactiveCustomers, currency, asOnDate, agingBasedOn,
      } = {}) => ({
        url: '/receivables/outstanding/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(customerGroup ? { customerGroup } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(customerName ? { customerName } : {}),
          ...(outstandingType ? { outstandingType } : {}),
          ...(include ? { include } : {}),
          ...(showInactiveCustomers ? { showInactiveCustomers } : {}),
          ...(currency ? { currency } : {}),
          ...(asOnDate ? { asOnDate } : {}),
          ...(agingBasedOn ? { agingBasedOn } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'CustomerOutstanding', id: 'REPORT' }],
    }),
  }),
});

export const { useGetOutstandingReportQuery, useLazyGetOutstandingReportQuery } = customerOutstandingReportApi;
