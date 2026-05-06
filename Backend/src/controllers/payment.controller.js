import { Payment } from '../models/Payment.js';
import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { appendStatusHistory } from '../utils/bookingWorkflow.js';
import { getIO } from '../socket.js';

export const initiatePayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod = 'upi', transactionId = null } = req.body;

    if (!bookingId) return res.status(400).json({ message: 'Booking ID is required' });

    const bookingObjectId = new ObjectId(bookingId);
    const booking = await Booking.collection().findOne({ _id: bookingObjectId });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (req.user?.role === 'customer' && booking.customer_user_id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only pay for your own booking' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Payment can only be recorded after the job is completed' });
    }

    const existingPayment = await Payment.collection().findOne({ booking_id: bookingObjectId });
    if (existingPayment) {
      return res.json({
        message: 'Payment already recorded for this booking',
        payment: existingPayment,
        transactionId: existingPayment.transaction_id,
      });
    }

    let commissionRate = 0.10;
    if (booking.service) {
      const category = await ServiceCategory.collection().findOne({ _id: new ObjectId(booking.service) });
      if (category?.base_commission_rate !== undefined) {
        commissionRate = category.base_commission_rate;
      }
    }

    const paymentDoc = await Payment.calculateAndInsert(booking, paymentMethod, transactionId, commissionRate);
    const statusHistory = appendStatusHistory(booking.statusHistory, booking.status, 'payment');

    await Booking.collection().updateOne(
      { _id: bookingObjectId },
      {
        $set: {
          paymentStatus: 'paid',
          updatedAt: new Date(),
          statusHistory,
        },
      },
    );

    if (booking.worker) {
      await WorkerProfile.collection().updateOne(
        { _id: booking.worker },
        {
          $inc: { completed_jobs_count: 1, total_earnings: paymentDoc.worker_amount },
          $set: { updatedAt: new Date() },
        },
      );
    }

    const io = getIO();
    if (io && booking.worker_user_id) {
      io.to(booking.worker_user_id.toString()).emit('payment_received', {
        bookingId,
        transactionId: paymentDoc.transaction_id,
        amount: paymentDoc.total_amount,
      });
    }

    res.json({
      message: 'Payment recorded and worker profile updated successfully',
      payment: paymentDoc,
      transactionId: paymentDoc.transaction_id,
    });
  } catch (err) {
    console.error('initiatePayment Error:', err);
    res.status(500).json({ message: 'Server error tracking payment' });
  }
};

export const getWorkerPayments = async (req, res) => {
  try {
    const workerId = req.user._id;
    const payments = await Payment.collection().find({ worker_id: new ObjectId(workerId) }).sort({ createdAt: -1 }).toArray();
    res.json(payments);
  } catch (err) {
    console.error('getWorkerPayments Error:', err);
    res.status(500).json({ message: 'Server error retrieving payments' });
  }
};

export const getCustomerPayments = async (req, res) => {
  try {
    const customerId = req.user._id;
    const payments = await Payment.collection().find({ customer_id: new ObjectId(customerId) }).sort({ createdAt: -1 }).toArray();
    res.json(payments);
  } catch (err) {
    console.error('getCustomerPayments Error:', err);
    res.status(500).json({ message: 'Server error retrieving payments' });
  }
};

export const getOverallPaymentStats = async (_req, res) => {
  try {
    const db = getDb();
    const stats = await db.collection('payments').aggregate([
      {
        $group: {
          _id: null,
          total_platform_revenue: { $sum: '$platform_fee_amount' },
          total_worker_revenue: { $sum: '$worker_amount' },
          total_gross_volume: { $sum: '$total_amount' },
          total_transactions: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          total_platform_revenue: { $round: ['$total_platform_revenue', 2] },
          total_worker_revenue: { $round: ['$total_worker_revenue', 2] },
          total_gross_volume: { $round: ['$total_gross_volume', 2] },
          total_transactions: 1,
        },
      },
    ]).toArray();

    const verifiedStats = stats[0] || {
      total_platform_revenue: 0,
      total_worker_revenue: 0,
      total_gross_volume: 0,
      total_transactions: 0,
    };

    const expectedGross = Number((verifiedStats.total_platform_revenue + verifiedStats.total_worker_revenue).toFixed(2));
    verifiedStats.data_integrity_verified = expectedGross === verifiedStats.total_gross_volume;

    res.json(verifiedStats);
  } catch (err) {
    console.error('getOverallPaymentStats Error:', err);
    res.status(500).json({ message: 'Server error retrieving payment stats' });
  }
};
