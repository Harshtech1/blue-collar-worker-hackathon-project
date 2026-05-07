import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
]);
const allowedExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp', '.pdf']);

const fileFilter = (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase();
    const hasAllowedExtension = allowedExtensions.has(extname);
    const hasAllowedMimeType = allowedMimeTypes.has(file.mimetype);

    if (hasAllowedExtension && hasAllowedMimeType) {
        return cb(null, true);
    } else {
        cb(new Error('Only images and PDFs are allowed!'));
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter
});
