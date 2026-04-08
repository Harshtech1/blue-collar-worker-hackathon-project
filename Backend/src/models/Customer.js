import { getDb } from '../config/db.js';

const COLLECTION = 'customers';

/*
 * Customer Data Structure
 * _id: ObjectId
 * user: ObjectId (Ref to Users)
 * address: { street: String, city: String, state: String, zipcode: String }
 * location: GeoJSON { type: "Point", coordinates: [lng, lat] }
 * settings: { notifications: Boolean, language: String }
 * createdAt / updatedAt: Date
 */

export const Customer = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.user) errors.push('User ID is required');

    if (data.location && data.location.type !== "Point") {
      errors.push('Location type must be Point');
    }
    return errors;
  },

  createIndexes: async () => {
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ user: 1 }, { unique: true });
    await db.collection(COLLECTION).createIndex({ location: "2dsphere" }).catch(e => console.warn('2dsphere index failed'));
  }
};
