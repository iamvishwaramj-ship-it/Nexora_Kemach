import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store/store';
import { AppThemeProvider } from './context/ThemeContext';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { NotificationProvider } from './components/feedback/NotificationProvider';
import { ConfirmProvider } from './components/feedback/ConfirmationDialog';
import NetworkStatusBanner from './components/feedback/NetworkStatusBanner';
import AppRouter from './router/AppRouter';
import './i18n/config';

const App = () => (
  <Provider store={store}>
    <AppThemeProvider>
      <NetworkStatusProvider>
        <NotificationProvider>
          <ConfirmProvider>
            {/* Opt in to the React Router v7 behaviours now, so the dev
                console stays clean and the v7 upgrade is a no-op. */}
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <NetworkStatusBanner />
              <AppRouter />
            </BrowserRouter>
          </ConfirmProvider>
        </NotificationProvider>
      </NetworkStatusProvider>
    </AppThemeProvider>
  </Provider>
);

export default App;
