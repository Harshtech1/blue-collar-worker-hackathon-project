import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ObjectId } from 'mongodb';
import { getIO, getConnectedUserIds } from '../socket.js';  // ← singleton, no circular dep
import { createNotification } from './notification.controller.js';
import { sendEmail } from '../utils/emailService.js';
import { getDb } from '../config/db.js';

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
      otp_finish: Math.floor(1000 + Math.random() * 9000).toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await Booking.collection().insertOne(doc);
    const insertedId = result.insertedId;

    // Phase 2: The Geospatial Matcher
    let availableWorkers = [];
    if (!worker_user_id && !workerId && customer_lng && customer_lat) {
      try {
        const coordinates = [parseFloat(customer_lng), parseFloat(customer_lat)];
        
        availableWorkers = await WorkerProfile.collection().find({
          location: {
            $near: {
              $geometry: { type: "Point", coordinates },
              $maxDistance: 10000 // 10km radius
            }
          },
          isAvailable: true,
          status: "online"
        }).toArray();
        
        console.log(`🌐 Geospatial Matcher found ${availableWorkers.length} nearby workers within 10km!`);
      } catch (geoErr) {
        console.error("Geospatial Matcher Error:", geoErr.message);
      }
    }

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
        // Broadcast to matched workers or fallback to ALL online workers
        if (availableWorkers.length > 0) {
          availableWorkers.forEach(worker => {
            io.to(worker.user.toString()).emit('new_booking', bookingPayload);
          });
          console.log(`📡 Broadcasted new_booking to ${availableWorkers.length} matching nearby workers`);
        } else {
          // Fallback: Notify explicitly ONLINE workers
          try {
            const allOnlineWorkers = await WorkerProfile.collection().find({ status: "online", isAvailable: true }).toArray();
            allOnlineWorkers.forEach(worker => {
              io.to(worker.user.toString()).emit('new_booking', bookingPayload);
            });
            console.log(`📡 Broadcasted new_booking to ${allOnlineWorkers.length} online workers (fallback)`);
          } catch (e) {
            console.error('Socket fallback error: ', e.message);
          }
        }
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

    // ── Save notification in DB for WORKER(s) ─────────────────────────────────
    if (worker_user_id || workerId) {
      const targetWorker = worker_user_id || workerId;
      await createNotification(
        targetWorker.toString(),
        'new_booking',
        `🆕 New Booking Request!`,
        `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: ₹${amount || 0}`,
        insertedId.toString()
      );
    } else if (availableWorkers.length > 0) {
      // Create notification only for nearby matched workers
      for (const worker of availableWorkers) {
        await createNotification(
          worker.user.toString(),
          'new_booking',
          `🆕 New Booking Request near you!`,
          `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: ₹${amount || 0}`,
          insertedId.toString()
        );
      }
    } else {
      // Fallback: Save a notification explicitly for ONLINE and AVAILABLE workers
      try {
        const allOnlineWorkers = await WorkerProfile.collection().find({ status: "online", isAvailable: true }).toArray();
        for (const worker of allOnlineWorkers) {
          const uid = worker.user.toString();
          if (uid === customer_user_id) continue;
          await createNotification(
            uid,
            'new_booking',
            `🆕 New Booking Request!`,
            `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: ₹${amount || 0}`,
            insertedId.toString()
          );
        }
      } catch (err) {
        console.error('Fallback DB notifications error: ', err.message);
      }
    }

    // ── Email customer their booking OTPs ─────────────────────────────────────
    if (customer_user_id) {
      try {
        const db = getDb();
        const customerUser = await db.collection('users').findOne({ _id: toObjectId(customer_user_id) });
        if (customerUser?.email) {
          const otpStart = doc.otp_start;
          const otpFinish = doc.otp_finish;
          sendEmail(
            customerUser.email,
            `RAHI Booking Confirmed — Your Service OTPs`,
            `Your ${serviceName || 'service'} booking has been placed successfully!\n\n` +
            `📍 Address: ${address || 'Not specified'}\n` +
            `💰 Amount: ₹${amount || 0}\n\n` +
            `🔐 Share this OTP with the worker when they ARRIVE to START work:\n   Start OTP: ${otpStart}\n\n` +
            `✅ Share this OTP with the worker when they FINISH to COMPLETE work:\n   Finish OTP: ${otpFinish}\n\n` +
            `Keep these OTPs safe. Do not share them until the worker is physically present.`
          ).catch(e => console.error('[Booking OTP Email] Failed:', e.message));
        }
      } catch (emailErr) {
        console.error('[Booking OTP Email] Error fetching user:', emailErr.message);
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

    const io = getIO();

    // ─────────────────────────────────────────────────────────────────────────
    // ACCEPT: Atomic "first-wins" guard using a filter on status: 'pending'
    // If another worker already accepted, findOneAndUpdate returns null → 409.
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'accepted') {
      const updates = {
        status: 'accepted',
        updatedAt: new Date(),
        worker_user_id: req.user._id.toString(),
        workerName: req.user.full_name || 'Worker',
        workerPhone: req.user.phone || '',
      };

      // Try to link the worker's profile document
      const workerProfile = await WorkerProfile.collection().findOne({ user: req.user._id });
      if (workerProfile) {
        updates.worker = workerProfile._id;
      }

      // ── ATOMIC: Only succeeds if booking is still 'pending' ───────────────
      const result = await Booking.collection().findOneAndUpdate(
        { _id: objId, status: 'pending' },  // ← Race condition guard
        { $set: updates },
        { returnDocument: 'after' }
      );

      // Handle both old and new MongoDB driver return shapes
      const updatedBooking = result?.value ?? result;

      // If null, the booking was already taken by another worker
      if (!updatedBooking || !updatedBooking._id) {
        // Fetch the current booking to find out who took it
        const existingBooking = await Booking.collection().findOne({ _id: objId });

        // Emit 'booking_taken' to THIS worker so their modal auto-dismisses
        if (io && req.user) {
          io.to(req.user._id.toString()).emit('booking_taken', {
            bookingId: id,
            takenBy: existingBooking?.workerName || 'Another worker',
            message: 'This booking was already accepted by another worker.',
          });
          console.log(`⚡ Emitted booking_taken → worker: ${req.user._id} (arrived too late)`);
        }

        return res.status(409).json({
          message: 'This booking was already accepted by another worker.',
          code: 'BOOKING_ALREADY_TAKEN',
        });
      }

      // ── SUCCESS: This worker won the race ────────────────────────────────

      // Notify customer
      if (io) {
        const customerRoom = updatedBooking.customer_user_id?.toString();
        if (customerRoom) {
          io.to(customerRoom).emit('booking_updated', {
            bookingId: id,
            status: 'accepted',
            workerName: updates.workerName,
            workerPhone: updates.workerPhone,
            worker_user_id: updates.worker_user_id,
            updatedAt: new Date(),
          });
          console.log(`📡 Emitted booking_updated (accepted) → customer room: ${customerRoom}`);
        }

        // Confirm to the winning worker
        io.to(req.user._id.toString()).emit('booking_updated', {
          bookingId: id,
          status: 'accepted',
          updatedAt: new Date(),
        });
      }

      // DB notifications
      if (updatedBooking.customer_user_id) {
        await createNotification(
          updatedBooking.customer_user_id,
          'status_update',
          `✅ Worker accepted your booking!`,
          `${updates.workerName} has accepted your ${updatedBooking.serviceName || 'service'} request and is on the way!`,
          id
        );
      }
      await createNotification(
        req.user._id.toString(),
        'booking_confirmed',
        `✅ You accepted a booking`,
        `You've accepted ${updatedBooking.customerName || 'a customer'}'s ${updatedBooking.serviceName || 'service'} request. Head to: ${updatedBooking.address || 'the location'}.`,
        id
      );

      return res.json({ success: true, booking: updatedBooking });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DECLINE: No race condition risk — just record the decline
    // ─────────────────────────────────────────────────────────────────────────
    const declineResult = await Booking.collection().findOneAndUpdate(
      { _id: objId },
      { $set: { status: 'declined', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    const updatedBooking = declineResult?.value ?? declineResult;

    if (!updatedBooking || !updatedBooking._id) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Notify customer of decline
    if (io) {
      const customerRoom = updatedBooking.customer_user_id?.toString();
      if (customerRoom) {
        io.to(customerRoom).emit('booking_updated', {
          bookingId: id,
          status: 'declined',
          updatedAt: new Date(),
        });
        console.log(`📡 Emitted booking_updated (declined) → customer room: ${customerRoom}`);
      }
    }

    // DB notifications for decline
    if (updatedBooking.customer_user_id) {
      await createNotification(
        updatedBooking.customer_user_id,
        'status_update',
        `❌ Worker declined your request`,
        `Your ${updatedBooking.serviceName || 'service'} request was declined. We'll find another worker.`,
        id
      );
    }
    if (req.user) {
      await createNotification(
        req.user._id.toString(),
        'booking_cancelled',
        `❌ You declined a booking`,
        `You declined ${updatedBooking.customerName || 'a customer'}'s ${updatedBooking.serviceName || 'service'} request.`,
        id
      );
    }

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
      if (wp) query.worker = wp._id;
      else query.worker = null;
    }

    if (req.query.is_worker_null === '1') query.worker = null;

    // Filter by customer_user_id
    if (req.query.customer_user_id) {
      query.customer_user_id = req.query.customer_user_id;
    }

    // Worker Job Filter: If a worker is requesting pending jobs, filter by their profession.
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer') && req.query.status === 'pending') {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = await import('jsonwebtoken'); // dynamic import since it's not at the top
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'changeme');
        if (decoded.role === 'worker') {
          const wp = await WorkerProfile.collection().findOne({ user: toObjectId(decoded.id) });
          // If the worker has a profession string in bio, filter matching sub-categories. 
          // We can use a regex to match things loosely (e.g., 'plumb' matches 'Plumber').
          if (wp && wp.bio) {
             query.serviceName = { $regex: new RegExp(wp.bio.slice(0,4), 'i') }; // slice(0,4) for Plumber->Plumb
          }
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

/**
 * @desc Cancel a booking (Only customer who made it can cancel)
 * @route PATCH /api/bookings/:id/cancel
 * @access Protected
 */
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid booking ID format.' });

    const booking = await Booking.collection().findOne({ _id: objId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Only allow if pending or accepted (not completed or already cancelled)
    if (!['pending', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot cancel a booking that is ${booking.status}.` });
    }

    // Verify it's the customer's booking
    if (booking.customer_user_id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking.' });
    }

    await Booking.collection().updateOne(
      { _id: objId },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    );

    const io = getIO();
    if (io) {
      // Notify the customer
      io.to(booking.customer_user_id.toString()).emit('booking_cancelled', { bookingId: booking._id });
      // Notify the worker if assigned
      if (booking.worker_user_id) {
        io.to(booking.worker_user_id.toString()).emit('booking_cancelled', { bookingId: booking._id });
      } else {
        // Broadcast to all workers to remove from their queue if pending
        io.to('worker').emit('booking_taken', { bookingId: booking._id, reason: 'cancelled' }); 
      }
    }

    return res.status(200).json({ ...booking, status: 'cancelled' });
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

    // Validate OTP if status is changing to in_progress
    if (updates.status === 'in_progress') {
      if (existing.otp_start !== updates.otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
      updates.otp_verified = true;
      updates.started_at = new Date();
    }

    // Validate OTP if status is changing to completed
    if (updates.status === 'completed' && existing.status !== 'completed') {
      // If otp is provided in request, verify it against otp_finish
      if (updates.otp) {
        if (existing.otp_finish !== updates.otp) {
          return res.status(400).json({ message: 'Invalid completion OTP' });
        }
        updates.otp_finish_verified = true;
      }
      
      const amount = existing.amount || 0;
      const commissionRate = 0.15; // 15%
      const insuranceFeeRate = 0.02; // 2%
      const platformFeeRate = 0.03; // 3%

      const commission = amount * commissionRate;
      const insuranceFee = amount * insuranceFeeRate;
      const platformFee = amount * platformFeeRate;
      const workerEarning = amount - commission - insuranceFee - platformFee;

      updates.completed_at = new Date();
      updates.worker_earning = workerEarning;
      updates.commission = commission;
      updates.insurance_fee = insuranceFee;
      updates.platform_fee = platformFee;
      updates.paymentStatus = existing.paymentStatus || 'unpaid'; // Do not auto-mark as paid
      // Note: Worker profile earnings update is handled in the /api/payments/initiate endpoint
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
