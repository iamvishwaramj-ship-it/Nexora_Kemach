import { baseApi } from '../../store/baseApi';

// Bespoke read-only report endpoint for Reports > Tax Reports > Input Tax
// Report — one row per invoice line item, pulled from every Sales and
// Purchase transaction screen that carries tax lines (Sales Invoice, Sales
// Return, Sales Credit Memo, Purchase Invoice, Purchase Return, Purchase
// Credit Memo, GRN — see backend/src/routes/resources.js's
// INPUT_TAX_REPORT_DOC_TYPES and pages/reports/tax/TaxReport.jsx).
export const taxReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInputTaxReport: builder.query({
      query: ({
        fromDate, toDate, branch, party, itemCode, taxRate, taxType, documentType,
      } = {}) => ({
        url: '/tax/input-tax-report',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(branch ? { branch } : {}),
          ...(party ? { party } : {}),
          ...(itemCode ? { itemCode } : {}),
          ...(taxRate !== '' && taxRate !== undefined && taxRate !== null ? { taxRate } : {}),
          ...(taxType ? { taxType } : {}),
          ...(documentType ? { documentType } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'SalesInvoice', id: 'TAX_REPORT' }, { type: 'PurchaseInvoice', id: 'TAX_REPORT' }],
    }),
    // Export to Excel — the GSTR-2 purchase filing sheet (one row per Purchase
    // Invoice, template column layout), built server-side and returned as an
    // .xlsx Blob. Takes the same filters as the report itself.
    exportInputTaxReportGstr2: builder.mutation({
      query: ({
        fromDate, toDate, branch, party, itemCode, taxRate, taxType, documentType,
      } = {}) => ({
        url: '/tax/input-tax-report/export',
        method: 'GET',
        params: {
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
          ...(branch ? { branch } : {}),
          ...(party ? { party } : {}),
          ...(itemCode ? { itemCode } : {}),
          ...(taxRate !== '' && taxRate !== undefined && taxRate !== null ? { taxRate } : {}),
          ...(taxType ? { taxType } : {}),
          ...(documentType ? { documentType } : {}),
        },
        responseHandler: (response) => response.blob(),
        cache: 'no-cache',
      }),
    }),
  }),
});

export const { useGetInputTaxReportQuery, useLazyGetInputTaxReportQuery, useExportInputTaxReportGstr2Mutation } = taxReportApi;
