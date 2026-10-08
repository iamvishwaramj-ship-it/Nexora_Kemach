// Socket.io wiring for real-time notification push (Notification bell
// feature). Routes never touch `io` directly: after a transaction COMMITS
// they hand rows to emitNotifications(), which is the only emit path.
//
// init(server) is called once from server.js with the http.Server returned
// by app.listen(), so Socket.io shares the REST API's port and CORS list.
//
// Scaling note: rooms live in this process's memory. On a SINGLE backend
// instance that is all that is needed. If the API ever runs on several
// instances, set SOCKET_REDIS_URL and install `@socket.io/redis-adapter` and
// `redis` (npm i @socket.io/redis-adapter redis) -- the adapter is wired up
// below only when that variable is present. The host must also allow
// WebSocket upgrades (the client falls back to long-polling otherwise, which
// works but costs more requests).

const { Server } = require('socket.io');
const { verifyAccessToken } = require('./jwt');
const prisma = require('../prisma/client');

let io = null;

const room = (userId) => `user:${userId}`;

async function attachRedisAdapter(server) {
  const url = process.env.SOCKET_REDIS_URL;
  if (!url) return;
  try {
    // Lazy require: the packages are optional and only needed when scaling out.
    // eslint-disable-next-line global-require, import/no-unresolved
    const { createAdapter } = require('@socket.io/redis-adapter');
    // eslint-disable-next-line global-require, import/no-unresolved
    const { createClient } = require('redis');
    const pub = createClient({ url });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    server.adapter(createAdapter(pub, sub));
    console.log('Socket.io: Redis adapter enabled');
  } catch (err) {
    console.error('Socket.io: SOCKET_REDIS_URL is set but the Redis adapter failed to start; continuing single-instance:', err.message);
  }
}

/**
 * Attach Socket.io to an existing http.Server.
 * @param {import('http').Server} server
 * @param {{ corsOptions: object }} options - reuse app.js's corsOptions so
 *   the allowed-origins list only has to be maintained in one place.
 */
function init(server, { corsOptions } = {}) {
  io = new Server(server, {
    cors: corsOptions || { origin: '*' },
    // Replays events a client missed during a short drop (Wi-Fi blip, laptop
    // lid) instead of forcing a refetch; the client falls back to ONE
    // catch-up fetch when recovery is not possible (see useNotificationSocket).
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false },
    // Payloads are tiny; per-message compression only burns CPU and memory.
    perMessageDeflate: false,
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  attachRedisAdapter(io);

  // Handshake auth: valid JWT AND the account must still be Active. The JWT
  // alone would keep a deactivated user connected until their token expires.
  // `auth` arrives as the plain object the client's auth() callback produced.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
    try {
      const user = await prisma.appUser.findUnique({ where: { id: decoded.id }, select: { id: true, status: true, role: true } });
      if (!user || user.status !== 'Active') return next(new Error('Account is not active'));
      socket.user = { id: user.id, role: user.role };
      return next();
    } catch (err) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // One room per user, joined server-side only. There are deliberately no
    // client `join` handlers: recipients are resolved on the server and a
    // client can never subscribe itself to someone else's room.
    socket.join(room(socket.user.id));
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet — call init(server) from server.js first.');
  }
  return io;
}

/**
 * Low-level single push (kept for callers that just need to nudge one user).
 * No-op without an initialized io or an open socket.
 */
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(room(userId)).emit(event, payload);
}

/**
 * Push notification events to their owners, AFTER the DB transaction
 * committed. Never throws: a failed push must not fail the HTTP response --
 * the rows are already saved and the client catches up on its next fetch.
 *
 * events: Array of
 *   { kind: 'new', notification }                         -> 'notification:new'
 *   { kind: 'updated', userId, id?, status, actionStatus, referenceId }
 *                                                          -> 'notification:updated'
 * Every payload also carries that user's `unreadCount`. It is per-user, so
 * payloads are not identical across users and cannot be batched into one
 * io.to([rooms]) call; the cost is kept down by computing all counts with a
 * single groupBy and emitting once per event, not once per recipient check.
 */
async function emitNotifications(events) {
  try {
    if (!io || !Array.isArray(events) || !events.length) return;
    const userIdOf = (e) => (e.kind === 'new' ? e.notification.userId : e.userId);
    const userIds = [...new Set(events.map(userIdOf))];

    const grouped = await prisma.notification.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: 'Unread' },
      _count: { _all: true },
    });
    const unread = new Map(grouped.map((g) => [g.userId, g._count._all]));

    events.forEach((e) => {
      const userId = userIdOf(e);
      const unreadCount = unread.get(userId) || 0;
      if (e.kind === 'new') {
        io.to(room(userId)).emit('notification:new', { notification: e.notification, unreadCount });
      } else {
        io.to(room(userId)).emit('notification:updated', {
          id: e.id,
          status: e.status,
          actionStatus: e.actionStatus,
          referenceId: e.referenceId,
          unreadCount,
        });
      }
    });
  } catch (err) {
    console.error('emitNotifications failed (ignored):', err.message);
  }
}

/**
 * Drop every open socket of a user so they reconnect and the handshake is
 * re-checked against their CURRENT account state. Called when an admin
 * changes a non-admin's permissions/branches. Never throws.
 */
function disconnectUser(userId) {
  try {
    if (!io) return;
    io.in(room(userId)).disconnectSockets(true);
  } catch (err) {
    console.error('disconnectUser failed (ignored):', err.message);
  }
}

module.exports = { init, getIO, emitToUser, emitNotifications, disconnectUser };
