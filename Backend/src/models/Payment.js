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
    if (data.total_amount === undefined || typeof data.total_amount !== 'number') {
        errors.push('Total amount is required and must be a number');
    }
    return errors;
  },

  // Backend schema function to auto-calculate worker_earning vs platform_fee
  calculateAndInsert: async (booking, paymentMethod, transactionId, baseCommissionRate = 0.10) => {
    const db = getDb();
    
    const totalAmount = booking.amount || 0;
    const platformFee = Number((totalAmount * baseCommissionRate).toFixed(2));
    const workerEarning = Number((totalAmount - platformFee).toFixed(2));

    const paymentDoc = {
      booking_id: booking._id,
      customer_id: booking.customer,
      worker_id: booking.worker,
      total_amount: totalAmount,
      platform_fee_amount: platformFee,
      worker_amount: workerEarning,
      status: 'completed',
      payment_method: paymentMethod || 'cash',
      transaction_id: transactionId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Before inserting, could run Payment.validate()
    const errors = Payment.validate(paymentDoc);
    if (errors.length > 0) throw new Error(`Payment validation failed: ${errors.join(', ')}`);

    const result = await db.collection(COLLECTION).insertOne(paymentDoc);
    return { ...paymentDoc, _id: result.insertedId };
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ booking_id: 1 }, { unique: true });
    await db.collection(COLLECTION).createIndex({ customer_id: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ worker_id: 1, createdAt: -1 });
    await db.collection(COLLECTION).createIndex({ status: 1 });
  }
};
