import express from 'express';
import { getTeam, getTeamStats, addTeamMember, getDemandHeatmap, getTeamVisits } from '../controllers/thekedar.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('thekedar', 'admin'));

router.get('/team', getTeam);
router.post('/team', addTeamMember);
router.get('/stats', getTeamStats);
router.get('/demand-heatmap', getDemandHeatmap);
router.get('/visits', getTeamVisits);

export default router;
