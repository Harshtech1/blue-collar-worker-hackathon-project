
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; 
import './index.css';
import 'leaflet/dist/leaflet.css';

const pwaEnabled = import.meta.env.VITE_ENABLE_PWA === 'true';

async function cleanupStaleServiceWorkers() {
  if (pwaEnabled || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }
  } catch (error) {
    console.warn('[PWA cleanup] Could not clear stale service workers:', error);
  }
}

void cleanupStaleServiceWorkers();

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
       <App />
    </React.StrictMode>
  );
} else {
  alert("Root element not found");
}
