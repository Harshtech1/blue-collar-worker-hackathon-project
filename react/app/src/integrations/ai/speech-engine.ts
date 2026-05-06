
export interface VoiceConfig {
  voiceId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

// Professional voice presets
export const VOICE_PRESETS = {
  SARAH_PROFESSIONAL: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah (Professional)',
    stability: 0.85,
    similarityBoost: 0.9,
    style: 0.2,
    useSpeakerBoost: true
  },
  ANTHONY_EXECUTIVE: {
    voiceId: 'ErXwobaYiN019PkySvjV',
    name: 'Anthony (Executive)',
    stability: 0.8,
    similarityBoost: 0.85,
    style: 0.1,
    useSpeakerBoost: true
  },
  MATILDA_NEWS: {
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda (News Anchor)',
    stability: 0.9,
    similarityBoost: 0.95,
    style: 0.0,
    useSpeakerBoost: true
  },
  CHARLES_CORPORATE: {
    voiceId: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Charles (Corporate)',
    stability: 0.85,
    similarityBoost: 0.9,
    style: 0.15,
    useSpeakerBoost: true
  },
  RACHEL_PROFESSIONAL: {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel (Premium Professional)',
    stability: 0.85,
    similarityBoost: 0.9,
    style: 0.1,
    useSpeakerBoost: true
  }
};

import { isElevenEnabled } from './eleven-client';

export class SpeechEngine {
  private isPlaying: boolean = false;
  private audio: HTMLAudioElement | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. Voice features will be disabled.');
    }

    if (isElevenEnabled()) {
      // Browser audio uses the fetch-based flow below.
    }
  }

  async speak(text: string, config?: Partial<VoiceConfig>): Promise<void> {
    if (!this.apiKey) {
      this.speakFallback(text);
      return;
    }

    if (this.isPlaying) {
      this.stopSpeaking();
    }

    try {
      this.isPlaying = true;
      
      const voiceId = config?.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default voice ID (Rachel)
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: config?.stability ?? 0.5,
            similarity_boost: config?.similarityBoost ?? 0.75,
            style: config?.style ?? 0.0,
            use_speaker_boost: config?.useSpeakerBoost ?? true
          }
        })
      });

      if (!response.ok) throw new Error('TTS API failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.audio = new Audio(audioUrl);
      
      return new Promise((resolve) => {
        if (!this.audio) return resolve();
        this.audio.onended = () => {
          this.isPlaying = false;
          resolve();
        };
        this.audio.onerror = () => {
          this.isPlaying = false;
          this.speakFallback(text);
          resolve();
        };
        this.audio.play().catch(err => {
          console.error('Audio play error:', err);
          this.speakFallback(text);
          resolve();
        });
      });
    } catch (error) {
      console.error('Error generating speech:', error);
      this.speakFallback(text);
    } finally {
      this.isPlaying = false;
    }
  }

  private speakFallback(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.onend = () => {
        this.isPlaying = false;
      };
      this.isPlaying = true;
      speechSynthesis.speak(utterance);
    }
  }

  stopSpeaking(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    this.isPlaying = false;
  }

  isVoiceEnabled(): boolean {
    return !!this.apiKey;
  }

  // Simplified for browser
  async getAvailableVoices(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': this.apiKey }
      });
      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }
}

export const speechEngine = new SpeechEngine();
