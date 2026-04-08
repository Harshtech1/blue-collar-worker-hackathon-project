import { getDb } from '../config/db.js';

const COLLECTION = 'service_categories';

/*
 * ServiceCategory Data Structure
 * _id: ObjectId
 * name: String (e.g., "Plumber", "Electrician", "Pandit")
 * icon: String (Icon name or URL)
 * description: String
 * display_order: Number
 * is_active: Boolean
 * base_price_estimate: Number
 * createdAt / updatedAt: Date
 */

export const ServiceCategory = {
    collection: () => getDb().collection(COLLECTION),

    validate: (data) => {
        const errors = [];
        if (!data.name) errors.push('Name is required');
        if (!data.icon) errors.push('Icon is required');
        if (data.display_order !== undefined && typeof data.display_order !== 'number') {
            errors.push('Display order must be a number');
        }
        return errors;
    },

    createIndexes: async () => {
        const db = getDb();
        await db.collection(COLLECTION).createIndex({ is_active: 1 });
        await db.collection(COLLECTION).createIndex({ display_order: 1 });
    }
};
