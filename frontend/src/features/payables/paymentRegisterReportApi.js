import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Payable >
// Payment Register page. `fromDate`/`toDate` are resolved on the page from
// the "Period Range" preset (MTD/WTD/QTD/YTD/Custom Range) before being
// sent ("All Time" sends none). Every filter — branch, partyType (Vendor/
// Account), supplier / account, payment mode / method, reference type,
// include, currency, show cancelled, show unreconciled — is applied
// server-side; see the route comment in resources.js.
export const paymentRegisterReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentRegisterReport: builder.query({
      query: ({
        branch, fromDate, toDate, supplierGroup, supplier, partyType, account, paymentMode, paymentMethod, include,
        currency, referenceType, showCancelledPayments, showUnreconciledPayments,
      } = {}) => ({
        url: '/payables/payment-register/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(supplierGroup ? { supplierGroup } : {}),
          ...(supplier ? { supplier } : {}),
          ...(partyType ? { partyType } : {}),
          ...(account ? { account } : {}),
          ...(paymentMode ? { paymentMode } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(include ? { include } : {}),
          ...(currency ? { currency } : {}),
          ...(referenceType ? { referenceType } : {}),
          ...(showCancelledPayments ? { showCancelledPayments } : {}),
          ...(showUnreconciledPayments ? { showUnreconciledPayments } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SupplierPayment', id: 'REGISTER_REPORT' }],
    }),
  }),
});

export const { useGetPaymentRegisterReportQuery, useLazyGetPaymentRegisterReportQuery } = paymentRegisterReportApi;
