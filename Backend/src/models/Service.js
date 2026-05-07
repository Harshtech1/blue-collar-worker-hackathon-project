import { getDb } from '../config/db.js';

const COLLECTION = 'services';

export const Service = {
  collection: () => getDb().collection(COLLECTION),

  validate: (data) => {
    const errors = [];
    if (!data.name) errors.push('Name is required');
    if (data.price === null || data.price === undefined) errors.push('Price is required');
    return errors;
  },

  createIndexes: async () => {
    // Add indexes if needed
    const db = getDb();
    await db.collection(COLLECTION).createIndex({ name: 1 });
  }
};
