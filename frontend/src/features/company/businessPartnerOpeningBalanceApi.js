import { createCrudApi } from '../../lib/createCrudApi';
import { baseApi } from '../../store/baseApi';

// Company Setup > BP Opening Balance. GET /business-partner-opening-balance
// returns one row per BP line (a multi-line document repeats its own header
// fields across its lines — see the backend route's own comment), so the
// generic createCrudApi list/get/delete-by-id shape fits the read side fine.
// Saving and whole-document delete are NOT generic CRUD, because this
// document has real accounting consequences (a journal entry, Outstanding
// rows) that have to be built/torn down as one unit — see the two bespoke
// endpoints below, mirroring openingBalanceApi/useSaveOpeningBalanceBatchMutation
// in features/resources.js for the stock version of this same idea.
export const businessPartnerOpeningBalanceApi = createCrudApi({
  resourcePath: 'business-partner-opening-balance',
  tagType: 'BusinessPartnerOpeningBalance',
  // A save touches the customer/supplier's own Outstanding position and the
  // journal entry ledger, so both have to refresh alongside this resource's
  // own list — otherwise Customer Outstanding/Aging would keep showing
  // stale figures until something else happened to invalidate them.
  extraInvalidateTags: ['CustomerOutstanding', 'SupplierOutstanding', 'JournalEntry'],
});

const businessPartnerOpeningBalanceExtraApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Every line of ONE document, by documentNumber — what View/Edit fetch
    // on demand now that the list itself is server-paged (see GET
    // /business-partner-opening-balance's own comment in resources.js).
    // Deliberately NOT built off whatever rows the list's current page
    // happens to hold: a document can have far more lines than fit on one
    // page, and PUT .../document/:documentNumber below replaces every line
    // of a document with whatever the form submits, so editing off a
    // partial set would silently delete the rest on save.
    getBusinessPartnerOpeningBalanceDocument: builder.query({
      query: (documentNumber) => `/business-partner-opening-balance/document/${encodeURIComponent(documentNumber)}`,
      transformResponse: (response) => response.data,
    }),
    // Header + BP lines saved together for a NEW document — always
    // allocates a fresh document number (see the backend route's own
    // comment on why this is a separate endpoint from the edit one below,
    // rather than the same one inferring create-vs-edit from whether
    // documentNumber is already filled in — DocumentNoField fills that
    // field with an unreserved preview even on a brand-new document). See
    // POST /business-partner-opening-balance/batch on the backend.
    saveBusinessPartnerOpeningBalanceBatch: builder.mutation({
      query: (body) => ({ url: '/business-partner-opening-balance/batch', method: 'POST', body }),
      invalidatesTags: [
        { type: 'BusinessPartnerOpeningBalance', id: 'LIST' },
        'CustomerOutstanding', 'SupplierOutstanding', 'JournalEntry',
        // BP form's Account Balance reads openingBalance from
        // /business-partners/:code/summary -- refetch it after any change.
        'BusinessPartner',
      ],
    }),
    // Replaces every line of an EXISTING document, keyed by the URL's
    // documentNumber — re-syncs its journal entry and Outstanding rows to
    // match. See PUT /business-partner-opening-balance/document/:documentNumber.
    updateBusinessPartnerOpeningBalanceDocument: builder.mutation({
      query: ({ documentNumber, ...body }) => ({
        url: `/business-partner-opening-balance/document/${encodeURIComponent(documentNumber)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        { type: 'BusinessPartnerOpeningBalance', id: 'LIST' },
        'CustomerOutstanding', 'SupplierOutstanding', 'JournalEntry',
        // BP form's Account Balance reads openingBalance from
        // /business-partners/:code/summary -- refetch it after any change.
        'BusinessPartner',
      ],
    }),
    // Deletes every line of the named document in one go, reversing its
    // journal entry and Outstanding rows with it — see DELETE
    // /business-partner-opening-balance/document/:documentNumber. Deleting
    // a single line by id is deliberately not exposed: a document is one
    // accounting event, not a bag of independent rows.
    deleteBusinessPartnerOpeningBalanceDocument: builder.mutation({
      query: (documentNumber) => ({
        url: `/business-partner-opening-balance/document/${encodeURIComponent(documentNumber)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'BusinessPartnerOpeningBalance', id: 'LIST' },
        'CustomerOutstanding', 'SupplierOutstanding', 'JournalEntry',
        // BP form's Account Balance reads openingBalance from
        // /business-partners/:code/summary -- refetch it after any change.
        'BusinessPartner',
      ],
    }),
  }),
});

export const {
  useLazyGetBusinessPartnerOpeningBalanceDocumentQuery,
  useSaveBusinessPartnerOpeningBalanceBatchMutation,
  useUpdateBusinessPartnerOpeningBalanceDocumentMutation,
  useDeleteBusinessPartnerOpeningBalanceDocumentMutation,
} = businessPartnerOpeningBalanceExtraApi;
