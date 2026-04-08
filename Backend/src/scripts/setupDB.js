import 'dotenv/config';
import { connectDB, getDb } from '../config/db.js';

import { User } from '../models/User.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { Customer } from '../models/Customer.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { Notification } from '../models/Notification.js';

async function setupDatabase() {
    try {
        await connectDB();
        const db = getDb();
        console.log('Connected to DB, configuring collections and indexes...');

        // Create collections explicitly to apply validators if they don't exist
        const collections = ['users', 'worker_profiles', 'customers', 'service_categories', 'bookings', 'payments', 'notifications'];
        const existingCollectionsObj = await db.listCollections().toArray();
        const existingCollections = existingCollectionsObj.map(c => c.name);

        for (const col of collections) {
            if (!existingCollections.includes(col)) {
                await db.createCollection(col);
                console.log(`Created collection: ${col}`);
            }
        }

        console.log('Cleaning up invalid data...');
        await db.collection('payments').deleteMany({ booking_id: null });

        console.log('Creating Indexes...');
        // Execute the generic createIndexes on all models
        await User.createIndexes();
        await WorkerProfile.createIndexes();
        await Customer.createIndexes();
        await ServiceCategory.createIndexes();
        await Booking.createIndexes();
        await Payment.createIndexes();
        await Notification.createIndexes();
        console.log('All indexes created successfully.');

        // Adding JSON schema validation for users collection
        console.log('Adding JSON schema validators...');
        await db.command({
            collMod: 'users',
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['full_name', 'password', 'role'],
                    properties: {
                        full_name: { bsonType: 'string', description: 'must be a string and is required' },
                        email: { bsonType: 'string', description: 'must be a string' },
                        phone: { bsonType: 'string', description: 'must be a string' },
                        password: { bsonType: 'string', description: 'must be a string and is required' },
                        role: { enum: ['customer', 'worker', 'thekedar', 'admin'], description: 'must be a valid role' },
                        isVerified: { bsonType: 'bool' },
                        socials: {
                            bsonType: 'object',
                            properties: {
                                twitter: { bsonType: 'string' },
                                linkedin: { bsonType: 'string' }
                            }
                        }
                    }
                }
            },
            validationLevel: 'moderate'
        }).catch(err => console.log('Notice: users schema update note -', err.message));

        console.log('Database setup complete.');
        process.exit(0);
    } catch (error) {
        console.error('Failed to setup database:', error.message);
        import('fs').then(fs => {
            fs.writeFileSync('error_log.txt', JSON.stringify({ message: error.message, stack: error.stack, code: error.code, writeErrors: error.writeErrors }, null, 2), 'utf8');
            process.exit(1);
        });
    }
}

setupDatabase();
