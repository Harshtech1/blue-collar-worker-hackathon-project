import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    createTestNotification
} from '../controllers/notification.controller.js';

const router = express.Router();

router.use(protect); // All notification routes require authentication

router.get('/', getUserNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.post('/test', createTestNotification);

export default router;
