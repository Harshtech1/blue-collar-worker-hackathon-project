import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';

class ChatMessage {
  static collection() {
    return getDb().collection('chat_messages');
  }

  static async create(data) {
    const message = {
      bookingId: data.bookingId instanceof ObjectId ? data.bookingId : new ObjectId(data.bookingId),
      senderId: data.senderId instanceof ObjectId ? data.senderId : new ObjectId(data.senderId),
      receiverId: data.receiverId instanceof ObjectId ? data.receiverId : new ObjectId(data.receiverId),
      text: data.text,
      timestamp: new Date(),
      status: 'sent' // sent, delivered, read
    };
    return await this.collection().insertOne(message);
  }

  static async getByBooking(bookingId) {
    return await this.collection()
      .find({ bookingId: new ObjectId(bookingId) })
      .sort({ timestamp: 1 })
      .toArray();
  }
}

export { ChatMessage };
