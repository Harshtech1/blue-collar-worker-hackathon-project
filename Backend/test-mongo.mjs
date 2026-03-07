import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI;
console.log('🔌 Testing SRV connection with IPv4 only...');

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  family: 4 // FORCE IPv4
});

try {
  await client.connect();
  const result = await client.db('admin').command({ ping: 1 });
  console.log('✅ SUCCESS! MongoDB Atlas CONNECTED!', JSON.stringify(result));
  await client.close();
} catch (err) {
  console.error('❌ Connection FAILED:', err.message);
}
