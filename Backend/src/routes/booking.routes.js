import express from 'express';
import { createBooking, listBookings, updateBooking, getByWorkerId, getById, respondToBooking, cancelBooking } from '../controllers/booking.controller.js';
import { queryParser } from '../middlewares/queryParser.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// List bookings with query parser
router.get('/', queryParser, listBookings);

// Create a new booking (customer — may or may not require auth)
router.post('/', createBooking);

// Worker responds (accept / decline) — requires auth
router.patch('/:id/respond', protect, respondToBooking);

// Cancel a booking
router.patch('/:id/cancel', protect, cancelBooking);

// Update an existing booking
router.patch('/:id', protect, updateBooking);

// Get bookings for a specific worker profile
router.get('/worker/:workerId', getByWorkerId);

// Get a single booking by id
router.get('/:id', getById);

export default router;
