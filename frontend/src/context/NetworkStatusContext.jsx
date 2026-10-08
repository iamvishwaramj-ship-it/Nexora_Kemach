import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

// Global network-status watcher — mounted ONCE at the app root (see App.jsx)
// so it is active on the login page and everywhere in the authenticated app
// without any per-page wiring.
//
// Offline/online: navigator.onLine + the browser's 'online'/'offline'
// window events. No backend ping/health-check on purpose — this is
// browser-signal-only detection.
//
// Slow network: the Network Information API (navigator.connection, with the
// Firefox/older-WebKit prefixed fallbacks). We read effectiveType ('2g' or
// 'slow-2g' counts as slow) and downlink (< 0.5 Mbps counts as slow), and
// listen for the connection object's 'change' event to stay live. This API
// has no Safari/iOS support — getConnection() then returns null and slow-
// network detection is simply skipped there; offline/online detection still
// works everywhere since it only depends on navigator.onLine.
const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g']);
const SLOW_DOWNLINK_MBPS = 0.5;

const NetworkStatusContext = createContext(null);

function getConnection() {
  if (typeof navigator === 'undefined') return null;
  return (
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection ||
    null
  );
}

function readConnectionInfo() {
  const connection = getConnection();
  if (!connection) {
    return { effectiveType: null, downlink: null, isSlow: false };
  }
  const effectiveType = connection.effectiveType ?? null;
  const downlink = typeof connection.downlink === 'number' ? connection.downlink : null;
  const isSlow =
    (effectiveType != null && SLOW_EFFECTIVE_TYPES.has(effectiveType)) ||
    (downlink != null && downlink < SLOW_DOWNLINK_MBPS);
  return { effectiveType, downlink, isSlow };
}

export function NetworkStatusProvider({ children }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [connectionInfo, setConnectionInfo] = useState(readConnectionInfo);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const connection = getConnection();
    if (!connection) return undefined;

    const handleChange = () => setConnectionInfo(readConnectionInfo());
    handleChange();

    // Network Information API dispatches 'change' on the connection object
    // itself, not on window.
    connection.addEventListener?.('change', handleChange);

    return () => {
      connection.removeEventListener?.('change', handleChange);
    };
  }, []);

  const setOfflineState = useCallback(() => setIsOnline(false), []);
  useEffect(() => {
    // Guard against SSR/environments with no navigator (defensive; this is
    // an SPA so this normally never fires).
    if (typeof navigator === 'undefined') {
      setOfflineState();
    }
  }, [setOfflineState]);

  const value = useMemo(
    () => ({
      isOnline,
      isSlow: isOnline && connectionInfo.isSlow,
      effectiveType: connectionInfo.effectiveType,
      downlink: connectionInfo.downlink,
    }),
    [isOnline, connectionInfo]
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) throw new Error('useNetworkStatus must be used within NetworkStatusProvider');
  return ctx;
}
