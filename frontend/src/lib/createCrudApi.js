import { baseApi } from '../store/baseApi';

/**
 * Generic RTK Query CRUD endpoint injector. Every simple master/transaction
 * resource in the app shares the same list/get/create/update/delete shape,
 * so endpoints are generated here instead of hand-rolled per feature file.
 * Never hand-roll fetch/axios calls inside components — inject from here.
 */
// extraInvalidateTags: tags to invalidate in addition to this resource's own
// (may be a static array, or a function (result, error, arg) => tags[] when
// the extra tag needs a dynamic id derived from the mutation's result/arg —
// LIST tag on create/update/delete — for resources whose mutations have a
// side effect on another resource's data server-side. BankDeposit,
// Collection, SupplierPayment, and Cheque are the case in point: saving any
// of them makes the backend silently upsert a matching
// BankReconciliationTransaction row (see syncBankReconciliationTxn in
// backend/src/routes/resources.js), but without also invalidating
// BankReconciliation's LIST tag here, RTK Query has no way to know that
// data changed — the Bank Reconciliation page's System Transactions tab
// would keep showing whatever it last fetched until a manual refresh.
export function createCrudApi({ resourcePath, tagType, extraInvalidateTags = [], keepUnusedDataFor = 60}) {
  const injected = baseApi.injectEndpoints({
    endpoints: (builder) => ({
      [`list${tagType}`]: builder.query({
        query: (params) => ({ url: `/${resourcePath}`, params }),
        transformResponse: (response) => response.data,
        keepUnusedDataFor,
        providesTags: (result) =>
          result
            ? [...result.map((r) => ({ type: tagType, id: r.id })), { type: tagType, id: 'LIST' }]
            : [{ type: tagType, id: 'LIST' }],
      }),
      [`get${tagType}`]: builder.query({
        query: (id) => `/${resourcePath}/${id}`,
        transformResponse: (response) => response.data,
        providesTags: (result, error, id) => [{ type: tagType, id }],
      }),
      // Phase 3 of the data-loading performance work (pure data-access, no
      // business-logic change) — a SEPARATE injected endpoint from `list`
      // above (own cache namespace, even though it hits the same URL), so
      // adding it can't change what `useList`'s `.data` shape is for any of
      // the ~40 existing resources built from this factory. Where `list`'s
      // `transformResponse` throws away everything but the `data` array
      // (today's byte-compatible shape every caller of `useList` expects),
      // this one keeps the `meta` paging envelope too (`{ page, limit,
      // total, pages }`) — the server only ever includes `meta` when the
      // caller actually passed `?page=`/`?limit=`, see crudFactory.js's
      // `list` handler and the bespoke `/business-partners` route. Use this
      // ONLY for a resource whose list route has been wired for server-side
      // paging (Phase 3) — right now, Product and BusinessPartner.
      [`listPaged${tagType}`]: builder.query({
        query: (params) => ({ url: `/${resourcePath}`, params }),
        transformResponse: (response) => ({ data: response.data, meta: response.meta }),
        providesTags: (result) =>
          result?.data
            ? [...result.data.map((r) => ({ type: tagType, id: r.id })), { type: tagType, id: 'LIST' }]
            : [{ type: tagType, id: 'LIST' }],
      }),
      [`create${tagType}`]: builder.mutation({
        query: (body) => ({ url: `/${resourcePath}`, method: 'POST', body }),
        transformResponse: (response) => response.data,
        invalidatesTags: (result, error, arg) => [
          { type: tagType, id: 'LIST' },
          ...(typeof extraInvalidateTags === 'function' ? extraInvalidateTags(result, error, arg) : extraInvalidateTags),
        ],
      }),
      [`update${tagType}`]: builder.mutation({
        query: ({ id, ...body }) => ({ url: `/${resourcePath}/${id}`, method: 'PUT', body }),
        transformResponse: (response) => response.data,
        invalidatesTags: (result, error, { id }) => [
          { type: tagType, id },
          { type: tagType, id: 'LIST' },
          ...(typeof extraInvalidateTags === 'function' ? extraInvalidateTags(result, error, { id }) : extraInvalidateTags),
        ],
      }),
      [`delete${tagType}`]: builder.mutation({
        query: (id) => ({ url: `/${resourcePath}/${id}`, method: 'DELETE' }),
        invalidatesTags: (result, error, arg) => [
          { type: tagType, id: 'LIST' },
          ...(typeof extraInvalidateTags === 'function' ? extraInvalidateTags(result, error, arg) : extraInvalidateTags),
        ],
      }),
      // Generic Cancel action — a soft alternative to delete for a resource
      // whose backend route supports it (currently only PATCH
      // /purchase/orders/:id/cancel; calling `useCancel` on a resource with
      // no matching backend route just 404s, same as calling any other
      // endpoint the server hasn't implemented). Marks the record cancelled
      // rather than removing it, so it stays visible in its own list. Takes
      // only the id, like delete — a cancel confirm popup has nothing else
      // to send.
      [`cancel${tagType}`]: builder.mutation({
        query: (id) => ({ url: `/${resourcePath}/${id}/cancel`, method: 'PATCH' }),
        transformResponse: (response) => response.data,
        invalidatesTags: (result, error, arg) => [
          { type: tagType, id: arg },
          { type: tagType, id: 'LIST' },
          ...(typeof extraInvalidateTags === 'function' ? extraInvalidateTags(result, error, arg) : extraInvalidateTags),
        ],
      }),
    }),
    overrideExisting: false,
  });

  return {
    api: injected,
    useList: injected[`useList${tagType}Query`],
    useGet: injected[`useGet${tagType}Query`],
    // Lazy variant of `useGet` — lets a page fetch one full record on demand
    // (e.g. only once a row is actually opened for Edit/View) instead of
    // subscribing up front. RTK Query auto-generates this hook for every
    // injected query endpoint; it was just never exposed here before. Purely
    // additive — every existing caller of createCrudApi() is unaffected.
    useLazyGet: injected[`useLazyGet${tagType}Query`],
    // See listPaged above — Phase 3, opt-in, only meaningful for a resource
    // whose list route understands `?page=`/`?limit=`/`?sort=`/`?dir=`.
    useListPaged: injected[`useListPaged${tagType}Query`],
    useCreate: injected[`useCreate${tagType}Mutation`],
    useUpdate: injected[`useUpdate${tagType}Mutation`],
    useDelete: injected[`useDelete${tagType}Mutation`],
    useCancel: injected[`useCancel${tagType}Mutation`],
  };
}
