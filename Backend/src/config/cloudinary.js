import { v2 as cloudinary } from 'cloudinary';

const parseCloudinaryUrl = (value) => {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'cloudinary:') return null;

    return {
      cloudName: parsed.hostname,
      apiKey: decodeURIComponent(parsed.username || ''),
      apiSecret: decodeURIComponent(parsed.password || ''),
    };
  } catch {
    return null;
  }
};

const cloudinaryUrlConfig = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || cloudinaryUrlConfig?.cloudName;
const apiKey = process.env.CLOUDINARY_API_KEY || cloudinaryUrlConfig?.apiKey;
const apiSecret = process.env.CLOUDINARY_API_SECRET || cloudinaryUrlConfig?.apiSecret;

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export { cloudinary };
