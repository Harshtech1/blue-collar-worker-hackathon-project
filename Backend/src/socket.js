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
import { getDb } from './config/db.js';
import { ObjectId } from 'mongodb';

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
    socket.on('join', async ({ userId, role }) => {
      if (!userId) return;
      socket.join(userId);
      socket.data.userId = userId;
      socket.data.role = role || 'unknown';
      if (role) {
        socket.join(role);
      }

      // Track this user in connectedUsers map
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId).add(socket.id);

      console.log(`👤 User ${userId} (${role || 'unknown'}) joined room | Total connected: ${connectedUsers.size}`);

      // Update worker lastSeen on join (helps clear ghost status)
      if (role === 'worker') {
        try {
          const db = getDb();
          await db.collection('worker_profiles').updateOne(
            { user: new ObjectId(userId) },
            { $set: { lastSeen: new Date() } }
          );
        } catch (e) {
          console.error("Socket join worker update error:", e.message);
        }
      }
    });

    // ── Handle live location updates from workers ──────────────────────────
    socket.on('location_update', async (data) => {
      const { userId, lat, lng, bookingId, customerId } = data;
      if (!userId || !lat || !lng) return;

      console.log(`📍 Location update from worker ${userId}: ${lat}, ${lng} | Booking: ${bookingId}`);

      // Keep lastSeen active
      try {
        const db = getDb();
        await db.collection('worker_profiles').updateOne(
          { user: new ObjectId(userId) },
          { $set: { lastSeen: new Date() } }
        );
      } catch (e) {
        // ignore fast-fail
      }

      // Broadcast the update to the customer if customerId is provided
      if (customerId) {
        io.to(customerId.toString()).emit('worker_location_update', {
          workerId: userId,
          bookingId,
          lat,
          lng,
          timestamp: new Date()
        });
      }
    });

    // ── Handle in-app chat messages ─────────────────────────────────────────
    socket.on('send_message', async (data) => {
      const { bookingId, senderId, receiverId, text } = data;
      if (!bookingId || !senderId || !receiverId || !text) return;

      try {
        const db = getDb();
        const message = {
          bookingId: new ObjectId(bookingId),
          senderId: new ObjectId(senderId),
          receiverId: new ObjectId(receiverId),
          text,
          timestamp: new Date(),
          status: 'sent'
        };
        
        await db.collection('chat_messages').insertOne(message);
        
        // Emit to the receiver room (userId room)
        io.to(receiverId.toString()).emit('receive_message', {
          ...message,
          _id: message._id.toString(),
          bookingId: bookingId.toString(),
          senderId: senderId.toString(),
          receiverId: receiverId.toString()
        });
        
        console.log(`💬 Chat message from ${senderId} to ${receiverId} for booking ${bookingId}`);
      } catch (e) {
        console.error("Chat message error:", e.message);
      }
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
