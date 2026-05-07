import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || process.env.MONGO_DB || 'test';

async function testValidation() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for testing schema validation");
    const db = client.db(DB_NAME);

    // Reapply validation to ensure it's up to date
    const collections = await db.listCollections({ name: 'payments' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('payments');
    }
    await db.command({
      collMod: 'payments',
      validator: {
        $and: [
          {
            $jsonSchema: {
              bsonType: "object",
              required: ["booking_id", "total_amount", "platform_fee_amount", "worker_amount"],
              properties: {
                total_amount: { bsonType: ["number", "double", "int"] },
                platform_fee_amount: { bsonType: ["number", "double", "int"] },
                worker_amount: { bsonType: ["number", "double", "int"] }
              }
            }
          },
          {
            $expr: {
              $eq: [
                { $round: ["$total_amount", 2] },
                { $round: [{ $add: ["$platform_fee_amount", "$worker_amount"] }, 2] }
              ]
            }
          }
        ]
      },
      validationLevel: "strict"
    });
    console.log("Schema validation applied successfully!");

    // Test 1: Valid Insert
    try {
      await db.collection("payments").insertOne({
        booking_id: "test_booking_1",
        total_amount: 100,
        platform_fee_amount: 10,
        worker_amount: 90
      });
      console.log("✅ Test 1 Passed: Valid payment inserted.");
    } catch (e) {
      console.error("❌ Test 1 Failed: Valid payment rejected", e.message);
    }

    // Test 2: Invalid Insert (Total mismatch)
    try {
      await db.collection("payments").insertOne({
        booking_id: "test_booking_2",
        total_amount: 100,
        platform_fee_amount: 10,
        worker_amount: 50 // Mismatch! 10 + 50 != 100
      });
      console.error("❌ Test 2 Failed: Invalid payment WAS inserted!");
    } catch (e) {
      console.log("✅ Test 2 Passed: Invalid payment correctly rejected by database.", e.message);
    }

    // Clean up test documents
    await db.collection("payments").deleteMany({ booking_id: { $in: ["test_booking_1", "test_booking_2"] } });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

testValidation();
