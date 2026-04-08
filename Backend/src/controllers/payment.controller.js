import { Payment } from '../models/Payment.js';
import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';

export const initiatePayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod, transactionId } = req.body;
    
    if (!bookingId) return res.status(400).json({ message: 'Booking ID is required' });

    const booking = await Booking.collection().findOne({ _id: new ObjectId(bookingId) });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Ensure double payment doesn't happen
    const existingPayment = await Payment.collection().findOne({ booking_id: new ObjectId(bookingId) });
    if (existingPayment) return res.status(400).json({ message: 'Payment already exists for this booking', payment: existingPayment });

    let commissionRate = 0.10; // Default 10%
    if (booking.service) {
      const category = await ServiceCategory.collection().findOne({ _id: new ObjectId(booking.service) });
      if (category && category.base_commission_rate !== undefined) {
        commissionRate = category.base_commission_rate;
      }
    }

    // Auto-calculate worker_earning vs platform_fee via schema function
    const paymentDoc = await Payment.calculateAndInsert(booking, paymentMethod, transactionId, commissionRate);

    // Update booking payment status
    await Booking.collection().updateOne(
      { _id: new ObjectId(bookingId) },
      { $set: { paymentStatus: 'paid', updatedAt: new Date() } }
    );

    // Auto-calculate into worker profile stats reliably
    if (booking.worker) {
      await WorkerProfile.collection().updateOne(
        { user: booking.worker },
        { 
          $inc: { completed_jobs_count: 1, total_earnings: paymentDoc.worker_amount },
          $set: { updatedAt: new Date() }
        }
      );
    }

    res.json({ message: 'Payment recorded and worker profile updated successfully', payment: paymentDoc });
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

export const getOverallPaymentStats = async (req, res) => {
  try {
    const db = getDb();
    
    const pipeline = [
      {
        $group: {
          _id: null,
          total_platform_revenue: { $sum: "$platform_fee_amount" },
          total_worker_revenue: { $sum: "$worker_amount" },
          total_gross_volume: { $sum: "$total_amount" },
          total_transactions: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          total_platform_revenue: { $round: ["$total_platform_revenue", 2] },
          total_worker_revenue: { $round: ["$total_worker_revenue", 2] },
          total_gross_volume: { $round: ["$total_gross_volume", 2] },
          total_transactions: 1
        }
      }
    ];

    const stats = await Payment.collection().aggregate(pipeline).toArray();
    
    // Add verification layer matching schema constraints
    let verifiedStats = stats[0] || { total_platform_revenue: 0, total_worker_revenue: 0, total_gross_volume: 0, total_transactions: 0 };
    
    // Safety check ensuring data integrity across the database matches expected calculations
    const expectedGross = Number((verifiedStats.total_platform_revenue + verifiedStats.total_worker_revenue).toFixed(2));
    verifiedStats.data_integrity_verified = (expectedGross === verifiedStats.total_gross_volume);

    res.json(verifiedStats);
  } catch (err) {
    console.error('getOverallPaymentStats Error:', err);
    res.status(500).json({ message: 'Server error retrieving payment stats' });
  }
};
