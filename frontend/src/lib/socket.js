// Socket.io client singleton for the Notification bell feature. One shared
// connection per login, used by useNotificationSocket() (lib/
// useNotificationSocket.js), which owns every event handler -- this module
// only creates/tears down the connection.
import { io } from 'socket.io-client';
import { BASE_URL } from '../store/baseApi';
import { store } from '../store/store';

let socket = null;

/**
 * Open (or reuse) the connection. `auth` is a FUNCTION so every (re)connect
 * handshake reads the CURRENT access token from the store -- after a token
 * refresh a reconnect just works, with no manual disconnect/reconnect dance.
 */
export function connectSocket() {
  if (!store.getState().auth.accessToken) return null;
  if (!socket) {
    socket = io(BASE_URL, {
      auth: (cb) => cb({ token: store.getState().auth.accessToken }),
      transports: ['websocket', 'polling'],
    });
  } else if (!socket.connected && !socket.active) {
    // A denied handshake (expired token) stops auto-retry; once a fresh token
    // exists the caller asks for another attempt here.
    socket.connect();
  }
  return socket;
}

export function getSocket() {
  return socket;
}

// For effect cleanups: the header unmounts on logout before its own effect can
// observe the cleared token, so the socket is closed here once no token is left.
export function disconnectSocketIfLoggedOut() {
  if (!store.getState().auth.accessToken) disconnectSocket();
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
