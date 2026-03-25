import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ObjectId } from 'mongodb';
import { getIO, getConnectedUserIds } from '../socket.js';  // ← singleton, no circular dep
import { createNotification } from './notification.controller.js';

const toObjectId = (id) => {
  try {
    return id ? new ObjectId(id) : null;
  } catch (e) {
    return null;
  }
};

const buildPopulatePipeline = () => ([
  { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'service' } },
  { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customer' } },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'worker_profiles', localField: 'worker', foreignField: '_id', as: 'worker_profile' } },
  { $unwind: { path: '$worker_profile', preserveNullAndEmptyArrays: true } },
]);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings
// Creates a booking and emits `new_booking` to the worker's socket room
// OR broadcasts to ALL connected workers if no specific worker is chosen.
// ─────────────────────────────────────────────────────────────────────────────
export const createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      customerId,
      customer_user_id,  // customer's auth user _id → used for socket room targeting
      workerId,
      worker_user_id,    // worker's auth user _id  → their socket room name
      scheduled_at,
      address,
      city,
      amount,
      serviceName,
      customerName,
      customerPhone,
      bookingType,       // 'instant' | 'scheduled' | 'emergency'
      description,
      customer_lat,
      customer_lng,
    } = req.body;

    if (!serviceName || !customer_user_id) {
      return res.status(400).json({ message: 'Missing required fields: serviceName, customer_user_id' });
    }

    const doc = {
      service: toObjectId(serviceId) || null,
      customer: toObjectId(customerId) || null,
      customer_user_id: customer_user_id || null,
      worker: toObjectId(workerId) || null,
      worker_user_id: worker_user_id || null,
      status: 'pending',
      paymentStatus: 'unpaid',
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      address: address || null,
      city: city || null,
      amount: amount || 0,
      serviceName: serviceName || null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      bookingType: bookingType || 'instant',
      description: description || null,
      customer_lat: customer_lat || null,
      customer_lng: customer_lng || null,
      otp_start: Math.floor(1000 + Math.random() * 9000).toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await Booking.collection().insertOne(doc);
    const insertedId = result.insertedId;

    const bookingPayload = {
      bookingId: insertedId.toString(),
      serviceName: serviceName || 'Service Request',
      customerName: customerName || 'A customer',
      customerPhone: customerPhone || '',
      address: address || 'Address not specified',
      city: city || '',
      amount: amount || 0,
      scheduled_at: scheduled_at || null,
      customer_user_id: customer_user_id || null,
      bookingType: bookingType || 'instant',
      description: description || null,
    };

    // ── Emit new_booking ──────────────────────────────────────────────────────
    const io = getIO();
    if (io) {
      if (worker_user_id || workerId) {
        // Send to specific worker
        const workerRoom = worker_user_id || workerId;
        io.to(workerRoom.toString()).emit('new_booking', bookingPayload);
        console.log(`📡 Emitted new_booking → room: ${workerRoom}`);
      } else {
        // BROADCAST to ALL connected sockets (all online workers will receive it)
        io.emit('new_booking', bookingPayload);
        console.log(`📡 Broadcasted new_booking to ALL connected clients`);
      }
    }

    // ── Save notification in DB for CUSTOMER ──────────────────────────────────
    if (customer_user_id) {
      await createNotification(
        customer_user_id,
        'booking_pending',
        `🔔 Booking Created!`,
        `Your ${serviceName || 'service'} booking has been sent to workers. Waiting for a worker to accept.`,
        insertedId.toString()
      );
    }

    // ── Save notification in DB for targeted WORKER ───────────────────────────
    if (worker_user_id) {
      await createNotification(
        worker_user_id,
        'new_booking',
        `🆕 New Booking Request!`,
        `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: ₹${amount || 0}`,
        insertedId.toString()
      );
    } else {
      // BROADCAST: Save a notification for ALL connected users (except the customer)
      const connectedIds = getConnectedUserIds();
      for (const uid of connectedIds) {
        if (uid === customer_user_id) continue; // skip the customer who booked
        await createNotification(
          uid,
          'new_booking',
          `🆕 New Booking Request!`,
          `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: ₹${amount || 0}`,
          insertedId.toString()
        );
      }
    }

    // Return the created booking with its ID
    const pipeline = [
      { $match: { _id: insertedId } },
      ...buildPopulatePipeline(),
    ];
    const booking = await Booking.collection().aggregate(pipeline).next();

    res.json({ ...booking, _id: insertedId, bookingId: insertedId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/respond
// Worker accepts or declines → updates booking & notifies customer via socket
// ─────────────────────────────────────────────────────────────────────────────
export const respondToBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;  // 'accepted' or 'declined'
    const ALLOWED = ['accepted', 'declined'];

    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED.join(', ')}` });
    }

    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid booking ID' });

    const updates = {
      status,
      updatedAt: new Date(),
    };

    // If accepted, assign this worker to the booking
    if (status === 'accepted' && req.user) {
      updates.worker_user_id = req.user._id.toString();

      // Try to find the worker's profile to get their name
      const workerProfile = await WorkerProfile.collection().findOne({ user: req.user._id });
      if (workerProfile) {
        updates.worker = workerProfile._id;
      }
      updates.workerName = req.user.full_name || 'Worker';
      updates.workerPhone = req.user.phone || '';
    }

    const booking = await Booking.collection().findOneAndUpdate(
      { _id: objId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    const updatedBooking = booking.value || booking;

    if (!updatedBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // ── Emit booking_updated to customer's socket room ────────────────────
    const io = getIO();
    if (io) {
      const customerRoom = updatedBooking.customer_user_id?.toString();
      if (customerRoom) {
        io.to(customerRoom).emit('booking_updated', {
          bookingId: id,
          status,
          workerName: updates.workerName || null,
          workerPhone: updates.workerPhone || null,
          worker_user_id: updates.worker_user_id || null,
          updatedAt: new Date(),
        });
        console.log(`📡 Emitted booking_updated (${status}) → customer room: ${customerRoom}`);
      }

      // Also confirm back to the worker
      if (req.user) {
        io.to(req.user._id.toString()).emit('booking_updated', {
          bookingId: id,
          status,
          updatedAt: new Date(),
        });
      }
    }

    // ── Create notification in DB for the CUSTOMER ─────────────────────────
    if (updatedBooking.customer_user_id) {
      const title = status === 'accepted'
        ? `✅ Worker accepted your booking!`
        : `❌ Worker declined your request`;
      const message = status === 'accepted'
        ? `${updates.workerName || 'A worker'} has accepted your ${updatedBooking.serviceName || 'service'} request and is on the way!`
        : `Your ${updatedBooking.serviceName || 'service'} request was declined. We'll find another worker.`;

      await createNotification(
        updatedBooking.customer_user_id,
        'status_update',
        title,
        message,
        id
      );
    }

    // ── Create notification in DB for the WORKER ──────────────────────────
    if (req.user) {
      const workerTitle = status === 'accepted'
        ? `✅ You accepted a booking`
        : `❌ You declined a booking`;
      const workerMessage = status === 'accepted'
        ? `You've accepted ${updatedBooking.customerName || 'a customer'}'s ${updatedBooking.serviceName || 'service'} request. Head to: ${updatedBooking.address || 'the location'}.`
        : `You declined ${updatedBooking.customerName || 'a customer'}'s ${updatedBooking.serviceName || 'service'} request.`;

      await createNotification(
        req.user._id.toString(),
        status === 'accepted' ? 'booking_confirmed' : 'booking_cancelled',
        workerTitle,
        workerMessage,
        id
      );
    }

    res.json({ success: true, booking: updatedBooking });
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
      if (wp) query.worker = wp._id;
      else query.worker = null;
    }

    if (req.query.is_worker_null === '1') query.worker = null;

    // Filter by customer_user_id
    if (req.query.customer_user_id) {
      query.customer_user_id = req.query.customer_user_id;
    }

    const pipeline = [
      { $match: query },
      ...buildPopulatePipeline(),
      { $sort: { createdAt: -1 } },
    ];

    if (req.query.limit) pipeline.push({ $limit: parseInt(req.query.limit) });

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

    const pipeline = [
      { $match: { worker: workerObjId } },
      ...buildPopulatePipeline(),
      { $sort: { createdAt: -1 } },
    ];

    const results = await Booking.collection().aggregate(pipeline).toArray();
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

    const pipeline = [
      { $match: { _id: objId } },
      ...buildPopulatePipeline(),
    ];

    const booking = await Booking.collection().aggregate(pipeline).next();
    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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

    // Validate OTP if status is changing to in_progress
    if (updates.status === 'in_progress') {
      if (existing.otp_start !== updates.otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
    }

    if (updates.service) updates.service = toObjectId(updates.service) || updates.service;
    if (updates.customer) updates.customer = toObjectId(updates.customer) || updates.customer;
    if (updates.worker) updates.worker = toObjectId(updates.worker) || updates.worker;
    delete updates._id;

    const result = await Booking.collection().updateOne({ _id: objId }, { $set: updates });
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Not found' });

    const pipeline = [{ $match: { _id: objId } }, ...buildPopulatePipeline()];
    const updated = await Booking.collection().aggregate(pipeline).next();

    // ── Emit booking_updated to customer's socket room ────────────────────
    // Since we brought in `getIO()` in booking.controller.js, we can emit state changes securely.
    const io = getIO();
    if (io && updated && updated.customer_user_id) {
      io.to(updated.customer_user_id.toString()).emit('booking_updated', {
        bookingId: id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
