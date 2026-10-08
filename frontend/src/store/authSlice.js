import { createSlice } from '@reduxjs/toolkit';

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem('nexora_user') || 'null');
  } catch {
    return null;
  }
}

const initialState = {
  user: loadUser(),
  accessToken: localStorage.getItem('nexora_access_token') || null,
  refreshToken: localStorage.getItem('nexora_refresh_token') || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsSet(state, action) {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      localStorage.setItem('nexora_user', JSON.stringify(user));
      localStorage.setItem('nexora_access_token', accessToken);
      if (refreshToken) localStorage.setItem('nexora_refresh_token', refreshToken);
    },
    accessTokenRefreshed(state, action) {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem('nexora_access_token', action.payload.accessToken);
    },
    userUpdated(state, action) {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('nexora_user', JSON.stringify(state.user));
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      localStorage.removeItem('nexora_user');
      localStorage.removeItem('nexora_access_token');
      localStorage.removeItem('nexora_refresh_token');
    },
  },
});

export const { credentialsSet, accessTokenRefreshed, userUpdated, loggedOut } = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.user;
export const selectAccessToken = (state) => state.auth.accessToken;
