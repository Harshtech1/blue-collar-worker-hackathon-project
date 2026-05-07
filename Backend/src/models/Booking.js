import { getDb } from '../config/db.js';

const COLLECTION = 'bookings';

/*
 * Booking Data Structure
 * _id: ObjectId
 * customer_user_id: ObjectId (Ref to Users)
 * worker_user_id: ObjectId (Ref to Users)
 * service_categoryId: ObjectId (Ref to ServiceCategories)
 * amount: Number
 * base_commission_rate: Number // e.g., 0.15 (15%) Snapshot at booking time
 * status: Enum ["pending", "matched", "accepted", "arriving", "otp_verify", "in_progress", "completed", "cancelled"]
 * statusHistory: Array of Objects { status: String, timestamp: Date }
 * otp_start: String
 * otp_finish: String
 * beforeWorkPhoto: Object { url, secure_url, public_id, format, timestamp }
 * afterWorkPhoto: Object { url, secure_url, public_id, format, timestamp }
 * workStartedAt: Date
 * workCompletedAt: Date
 * cancelReason: String
 * paymentStatus: Enum ["pending", "paid", "failed", "refunded"]
 * match_candidates: ranked worker candidates with MatchScore metadata
 * waterfall_cursor: Number // currently pinged worker index
 * priceMultiplier: Number // density-based pricing snapshot
 * materialCost: Number // optional parts/material estimate
 * convenienceFee: Number // RAHI safety/platform fee
 * etaBuffer: Number // worker preparation buffer in minutes
 * createdAt / updatedAt: Date
 */

export const Booking = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.customer && !data.customer_user_id) errors.push('Customer ID is required');
    if (!data.service && !data.service_categoryId) errors.push('Service details are required');
    
    if (data.amount !== undefined && typeof data.amount !== 'number') {
      errors.push('Amount must be a number');
    }
    return errors;
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ customer_user_id: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ worker_user_id: 1, status: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ status: 1, createdAt: -1 });
  }
};
