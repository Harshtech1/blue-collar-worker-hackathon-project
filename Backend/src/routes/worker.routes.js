import express from 'express';
import { createProfile, getByUserId, updateByUserId, listWorkerProfiles, getWorkerStats, getNearbyWorkers, simulateWorkerMovement } from '../controllers/worker.controller.js';
import { queryParser } from '../middlewares/queryParser.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', queryParser, listWorkerProfiles);
router.post('/', protect, authorize('worker', 'admin'), createProfile);
router.get('/stats', protect, authorize('worker', 'admin'), getWorkerStats);
router.get('/nearby', getNearbyWorkers);
router.post('/simulate-movement', protect, authorize('admin'), simulateWorkerMovement);
router.get('/user/:userId', getByUserId); // Publicly viewable for booking
router.patch('/user/:userId', protect, authorize('worker', 'admin'), updateByUserId);

export default router;
