import { getDb } from '../config/db.js';

const COLLECTION = 'worker_profiles';

/*
 * WorkerProfile Data Structure
 * _id: ObjectId
 * user_id: ObjectId (Ref to Users)
 * manager_id: ObjectId (Ref to Users with role 'thekedar')
 * serviceCategories: Array of ObjectIds
 * experience_years: Number
 * base_price: Number
 * bio: String
 * location: GeoJSON { type: "Point", coordinates: [lng, lat] }
 * status: Enum ["online", "offline", "busy"]
 * lastSeen: Date
 * isAvailable: Boolean
 * completed_jobs_count: Number
 * rating: Number
 */

export const WorkerProfile = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.user && !data.user_id) errors.push('User ID is required');
    
    if (data.base_price !== undefined && typeof data.base_price !== 'number') {
      errors.push('Base price must be a number');
    }
    if (data.serviceCategories && !Array.isArray(data.serviceCategories)) {
      errors.push('Service categories must be an array');
    }
    return errors;
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ user: 1 }, { unique: true });
    await db.collection(COLLECTION).createIndex({ serviceCategories: 1 });
    await db.collection(COLLECTION).createIndex({ status: 1, isAvailable: 1 });
    // Note: Creating a 2dsphere index requires clean geometry data so it shouldn't be blindly added.
    await db.collection(COLLECTION).createIndex({ location: "2dsphere" }).catch(e => console.warn('2dsphere index failed, location geometry might be missing or invalid'));
  }
};
