import { getDb } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { sendEmail } from '../utils/emailService.js';

const generateToken = (user) => {
  return jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, process.env.JWT_SECRET || 'changeme', { expiresIn: '7d' });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const db = getDb();
    const existing = await db.collection('users').findOne({ email });

    if (existing) {
      if (existing.isVerified) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      // Update existing unverified user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const otp = generateOTP();
      console.log(`[DEV] OTP for ${email}: ${otp}`); // Log OTP for debugging

      await db.collection('users').updateOne({ _id: existing._id }, {
        $set: {
          password: hashedPassword,
          full_name,
          role: role || 'customer',
          otp,
          otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
          updatedAt: new Date()
        }
      });

      // Resend OTP
      try {
        await sendEmail(email, 'Your Verification OTP', `Your OTP is ${otp}`);
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
        // Continue even if email fails in dev, but usually strict in prod
      }
      return res.json({ message: 'OTP sent to email', userId: existing._id, email });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    console.log(`[DEV] OTP for ${email}: ${otp}`); // Log OTP for debugging

    const newUser = {
      email,
      password: hashedPassword,
      full_name,
      role: role || 'customer',
      isVerified: false,
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    try {
      await sendEmail(email, 'Your Verification OTP', `Your OTP is ${otp}`);
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }

    res.json({ message: 'OTP sent to email', userId: result.insertedId, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body; // type: 'register' or 'login'

    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user) return res.status(400).json({ message: 'User not found' });

    // Allow strict equality or loose equality if types differ, but both are strings ideally.
    if (user.otp !== otp) {
      // Fallback check for dates
      if (!user.otp || user.otpExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Clear OTP
    await db.collection('users').updateOne({ _id: user._id }, {
      $set: { otp: null, otpExpires: null, isVerified: true }
    });

    // Create related profile records if not exists (Lazy creation)
    if (type === 'register' || !user.isVerified) {
      try {
        // Only create if verify is for registration or first time verification
        const profileCollection = user.role === 'worker' ? 'worker_profiles' : 'customers';
        const existingProfile = await db.collection(profileCollection).findOne({ user: user._id });

        if (!existingProfile) {
          if (user.role === 'worker') {
            await db.collection('worker_profiles').insertOne({ user: user._id, createdAt: new Date() });
          } else {
            await db.collection('customers').insertOne({ user: user._id, full_name: user.full_name || '', email, createdAt: new Date() });
          }
        }
      } catch (profileErr) {
        console.error("Profile creation failed:", profileErr);
        // Don't block auth, just log
      }
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, full_name: user.full_name, role: user.role, isVerified: true } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if it's the admin
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (ADMIN_EMAIL && ADMIN_PASSWORD && email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { role: "admin", email },
        process.env.JWT_SECRET || "changeme",
        { expiresIn: "4h" }
      );
      return res.json({ token, role: "admin", user: { email, role: "admin", full_name: "Admin Backend" }, requireOtp: false });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate OTP for 2FA
    const otp = generateOTP();
    console.log(`[DEV] OTP for ${email}: ${otp}`); // Log OTP for debugging

    await db.collection('users').updateOne({ _id: user._id }, {
      $set: { otp, otpExpires: new Date(Date.now() + 10 * 60 * 1000) }
    });

    try {
      await sendEmail(email, 'Your Login OTP', `Your OTP for login is ${otp}`);
    } catch (emailErr) {
      console.error("Login OTP email failed:", emailErr);
    }

    res.json({ message: 'OTP sent to email', requireOtp: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme');

    // Check if the decoded token represents an admin
    if (decoded.role === 'admin') {
      return res.json({ user: { email: decoded.email, role: 'admin', full_name: 'RAHI Admin' } });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });

    if (!user) return res.status(404).json({ message: 'Not found' });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Not authorized' });
  }
};
