import { API_ROOT as API_BASE } from './constants';

const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => (
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Image compression failed'));
        }, 'image/webp', quality);
    })
);

export const compressImageForUpload = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.size <= MAX_IMAGE_BYTES) {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
        bitmap.close?.();
        return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = 0.82;
    let blob = await canvasToBlob(canvas, quality);

    while (blob.size > MAX_IMAGE_BYTES && quality > 0.46) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, quality);
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
    });
};

export interface UploadedMedia {
    url: string | null;
    secure_url?: string | null;
    public_id?: string | null;
    format?: string | null;
    version?: string | null;
    width?: number | null;
    height?: number | null;
    visibility?: string | null;
}

export const extractMediaUrl = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const media = value as UploadedMedia;
        return media.url || media.secure_url || null;
    }
    return null;
};

export const uploadFile = async (file: File, type = 'avatar'): Promise<{ url?: string | null; media?: UploadedMedia; error?: string }> => {
    const token = localStorage.getItem('token');

    if (!token) {
        return { error: 'Not authenticated' };
    }

    try {
        const formData = new FormData();
        const optimizedFile = await compressImageForUpload(file);
        formData.append('file', optimizedFile);
        formData.append('type', type);

        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Do NOT set Content-Type to application/json or multipart/form-data manually
                // Fetch will set it automatically with the correct boundary when body is FormData
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upload file');
        }

        const data = await response.json();
        return { url: extractMediaUrl(data.media) || data.url || null, media: data.media };
    } catch (error: any) {
        console.error('Error uploading file:', error);
        return { error: error.message || 'Unknown error occurred during upload' };
    }
};
