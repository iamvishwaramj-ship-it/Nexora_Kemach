import { baseApi } from '../../store/baseApi';

export const companyDetailsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCompanyDetails: builder.query({
      query: () => '/company/details',
      transformResponse: (r) => r.data,
      providesTags: ['Company'],
    }),
    updateCompanyDetails: builder.mutation({
      query: (body) => ({ url: '/company/details', method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Company'],
    }),

    // Logo upload/remove — separate multipart endpoints from the JSON
    // /company/details above, since the object goes to OCI Object Storage
    // rather than into the request body. `formData` is a FormData with a
    // single 'file' field; fetchBaseQuery leaves FormData bodies alone (no
    // JSON.stringify, no forced content-type) so the browser sets the right
    // multipart boundary itself. Both invalidate ['Company'] so every
    // getCompanyDetails subscriber (including the header) refetches and
    // picks up the new/removed logoUrl automatically.
    uploadCompanyLogo: builder.mutation({
      query: (formData) => ({ url: '/company/logo', method: 'POST', body: formData }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Company'],
    }),
    removeCompanyLogo: builder.mutation({
      query: () => ({ url: '/company/logo', method: 'DELETE' }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Company'],
    }),

    // --- Document Numbering Series ------------------------------------------
    // The list is scoped by financial year (series are per-FY), so the query
    // arg is an object of filters rather than nothing. RTK Query caches each
    // filter combination separately, which is what we want when the user
    // flips the FY selector back and forth.
    listDocumentNumbering: builder.query({
      query: (params = {}) => ({ url: '/company/document-numbers', params }),
      transformResponse: (r) => r.data,
      providesTags: ['DocumentNumbering'],
    }),
    getDocumentNumbering: builder.query({
      query: (id) => `/company/document-numbers/${id}`,
      transformResponse: (r) => r.data,
      providesTags: ['DocumentNumbering'],
    }),
    // Document types, separators and length options for the Add/Edit form.
    // Pass financialYearId to have each document flagged with whether it
    // already has a series in that year (so we can grey it out).
    getDocumentNumberingCatalog: builder.query({
      query: (params = {}) => ({ url: '/company/document-numbers/catalog', params }),
      transformResponse: (r) => r.data,
      providesTags: ['DocumentNumbering'],
    }),
    // Every series for one document type in one FY — backs the "Existing
    // Series for ..." table on the Add/Edit form. Also returns a `suggestion`
    // block (next free name and a non-overlapping start point) so the form can
    // pre-fill a valid new series instead of making the user work out where
    // the previous block ended.
    listSeriesForDocument: builder.query({
      query: ({ documentCode, ...params }) => ({
        url: `/company/document-numbers/by-document/${documentCode}`,
        params,
      }),
      transformResponse: (r) => r.data,
      providesTags: ['DocumentNumbering'],
    }),
    // Promote a series to be the one its document type allocates from.
    // Separate from the plain update because it has to demote the incumbent
    // in the same transaction.
    setDefaultDocumentSeries: builder.mutation({
      query: (id) => ({ url: `/company/document-numbers/${id}/set-default`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['DocumentNumbering'],
    }),
    createDocumentNumbering: builder.mutation({
      query: (body) => ({ url: '/company/document-numbers', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['DocumentNumbering'],
    }),
    updateDocumentNumbering: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/company/document-numbers/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['DocumentNumbering'],
    }),
    deleteDocumentNumbering: builder.mutation({
      query: (id) => ({ url: `/company/document-numbers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['DocumentNumbering'],
    }),
    resetDocumentNumbering: builder.mutation({
      query: (body = {}) => ({ url: '/company/document-numbers/reset', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['DocumentNumbering'],
    }),
    // Copies the current year's series into the target FY, honouring each
    // series' Reset Every FY flag. Idempotent.
    rolloverDocumentNumbering: builder.mutation({
      query: (body) => ({ url: '/company/document-numbers/rollover', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['DocumentNumbering'],
    }),
    // Server-side preview. The form renders its own preview locally for
    // instant feedback; this exists so transaction screens and any future
    // caller get the number formatted by the same code that will issue it.
    previewDocumentNumber: builder.mutation({
      query: (body) => ({ url: '/company/document-numbers/preview', method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
    // Non-consuming: what the next number *would* be. Safe on form open.
    peekDocumentNumber: builder.mutation({
      query: (body) => ({ url: '/company/document-numbers/peek', method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
    // Consuming: burns the number. Only call this when actually saving a
    // document, and treat a 409 as a hard stop.
    allocateDocumentNumber: builder.mutation({
      query: (body) => ({ url: '/company/document-numbers/next', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['DocumentNumbering'],
    }),

    // --- E-Invoice / E-Way Bill Settings -----------------------------------
    // Settings page card — the non-secret half of the TaxPro GSP config
    // (Enable toggle, environment, API URLs, QR size, ASP ID, and the
    // sandbox/production GSTIN + username pairs). ASP Password and both
    // e-invoice Passwords are deliberately NOT part of this payload in
    // either direction: they're configured on the server via .env
    // (TAXPRO_ASP_PASSWORD / TAXPRO_PASSWORD / TAXPRO_PRODUCTION_PASSWORD)
    // and this endpoint never sends or returns them — see
    // backend/src/routes/company.js's /einvoice-settings routes.
    getEInvoiceSettings: builder.query({
      query: () => '/company/einvoice-settings',
      transformResponse: (r) => r.data,
      providesTags: ['EInvoiceSettings'],
    }),
    updateEInvoiceSettings: builder.mutation({
      query: (body) => ({ url: '/company/einvoice-settings', method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['EInvoiceSettings'],
    }),
    // Dry-run auth handshake against TaxPro using whatever's currently in
    // the form (not necessarily saved yet) — see testConnection() in
    // taxproGsp.service.js. Never touches the shared session cache that
    // real invoice actions use.
    testEInvoiceConnection: builder.mutation({
      query: (body) => ({ url: '/company/einvoice-settings/test-connection', method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
  }),
});

export const {
  useGetCompanyDetailsQuery, useUpdateCompanyDetailsMutation,
  useUploadCompanyLogoMutation, useRemoveCompanyLogoMutation,
  useListDocumentNumberingQuery, useGetDocumentNumberingQuery,
  useGetDocumentNumberingCatalogQuery,
  useListSeriesForDocumentQuery, useSetDefaultDocumentSeriesMutation,
  useCreateDocumentNumberingMutation, useUpdateDocumentNumberingMutation,
  useDeleteDocumentNumberingMutation, useResetDocumentNumberingMutation,
  useRolloverDocumentNumberingMutation,
  usePreviewDocumentNumberMutation, usePeekDocumentNumberMutation,
  useAllocateDocumentNumberMutation,
  useGetEInvoiceSettingsQuery, useUpdateEInvoiceSettingsMutation, useTestEInvoiceConnectionMutation,
} = companyDetailsApi;
