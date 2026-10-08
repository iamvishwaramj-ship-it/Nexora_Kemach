import { baseApi } from '../../store/baseApi';

// Bespoke read-only aggregate endpoint for the Reports > Inventory >
// Stock Valuation page. Query params drive the filter bar; the response
// contains one row per product (opening/inward/outward qty & value,
// closing/on-hand qty, unit cost, stock value, last purchase price/date,
// warehouse), precomputed stat totals, and four chart series.
// `asOnDate`/`branch`/`warehouse` filter the [dbo].[Stock] journal directly
// (same as Stock Summary's report), and Stock Value = openingValue +
// inwardValue - outwardValue from that journal — NOT onHandQty * unitCost.
// `valuationMethod` still recomputes the displayed Unit Cost as Standard
// Cost / Moving Average / FIFO from purchase receipt history, but it no
// longer affects Stock Value — see the route comment and
// computeValuationUnitCost in resources.js.
export const stockValuationReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStockValuationReport: builder.query({
      query: ({ branch, warehouse, productGroup, product, valuationMethod, asOnDate } = {}) => ({
        url: '/inventory/stock-valuation/report',
        params: {
          ...(branch ? { branch } : {}),
          ...(warehouse ? { warehouse } : {}),
          ...(productGroup ? { productGroup } : {}),
          ...(product ? { product } : {}),
          ...(valuationMethod ? { valuationMethod } : {}),
          ...(asOnDate ? { asOnDate } : {}),
        },
      }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Product', id: 'STOCK_VALUATION_REPORT' }],
    }),
  }),
});

export const { useGetStockValuationReportQuery, useLazyGetStockValuationReportQuery } = stockValuationReportApi;
