import { getDb } from '../config/db.js';

const COLLECTION = 'users';

/*
 * User Data Structure
 * _id: ObjectId
 * full_name: String
 * email: String
 * phone: String
 * password: String
 * role: Enum ["customer", "worker", "thekedar", "admin"]
 * isVerified: Boolean
 * socials: { twitter: String, linkedin: String }
 * createdAt / updatedAt: Date
 */

export const User = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.full_name) errors.push('Full name is required');
    if (!data.phone && !data.email) errors.push('Either phone or email is required');
    if (!data.password) errors.push('Password is required');
    
    // Optional client access/social handles validation
    if (data.socials) {
      if (typeof data.socials !== 'object') errors.push('Socials must be an object');
      if (data.socials.twitter && typeof data.socials.twitter !== 'string') errors.push('Twitter handle must be a string');
    }
    return errors;
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
    await db.collection(COLLECTION).createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
  }
};
