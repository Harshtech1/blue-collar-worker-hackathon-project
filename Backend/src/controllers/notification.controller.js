import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';

export const getUserNotifications = async (req, res) => {
    try {
        const db = getDb();
        const notifications = await db
            .collection('notifications')
            .find({ user: new ObjectId(req.user._id) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const db = getDb();
        const result = await db
            .collection('notifications')
            .findOneAndUpdate(
                { _id: new ObjectId(id), user: new ObjectId(req.user._id) },
                { $set: { read: true, updatedAt: new Date() } },
                { returnDocument: 'after' }
            );

        if (!result.value && !result) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json(result.value || result);
    } catch (err) {
        console.error('Error marking notification read:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const db = getDb();
        await db
            .collection('notifications')
            .updateMany(
                { user: new ObjectId(req.user._id), read: false },
                { $set: { read: true, updatedAt: new Date() } }
            );

        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        console.error('Error marking all read:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Internal utility to create notifications
export const createNotification = async (userId, type, title, message, relatedId = null) => {
    try {
        const db = getDb();
        const doc = {
            user: new ObjectId(userId),
            type,
            title,
            message,
            relatedId: relatedId ? new ObjectId(relatedId) : null,
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('notifications').insertOne(doc);
        return { ...doc, _id: result.insertedId };
    } catch (err) {
        console.error('Failed to create notification', err);
        return null;
    }
};

export const createTestNotification = async (req, res) => {
    try {
        const types = ['job_invite', 'status_update', 'payment', 'system'];
        const randomType = types[Math.floor(Math.random() * types.length)];

        const notification = await createNotification(
            req.user._id,
            randomType,
            `Test Notification ${Math.floor(Math.random() * 1000)}`,
            'This is a generated test notification to verify the frontend UI.'
        );

        res.json(notification);
    } catch (err) {
        console.error('Test notification error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
