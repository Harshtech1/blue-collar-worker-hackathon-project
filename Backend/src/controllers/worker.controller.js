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
      status: 'offline'
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
      { projection: { email: 1, full_name: 1, role: 1 } }
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

    // Security: don't allow updating user field
    delete updates.user;
    delete updates._id;

    const result = await WorkerProfile.collection().findOneAndUpdate(
      { user: new ObjectId(userId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value && !result) return res.status(404).json({ message: 'Not found' }); // Driver v4 vs v6 check

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
