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
} = productionPlanningApi;
