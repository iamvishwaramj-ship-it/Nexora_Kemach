import { baseApi } from '../store/baseApi';
import { createCrudApi } from '../lib/createCrudApi';

// Production Planning / Execution — Phase A manufacturing foundation.
// Work Centers / BOM / Routing / Production Order all share the plain
// list/get/create/update/delete shape (BOM and Routing's "lines" are just
// part of the same create/update payload server-side — see
// routes/productionMasters.js) — generated from the same factory every other
// simple resource in this app uses. Only the Production Order status
// transition is bespoke (injectEndpoints below), because it is not a plain
// field update.
export const workCenterApi = createCrudApi({ resourcePath: 'production/work-centers', tagType: 'WorkCenter', keepUnusedDataFor: 300 });
export const bomApi = createCrudApi({ resourcePath: 'production/boms', tagType: 'Bom' });
export const routingApi = createCrudApi({ resourcePath: 'production/routings', tagType: 'Routing' });
export const productionOrderApi = createCrudApi({ resourcePath: 'production/orders', tagType: 'ProductionOrder' });

export const productionOrderStatusApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Controlled, forward-only status transition (Planned -> Released ->
    // In Progress -> Completed -> Closed) — see PATCH
    // /production/orders/:id/status in routes/productionOrders.js.
    updateProductionOrderStatus: builder.mutation({
      query: ({ id, status }) => ({ url: `/production/orders/${id}/status`, method: 'PATCH', body: { status } }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { id }) => [{ type: 'ProductionOrder', id }, { type: 'ProductionOrder', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const { useUpdateProductionOrderStatusMutation } = productionOrderStatusApi;
