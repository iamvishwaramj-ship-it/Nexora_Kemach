import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAccessToken } from '../store/authSlice';
import { notificationApi } from '../features/resources';
import { connectSocket, disconnectSocket, disconnectSocketIfLoggedOut } from './socket';
import { useNotify } from '../components/feedback/NotificationProvider';

// Same cap as the REST list (routes/notifications.js takes the newest 50).
const LIST_LIMIT = 50;
// Must equal the args Header.jsx passes to useGetNotificationsQuery -- RTK
// Query keys its cache on them, so updateQueryData would silently patch a
// different (nonexistent) entry otherwise.
const LIST_ARGS = undefined;

/**
 * Real-time notification bell. Keeps the RTK Query cache of
 * getNotifications in sync from socket events that CARRY their data, so a
 * push costs zero extra HTTP requests (no refetch-per-event).
 *
 *   notification:new     { notification, unreadCount }
 *   notification:updated { id?, status, actionStatus, referenceId, unreadCount }
 *
 * Handlers are registered once per login and removed on logout/unmount; the
 * socket is opened on login and closed on logout. No polling anywhere.
 */
export default function useNotificationSocket() {
  const dispatch = useDispatch();
  const notify = useNotify();
  const accessToken = useSelector(selectAccessToken);
  const loggedIn = Boolean(accessToken);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const hasConnectedRef = useRef(false);

  const patchList = (recipe) => dispatch(notificationApi.util.updateQueryData('getNotifications', LIST_ARGS, recipe));

  // Open the connection once per login; handlers live exactly as long as it does.
  useEffect(() => {
    if (!loggedIn) {
      hasConnectedRef.current = false;
      disconnectSocket();
      return undefined;
    }
    const socket = connectSocket();
    if (!socket) return undefined;

    const onNew = ({ notification, unreadCount } = {}) => {
      if (!notification) return;
      patchList((draft) => {
        // Upsert: a re-opened row (PUT re-routing) arrives as "new" with an id we already hold.
        draft.data = [notification, ...draft.data.filter((n) => n.id !== notification.id)].slice(0, LIST_LIMIT);
        if (typeof unreadCount === 'number') draft.unreadCount = unreadCount;
      });
      const text = notification.message ? `${notification.title}: ${notification.message}` : notification.title;
      notifyRef.current.info(text);
    };

    const onUpdated = ({ id, status, actionStatus, referenceId, unreadCount } = {}) => {
      patchList((draft) => {
        // By id when the server knows the row; by document (referenceId +
        // type 'ApprovalRequest') for the bulk sync cases that carry no id.
        const targets = id != null
          ? draft.data.filter((n) => n.id === id)
          : draft.data.filter((n) => n.referenceId === referenceId && n.type === 'ApprovalRequest' && !n.actionStatus);
        targets.forEach((n) => {
          if (status !== undefined) n.status = status;
          if (actionStatus !== undefined) n.actionStatus = actionStatus;
        });
        if (typeof unreadCount === 'number') draft.unreadCount = unreadCount;
      });
    };

    const onConnect = () => {
      // Catch-up: only when this is a RE-connect and the server could not
      // replay what we missed (connection-state recovery failed). One
      // refetch, not one per event.
      if (hasConnectedRef.current && socket.recovered === false) {
        dispatch(notificationApi.endpoints.getNotifications.initiate(LIST_ARGS, { forceRefetch: true })).unsubscribe();
      }
      hasConnectedRef.current = true;
    };

    // The server drops a user's sockets when an admin changes their access
    // ("io server disconnect" is never retried by socket.io itself): dial
    // back in so the handshake is re-checked against current access.
    const onDisconnect = (reason) => {
      if (reason === 'io server disconnect') setTimeout(() => connectSocket(), 500);
    };

    socket.on('notification:new', onNew);
    socket.on('notification:updated', onUpdated);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:updated', onUpdated);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      disconnectSocketIfLoggedOut();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // A refreshed token after a denied handshake: ask for another attempt. A
  // healthy connection is left alone (auth() reads the token on its own).
  useEffect(() => {
    if (loggedIn) connectSocket();
  }, [accessToken, loggedIn]);
}
