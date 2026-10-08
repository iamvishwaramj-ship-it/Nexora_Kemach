import './lib/ariaHiddenFix';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppBootGate from './components/feedback/AppBootGate';
import AppErrorBoundary from './components/feedback/AppErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppBootGate>
        <App />
      </AppBootGate>
    </AppErrorBoundary>
  </React.StrictMode>
);
