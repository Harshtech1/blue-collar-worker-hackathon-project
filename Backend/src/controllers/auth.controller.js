import { getDb } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { sendEmail } from '../utils/emailService.js';
import { getMediaUrl, normalizeMediaField } from '../utils/mediaStorage.js';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const isMasterOtpEnabled = () => process.env.ALLOW_MASTER_OTP === 'true' || process.env.NODE_ENV !== 'production';
const getMasterOtp = () => process.env.MASTER_OTP || '123456';

const logOtpForDev = (identifier, otp) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] OTP for ${identifier}: ${otp}`);
  }
};

const generateToken = (user) => {
  return jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '7d' });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL = '15m';
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const buildPasswordResetToken = (user) => jwt.sign({
  purpose: 'password-reset',
  id: user._id.toString(),
  email: user.email,
}, getJwtSecret(), { expiresIn: PASSWORD_RESET_TOKEN_TTL });

const clearPasswordResetState = {
  passwordResetOtp: null,
  passwordResetOtpExpires: null,
  passwordResetVerifiedAt: null,
};

export const register = async (req, res) => {
  try {
    const { email, password, full_name, phone, role } = req.body;
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
      logOtpForDev(email, otp);

      await db.collection('users').updateOne({ _id: existing._id }, {
        $set: {
          password: hashedPassword,
          full_name,
          phone: phone || existing.phone || null,
          role: role || 'customer',
          otp,
          otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
          updatedAt: new Date()
        }
      });

      // Resend OTP asynchronously so it doesn't block the API response
      sendEmail(email, 'Your Verification OTP', `Your OTP is ${otp}`).catch(emailErr => {
        console.error("Email send failed:", emailErr);
        // Continue even if email fails in dev, but usually strict in prod
      });
      return res.json({ message: 'OTP sent to email', userId: existing._id, email });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    logOtpForDev(email, otp);

    const newUser = {
      email,
      phone: phone || null,
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

    // Send OTP asynchronously
    sendEmail(email, 'Your Verification OTP', `Your OTP is ${otp}`).catch(emailErr => {
      console.error("Email send failed:", emailErr);
    });

    res.json({ message: 'OTP sent to email', userId: result.insertedId, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body; // `email` may contain email or phone for demo compatibility
    const identifier = String(email || '').trim();
    if (!identifier || !otp) {
      return res.status(400).json({ message: 'Identifier and OTP are required' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });

    if (!user) return res.status(400).json({ message: 'User not found' });

    // Secret master OTP for hackathon demos/testing where emails easily fail
    const isMasterOtp = isMasterOtpEnabled() && otp === getMasterOtp();
    if (isMasterOtp) {
      console.warn('[AUTH] Master OTP used for verification');
    }

    // Allow strict equality or loose equality if types differ, but both are strings ideally.
    if (user.otp !== otp && !isMasterOtp) {
      // Fallback check for dates
      if (!user.otp || user.otpExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (!isMasterOtp && user.otpExpires < new Date()) {
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
            await db.collection('customers').insertOne({ user: user._id, full_name: user.full_name || '', email: user.email || null, phone: user.phone || null, createdAt: new Date() });
          }
        }
      } catch (profileErr) {
        console.error("Profile creation failed:", profileErr);
        // Don't block auth, just log
      }
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role,
        avatar: normalizeMediaField(user.avatar || user.avatar_url),
        avatar_url: getMediaUrl(user.avatar || user.avatar_url),
        socials: user.socials || {},
        preferred_language: user.preferred_language,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        isVerified: true
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    console.log(`[AUTH] Login attempt for: ${email}`);
    
    // Check if it's the admin
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (ADMIN_EMAIL && ADMIN_PASSWORD && email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { role: "admin", email },
        getJwtSecret(),
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
    logOtpForDev(email, otp);

    await db.collection('users').updateOne({ _id: user._id }, {
      $set: { otp, otpExpires: new Date(Date.now() + 10 * 60 * 1000) }
    });

    // Send OTP asynchronously
    sendEmail(email, 'Your Login OTP', `Your OTP for login is ${otp}`).catch(emailErr => {
      console.error("Login OTP email failed:", emailErr);
    });

    res.json({ message: 'OTP sent to email', requireOtp: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const sendOtp = async (req, res) => {
  try {
    const identifier = String(req.body.phone || req.body.email || '').trim();
    if (!identifier) {
      return res.status(400).json({ message: 'Phone or email is required' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = generateOTP();
    logOtpForDev(identifier, otp);

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { otp, otpExpires: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date() } }
    );

    if (user.email) {
      sendEmail(user.email, 'Your Login OTP', `Your OTP for login is ${otp}`).catch(emailErr => {
        console.error("Login OTP email failed:", emailErr);
      });
    }

    res.json({ message: 'OTP sent successfully', requireOtp: true, identifier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const genericMessage = 'If an account exists for this email, a password reset OTP has been sent.';
    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return res.json({ message: genericMessage });
    }

    const otp = generateOTP();
    logOtpForDev(email, otp);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetOtp: otp,
          passwordResetOtpExpires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
          passwordResetVerifiedAt: null,
          updatedAt: new Date(),
        },
      },
    );

    sendEmail(
      email,
      'Your RAHI password reset OTP',
      `Your password reset OTP is ${otp}. Enter this code in the RAHI app to choose a new password.`,
    ).catch((emailErr) => {
      console.error('Password reset OTP email failed:', emailErr);
    });

    return res.json({ message: genericMessage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset OTP' });
    }

    const isMasterOtp = isMasterOtpEnabled() && otp === getMasterOtp();
    if (!isMasterOtp && (!user.passwordResetOtp || user.passwordResetOtp !== otp)) {
      return res.status(400).json({ message: 'Invalid or expired password reset OTP' });
    }

    if (!isMasterOtp && user.passwordResetOtpExpires < new Date()) {
      return res.status(400).json({ message: 'Password reset OTP expired' });
    }

    const resetToken = buildPasswordResetToken(user);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          passwordResetOtp: '',
          passwordResetOtpExpires: '',
        },
      },
    );

    return res.json({
      message: 'OTP verified successfully',
      resetToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const resetToken = String(req.body.resetToken || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: 'Email, reset token, and new password are required' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, getJwtSecret());
    } catch (_err) {
      return res.status(400).json({ message: 'Password reset session expired. Please request a new OTP.' });
    }

    if (decoded?.purpose !== 'password-reset' || normalizeEmail(decoded?.email) !== email) {
      return res.status(400).json({ message: 'Password reset session is invalid' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Unable to reset password for this account' });
    }

    const verifiedAt = user.passwordResetVerifiedAt ? new Date(user.passwordResetVerifiedAt) : null;
    if (!verifiedAt || (Date.now() - verifiedAt.getTime()) > PASSWORD_RESET_TTL_MS) {
      return res.status(400).json({ message: 'Password reset verification expired. Please request a new OTP.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          otp: null,
          otpExpires: null,
          updatedAt: new Date(),
          ...clearPasswordResetState,
        },
      },
    );

    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());

    // Check if the decoded token represents an admin
    if (decoded.role === 'admin') {
      return res.json({ user: { email: decoded.email, role: 'admin', full_name: 'RAHI Admin' } });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });

    if (!user) return res.status(404).json({ message: 'Not found' });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json({
      user: {
        ...userWithoutPassword,
        avatar: normalizeMediaField(userWithoutPassword.avatar || userWithoutPassword.avatar_url),
        avatar_url: getMediaUrl(userWithoutPassword.avatar || userWithoutPassword.avatar_url),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Not authorized' });
  }
};
