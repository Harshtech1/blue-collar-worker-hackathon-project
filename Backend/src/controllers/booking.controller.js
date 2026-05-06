import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ObjectId } from 'mongodb';
import { getIO } from '../socket.js';
import { createNotification } from './notification.controller.js';
import { sendEmail } from '../utils/emailService.js';
import { getDb } from '../config/db.js';
import {
  appendStatusHistory,
  canTransitionBookingStatus,
  isDemoOtp,
  normalizePaymentStatus,
} from '../utils/bookingWorkflow.js';

const toObjectId = (id) => {
  try {
    return id ? new ObjectId(id) : null;
  } catch {
    return null;
  }
};

const asString = (value) => value?.toString?.() || value || '';

const serializeChatMessage = (message) => ({
  ...message,
  _id: asString(message._id),
  bookingId: asString(message.bookingId),
  senderId: asString(message.senderId),
  receiverId: asString(message.receiverId),
  timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
});

const buildPopulatePipeline = () => ([
  { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'service' } },
  { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customer' } },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'worker_profiles', localField: 'worker', foreignField: '_id', as: 'worker_profile' } },
  { $unwind: { path: '$worker_profile', preserveNullAndEmptyArrays: true } },
]);

const emitBookingUpdate = (bookingId, booking) => {
  const io = getIO();
  if (!io || !booking) return;

  const payload = {
    bookingId: bookingId.toString(),
    status: booking.status,
    updatedAt: booking.updatedAt,
    paymentStatus: booking.paymentStatus,
    workerName: booking.workerName,
    workerPhone: booking.workerPhone,
    worker_user_id: booking.worker_user_id,
  };

  if (booking.customer_user_id) {
    io.to(booking.customer_user_id.toString()).emit('booking_updated', payload);
  }

  if (booking.worker_user_id) {
    io.to(booking.worker_user_id.toString()).emit('booking_updated', payload);
  }
};

export const createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      customerId,
      customer_user_id,
      workerId,
      worker_user_id,
      scheduled_at,
      address,
      city,
      amount,
      serviceName,
      customerName,
      customerPhone,
      bookingType,
      description,
      customer_lat,
      customer_lng,
    } = req.body;

    if (!serviceName || !customer_user_id) {
      return res.status(400).json({ message: 'Missing required fields: serviceName, customer_user_id' });
    }

    const normalizedAmount = Number(amount || 0);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      return res.status(400).json({ message: 'Amount must be a valid non-negative number' });
    }

    const doc = {
      service: toObjectId(serviceId) || null,
      customer: toObjectId(customerId) || null,
      customer_user_id: customer_user_id || null,
      worker: toObjectId(workerId) || null,
      worker_user_id: worker_user_id || null,
      status: 'pending',
      paymentStatus: 'pending',
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      address: address || null,
      city: city || null,
      amount: normalizedAmount,
      serviceName: serviceName || null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      bookingType: bookingType || 'instant',
      description: description || null,
      customer_lat: customer_lat || null,
      customer_lng: customer_lng || null,
      declined_worker_ids: [],
      otp_start: Math.floor(1000 + Math.random() * 9000).toString(),
      otp_finish: Math.floor(1000 + Math.random() * 9000).toString(),
      statusHistory: appendStatusHistory([], 'pending', 'customer'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await Booking.collection().insertOne(doc);
    const insertedId = result.insertedId;

    let availableWorkers = [];
    if (!worker_user_id && !workerId && customer_lng && customer_lat) {
      try {
        const coordinates = [parseFloat(customer_lng), parseFloat(customer_lat)];
        availableWorkers = await WorkerProfile.collection().find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates },
              $maxDistance: 10000,
            },
          },
          isAvailable: true,
          status: 'online',
        }).limit(10).toArray();
      } catch (geoErr) {
        console.error('Geospatial matcher error:', geoErr.message);
      }
    }

    const bookingPayload = {
      bookingId: insertedId.toString(),
      serviceName: serviceName || 'Service Request',
      customerName: customerName || 'A customer',
      customerPhone: customerPhone || '',
      address: address || 'Address not specified',
      city: city || '',
      amount: normalizedAmount,
      scheduled_at: scheduled_at || null,
      customer_user_id: customer_user_id || null,
      bookingType: bookingType || 'instant',
      description: description || null,
    };

    const io = getIO();
    if (io) {
      if (worker_user_id || workerId) {
        io.to((worker_user_id || workerId).toString()).emit('new_booking', bookingPayload);
      } else if (availableWorkers.length > 0) {
        availableWorkers.forEach((worker) => {
          io.to(worker.user.toString()).emit('new_booking', bookingPayload);
        });
      } else {
        const allOnlineWorkers = await WorkerProfile.collection().find({ status: 'online', isAvailable: true }).toArray();
        allOnlineWorkers.forEach((worker) => {
          io.to(worker.user.toString()).emit('new_booking', bookingPayload);
        });
      }
    }

    if (customer_user_id) {
      await createNotification(
        customer_user_id,
        'booking_pending',
        'Booking created',
        `Your ${serviceName || 'service'} booking has been sent to nearby workers.`,
        insertedId.toString(),
      );
    }

    const targetWorkers = worker_user_id || workerId
      ? [{ user: worker_user_id || workerId }]
      : availableWorkers.length > 0
        ? availableWorkers
        : await WorkerProfile.collection().find({ status: 'online', isAvailable: true }).toArray();

    for (const worker of targetWorkers) {
      const workerUserId = worker.user?.toString?.() || worker.user || worker;
      if (!workerUserId || workerUserId === customer_user_id) continue;
      await createNotification(
        workerUserId,
        'new_booking',
        'New booking request',
        `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: Rs ${normalizedAmount}`,
        insertedId.toString(),
      );
    }

    try {
      const db = getDb();
      const customerUser = await db.collection('users').findOne({ _id: toObjectId(customer_user_id) });
      if (customerUser?.email) {
        sendEmail(
          customerUser.email,
          'RAHI booking confirmed - your service OTPs',
          `Your ${serviceName || 'service'} booking has been placed successfully.\n\nStart OTP: ${doc.otp_start}\nFinish OTP: ${doc.otp_finish}\n\nShare these only when appropriate.`,
        ).catch((emailError) => console.error('[Booking OTP email] Failed:', emailError.message));
      }
    } catch (emailErr) {
      console.error('[Booking OTP email] Error:', emailErr.message);
    }

    const booking = await Booking.collection().aggregate([
      { $match: { _id: insertedId } },
      ...buildPopulatePipeline(),
    ]).next();

    res.json({ ...booking, _id: insertedId, bookingId: insertedId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const respondToBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Allowed: accepted, declined' });
    }

    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid booking ID' });

    const currentBooking = await Booking.collection().findOne({ _id: objId });
    if (!currentBooking) return res.status(404).json({ message: 'Booking not found' });

    if (status === 'accepted') {
      const workerProfile = await WorkerProfile.collection().findOne({ user: req.user._id });
      const updates = {
        status: 'accepted',
        updatedAt: new Date(),
        worker_user_id: req.user._id.toString(),
        workerName: req.user.full_name || 'Worker',
        workerPhone: req.user.phone || '',
        statusHistory: appendStatusHistory(currentBooking.statusHistory, 'accepted', 'worker'),
      };

      if (workerProfile) {
        updates.worker = workerProfile._id;
      }

      const result = await Booking.collection().findOneAndUpdate(
        { _id: objId, status: 'pending' },
        { $set: updates },
        { returnDocument: 'after' },
      );

      const updatedBooking = result?.value ?? result;
      if (!updatedBooking || !updatedBooking._id) {
        const io = getIO();
        if (io && req.user) {
          io.to(req.user._id.toString()).emit('booking_taken', {
            bookingId: id,
            takenBy: currentBooking?.workerName || 'Another worker',
            message: 'This booking was already accepted by another worker.',
          });
        }

        return res.status(409).json({
          message: 'This booking was already accepted by another worker.',
          code: 'BOOKING_ALREADY_TAKEN',
        });
      }

      emitBookingUpdate(id, updatedBooking);

      if (updatedBooking.customer_user_id) {
        await createNotification(
          updatedBooking.customer_user_id,
          'status_update',
          'Worker accepted your booking',
          `${updates.workerName} accepted your ${updatedBooking.serviceName || 'service'} request.`,
          id,
        );
      }

      await createNotification(
        req.user._id.toString(),
        'booking_confirmed',
        'Booking accepted',
        `You accepted ${updatedBooking.customerName || 'a customer'}'s ${updatedBooking.serviceName || 'service'} request.`,
        id,
      );

      return res.json({ success: true, booking: updatedBooking });
    }

    const declineResult = await Booking.collection().findOneAndUpdate(
      { _id: objId },
      {
        $set: { updatedAt: new Date() },
        $addToSet: { declined_worker_ids: req.user._id.toString() },
      },
      { returnDocument: 'after' },
    );

    const updatedBooking = declineResult?.value ?? declineResult;
    if (!updatedBooking || !updatedBooking._id) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const io = getIO();
    if (io) {
      io.to(req.user._id.toString()).emit('booking_declined_ack', {
        bookingId: id,
        updatedAt: updatedBooking.updatedAt,
      });
    }

    await createNotification(
      req.user._id.toString(),
      'booking_cancelled',
      'Booking skipped',
      `You skipped ${updatedBooking.customerName || 'a customer'}'s ${updatedBooking.serviceName || 'service'} request.`,
      id,
    );

    return res.json({ success: true, booking: updatedBooking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listBookings = async (req, res) => {
  try {
    const query = req.mongoQuery || {};

    if (req.query.worker_user_id) {
      const wp = await WorkerProfile.collection().findOne({ user: toObjectId(req.query.worker_user_id) });
      query.worker = wp ? wp._id : null;
    }

    if (req.query.is_worker_null === '1') query.worker = null;
    if (req.query.customer_user_id) query.customer_user_id = req.query.customer_user_id;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer') && req.query.status === 'pending') {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'changeme');
        if (decoded.role === 'worker') {
          const wp = await WorkerProfile.collection().findOne({ user: toObjectId(decoded.id) });
          if (wp?.bio) {
            query.serviceName = { $regex: new RegExp(wp.bio.slice(0, 4), 'i') };
          }
          query.declined_worker_ids = { $ne: decoded.id };
        }
      } catch (err) {
        console.warn('listBookings token parse warning:', err.message);
      }
    }

    const pipeline = [
      { $match: query },
      ...buildPopulatePipeline(),
      { $sort: { createdAt: -1 } },
    ];

    if (req.query.limit) pipeline.push({ $limit: parseInt(req.query.limit, 10) });

    const bookings = await Booking.collection().aggregate(pipeline).toArray();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getByWorkerId = async (req, res) => {
  try {
    const { workerId } = req.params;
    const workerObjId = toObjectId(workerId);
    if (!workerObjId) return res.status(400).json({ message: 'Invalid ID' });

    const results = await Booking.collection().aggregate([
      { $match: { worker: workerObjId } },
      ...buildPopulatePipeline(),
      { $sort: { createdAt: -1 } },
    ]).toArray();

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid id' });

    const booking = await Booking.collection().aggregate([
      { $match: { _id: objId } },
      ...buildPopulatePipeline(),
    ]).next();

    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid booking ID format.' });

    const booking = await Booking.collection().findOne({ _id: objId });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    if (!['pending', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot cancel a booking that is ${booking.status}.` });
    }

    if (booking.customer_user_id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking.' });
    }

    const statusHistory = appendStatusHistory(booking.statusHistory, 'cancelled', 'customer');
    await Booking.collection().updateOne(
      { _id: objId },
      { $set: { status: 'cancelled', updatedAt: new Date(), statusHistory } },
    );

    const updatedBooking = { ...booking, status: 'cancelled', updatedAt: new Date(), statusHistory };
    const io = getIO();
    if (io) {
      io.to(booking.customer_user_id.toString()).emit('booking_cancelled', { bookingId: booking._id.toString() });
      if (booking.worker_user_id) {
        io.to(booking.worker_user_id.toString()).emit('booking_cancelled', { bookingId: booking._id.toString() });
      } else {
        io.to('worker').emit('booking_taken', { bookingId: booking._id.toString(), reason: 'cancelled' });
      }
    }

    res.status(200).json(updatedBooking);
  } catch (error) {
    console.error('Error in cancelBooking:', error);
    res.status(500).json({ message: 'Server error cancelling booking.' });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updatedAt: new Date() };
    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid id' });

    const existing = await Booking.collection().findOne({ _id: objId });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (updates.status && !canTransitionBookingStatus(existing.status, updates.status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${existing.status} to ${updates.status}`,
      });
    }

    if (updates.status === 'in_progress') {
      if (existing.otp_start !== updates.otp && !isDemoOtp(updates.otp)) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
      updates.otp_verified = true;
      updates.started_at = new Date();
    }

    if (updates.status === 'completed' && existing.status !== 'completed') {
      if (updates.otp && existing.otp_finish !== updates.otp && !isDemoOtp(updates.otp)) {
        return res.status(400).json({ message: 'Invalid completion OTP' });
      }

      if (updates.otp) {
        updates.otp_finish_verified = true;
      }

      const amount = existing.amount || 0;
      const commissionRate = 0.15;
      const insuranceFeeRate = 0.02;
      const platformFeeRate = 0.03;

      const commission = amount * commissionRate;
      const insuranceFee = amount * insuranceFeeRate;
      const platformFee = amount * platformFeeRate;
      const workerEarning = amount - commission - insuranceFee - platformFee;

      updates.completed_at = new Date();
      updates.worker_earning = workerEarning;
      updates.commission = commission;
      updates.insurance_fee = insuranceFee;
      updates.platform_fee = platformFee;
      updates.paymentStatus = normalizePaymentStatus(existing.paymentStatus);
    }

    if (updates.status) {
      updates.statusHistory = appendStatusHistory(existing.statusHistory, updates.status, req.user?.role || 'system');
    }

    if (updates.service) updates.service = toObjectId(updates.service) || updates.service;
    if (updates.customer) updates.customer = toObjectId(updates.customer) || updates.customer;
    if (updates.worker) updates.worker = toObjectId(updates.worker) || updates.worker;
    delete updates._id;

    const result = await Booking.collection().updateOne({ _id: objId }, { $set: updates });
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Not found' });

    const updated = await Booking.collection().aggregate([
      { $match: { _id: objId } },
      ...buildPopulatePipeline(),
    ]).next();

    emitBookingUpdate(id, updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getBookingMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const bookingObjectId = toObjectId(id);
    if (!bookingObjectId) return res.status(400).json({ message: 'Invalid booking ID' });

    const db = getDb();
    const booking = await Booking.collection().findOne({ _id: bookingObjectId });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const requesterId = asString(req.user?._id);
    const participants = [
      asString(booking.customer_user_id),
      asString(booking.worker_user_id),
    ].filter(Boolean);

    if (req.user?.role !== 'admin' && requesterId && !participants.includes(requesterId)) {
      return res.status(403).json({ message: 'Not authorized for this booking chat' });
    }

    const messages = await db.collection('chat_messages')
      .find({ bookingId: bookingObjectId })
      .sort({ timestamp: 1 })
      .toArray();

    res.json(messages.map(serializeChatMessage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
