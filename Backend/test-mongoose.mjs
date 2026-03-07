import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI;
console.log('🔌 Testing Mongoose connection...');

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ SUCCESS! Mongoose connected to MongoDB Atlas!');
  await mongoose.disconnect();
} catch (err) {
  console.error('❌ Mongoose connection FAILED:', err.message);
}
