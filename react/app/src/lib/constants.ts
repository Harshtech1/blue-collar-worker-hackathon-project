const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export const API_ROOT = isLocalhost 
  ? (import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000')
  : 'https://blue-collar-worker-hackathon-project.onrender.com';

export const API = `${API_ROOT}/api`;
