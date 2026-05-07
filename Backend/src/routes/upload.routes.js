import express from 'express';
import { upload } from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';
import { uploadMedia } from '../utils/mediaStorage.js';

const router = express.Router();

// Upload a single file
router.post('/', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const requestedType = String(req.body.type || 'avatar').trim();
        const mediaKind = ['avatar', 'portfolio', 'workPhoto', 'bookingProof', 'aadhaar', 'pan', 'skill'].includes(requestedType)
            ? requestedType
            : 'avatar';
        const media = await uploadMedia(req.file, mediaKind);

        res.json({
            message: 'File uploaded successfully',
            url: media.url,
            media,
            public_id: media.public_id,
            filename: media.public_id,
            mimetype: req.file.mimetype,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'File upload failed: ' + error.message });
    }
});

export default router;
