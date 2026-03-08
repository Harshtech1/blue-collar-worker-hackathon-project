/**
 * socket.js — Socket.IO singleton
 * ─────────────────────────────────────────────────────────────────────────────
 * Breaks the circular dependency:
 *   index.js → booking.routes.js → booking.controller.js → index.js  ← LOOP
 *
 * Now both index.js and booking.controller.js import from HERE instead.
 * index.js calls initSocket(httpServer) once at startup to bind the instance.
 * booking.controller.js calls getIO() to emit events safely.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Server } from 'socket.io';

let io = null;

// Track connected users by userId → Set of socketIds
const connectedUsers = new Map();

/**
 * Called ONCE from index.js after the httpServer is created.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, true), // permissive in dev
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client emits { userId, role } immediately after connecting
    socket.on('join', ({ userId, role }) => {
      if (!userId) return;
      socket.join(userId);
      socket.data.userId = userId;
      socket.data.role = role || 'unknown';

      // Track this user in connectedUsers map
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId).add(socket.id);

      console.log(`👤 User ${userId} (${role || 'unknown'}) joined room | Total connected: ${connectedUsers.size}`);
    });

    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId && connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);
        if (connectedUsers.get(userId).size === 0) {
          connectedUsers.delete(userId);
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Returns the initialized Socket.IO instance.
 * Safe to call from any module — returns null if called before initSocket().
 * @returns {import('socket.io').Server | null}
 */
export function getIO() {
  return io;
}

/**
 * Returns an array of all currently connected user IDs.
 * Useful for creating DB notifications for broadcast bookings.
 * @returns {string[]}
 */
export function getConnectedUserIds() {
  return Array.from(connectedUsers.keys());
}
