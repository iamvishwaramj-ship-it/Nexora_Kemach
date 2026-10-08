import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Receivable >
// Collection Register page. `fromDate`/`toDate` are resolved on the page
// from the "Period Range" preset (MTD/WTD/QTD/YTD/Custom Range) before
// being sent. Every filter — partyType (Customer/Account), customer / account,
// salesPerson, paymentMode, branch, include, currency — is applied server-side;
// see the route comment in resources.js.
export const collectionRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCollectionRegisterReport: builder.query({
      query: ({
        branch, fromDate, toDate, customerGroup, customer, partyType, account, salesPerson, paymentMode,
        include, showInactiveCustomers, currency,
      } = {}) => ({
        url: '/receivables/collection-register/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(customerGroup ? { customerGroup } : {}),
          ...(customer ? { customer } : {}),
          ...(partyType ? { partyType } : {}),
          ...(account ? { account } : {}),
          ...(salesPerson ? { salesPerson } : {}),
          ...(paymentMode ? { paymentMode } : {}),
          ...(include ? { include } : {}),
          ...(showInactiveCustomers ? { showInactiveCustomers } : {}),
          ...(currency ? { currency } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Collection', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetCollectionRegisterReportQuery, useLazyGetCollectionRegisterReportQuery } = collectionRegisterReportApi;
