import { baseApi } from '../../store/baseApi';
import { userUpdated } from '../../store/authSlice';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    updateProfile: builder.mutation({
      query: (body) => ({ url: '/profile', method: 'PUT', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(userUpdated(data.user));
      },
      invalidatesTags: ['Me'],
    }),
  }),
});

export const { useUpdateProfileMutation } = profileApi;
