import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Cash/Bank
// Position > Bank Book page. `fromDate`/`toDate` are resolved on the page
// from the "Period Range" preset (MTD/WTD/QTD/YTD/Custom Range) before
// being sent. `branch` now genuinely filters (Collection/SupplierPayment's
// own `branch` column and HouseBank's `branchName`, via withBranchScope on
// the backend — see the route comment in resources.js). `currency` remains
// a no-op on the backend (single implicit currency).
export const bankBookReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBankBookReport: builder.query({
      query: ({
        branch, bankAccount, fromDate, toDate, currency, include, voucherType,
        showClearedTransactions, openingBalanceAsOn,
      } = {}) => ({
        url: '/banking/bank-book/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(bankAccount ? { bankAccount } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(currency ? { currency } : {}),
          ...(include ? { include } : {}),
          ...(voucherType ? { voucherType } : {}),
          ...(showClearedTransactions ? { showClearedTransactions } : {}),
          ...(openingBalanceAsOn ? { openingBalanceAsOn } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Collection', id: 'BANK_BOOK_REPORT' }],
    }),
  }),
});

export const { useGetBankBookReportQuery, useLazyGetBankBookReportQuery } = bankBookReportApi;
