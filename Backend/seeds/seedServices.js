import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || process.env.MONGO_DB || 'test';

const services = [
    { id: 'ac-repair', name: 'AC Repair', name_hi: 'एसी मरम्मत', icon: 'thermometer', color: '#3b82f6', description: 'AC installation, repair & servicing', is_active: true, display_order: 1 },
    { id: 'plumbing', name: 'Plumbing', name_hi: 'प्लंबिंग', icon: 'droplets', color: '#06b6d4', description: 'Pipe repair, leakage & installation', is_active: true, display_order: 2 },
    { id: 'electrical', name: 'Electrical', name_hi: 'बिजली का काम', icon: 'zap', color: '#f59e0b', description: 'Wiring, repair & installation', is_active: true, display_order: 3 },
    { id: 'carpentry', name: 'Carpentry', name_hi: 'बढ़ईगीरी', icon: 'hammer', color: '#8b5cf6', description: 'Furniture repair & woodwork', is_active: true, display_order: 4 },
    { id: 'painting', name: 'Painting', name_hi: 'पेंटिंग', icon: 'paintbrush', color: '#ec4899', description: 'Wall painting & polishing', is_active: true, display_order: 5 },
    { id: 'cleaning', name: 'Cleaning', name_hi: 'सफाई', icon: 'sparkles', color: '#10b981', description: 'Home & office cleaning', is_active: true, display_order: 6 },
    { id: 'appliance-repair', name: 'Appliance Repair', name_hi: 'उपकरण मरम्मत', icon: 'settings', color: '#6366f1', description: 'TV, Fridge, Washing machine repair', is_active: true, display_order: 7 },
    { id: 'construction', name: 'Construction', name_hi: 'निर्माण', icon: 'hard-hat', color: '#f97316', description: 'Civil work & renovation', is_active: true, display_order: 8 },
    { id: 'thekedar', name: 'Thekedar', name_hi: 'ठेकेदार', icon: 'hard-hat', color: '#10b981', description: 'Big / Complex work planning', is_active: true, display_order: 9 },
];

async function seed() {
    if (!MONGO_URI) {
        throw new Error('MONGODB_URI or MONGO_URI is required to seed services');
    }

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db(DB_NAME);

        // Clear existing
        await db.collection('service_categories').deleteMany({});

        // Insert new
        await db.collection('service_categories').insertMany(services);

        console.log('Services seeded successfully');
    } catch (error) {
        console.error('Error seeding services:', error);
    } finally {
        await client.close();
    }
}

seed();
