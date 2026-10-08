import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Cash/Bank
// Position > Deposit Register page. `fromDate`/`toDate` are resolved on
// the page from the "Period Range" preset before being sent. `branch`
// now genuinely filters (BankDeposit/SupplierPayment's own `branch` column
// and HouseBank's `branchName`, via withBranchScope on the backend — see
// the route comment in resources.js). `currency` and
// `showCancelledDeposits` remain no-ops on the backend (single implicit
// currency; BankDeposit only ever has Draft/Posted status). This report
// reflects real BankDeposit/DepositItem records
// (Cash/Cheque/Bank Transfer/Mixed deposit slips) rather than the
// Fixed/Recurring Deposit design in the original mockup, since no
// term-deposit/investment model exists in this schema — confirmed with
// the user before building.
export const depositRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDepositRegisterReport: builder.query({
      query: ({
        branch, account, depositType, fromDate, toDate, currency, include, showCancelledDeposits,
      } = {}) => ({
        url: '/banking/deposit-register/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(account ? { account } : {}),
          ...(depositType ? { depositType } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(currency ? { currency } : {}),
          ...(include ? { include } : {}),
          ...(showCancelledDeposits ? { showCancelledDeposits } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'BankDeposit', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetDepositRegisterReportQuery, useLazyGetDepositRegisterReportQuery } = depositRegisterReportApi;
