import { baseApi } from '../store/baseApi';

// Production Planning > Forecast — bespoke RTK Query endpoints (not
// lib/createCrudApi.js) because the backend does real compute work (preview
// and save both run the server-side Actual/Forecast Demand calculation —
// see backend/src/services/forecastPlanService.js), not a plain CRUD shape.
// Dropdown master data (Branch, Product Group, Product, Customer) is NOT
// duplicated here — Forecast.jsx reuses the existing branchApi/
// productGroupApi/productApi/customerApi from features/resources.js.
export const productionPlanningApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listForecastPlans: builder.query({
      query: () => '/production-planning/forecast-plans',
      transformResponse: (response) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((r) => ({ type: 'ProductionForecastPlan', id: r.id })), { type: 'ProductionForecastPlan', id: 'LIST' }]
          : [{ type: 'ProductionForecastPlan', id: 'LIST' }],
    }),
    getForecastPlan: builder.query({
      query: (id) => `/production-planning/forecast-plans/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'ProductionForecastPlan', id }],
    }),
    // Compute-only — nothing is saved. Powers the "Run Forecast" button so
    // the screen's Actual/Forecast Demand table and the Section 3 order
    // summary are always real numbers computed from current Sales Invoice
    // history, before the user decides to save a plan.
    previewForecastPlan: builder.mutation({
      query: (body) => ({ url: '/production-planning/forecast-plans/preview', method: 'POST', body }),
      transformResponse: (response) => response.data,
    }),
    createForecastPlan: builder.mutation({
      query: (body) => ({ url: '/production-planning/forecast-plans', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'ProductionForecastPlan', id: 'LIST' }],
    }),
    updateForecastPlan: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/production-planning/forecast-plans/${id}`, method: 'PUT', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'ProductionForecastPlan', id },
        { type: 'ProductionForecastPlan', id: 'LIST' },
      ],
    }),
    deleteForecastPlan: builder.mutation({
      query: (id) => ({ url: `/production-planning/forecast-plans/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'ProductionForecastPlan', id: 'LIST' }],
    }),
    // Distinct Product.productType values — the real (if improvised) stand-in
    // for an "Item Category" master; see the backend route's own comment.
    listItemCategories: builder.query({
      query: () => '/production-planning/meta/item-categories',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'ProductionForecastPlan', id: 'ITEM-CATEGORIES' }],
    }),

    // --- MRP & Order Generation (Phase 1) -----------------------------------
    // Same bespoke-endpoints convention as Forecast above — real compute work
    // (services/mrpService.js), not a plain CRUD shape.
    // Direct open-quantity conversion for Generate Order - Sales Order (no
    // MRP netting) — see mrpService.listOpenSalesOrderLines.
    listOpenSalesOrderLines: builder.query({
      query: () => '/production-planning/open-sales-order-lines',
      transformResponse: (response) => response.data,
    }),
    runMrp: builder.mutation({
      query: (body) => ({ url: '/production-planning/mrp-runs', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'ProductionMrpRun', id: 'LIST' }],
    }),
    listMrpRuns: builder.query({
      query: () => '/production-planning/mrp-runs',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'ProductionMrpRun', id: 'LIST' }],
    }),
    getMrpRun: builder.query({
      query: (id) => `/production-planning/mrp-runs/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'ProductionMrpRun', id }],
    }),
    getMrpItemDetail: builder.query({
      query: ({ runId, productCode }) => `/production-planning/mrp-runs/${runId}/items/${encodeURIComponent(productCode)}/detail`,
      transformResponse: (response) => response.data,
    }),
    // Same BOM/Routing read as above, usable with no MRP run in context —
    // Generate Order - Manual selects straight from Product Master.
    getItemDetail: builder.query({
      query: (productCode) => `/production-planning/items/${encodeURIComponent(productCode)}/detail`,
      transformResponse: (response) => response.data,
    }),
    createGenerationOrder: builder.mutation({
      query: (body) => ({ url: '/production-planning/generation-orders', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'ProductionGenerationOrder', id: 'LIST' }],
    }),
    getGenerationOrder: builder.query({
      query: (id) => `/production-planning/generation-orders/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'ProductionGenerationOrder', id }],
    }),
    updateGenerationOrder: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/production-planning/generation-orders/${id}`, method: 'PUT', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { id }) => [{ type: 'ProductionGenerationOrder', id }],
    }),
    generateOrders: builder.mutation({
      query: (id) => ({ url: `/production-planning/generation-orders/${id}/generate`, method: 'POST' }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, id) => [
        { type: 'ProductionGenerationOrder', id },
        { type: 'ProductionOrder', id: 'LIST' },
      ],
    }),
    getProductionPlanningDashboardStats: builder.query({
      query: () => '/production-planning/dashboard-stats',
      transformResponse: (response) => response.data,
    }),
  }),
  overrideExisting: false,
});

export const {
  useListForecastPlansQuery,
  useGetForecastPlanQuery,
  usePreviewForecastPlanMutation,
  useCreateForecastPlanMutation,
  useUpdateForecastPlanMutation,
  useDeleteForecastPlanMutation,
  useListItemCategoriesQuery,
  useListOpenSalesOrderLinesQuery,
  useRunMrpMutation,
  useListMrpRunsQuery,
  useGetMrpRunQuery,
  useLazyGetMrpItemDetailQuery,
  useGetItemDetailQuery,
  useLazyGetItemDetailQuery,
  useCreateGenerationOrderMutation,
  useGetGenerationOrderQuery,
  useUpdateGenerationOrderMutation,
  useGenerateOrdersMutation,
  useGetProductionPlanningDashboardStatsQuery,
} = productionPlanningApi;
