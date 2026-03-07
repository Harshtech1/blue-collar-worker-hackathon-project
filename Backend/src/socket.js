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

/**
 * Called ONCE from index.js after the httpServer is created.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client emits { userId } immediately after connecting
    socket.on('join', ({ userId }) => {
      if (!userId) return;
      socket.join(userId);
      console.log(`👤 User ${userId} joined room`);
    });

    socket.on('disconnect', () => {
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
