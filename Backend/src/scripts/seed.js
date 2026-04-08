import 'dotenv/config';
import { connectDB, getDb } from '../config/db.js';
import { faker } from '@faker-js/faker';

async function seedDatabase() {
    try {
        await connectDB();
        const db = getDb();
        console.log('Seeding fake data...');

        // Clear existing related fake data (optional, but good for pure seed)
        // Let's just append some fake workers for testing.
        const serviceCategories = await db.collection('service_categories').find().toArray();
        if (serviceCategories.length === 0) {
            console.log('No service categories found. Seed them first or create them in admin panel.');
            process.exit(1);
        }

        const workers = [];
        for (let i = 0; i < 5; i++) {
            // Create user
            const workerUser = {
                full_name: faker.person.fullName(),
                email: faker.internet.email(),
                phone: faker.phone.number({ style: 'international' }),
                password: 'hashedpassword123', // Just a placeholder
                role: 'worker',
                isVerified: true,
                socials: {
                    twitter: faker.internet.username(),
                    linkedin: faker.internet.username()
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const userResult = await db.collection('users').insertOne(workerUser);

            // Create worker profile
            const workerProfile = {
                user: userResult.insertedId,
                user_id: userResult.insertedId,
                serviceCategories: [faker.helpers.arrayElement(serviceCategories)._id],
                experience_years: faker.number.int({ min: 1, max: 20 }),
                base_price: faker.number.int({ min: 100, max: 2000 }),
                bio: faker.person.bio(),
                location: {
                    type: "Point",
                    coordinates: [
                        faker.location.longitude({ min: 76.7, max: 76.8 }), // Chandigarh approx long
                        faker.location.latitude({ min: 30.7, max: 30.8 })   // Chandigarh approx lat
                    ]
                },
                status: faker.helpers.arrayElement(["online", "offline"]),
                isAvailable: true,
                completed_jobs_count: faker.number.int({ min: 0, max: 100 }),
                rating: faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 }),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            workers.push(workerProfile);
        }

        if (workers.length > 0) {
            await db.collection('worker_profiles').insertMany(workers);
            console.log(`Inserted ${workers.length} fake workers for testing matching.`);
        }

        console.log('Seed complete!');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seedDatabase();
