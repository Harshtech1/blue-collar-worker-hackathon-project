const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

export const uploadFile = async (file: File): Promise<{ url?: string; error?: string }> => {
    const token = localStorage.getItem('token');

    if (!token) {
        return { error: 'Not authenticated' };
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
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
        // Return full url format just in case
        return { url: `${API_BASE}${data.url}` };
    } catch (error: any) {
        console.error('Error uploading file:', error);
        return { error: error.message || 'Unknown error occurred during upload' };
    }
};
