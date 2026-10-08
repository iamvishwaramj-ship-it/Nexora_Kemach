import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './baseApi';
import authReducer from './authSlice';
import themeReducer from './themeSlice';
import uiReducer from './uiSlice';
import tabsReducer from './tabsSlice';
import copyIntentReducer from './copyIntentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    ui: uiReducer,
    tabs: tabsReducer,
    copyIntent: copyIntentReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) => getDefault({
    serializableCheck: false,
    immutableCheck: false,

  }).concat(baseApi.middleware),
});

// Wires up RTK Query's window `focus`/`online` event listeners. Without
// this, a query hook's `refetchOnFocus`/`refetchOnReconnect`/
// `skipPollingIfUnfocused` options are silently inert -- nothing is
// listening for the browser events they depend on. This is additive and
// global: it does nothing on its own to any existing query, since none of
// those options are set anywhere yet. It only takes effect where a hook
// call opts in (see the Low Stock Report's periodic-sync polling, for one).
setupListeners(store.dispatch);

export default store;
