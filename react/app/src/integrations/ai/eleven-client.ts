import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Shared ElevenLabs client for browser usage
export const elevenClient = new ElevenLabsClient({
  apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY || "dummy",
});

export function isElevenEnabled() {
  return Boolean(import.meta.env.VITE_ELEVENLABS_API_KEY);
}
