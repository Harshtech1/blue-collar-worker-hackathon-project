import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// Dono variables check kar raha hai
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
  console.error("❌ ERROR: MONGODB_URI or MONGO_URI is missing in your .env file!");
  process.exit(1); 
}

const client = new MongoClient(uri);

let db;

export const connectDB = async () => {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected (Native Driver)");
    db = client.db(); // Agar db name .env mein nahi hai, toh ye default db uthayega
    
    // Set up indexes
    await setupIndexes(db);
    
    return db;
  } catch (error) {
    console.error("❌ MongoDB Connection error:", error.message);
    process.exit(1);
  }
};

const setupIndexes = async (database) => {
  try {
    const workerProfiles = database.collection('worker_profiles');
    await workerProfiles.createIndex({ "location": "2dsphere" });
    await workerProfiles.createIndex({ "user": 1 });
    
    const bookings = database.collection('bookings');
    await bookings.createIndex({ "customer_user_id": 1, "createdAt": -1 });
    await bookings.createIndex({ "worker_user_id": 1, "status": 1, "createdAt": -1 });
    await bookings.createIndex({ "status": 1, "createdAt": -1 });

    const users = database.collection('users');
    await users.createIndex({ "email": 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
    await users.createIndex({ "phone": 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });

    // Enforce Schema Validation on 'payments' collection to reliably secure auto-calculated sums
    const collections = await database.listCollections({ name: 'payments' }).toArray();
    if (collections.length === 0) {
      await database.createCollection('payments');
    }
    await database.command({
      collMod: 'payments',
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["booking_id", "total_amount", "platform_fee_amount", "worker_amount"],
          properties: {
            total_amount: { bsonType: ["number", "double", "int"] },
            platform_fee_amount: { bsonType: ["number", "double", "int"] },
            worker_amount: { bsonType: ["number", "double", "int"] }
          }
        },
        $expr: {
          $eq: [
            { $round: ["$total_amount", 2] },
            { $round: [{ $add: ["$platform_fee_amount", "$worker_amount"] }, 2] }
          ]
        }
      },
      validationLevel: "strict"
    });

    console.log("✅ MongoDB Indexes and Schema Validation set up successfully");
  } catch (err) {
    console.error("⚠️ Warning: Failed to set up indexes or schema validation:", err.message);
  }
};

export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return db;
};