import { User } from '../models/User.js';
import { ObjectId } from 'mongodb';
import { getMediaUrl, normalizeMediaField } from '../utils/mediaStorage.js';

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Security: Only allow users to update their own profile, unless admin
    if (req.user && req.user.role !== 'admin' && req.user._id?.toString() !== id) {
      return res.status(403).json({ message: 'Forbidden. You can only update your own user details.' });
    }

    const updates = req.body;

    if (updates.avatar_url && !updates.avatar) {
      updates.avatar = normalizeMediaField(updates.avatar_url);
    }
    if (updates.avatar) {
      updates.avatar = normalizeMediaField(updates.avatar);
      updates.avatar_url = getMediaUrl(updates.avatar);
    }

    // Security: don't allow updating sensitive fields directly here if not needed
    delete updates.password;
    delete updates.email; // Usually requires separate flow
    delete updates.role; // Prevent role escalation
    delete updates._id;

    updates.updatedAt = new Date();

    const flattenedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'object' && value !== null && key === 'socials') {
        for (const [subKey, subValue] of Object.entries(value)) {
          flattenedUpdates[`${key}.${subKey}`] = subValue;
        }
      } else {
        flattenedUpdates[key] = value;
      }
    }

    const result = await User.collection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: flattenedUpdates },
      { returnDocument: 'after' }
    );

    if (!result.value && !result) return res.status(404).json({ message: 'User not found' });

    const user = result.value || result;
    const { password, ...safeUser } = user;
    res.json({
      ...safeUser,
      avatar: normalizeMediaField(safeUser.avatar || safeUser.avatar_url),
      avatar_url: getMediaUrl(safeUser.avatar || safeUser.avatar_url),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
