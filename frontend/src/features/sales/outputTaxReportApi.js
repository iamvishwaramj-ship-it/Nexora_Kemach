import { baseApi } from '../../store/baseApi';

// Bespoke read-only report endpoint for Reports > Tax Reports > Output Tax
// Report — one row per invoice line item, pulled from every Sales and
// Purchase transaction screen that carries tax lines (Sales Invoice, Sales
// Return, Sales Credit Memo, Purchase Invoice, Purchase Return, Purchase
// Credit Memo, GRN — see backend/src/routes/resources.js's
// TAX_REPORT_DOC_TYPES/buildTaxReportRows and
// pages/reports/tax/OutputTaxReport.jsx). Same shape and same source
// screens as Input Tax Report's own taxReportApi.js — only the per-line tax
// amount field differs (`outputTax` here vs `inputTax` there).
export const outputTaxReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOutputTaxReport: builder.query({
      query: ({
        fromDate, toDate, branch, party, itemCode, taxRate, taxType, documentType,
      } = {}) => ({
        url: '/tax/output-tax-report',
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
    // Export to Excel — the GSTR-1 sales filing sheet (one row per Sales
    // Invoice, template column layout), built server-side and returned as an
    // .xlsx Blob. Takes the same filters as the report itself.
    exportOutputTaxReportGstr1: builder.mutation({
      query: ({
        fromDate, toDate, branch, party, itemCode, taxRate, taxType, documentType,
      } = {}) => ({
        url: '/tax/output-tax-report/export',
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

export const { useGetOutputTaxReportQuery, useLazyGetOutputTaxReportQuery, useExportOutputTaxReportGstr1Mutation } = outputTaxReportApi;
