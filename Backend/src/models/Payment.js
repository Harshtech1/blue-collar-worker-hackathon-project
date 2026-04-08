import { getDb } from '../config/db.js';

const COLLECTION = 'payments';

/*
 * Payment Data Structure
 * _id: ObjectId
 * booking_id: ObjectId (Ref to Bookings)
 * customer_id: ObjectId (Ref to Users)
 * worker_id: ObjectId (Ref to Users)
 * total_amount: Number
 * platform_fee_amount: Number
 * worker_amount: Number
 * status: Enum ["pending", "completed", "failed", "refunded"]
 * payment_method: String ("cash", "card", "upi")
 * transaction_id: String (optional, if online)
 * createdAt / updatedAt: Date
 */

export const Payment = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.booking_id) errors.push('Booking ID is required');
    if (!data.total_amount || typeof data.total_amount !== 'number') {
        errors.push('Total amount is required and must be a number');
    }
    return errors;
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ booking_id: 1 }, { unique: true });
    await db.collection(COLLECTION).createIndex({ customer_id: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ worker_id: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ status: 1 });
  }
};
