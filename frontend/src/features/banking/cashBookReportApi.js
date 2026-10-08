import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Cash/Bank
// Position > Cash Book page. `fromDate`/`toDate` are resolved on the page
// from the "Period Range" preset (MTD/WTD/QTD/YTD/Custom Range) before
// being sent. `branch` now genuinely filters (Collection/SupplierPayment's
// own `branch` column and HouseBank's `branchName`, via withBranchScope on
// the backend — see the route comment in resources.js). `currency` and
// `showCancelledTransactions` remain no-ops on the backend (single implicit
// currency; Collection/SupplierPayment only ever have Draft/Posted status).
export const cashBookReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCashBookReport: builder.query({
      query: ({
        branch, cashAccount, fromDate, toDate, currency, include, voucherType,
        showCancelledTransactions, openingBalanceAsOn,
      } = {}) => ({
        url: '/banking/cash-book/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(cashAccount ? { cashAccount } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(currency ? { currency } : {}),
          ...(include ? { include } : {}),
          ...(voucherType ? { voucherType } : {}),
          ...(showCancelledTransactions ? { showCancelledTransactions } : {}),
          ...(openingBalanceAsOn ? { openingBalanceAsOn } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Collection', id: 'CASH_BOOK_REPORT' }],
    }),
  }),
});

export const { useGetCashBookReportQuery, useLazyGetCashBookReportQuery } = cashBookReportApi;
