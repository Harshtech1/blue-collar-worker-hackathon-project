import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI;
console.log('🔌 Testing Mongoose connection with TLS options...');

try {
  await mongoose.connect(uri, {
    tlsAllowInvalidCertificates: true,
    serverSelectionTimeoutMS: 15000
  });
  console.log('✅ SUCCESS! Mongoose connected to MongoDB Atlas!');
  await mongoose.disconnect();
} catch (err) {
  console.error('❌ Mongoose connection FAILED:', err.message);
}
