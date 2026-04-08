import { WorkerProfile } from '../models/WorkerProfile.js';
import { User } from '../models/User.js';
import { ObjectId } from 'mongodb';

/**
 * @desc Get all workers managed by the current thekedar
 * @route GET /api/thekedar/team
 * @access Private (Thekedar)
 */
export const getTeam = async (req, res) => {
  try {
    const thekedarId = new ObjectId(req.user._id);

    // Find all worker profiles where manager_id matches thekedarId
    const members = await WorkerProfile.collection()
      .find({ manager_id: thekedarId })
      .toArray();

    // Population of user details and calculation of individual stats
    const populatedMembers = await Promise.all(members.map(async (m) => {
      const userDetails = await User.collection().findOne(
        { _id: m.user },
        { projection: { full_name: 1, phone: 1, email: 1 } }
      );

      // Get bookings for this worker to calculate earnings/jobs
      const db = WorkerProfile.collection().s.db;
      const workerIdStr = m.user.toString();
      
      const stats = await db.collection('bookings').aggregate([
        {
          $match: {
            $or: [
              { worker_user_id: workerIdStr },
              { worker: m.user }
            ],
            status: { $in: ["completed", "paid"] }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$amount" },
            totalJobs: { $sum: 1 }
          }
        }
      ]).toArray();

      return {
        ...m,
        id: m._id,
        worker_id: m.user,
        full_name: userDetails?.full_name || 'Unknown Worker',
        phone: userDetails?.phone || 'N/A',
        email: userDetails?.email || 'N/A',
        total_jobs: stats[0]?.totalJobs || 0,
        earnings: stats[0]?.totalEarnings || 0,
        skills: m.serviceCategories || [],
        // ✅ Identity Verification — drives the Aadhaar badge in the UI
        is_verified: m.is_verified || false,
        aadhaar_url: m.aadhaar_url || null,
      };
    }));

    res.json(populatedMembers);
  } catch (err) {
    console.error('getThekedarTeam Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc Get aggregate stats for the entire team
 * @route GET /api/thekedar/stats
 * @access Private (Thekedar)
 */
export const getTeamStats = async (req, res) => {
  try {
    const thekedarId = new ObjectId(req.user._id);

    // 1. Get all supervised workers
    const supervisedWorkers = await WorkerProfile.collection()
      .find({ manager_id: thekedarId })
      .project({ user: 1 })
      .toArray();

    const workerUserIds = supervisedWorkers.map(sw => sw.user);
    const workerUserIdStrs = workerUserIds.map(id => id.toString());

    const db = WorkerProfile.collection().s.db;

    // 2. Aggregate bookings for all these workers
    const statsPipeline = [
      {
        $match: {
          $or: [
            { worker_user_id: { $in: workerUserIdStrs } },
            { worker: { $in: workerUserIds } }
          ],
          status: { $in: ["completed", "paid"] }
        }
      },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalTeamEarnings: { $sum: "$amount" },
                totalTeamJobs: { $sum: 1 }
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

    const stats = await db.collection('bookings').aggregate(statsPipeline).toArray();

    res.json({
      totalTeamEarnings: stats[0]?.overall[0]?.totalTeamEarnings || 0,
      totalTeamJobs: stats[0]?.overall[0]?.totalTeamJobs || 0,
      teamMemberCount: supervisedWorkers.length,
      monthlyStats: stats[0]?.monthly || []
    });

  } catch (err) {
    console.error('getTeamStats Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc Add a worker to the thekedar's team (using worker's email/phone)
 * @route POST /api/thekedar/team
 * @access Private (Thekedar)
 */
export const addTeamMember = async (req, res) => {
  try {
    const { identifier } = req.body; // email or phone
    const thekedarId = new ObjectId(req.user._id);

    if (!identifier) return res.status(400).json({ message: 'Identifier (email/phone) required' });

    // 1. Find user
    const targetUser = await User.collection().findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });

    if (!targetUser) return res.status(404).json({ message: 'Worker user not found' });
    if (targetUser.role !== 'worker') return res.status(400).json({ message: 'User is not a worker' });

    // 2. Update WorkerProfile to set manager_id
    const result = await WorkerProfile.collection().findOneAndUpdate(
      { user: targetUser._id },
      { $set: { manager_id: thekedarId, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ message: 'Worker profile not found for this user' });

    res.json({ message: 'Worker added to team successfully', worker: targetUser.full_name });
  } catch (err) {
    console.error('addTeamMember Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc Get hotspots of pending bookings for the demand heatmap
 * @route GET /api/thekedar/demand-heatmap
 * @access Private (Thekedar/Admin)
 */
export const getDemandHeatmap = async (req, res) => {
  try {
    const db = WorkerProfile.collection().s.db;
    
    // Fetch pending bookings from the last 24 hours
    const recentTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const hotspots = await db.collection('bookings').aggregate([
      {
        $match: {
          status: 'pending',
          createdAt: { $gte: recentTime },
          'customer_location.coordinates': { $exists: true }
        }
      },
      {
        $project: {
          id: "$_id",
          lat: { $arrayElemAt: ["$customer_location.coordinates", 1] },
          lng: { $arrayElemAt: ["$customer_location.coordinates", 0] },
          service: 1,
          amount: 1
        }
      }
    ]).toArray();

    res.json(hotspots);
  } catch (err) {
    console.error('getDemandHeatmap Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc Get all site visits for a Thekedar's team
 * @route GET /api/thekedar/visits
 * @access Private (Thekedar/Admin)
 */
export const getTeamVisits = async (req, res) => {
  try {
    const db = WorkerProfile.collection().s.db;
    const thekedar_id = req.user.id;

    const visits = await db.collection('bookings').aggregate([
      {
        $match: {
          manager_id: thekedar_id,
          status: { $in: ['pending', 'scheduled', 'in_progress'] }
        }
      },
      {
        $lookup: {
          from: 'worker_profiles',
          localField: 'worker_id',
          foreignField: 'user_id',
          as: 'worker'
        }
      },
      {
        $unwind: { path: '$worker', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          id: "$_id",
          status: 1,
          createdAt: 1,
          estimatedAmount: 1,
          address: 1,
          lat: { $arrayElemAt: ["$customer_location.coordinates", 1] },
          lng: { $arrayElemAt: ["$customer_location.coordinates", 0] },
          workerName: "$worker.full_name",
          customerName: "$customer_name"
        }
      }
    ]).toArray();

    res.json(visits);
  } catch (err) {
    console.error('getTeamVisits Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
