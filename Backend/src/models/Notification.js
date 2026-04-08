import { getDb } from '../config/db.js';

const COLLECTION = 'notifications';

/*
 * Notification Data Structure
 * _id: ObjectId
 * recipient_user_id: ObjectId (Ref to Users)
 * type: Enum ['job_invite', 'status_update', 'payment', 'system']
 * title: String
 * message: String
 * relatedId: ObjectId (Optional reference to Booking, etc)
 * read: Boolean
 * createdAt / updatedAt: Date
 */

export const Notification = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.user && !data.recipient_user_id) errors.push('User/Recipient ID is required');
    if (!data.title) errors.push('Title is required');
    if (!data.message) errors.push('Message is required');
    return errors;
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ user: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ recipient_user_id: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ user: 1, read: 1 });
  }
};
