export function isElevenEnabled() {
  return Boolean(import.meta.env.VITE_ELEVENLABS_API_KEY);
}

// The browser integration uses direct fetch calls for audio generation,
// so we avoid bundling the Node-oriented SDK into the client build.
export const elevenClient = null;
