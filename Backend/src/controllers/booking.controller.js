import { Booking } from '../models/Booking.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ObjectId } from 'mongodb';
import { getIO, zoneRoom } from '../socket.js';
import { createNotification } from './notification.controller.js';
import { sendEmail } from '../utils/emailService.js';
import { getDb } from '../config/db.js';
import {
  appendStatusHistory,
  canTransitionBookingStatus,
  isDemoOtp,
  normalizePaymentStatus,
} from '../utils/bookingWorkflow.js';
import { normalizeMediaField } from '../utils/mediaStorage.js';

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

const ACTIVE_BOOKING_STATUSES = ['accepted', 'arriving', 'otp_verify', 'in_progress'];
const WATERFALL_DELAY_MS = Number(process.env.BOOKING_WATERFALL_DELAY_MS || 15000);
const WATERFALL_MAX_CANDIDATES = 5;
const DEFAULT_ETA_BUFFER_MINUTES = Number(process.env.WORKER_PREP_BUFFER_MINUTES || 15);
const activeWaterfallTimers = new Map();

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const buildProofPhotoRecord = (value) => {
  const media = normalizeMediaField(value);
  if (!media?.url) return null;

  return {
    ...media,
    timestamp: new Date(),
  };
};

const getRequestedWorkerUserId = async (booking) => {
  if (booking.assignment_mode === 'direct') {
    if (booking.worker_user_id) return asString(booking.worker_user_id);
    if (booking.worker) {
      const workerProfile = await WorkerProfile.collection().findOne({ _id: toObjectId(booking.worker) || booking.worker });
      return asString(workerProfile?.user);
    }
    return '';
  }

  if (booking.last_pinged_worker_id) {
    return asString(booking.last_pinged_worker_id);
  }

  const currentCandidate = Array.isArray(booking.match_candidates)
    && Number.isInteger(booking.waterfall_cursor)
    && booking.waterfall_cursor >= 0
    ? booking.match_candidates[booking.waterfall_cursor]
    : null;

  return asString(currentCandidate?.workerUserId);
};

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const toRad = (degree) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getWorkerCoordinates = (worker) => {
  const coordinates = worker?.location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lng = toNumber(coordinates[0], null);
  const lat = toNumber(coordinates[1], null);
  if (lng === null || lat === null) return null;

  return [lng, lat];
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const getSkillFitScore = (worker, serviceName) => {
  const serviceTokens = normalizeText(serviceName).split(' ').filter((token) => token.length >= 3);
  if (serviceTokens.length === 0) return 0.65;

  const workerText = normalizeText([
    worker.bio,
    worker.profession,
    worker.title,
    ...(Array.isArray(worker.skills) ? worker.skills : []),
    ...(Array.isArray(worker.serviceNames) ? worker.serviceNames : []),
  ].join(' '));

  const matchingTokens = serviceTokens.filter((token) => workerText.includes(token)).length;
  if (matchingTokens > 0) return clamp01(0.65 + (matchingTokens / serviceTokens.length) * 0.35);

  if (Array.isArray(worker.serviceCategories) && worker.serviceCategories.length > 0) return 0.7;
  return 0.55;
};

const getReliabilityScore = (worker) => {
  const completedJobs = toNumber(worker.completed_jobs_count ?? worker.completedJobs ?? worker.jobsCompleted, 0);
  const cancellationRate = clamp01(toNumber(worker.cancellation_rate ?? worker.cancellationRate, 0.08));
  const punctualityRate = clamp01(toNumber(worker.punctuality_rate ?? worker.punctualityRate, 0.78));
  const experienceBoost = Math.min(0.2, completedJobs / 250);

  return clamp01((0.45 * punctualityRate) + (0.35 * (1 - cancellationRate)) + 0.1 + experienceBoost);
};

const buildMatchCandidates = (workers, customerCoordinates, serviceName) => workers
  .map((worker) => {
    const workerCoordinates = getWorkerCoordinates(worker);
    const distanceKm = workerCoordinates && customerCoordinates
      ? haversineKm(customerCoordinates, workerCoordinates)
      : 10;
    const ratingScore = clamp01(toNumber(worker.rating, 4) / 5);
    const distanceScore = clamp01(1 - (distanceKm / 10));
    const acceptanceRate = clamp01(toNumber(worker.acceptance_rate ?? worker.acceptanceRate, 0.75));
    const skillFit = getSkillFitScore(worker, serviceName);
    const reliabilityScore = getReliabilityScore(worker);
    const matchScore = (0.3 * ratingScore)
      + (0.25 * distanceScore)
      + (0.2 * acceptanceRate)
      + (0.1 * skillFit)
      + (0.1 * reliabilityScore);

    return {
      workerProfileId: asString(worker._id),
      workerUserId: asString(worker.user || worker.user_id),
      ratingScore: Number(ratingScore.toFixed(3)),
      distanceScore: Number(distanceScore.toFixed(3)),
      acceptanceRate: Number(acceptanceRate.toFixed(3)),
      skillFit: Number(skillFit.toFixed(3)),
      reliabilityScore: Number(reliabilityScore.toFixed(3)),
      distanceKm: Number(distanceKm.toFixed(2)),
      matchScore: Number(matchScore.toFixed(3)),
    };
  })
  .filter((candidate) => candidate.workerUserId)
  .sort((a, b) => b.matchScore - a.matchScore)
  .slice(0, WATERFALL_MAX_CANDIDATES);

const buildBookingPayload = (booking, candidate = null) => ({
  bookingId: asString(booking._id),
  serviceName: booking.serviceName || 'Service Request',
  customerName: booking.customerName || 'A customer',
  customerPhone: booking.customerPhone || '',
  address: booking.address || 'Address not specified',
  city: booking.city || '',
  amount: toNumber(booking.amount, 0),
  priceMultiplier: toNumber(booking.priceMultiplier, 1),
  materialCost: toNumber(booking.materialCost, 0),
  convenienceFee: toNumber(booking.convenienceFee, 0),
  etaBuffer: toNumber(booking.etaBuffer, DEFAULT_ETA_BUFFER_MINUTES),
  scheduled_at: booking.scheduled_at || null,
  customer_user_id: booking.customer_user_id || null,
  bookingType: booking.bookingType || 'instant',
  description: booking.description || null,
  beforeWorkPhoto: booking.beforeWorkPhoto || null,
  afterWorkPhoto: booking.afterWorkPhoto || null,
  matchScore: candidate?.matchScore,
  distanceKm: candidate?.distanceKm,
  skillFit: candidate?.skillFit,
  reliabilityScore: candidate?.reliabilityScore,
  assignedWorkerIndex: Number.isInteger(booking.waterfall_cursor) ? booking.waterfall_cursor : undefined,
  assignmentMode: booking.assignment_mode || 'waterfall',
});

const getSuggestedReofferMultiplier = (booking) => {
  const currentMultiplier = toNumber(booking.priceMultiplier, 1);
  return Number(Math.min(1.5, Math.max(1.05, currentMultiplier + 0.1)).toFixed(2));
};

const clearWaterfallTimer = (bookingId) => {
  const key = asString(bookingId);
  const timer = activeWaterfallTimers.get(key);
  if (timer) clearTimeout(timer);
  activeWaterfallTimers.delete(key);
};

const dispatchWaterfallCandidate = async (bookingId, startIndex = 0) => {
  const bookingObjectId = toObjectId(bookingId);
  if (!bookingObjectId) return;

  const booking = await Booking.collection().findOne({ _id: bookingObjectId });
  if (!booking || booking.status !== 'pending') {
    clearWaterfallTimer(bookingId);
    return;
  }

  const candidates = Array.isArray(booking.match_candidates) ? booking.match_candidates : [];
  const declined = new Set((booking.declined_worker_ids || []).map(asString));
  const nextIndex = candidates.findIndex((candidate, index) => (
    index >= startIndex && candidate.workerUserId && !declined.has(asString(candidate.workerUserId))
  ));

  if (nextIndex === -1) {
    clearWaterfallTimer(bookingId);
    const io = getIO();
    const suggestedPriceMultiplier = getSuggestedReofferMultiplier(booking);
    const escalation = {
      status: 'admin_review_required',
      reason: candidates.length > 0
        ? 'All ranked workers rejected or timed out.'
        : 'No ranked workers were available in the selected zone.',
      rejectedWorkerCount: Math.max(candidates.length, declined.size),
      suggestedPriceMultiplier,
      escalatedAt: new Date(),
    };

    await Booking.collection().updateOne(
      { _id: bookingObjectId, status: 'pending' },
      {
        $set: {
          assignment_status: 'admin_review_required',
          fulfillmentEscalation: escalation,
          updatedAt: new Date(),
        },
      },
    );

    if (io && booking.customer_user_id) {
      io.to(asString(booking.customer_user_id)).emit('no_workers_available', {
        bookingId: asString(booking._id),
        message: 'No ranked workers accepted yet. RAHI operations has been alerted.',
        suggestedPriceMultiplier,
      });
    }

    if (io) {
      io.to('admin').emit('booking_needs_review', {
        bookingId: asString(booking._id),
        serviceName: booking.serviceName,
        areaId: booking.areaId,
        ...escalation,
      });
    }
    return;
  }

  const candidate = candidates[nextIndex];
  const workerUserId = asString(candidate.workerUserId);
  const payload = buildBookingPayload(booking, candidate);
  const now = new Date();
  const previousWorkerId = asString(booking.last_pinged_worker_id);

  await Booking.collection().updateOne(
    { _id: bookingObjectId, status: 'pending' },
    {
      $set: {
        waterfall_cursor: nextIndex,
        last_pinged_worker_id: workerUserId,
        last_pinged_at: now,
        updatedAt: now,
      },
    },
  );

  const io = getIO();
  if (io) {
    if (previousWorkerId && previousWorkerId !== workerUserId) {
      io.to(previousWorkerId).emit('booking_ping_expired', {
        bookingId: asString(booking._id),
        message: 'This booking moved to the next ranked worker.',
      });
      io.to(previousWorkerId).emit('CLEAR_JOB', { bookingId: asString(booking._id) });
    }

    io.to(workerUserId).emit('new_booking', payload);
    io.to(workerUserId).emit('NEW_JOB', payload);
  }

  await createNotification(
    workerUserId,
    'new_booking',
    'New booking request',
    `${booking.customerName || 'A customer'} needs ${booking.serviceName || 'a service'} at ${booking.address || 'their location'}. Amount: Rs ${toNumber(booking.amount, 0)}`,
    asString(booking._id),
  );

  clearWaterfallTimer(bookingId);
  const timer = setTimeout(async () => {
    try {
      const latest = await Booking.collection().findOne({ _id: bookingObjectId });
      if (!latest || latest.status !== 'pending') {
        clearWaterfallTimer(bookingId);
        return;
      }

      if (asString(latest.last_pinged_worker_id) === workerUserId) {
        await dispatchWaterfallCandidate(bookingId, nextIndex + 1);
      }
    } catch (error) {
      console.error('Waterfall timer error:', error.message);
    }
  }, WATERFALL_DELAY_MS);

  activeWaterfallTimers.set(asString(bookingId), timer);
};

const emitBookingUpdate = (bookingId, booking) => {
  const io = getIO();
  if (!io || !booking) return;

  const payload = {
    bookingId: bookingId.toString(),
    status: booking.status,
    updatedAt: booking.updatedAt,
    paymentStatus: booking.paymentStatus,
    amount: toNumber(booking.amount, 0),
    priceMultiplier: toNumber(booking.priceMultiplier, 1),
    materialCost: toNumber(booking.materialCost, 0),
    convenienceFee: toNumber(booking.convenienceFee, 0),
    etaBuffer: toNumber(booking.etaBuffer, DEFAULT_ETA_BUFFER_MINUTES),
    assignment_status: booking.assignment_status,
    fulfillmentEscalation: booking.fulfillmentEscalation,
    workerName: booking.workerName,
    workerPhone: booking.workerPhone,
    worker_user_id: booking.worker_user_id,
    beforeWorkPhoto: booking.beforeWorkPhoto || null,
    afterWorkPhoto: booking.afterWorkPhoto || null,
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
      areaId,
      area_id,
      priceMultiplier,
      materialCost,
      convenienceFee,
      etaBuffer,
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
      location: customer_lng && customer_lat
        ? { type: 'Point', coordinates: [parseFloat(customer_lng), parseFloat(customer_lat)] }
        : null,
      areaId: areaId || area_id || city || null,
      priceMultiplier: toNumber(priceMultiplier, 1),
      materialCost: toNumber(materialCost, 0),
      convenienceFee: toNumber(convenienceFee, Math.round(normalizedAmount * 0.1)),
      etaBuffer: toNumber(etaBuffer, DEFAULT_ETA_BUFFER_MINUTES),
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
    let customerCoordinates = null;
    const bookingAreaId = doc.areaId;
    if (!worker_user_id && !workerId && customer_lng && customer_lat) {
      try {
        customerCoordinates = [parseFloat(customer_lng), parseFloat(customer_lat)];
        availableWorkers = await WorkerProfile.collection().find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: customerCoordinates },
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

    if (!worker_user_id && !workerId && availableWorkers.length === 0 && bookingAreaId) {
      availableWorkers = await WorkerProfile.collection()
        .find({
          status: 'online',
          isAvailable: true,
          areaId: String(bookingAreaId).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
        })
        .limit(10)
        .toArray();
    }

    if (!worker_user_id && !workerId && availableWorkers.length === 0) {
      availableWorkers = await WorkerProfile.collection()
        .find({ status: 'online', isAvailable: true })
        .limit(10)
        .toArray();
    }

    const io = getIO();
    if (worker_user_id || workerId) {
      const targetWorkerId = (worker_user_id || workerId).toString();
      if (io) {
        const directPayload = buildBookingPayload({ ...doc, _id: insertedId, assignment_mode: 'direct' });
        io.to(targetWorkerId).emit('new_booking', directPayload);
        io.to(targetWorkerId).emit('NEW_JOB', directPayload);
      }
    } else {
      const matchCandidates = buildMatchCandidates(availableWorkers, customerCoordinates, serviceName);
      await Booking.collection().updateOne(
        { _id: insertedId },
        {
          $set: {
            match_candidates: matchCandidates,
            assignment_mode: 'waterfall',
            waterfall_cursor: -1,
            updatedAt: new Date(),
          },
        },
      );

      dispatchWaterfallCandidate(insertedId).catch((error) => {
        console.error('Waterfall dispatch failed:', error.message);
      });

      if (io && matchCandidates.length === 0 && bookingAreaId) {
        io.to(zoneRoom(bookingAreaId)).emit('zone_booking_unmatched', {
          bookingId: insertedId.toString(),
          areaId: bookingAreaId,
          serviceName,
          message: 'A booking was created in this zone but no ranked workers were available.',
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

    if (worker_user_id || workerId) {
      const workerUserId = asString(worker_user_id || workerId);
      if (workerUserId && workerUserId !== customer_user_id) {
        await createNotification(
          workerUserId,
          'new_booking',
          'New booking request',
          `${customerName || 'A customer'} needs ${serviceName || 'a service'} at ${address || 'their location'}. Amount: Rs ${normalizedAmount}`,
          insertedId.toString(),
        );
      }
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
    const requesterId = asString(req.user?._id);

    if (req.user?.role !== 'worker') {
      return res.status(403).json({ message: 'Only workers can respond to booking offers.' });
    }

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Allowed: accepted, declined' });
    }

    const objId = toObjectId(id);
    if (!objId) return res.status(400).json({ message: 'Invalid booking ID' });

    const currentBooking = await Booking.collection().findOne({ _id: objId });
    if (!currentBooking) return res.status(404).json({ message: 'Booking not found' });
    if (currentBooking.status !== 'pending') {
      return res.status(409).json({ message: 'This booking is no longer awaiting worker response.' });
    }

    const requestedWorkerUserId = await getRequestedWorkerUserId(currentBooking);
    if (!requestedWorkerUserId) {
      return res.status(409).json({ message: 'This booking does not have an active worker offer.' });
    }
    if (requestedWorkerUserId !== requesterId) {
      return res.status(403).json({ message: 'Not your turn to accept this booking.' });
    }

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

      clearWaterfallTimer(id);
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
      { _id: objId, status: 'pending', last_pinged_worker_id: requesterId },
      {
        $set: { updatedAt: new Date() },
        $addToSet: { declined_worker_ids: requesterId },
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

    dispatchWaterfallCandidate(id, (updatedBooking.waterfall_cursor ?? -1) + 1).catch((error) => {
      console.error('Waterfall decline dispatch failed:', error.message);
    });

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
        if (!process.env.JWT_SECRET) {
          throw new Error('JWT_SECRET is not configured');
        }
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'worker') {
          query.assignment_mode = 'waterfall';
          query.last_pinged_worker_id = decoded.id;
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

export const getActiveBooking = async (req, res) => {
  try {
    const userId = asString(req.user?._id);
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const query = {
      status: { $in: ACTIVE_BOOKING_STATUSES },
      $or: [
        { customer_user_id: userId },
        { worker_user_id: userId },
      ],
    };

    const activeBooking = await Booking.collection().aggregate([
      { $match: query },
      ...buildPopulatePipeline(),
      { $sort: { updatedAt: -1, createdAt: -1 } },
      { $limit: 1 },
    ]).next();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ activeBooking: activeBooking || null });
  } catch (err) {
    console.error('getActiveBooking Error:', err);
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
    clearWaterfallTimer(id);

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
    const requesterId = asString(req.user?._id);
    const isAdmin = req.user?.role === 'admin';
    const isAssignedWorker = requesterId && asString(existing.worker_user_id) === requesterId;
    const isOwningCustomer = requesterId && asString(existing.customer_user_id) === requesterId;
    const workerControlledStatuses = new Set(['arriving', 'otp_verify', 'in_progress', 'completed']);

    if (!isAdmin) {
      if (!requesterId) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      if (updates.status === 'accepted') {
        return res.status(403).json({ message: 'Use the respond endpoint to accept a booking.' });
      }

      if (updates.status && workerControlledStatuses.has(updates.status) && !isAssignedWorker) {
        return res.status(403).json({ message: 'Only the assigned worker can update this booking status.' });
      }

      if (updates.status === 'cancelled' && !isOwningCustomer) {
        return res.status(403).json({ message: 'Only the customer can cancel this booking.' });
      }

      if (!updates.status && !isAssignedWorker && !isOwningCustomer) {
        return res.status(403).json({ message: 'Not authorized to update this booking.' });
      }
    }

    if (updates.status && !canTransitionBookingStatus(existing.status, updates.status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${existing.status} to ${updates.status}`,
      });
    }

    if (updates.status === 'in_progress') {
      if (!String(updates.otp || '').trim()) {
        return res.status(400).json({ message: 'Start OTP is required.' });
      }
      if (existing.otp_start !== updates.otp && !isDemoOtp(updates.otp)) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
      const beforeWorkPhoto = buildProofPhotoRecord(updates.beforeWorkPhoto);
      if (!beforeWorkPhoto) {
        return res.status(400).json({ message: 'Error: Visual proof is mandatory to verify OTP. Upload before-work photo first.' });
      }
      updates.beforeWorkPhoto = beforeWorkPhoto;
      updates.otp_verified = true;
      updates.started_at = new Date();
    }

    if (updates.status === 'completed' && existing.status !== 'completed') {
      if (!String(updates.otp || '').trim()) {
        return res.status(400).json({ message: 'Completion OTP is required.' });
      }
      if (updates.otp && existing.otp_finish !== updates.otp && !isDemoOtp(updates.otp)) {
        return res.status(400).json({ message: 'Invalid completion OTP' });
      }

      if (updates.otp) {
        updates.otp_finish_verified = true;
      }

      const afterWorkPhoto = buildProofPhotoRecord(updates.afterWorkPhoto);
      if (!afterWorkPhoto) {
        return res.status(400).json({ message: 'Error: Visual proof is mandatory to verify OTP. Upload after-work photo first.' });
      }
      updates.afterWorkPhoto = afterWorkPhoto;

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

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(messages.map(serializeChatMessage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
