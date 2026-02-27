import { User } from '../models/User.js';
import { ObjectId } from 'mongodb';

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Security: Only allow users to update their own profile, unless admin
    if (req.user && req.user._id.toString() !== id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. You can only update your own user details.' });
    }

    const updates = req.body;

    // Security: don't allow updating sensitive fields directly here if not needed
    delete updates.password;
    delete updates.email; // Usually requires separate flow
    delete updates.role; // Prevent role escalation
    delete updates._id;

    updates.updatedAt = new Date();

    const result = await User.collection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value && !result) return res.status(404).json({ message: 'User not found' });

    const user = result.value || result;
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
