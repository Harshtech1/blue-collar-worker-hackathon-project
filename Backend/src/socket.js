import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { getDb } from './config/db.js';

let io = null;

// userId -> Set<socketId>. Used for targeted booking/chat notifications.
const connectedUsers = new Map();

const toObjectId = (id) => {
  try {
    return id ? new ObjectId(id) : null;
  } catch {
    return null;
  }
};

const asString = (value) => value?.toString?.() || value || '';
const chatRoom = (bookingId) => `booking:${bookingId}`;

const serializeChatMessage = (message) => ({
  ...message,
  _id: asString(message._id),
  bookingId: asString(message.bookingId),
  senderId: asString(message.senderId),
  receiverId: asString(message.receiverId),
  timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
});

const resolveChatParticipants = async ({ bookingId, senderId, receiverId }) => {
  const bookingObjectId = toObjectId(bookingId);
  if (!bookingObjectId) return { error: 'Invalid booking ID' };

  const db = getDb();
  const booking = await db.collection('bookings').findOne({ _id: bookingObjectId });
  if (!booking) return { error: 'Booking not found' };

  const customerId = asString(booking.customer_user_id);
  const workerId = asString(booking.worker_user_id);
  const normalizedSenderId = asString(senderId);
  const requestedReceiverId = asString(receiverId);
  const expectedReceiverId = normalizedSenderId === customerId
    ? workerId
    : normalizedSenderId === workerId
      ? customerId
      : requestedReceiverId;

  if (requestedReceiverId && expectedReceiverId && requestedReceiverId !== expectedReceiverId) {
    console.warn(
      `Ignoring mismatched chat receiver ${requestedReceiverId}; expected ${expectedReceiverId} for booking ${bookingId}`,
    );
  }

  return {
    booking,
    bookingObjectId,
    customerId,
    workerId,
    senderId: normalizedSenderId,
    receiverId: expectedReceiverId,
  };
};

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, true),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join', async ({ userId, role } = {}) => {
      if (!userId) return;

      socket.join(userId);
      socket.data.userId = userId;
      socket.data.role = role || 'unknown';
      if (role) socket.join(role);

      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId).add(socket.id);

      console.log(`User ${userId} (${role || 'unknown'}) joined private socket room`);

      if (role === 'worker') {
        try {
          const db = getDb();
          const workerUserId = toObjectId(userId);
          if (workerUserId) {
            await db.collection('worker_profiles').updateOne(
              { user: workerUserId },
              { $set: { lastSeen: new Date() } },
            );
          }
        } catch (e) {
          console.error('Socket join worker update error:', e.message);
        }
      }
    });

    socket.on('join_booking_chat', async ({ bookingId, userId } = {}) => {
      if (!bookingId) return;

      try {
        const participantId = asString(userId || socket.data.userId);
        const { error, customerId, workerId } = await resolveChatParticipants({
          bookingId,
          senderId: participantId,
        });

        if (error) {
          socket.emit('chat_error', { bookingId, message: error });
          return;
        }

        const isParticipant = participantId && [customerId, workerId].includes(participantId);
        if (!isParticipant && process.env.NODE_ENV === 'production') {
          socket.emit('chat_error', { bookingId, message: 'Not authorized for this booking chat' });
          return;
        }

        socket.join(chatRoom(bookingId));
        socket.emit('chat_joined', { bookingId, room: chatRoom(bookingId) });
        console.log(`Chat participant ${participantId || socket.id} joined ${chatRoom(bookingId)}`);
      } catch (e) {
        console.error('Join booking chat error:', e.message);
        socket.emit('chat_error', { bookingId, message: 'Unable to join booking chat' });
      }
    });

    socket.on('location_update', async (data = {}) => {
      const { userId, lat, lng, bookingId, customerId } = data;
      if (!userId || !lat || !lng) return;

      try {
        const db = getDb();
        const workerUserId = toObjectId(userId);
        if (workerUserId) {
          await db.collection('worker_profiles').updateOne(
            { user: workerUserId },
            { $set: { lastSeen: new Date() } },
          );
        }
      } catch {
        // Location should stay real-time even if lastSeen persistence fails.
      }

      if (customerId) {
        io.to(customerId.toString()).emit('worker_location_update', {
          workerId: userId,
          bookingId,
          lat,
          lng,
          timestamp: new Date(),
        });
      }
    });

    socket.on('send_message', async (data = {}) => {
      const { bookingId, receiverId, text, clientMessageId } = data;
      const senderId = asString(data.senderId || socket.data.userId);
      const cleanText = String(text || '').trim();

      if (!bookingId || !senderId || !cleanText) {
        socket.emit('chat_error', {
          bookingId,
          clientMessageId,
          message: 'Message, booking, and sender are required',
        });
        return;
      }

      try {
        const db = getDb();
        const participantResult = await resolveChatParticipants({ bookingId, senderId, receiverId });

        if (participantResult.error) {
          socket.emit('chat_error', {
            bookingId,
            clientMessageId,
            message: participantResult.error,
          });
          return;
        }

        const { bookingObjectId, customerId, workerId } = participantResult;
        const resolvedReceiverId = participantResult.receiverId;
        const isParticipant = [customerId, workerId].includes(senderId);

        if (!resolvedReceiverId) {
          socket.emit('chat_error', {
            bookingId,
            clientMessageId,
            message: 'The other participant is not assigned to this booking yet',
          });
          return;
        }

        if (!isParticipant && process.env.NODE_ENV === 'production') {
          socket.emit('chat_error', {
            bookingId,
            clientMessageId,
            message: 'Not authorized for this booking chat',
          });
          return;
        }

        const chatMessages = db.collection('chat_messages');

        if (clientMessageId) {
          const existingMessage = await chatMessages.findOne({
            bookingId: bookingObjectId,
            clientMessageId,
          });

          if (existingMessage) {
            const existingPayload = serializeChatMessage(existingMessage);
            socket.emit('message_sent', existingPayload);
            socket.to(chatRoom(bookingId)).to(resolvedReceiverId).emit('receive_message', existingPayload);
            return;
          }
        }

        const message = {
          bookingId: bookingObjectId,
          senderId: toObjectId(senderId) || senderId,
          receiverId: toObjectId(resolvedReceiverId) || resolvedReceiverId,
          text: cleanText,
          timestamp: new Date(),
          status: 'sent',
          clientMessageId: clientMessageId || null,
        };

        const insertResult = await chatMessages.insertOne(message);
        const payload = serializeChatMessage({ ...message, _id: insertResult.insertedId });

        socket.join(chatRoom(bookingId));
        socket.emit('message_sent', payload);
        socket.to(chatRoom(bookingId)).to(resolvedReceiverId).emit('receive_message', payload);

        console.log(`Chat message from ${senderId} to ${resolvedReceiverId} for booking ${bookingId}`);
      } catch (e) {
        console.error('Chat message error:', e.message);
        socket.emit('chat_error', {
          bookingId,
          clientMessageId,
          message: 'Message could not be delivered',
        });
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
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function getConnectedUserIds() {
  return Array.from(connectedUsers.keys());
}
