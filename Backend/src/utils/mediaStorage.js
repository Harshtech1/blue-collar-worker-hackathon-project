import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackUploadDir = path.join(__dirname, '../../public/uploads');

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const PDF_MIME_TYPES = new Set(['application/pdf']);

export const mediaProfiles = {
  avatar: { folder: 'rahi/public', visibility: 'public' },
  portfolio: { folder: 'rahi/public', visibility: 'public' },
  workPhoto: { folder: 'rahi/public', visibility: 'public' },
  bookingProof: { folder: 'rahi/bookings/proof', visibility: 'public' },
  aadhaar: { folder: 'rahi/private', visibility: 'private' },
  pan: { folder: 'rahi/private', visibility: 'private' },
  skill: { folder: 'rahi/private', visibility: 'private' },
};

export const isImageFile = (file) => IMAGE_MIME_TYPES.has(file?.mimetype);
export const isPdfFile = (file) => PDF_MIME_TYPES.has(file?.mimetype);

export const normalizeMediaField = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    return {
      url: value,
      secure_url: value,
      public_id: null,
      format: null,
      resource_type: null,
      bytes: null,
      width: null,
      height: null,
      version: null,
      visibility: 'legacy',
      delivery_type: 'legacy',
      original_filename: null,
    };
  }

  if (typeof value === 'object') {
    return {
      url: value.url || value.secure_url || null,
      secure_url: value.secure_url || value.url || null,
      public_id: value.public_id || null,
      format: value.format || null,
      resource_type: value.resource_type || null,
      bytes: value.bytes ?? null,
      width: value.width ?? null,
      height: value.height ?? null,
      version: value.version ?? null,
      visibility: value.visibility || 'public',
      delivery_type: value.delivery_type || 'upload',
      original_filename: value.original_filename || null,
    };
  }

  return null;
};

export const getMediaUrl = (value) => normalizeMediaField(value)?.url || null;

export const getSignedMediaUrl = (value, options = {}) => {
  const media = normalizeMediaField(value);
  if (!media?.public_id || !isCloudinaryConfigured) {
    return media?.url || null;
  }

  const expiresAt = options.expiresAt || Math.floor(Date.now() / 1000) + (options.ttlSeconds || 600);

  return cloudinary.url(media.public_id, {
    resource_type: media.resource_type || 'image',
    type: media.visibility === 'private' ? 'private' : 'upload',
    sign_url: true,
    secure: true,
    expires_at: expiresAt,
    format: media.format || undefined,
  });
};

export const withLegacyMediaAliases = (doc = {}) => {
  const avatar = normalizeMediaField(doc.avatar || doc.avatar_url);
  const aadhaar = normalizeMediaField(doc.aadhaar || doc.aadhaar_url);
  const pan = normalizeMediaField(doc.pan || doc.pan_url);
  const skills = normalizeMediaField(doc.skillsDocument || doc.skills_url);

  return {
    ...doc,
    avatar,
    avatar_url: avatar?.url || doc.avatar_url || null,
    aadhaar,
    aadhaar_url: aadhaar?.url || doc.aadhaar_url || null,
    pan,
    pan_url: pan?.url || doc.pan_url || null,
    skillsDocument: skills,
    skills_url: skills?.url || doc.skills_url || null,
  };
};

const cloudinaryUpload = (file, profile) => (
  new Promise((resolve, reject) => {
    const isImage = isImageFile(file);
    const uploadOptions = {
      folder: profile.folder,
      resource_type: isImage ? 'image' : 'raw',
      type: profile.visibility === 'private' ? 'private' : 'upload',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      access_mode: profile.visibility === 'private' ? 'authenticated' : undefined,
      transformation: isImage ? [{
        width: 512,
        height: 512,
        crop: 'fill',
        gravity: 'face',
        fetch_format: 'auto',
        quality: 'auto',
      }] : undefined,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });

    stream.end(file.buffer);
  })
);

const persistLocalFallback = async (file, profile) => {
  await fs.ensureDir(fallbackUploadDir);
  const extension = path.extname(file.originalname) || (isPdfFile(file) ? '.pdf' : '.webp');
  const filename = `${profile.visibility}-${Date.now()}-${randomUUID()}${extension}`;
  const destination = path.join(fallbackUploadDir, filename);

  await fs.writeFile(destination, file.buffer);

  return {
    secure_url: `/uploads/${filename}`,
    public_id: filename,
    format: extension.replace('.', ''),
    resource_type: isImageFile(file) ? 'image' : 'raw',
    bytes: file.size,
    width: null,
    height: null,
    version: null,
    original_filename: file.originalname,
    fallback: true,
  };
};

const toMediaRecord = (uploadResult, profile) => ({
  url: uploadResult.secure_url || null,
  secure_url: uploadResult.secure_url || null,
  public_id: uploadResult.public_id || null,
  format: uploadResult.format || null,
  resource_type: uploadResult.resource_type || null,
  bytes: uploadResult.bytes ?? null,
  width: uploadResult.width ?? null,
  height: uploadResult.height ?? null,
  version: uploadResult.version ?? null,
  visibility: profile.visibility,
  delivery_type: uploadResult.fallback ? 'fallback-local' : (profile.visibility === 'private' ? 'private' : 'upload'),
  original_filename: uploadResult.original_filename || null,
});

export const uploadMedia = async (file, mediaKind = 'avatar') => {
  const profile = mediaProfiles[mediaKind] || mediaProfiles.avatar;
  const uploadResult = isCloudinaryConfigured
    ? await cloudinaryUpload(file, profile)
    : await persistLocalFallback(file, profile);

  return toMediaRecord(uploadResult, profile);
};
