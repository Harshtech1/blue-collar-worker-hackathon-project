import express from 'express';
import { initiatePayment, getWorkerPayments, getCustomerPayments, getOverallPaymentStats } from '../controllers/payment.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/initiate', initiatePayment);
router.get('/worker', authorize('worker'), getWorkerPayments);
router.get('/customer', authorize('customer'), getCustomerPayments);
router.get('/stats', authorize('admin'), getOverallPaymentStats);

export default router;
