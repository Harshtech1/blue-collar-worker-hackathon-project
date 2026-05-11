import express from 'express';
import {
  register,
  login,
  getMe,
  verifyOtp,
  sendOtp,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-password-reset-otp', verifyPasswordResetOtp);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

export default router;
