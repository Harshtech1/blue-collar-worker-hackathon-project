import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ObjectId } from 'mongodb';
import { getIO } from '../socket.js';  // ← singleton, no circular dep

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
// Creates a booking and emits `new_booking` to the worker's socket room.
// ─────────────────────────────────────────────────────────────────────────────
export const createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      customerId,
      customer_user_id,  // customerʼs auth user _id → used for socket room targeting
      workerId,
      worker_user_id,    // workerʼs auth user _id  → their socket room name
      scheduled_at,
      address,
      city,
      amount,
      serviceName,
      customerName,
      customerPhone,
    } = req.body;

    if (!serviceId || !customerId || !workerId) {
      return res.status(400).json({ message: 'Missing required fields: serviceId, customerId, workerId' });
    }

    const doc = {
      service:          toObjectId(serviceId),
      customer:         toObjectId(customerId),
      customer_user_id: customer_user_id || null,
      worker:           toObjectId(workerId),
      worker_user_id:   worker_user_id || null,
      status:           'pending',
      paymentStatus:    'unpaid',
      scheduled_at:     scheduled_at ? new Date(scheduled_at) : null,
      address:          address || null,
      city:             city || null,
      amount:           amount || 0,
      serviceName:      serviceName || null,
      customerName:     customerName || null,
      customerPhone:    customerPhone || null,
      createdAt:        new Date(),
      updatedAt:        new Date(),
    };

    const result = await Booking.collection().insertOne(doc);
    const insertedId = result.insertedId;

    const pipeline = [
      { $match: { _id: insertedId } },
      ...buildPopulatePipeline(),
    ];

    const booking = await Booking.collection().aggregate(pipeline).next();

    // ── Emit new_booking to worker's private socket room ──────────────────────
    const io = getIO();
    const workerRoom = worker_user_id || workerId;
    if (io && workerRoom) {
      io.to(workerRoom.toString()).emit('new_booking', {
        bookingId:        insertedId.toString(),
        serviceName:      serviceName || 'Service Request',
        customerName:     customerName || 'A customer',
        customerPhone:    customerPhone || '',
        address:          address || 'Address not specified',
        city:             city || '',
        amount:           amount || 0,
        scheduled_at:     scheduled_at || null,
        customer_user_id: customer_user_id || null,
      });
      console.log(`📡 Emitted new_booking → room: ${workerRoom}`);
    }

    res.json(booking);
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

    if (updates.service)  updates.service  = toObjectId(updates.service)  || updates.service;
    if (updates.customer) updates.customer = toObjectId(updates.customer) || updates.customer;
    if (updates.worker)   updates.worker   = toObjectId(updates.worker)   || updates.worker;
    delete updates._id;

    const result = await Booking.collection().updateOne({ _id: objId }, { $set: updates });
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Not found' });

    const pipeline = [{ $match: { _id: objId } }, ...buildPopulatePipeline()];
    const updated = await Booking.collection().aggregate(pipeline).next();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
