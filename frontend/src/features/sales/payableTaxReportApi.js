import { baseApi } from '../../store/baseApi';

// Bespoke read-only report endpoint for Reports > Tax Reports > Payable Tax
// Report — Output Tax (Sales-side documents) less Input Tax (Purchase-side
// documents), rolled up to whichever level `groupBy` asks for: 'invoice'
// (one row per source document), 'party' (one row per Customer/Vendor), or
// 'all' (one overall summary row). See backend/src/routes/resources.js's
// buildPayableTaxReportRows and pages/reports/tax/PayableTaxReport.jsx.
export const payableTaxReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPayableTaxReport: builder.query({
      query: ({
        fromDate, toDate, branch, party, documentType, taxRate, taxType, groupBy,
      } = {}) => ({
        url: '/tax/payable-tax-report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(branch ? { branch } : {}),
          ...(party ? { party } : {}),
          ...(documentType ? { documentType } : {}),
          ...(taxRate !== '' && taxRate !== undefined && taxRate !== null ? { taxRate } : {}),
          ...(taxType ? { taxType } : {}),
          ...(groupBy ? { groupBy } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'TAX_REPORT' }, { type: 'PurchaseInvoice', id: 'TAX_REPORT' }],
    }),
  }),
});

export const { useGetPayableTaxReportQuery, useLazyGetPayableTaxReportQuery } = payableTaxReportApi;
