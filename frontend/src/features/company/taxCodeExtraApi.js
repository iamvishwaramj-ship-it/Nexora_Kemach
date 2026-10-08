import { baseApi } from '../../store/baseApi';

// Extra tax-code endpoint that doesn't fit the generic CRUD shape
// (createCrudApi in lib/createCrudApi.js — see features/resources.js's
// `taxCodeApi` for list/create/update/delete). Injected onto the same
// baseApi with the same 'TaxCode' tag so resetting invalidates the
// generic list query too.
export const taxCodeExtraApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    resetTaxCodes: builder.mutation({
      query: () => ({ url: '/company/tax-codes/reset', method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'TaxCode', id: 'LIST' }],
    }),
    // The Sales/Purchase/RCM Tax Account pickers on the Tax Code Master form
    // (TaxCode.jsx) — NOT the full chart-of-accounts list. Server-filtered to
    // the intersection of "Liabilities accounts named *GST*" and "accounts
    // referenced by G/L Account Determination's Tax section" (see
    // backend/src/utils/taxGlAccountFilter.js) — the filtering is never
    // duplicated or bypassed client-side. Tagged ChartOfAccount/GlAccountDetermination
    // so it re-fetches whenever either master changes.
    listTaxGLAccounts: builder.query({
      query: (params) => ({ url: '/company/tax-codes/gl-accounts', params }),
      transformResponse: (r) => r.data,
      // Re-fetch whenever either input master changes — editing an account's
      // name/group on Chart of Accounts, or repointing G/L Account
      // Determination's Tax section, can change which accounts this lookup
      // is allowed to return.
      providesTags: [{ type: 'ChartOfAccount', id: 'LIST' }, { type: 'GlAccountDetermination', id: 'LIST' }],
    }),
  }),
});

export const { useResetTaxCodesMutation, useListTaxGLAccountsQuery } = taxCodeExtraApi;
