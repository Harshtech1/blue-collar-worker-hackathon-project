import { WorkerProfile } from '../models/WorkerProfile.js';
import { User } from '../models/User.js';
import { ObjectId } from 'mongodb';

export const createProfile = async (req, res) => {
  try {
    const { userId, bio, location, extra } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const existing = await WorkerProfile.collection().findOne({ user: new ObjectId(userId) });
    if (existing) return res.status(400).json({ message: 'Profile already exists' });

    const newProfile = {
      user: new ObjectId(userId),
      bio,
      location,
      extra,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: req.body.status || 'offline',
      isAvailable: req.body.status === 'online' || req.body.isAvailable || false
    };

    const result = await WorkerProfile.collection().insertOne(newProfile);
    res.json({ ...newProfile, _id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await WorkerProfile.collection().findOne({ user: new ObjectId(userId) });
    if (!profile) return res.status(404).json({ message: 'Not found' });

    // Manual populate
    const user = await User.collection().findOne(
      { _id: profile.user },
      { projection: { email: 1, full_name: 1, role: 1, socials: 1 } }
    );

    res.json({ ...profile, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Security: Only allow users to update their own profile, unless admin
    if (req.user && req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. You can only update your own profile.' });
    }

    const updates = req.body;
    updates.updatedAt = new Date();

    // Security: don't allow updating user field directly
    delete updates.user;
    delete updates._id;

    // Separate User fields vs Worker fields
    const userUpdates = {};
    const userFields = ['full_name', 'phone', 'socials'];
    for (const field of userFields) {
      if (updates[field] !== undefined) {
        userUpdates[field] = updates[field];
        delete updates[field]; // remove from worker updates
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      const flattenedUserUpdates = {};
      for (const [key, value] of Object.entries(userUpdates)) {
        if (typeof value === 'object' && value !== null && key === 'socials') {
          for (const [subKey, subValue] of Object.entries(value)) {
            flattenedUserUpdates[`${key}.${subKey}`] = subValue;
          }
        } else {
          flattenedUserUpdates[key] = value;
        }
      }
      await User.collection().updateOne(
        { _id: new ObjectId(userId) },
        { $set: flattenedUserUpdates }
      );
    }

    // Handle document verification status updates if files are uploaded
    if (updates.aadhaar_url || updates.pan_url || updates.skills_url) {
      if (!updates.verificationStatus) {
        // If not provided, initialize it
        const current = await WorkerProfile.collection().findOne({ user: new ObjectId(userId) });
        updates.verificationStatus = current?.verificationStatus || {
          aadhaar: "pending",
          pan: "pending",
          skills: "pending"
        };
      }
      
      if (updates.aadhaar_url) updates.verificationStatus.aadhaar = "verified";
      if (updates.pan_url) updates.verificationStatus.pan = "verified";
      if (updates.skills_url) updates.verificationStatus.skills = "verified";
    }

    const result = await WorkerProfile.collection().findOneAndUpdate(
      { user: new ObjectId(userId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value && !result) return res.status(404).json({ message: 'Not found' });

    res.json(result.value || result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listWorkerProfiles = async (req, res) => {
  try {
    const query = req.mongoQuery || {};
    const profiles = await WorkerProfile.collection().find(query).toArray();
    res.json(profiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getWorkerStats = async (req, res) => {
  try {
    const workerUserIdStr = req.user._id.toString();
    const workerUserIdObj = new ObjectId(req.user._id);

    const db = WorkerProfile.collection().s.db; // Get db instance safely

    const pipeline = [
      {
        $match: {
          $or: [
            { worker_user_id: workerUserIdStr },
            { worker_user_id: workerUserIdObj },
            { worker: workerUserIdObj }
          ],
          status: { $in: ["completed", "paid"] }
        }
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalEarnings: { $sum: "$amount" },
                totalCompleted: { $sum: 1 }
              }
            }
          ],
          monthly: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: { $ifNull: ["$updatedAt", "$createdAt"] } } },
                earnings: { $sum: "$amount" },
                jobs: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ];

    const stats = await db.collection('bookings').aggregate(pipeline).toArray();
    
    // Active / Ongoing jobs
    const activeJobs = await db.collection('bookings').countDocuments({
      $or: [
        { worker_user_id: workerUserIdStr },
        { worker_user_id: workerUserIdObj },
        { worker: workerUserIdObj }
      ],
      status: { $in: ["accepted", "arriving", "in_progress", "otp_verify", "pending_payment"] }
    });

    res.json({
      totalEarnings: stats[0]?.totals[0]?.totalEarnings || 0,
      totalCompleted: stats[0]?.totals[0]?.totalCompleted || 0,
      monthlyStats: stats[0]?.monthly || [],
      activeJobs
    });

  } catch (err) {
    console.error('Worker Stats Error:', err);
    res.status(500).json({ message: 'Server error while calculating stats' });
  }
};

/**
 * @desc Get nearby workers for map visualization
 * @route GET /api/workers/nearby
 * @access Public/Protected
 */
export const getNearbyWorkers = async (req, res) => {
  try {
    const { lng, lat, radius = 5000 } = req.query; // Default 5km radius
    
    if (!lng || !lat) {
      return res.status(400).json({ message: 'lng and lat are required' });
    }

    const coordinates = [parseFloat(lng), parseFloat(lat)];
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const query = {
      location: {
        $near: {
          $geometry: { type: "Point", coordinates },
          $maxDistance: parseInt(radius)
        }
      },
      isAvailable: true,
      status: "online"
    };

    const workers = await WorkerProfile.collection()
      .find(query)
      .limit(10)
      .toArray();

    // Population of user details
    const populatedWorkers = await Promise.all(workers.map(async (w) => {
      const user = await User.collection().findOne(
        { _id: w.user },
        { projection: { full_name: 1, phone: 1, email: 1 } }
      );
      return { ...w, user };
    }));

    res.json(populatedWorkers);
  } catch (err) {
    console.error('getNearbyWorkers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc Simulate worker movement toward customer for Demo purposes
 * @route POST /api/workers/simulate-movement
 * @access Admin/Internal
 */
export const simulateWorkerMovement = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const db = WorkerProfile.collection().s.db;
    
    let booking;
    try {
      booking = await db.collection('bookings').findOne({ _id: new ObjectId(bookingId) });
    } catch(e) {
      booking = await db.collection('bookings').findOne({ _id: bookingId });
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const workerUserId = booking.worker_user_id || booking.worker;
    if (!workerUserId) return res.status(400).json({ message: 'No worker assigned to this booking' });

    res.json({ message: 'Simulation started for worker movement' });

    // Background simulation: Move worker closer to customer
    const targetLoc = [booking.customer_lng, booking.customer_lat];
    const workerProfile = await WorkerProfile.collection().findOne({ 
      $or: [
        { user: new ObjectId(workerUserId) },
        { user: workerUserId }
      ]
    });
    
    if (!workerProfile) {
      console.log('Worker profile not found for simulation');
      return;
    }

    let currentLoc = workerProfile.location.coordinates;
    const steps = 12;
    const interval = 6000; // 6 seconds per step

    const deltaLng = (targetLoc[0] - currentLoc[0]) / steps;
    const deltaLat = (targetLoc[1] - currentLoc[1]) / steps;

    let currentStep = 0;
    const timer = setInterval(async () => {
      currentStep++;
      currentLoc = [currentLoc[0] + deltaLng, currentLoc[1] + deltaLat];
      
      await WorkerProfile.collection().updateOne(
        { _id: workerProfile._id },
        { 
          $set: { 
            "location.coordinates": currentLoc,
            lastSeen: new Date(),
            status: "online",
            isAvailable: true
          } 
        }
      );

      console.log(`[Simulation] Worker ${workerUserId} moved to:`, currentLoc);
      
      if (currentStep >= steps) {
        clearInterval(timer);
        console.log(`[Simulation] Worker ${workerUserId} arrived at destination.`);
      }
    }, interval);

  } catch (err) {
    console.error('Simulation error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Simulation failed' });
  }
};
