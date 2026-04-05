import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, MessageSquare, Send, Volume2, VolumeX, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate, useLocation } from 'react-router-dom';
import { KNOWLEDGE_BASE } from '@/data/knowledge';
import { speechEngine, VOICE_PRESETS } from '@/integrations/ai/speech-engine';
import { useChatContext } from '@/integrations/ai/context-provider';
import { aiApi } from '@/integrations/ai/ai-api'; // Keep as fallback

// --- CONSTANTS ---
const CHAT_TIMEOUT_MS = 15000; // 15 second timeout
const MIN_KEYWORD_LENGTH = 3;

// --- TYPES ---
interface Message {
  role: 'user' | 'assistant';
  content: string;
  isVoice?: boolean;
}

interface NavigationResult {
  text: string;
  navigate?: string;
}

// --- COMPONENT ---
export const ChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Namaste! I am your RAHI Assistant. How can I help you navigate our platform today?" }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [muteVoice, setMuteVoice] = useState(true); // Voice OFF by default - user must enable
  const [selectedVoice, setSelectedVoice] = useState(VOICE_PRESETS.RACHEL_PROFESSIONAL); // Most professional voice
  
  const navigate = useNavigate();
  const location = useLocation();
  const { getChatContext } = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Try backend API first
      const context = await getChatContext();
      
      // Call backend API with timeout and proper CORS settings
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('Chat request timed out');
        controller.abort();
      }, CHAT_TIMEOUT_MS);
      
      const { API: API_FROM_ENV } = await import('@/lib/constants');
      const BACKEND_API_URL = API_FROM_ENV.replace(/\/api$/, '');
      const response = await fetch(`${BACKEND_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          context: context
        }),
        signal: controller.signal,
        mode: 'cors', // Enable CORS
        credentials: 'omit' // Don't send cookies
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Log the specific error for debugging
        const errorText = await response.text();
        console.error(`Backend API responded with status: ${response.status} ${response.statusText}`, errorText);
        // Backend failed, use fallback
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.reply;
      
      // Check if the response contains navigation instructions
      const navigateTo = getNavigationDestination(text);

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      
      if (navigateTo) {
        navigate(navigateTo);
      }

      if (!muteVoice) {
        speak(aiResponse);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Check if this is specifically a network/CORS error vs backend processing error
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('CORS') || errorMessage.includes('TypeError')) {
        // Network/CORS error - backend is likely not accessible
        console.warn('Network error - trying fallback to local AI...');
        
        // Use fallback response from the existing AI system
        try {
          const context = await getChatContext();
          const fallbackResponse = await aiApi.sendMessage(text, context);
          
          console.debug('Local AI fallback response:', fallbackResponse);
          
          // Check if the response contains navigation instructions
          const navigateTo = getNavigationDestination(text);

          setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }]);
          
          if (navigateTo) {
            navigate(navigateTo);
          }

          if (!muteVoice) {
            speak(fallbackResponse);
          }
        } catch (fallbackError) {
          console.error('Fallback AI also failed:', fallbackError);
          
          const errorMsg: Message = { 
            role: 'assistant', 
            content: "I'm having trouble connecting to both the backend service and the local AI. Let me provide basic assistance." 
          };
          setMessages(prev => [...prev, errorMsg]);
          
          // Final fallback to simple keyword-based responses
          const response = await processFallbackQuery(text);
          setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
          
          if (response.navigate) {
            navigate(response.navigate);
          }

          if (!muteVoice) {
            speak(response.text);
          }
        }
      } else {
        // Backend responded but with an error - use fallback
        console.warn('Backend processing error - trying fallback to local AI...');
        
        try {
          const context = await getChatContext();
          const fallbackResponse = await aiApi.sendMessage(text, context);
          
          // Check if the response contains navigation instructions
          const navigateTo = getNavigationDestination(text);

          setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }]);
          
          if (navigateTo) {
            navigate(navigateTo);
          }

          if (!muteVoice) {
            speak(fallbackResponse);
          }
        } catch (fallbackError) {
          console.error('Fallback AI also failed:', fallbackError);
          
          const errorMsg: Message = { 
            role: 'assistant', 
            content: "I'm having trouble connecting to both the backend service and the local AI. Let me provide basic assistance." 
          };
          setMessages(prev => [...prev, errorMsg]);
          
          // Final fallback to simple keyword-based responses
          const response = await processFallbackQuery(text);
          setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
          
          if (response.navigate) {
            navigate(response.navigate);
          }

          if (!muteVoice) {
            speak(response.text);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, navigate, muteVoice]);

  // --- Navigation Helper ---
  const getNavigationDestination = (query: string): string | undefined => {
    const q = query.toLowerCase();
    
    if (q.includes('book') || q.includes('hire') || q.includes('booking') || q.includes('payment') || q.includes('pay')) {
      return '/services';
    } else if (q.includes('track') || q.includes('status') || q.includes('where is my worker')) {
      return '/tracking';
    } else if (q.includes('login') || q.includes('register') || q.includes('sign up')) {
      return '/login';
    } else if (q.includes('home') || q.includes('main page')) {
      return '/';
    }
    
    return undefined;
  };

  // --- Fallback Brain Logic ---
  const processFallbackQuery = async (query: string): Promise<NavigationResult> => {
    const q = query.toLowerCase();
    
    // 1. Navigation Shortcuts
    if (q.includes('book') || q.includes('hire') || q.includes('booking')) {
      return { 
        text: "I can help you with that! Taking you to our booking section where you can choose a professional for your needs.",
        navigate: '/services'
      };
    }
    
    if (q.includes('track') || q.includes('status') || q.includes('where is my worker')) {
      return {
        text: "Sure! Let's check your active bookings in the tracking section.",
        navigate: '/tracking'
      };
    }

    if (q.includes('login') || q.includes('register') || q.includes('sign up')) {
      return {
        text: "Heading to the registration page. You can join as a Worker, Customer, or Partner!",
        navigate: '/login'
      };
    }

    if (q.includes('home') || q.includes('main page')) {
      return {
        text: "Returning you to the homepage.",
        navigate: '/'
      };
    }

    if (q.includes('plumber') || q.includes('electrician') || q.includes('carpenter')) {
      return {
        text: "You can find professionals like plumbers, electricians, and carpenters on our services page. Would you like me to take you there?",
        navigate: '/services'
      };
    }

    // 2. Knowledge Base Search (Keyword Scoring)
    const keywords = q.split(' ').filter(word => word.length > MIN_KEYWORD_LENGTH);
    let bestMatch = { content: '', score: 0 };

    KNOWLEDGE_BASE.forEach(doc => {
      let score = 0;
      keywords.forEach(kw => {
        if (doc.content.toLowerCase().includes(kw)) score++;
      });
      if (score > bestMatch.score) {
        bestMatch = { content: doc.content, score };
      }
    });

    if (bestMatch.score > 0) {
      // Extract a relevant sentence/paragraph
      const sentences = bestMatch.content.split(/[.!?]/);
      const relevant = sentences.find(s => keywords.some(kw => s.toLowerCase().includes(kw))) || sentences[0];
      return { text: relevant.trim() + "." };
    }

    // 3. Fallback based on general knowledge of RAHI (from PDF context)
    if (q.includes('commission') || q.includes('price') || q.includes('charge')) {
      return { text: "RAHI uses a fair pricing model with only 8-12% commission, which is much lower than other platforms. We believe in dignity and fair earnings for our workers." };
    }
    
    if (q.includes('urban company') || q.includes('competitor')) {
      return { text: "Unlike Urban Company, RAHI focuses on Tier-2 and Tier-3 cities, offers faster 60-second matching, and doesn't penalize workers for rejecting jobs. We're an ethical gig platform." };
    }

    if (q.includes('voice') || q.includes('literacy')) {
      return { text: "We specialized our app for low-literacy users with voice navigation in regional languages like Hindi, Bengali, and Marathi." };
    }

    return { 
      text: "I'm not quite sure about that. But I can help you book a service, track a professional, or tell you about our mission to empower workers. What would you like to do?"
    };
  };

  // --- TTS (Using SpeechEngine) ---
  const speak = async (text: string) => {
    if (muteVoice || !text) return;
    setIsSpeaking(true);
    
    try {
      await speechEngine.speak(text, selectedVoice);
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Stop speaking when mute is toggled
  const handleMuteToggle = () => {
    if (!muteVoice) {
      // User is muting - stop current speech immediately
      speechEngine.stopSpeaking();
      setIsSpeaking(false);
    }
    setMuteVoice(!muteVoice);
  };

  // --- STT (Web Speech API) ---
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;  // Single utterance only
    recognition.interimResults = false;  // Only final results
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    
    recognition.start();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] md:w-[400px]"
          >
            <Card className="flex flex-col h-[500px] shadow-2xl border-primary/20 overflow-hidden glassmorphism">
              {/* Header */}
              <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center bg-gradient-to-r from-orange-500 via-white to-green-600">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="font-bold text-slate-900">RAHI Guide</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Voice Selector Dropdown */}
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-slate-600 mb-1">Voice:</span>
                    <select 
                      value={selectedVoice.voiceId}
                      onChange={(e) => {
                        const voiceKey = Object.keys(VOICE_PRESETS).find(key => 
                          VOICE_PRESETS[key as keyof typeof VOICE_PRESETS].voiceId === e.target.value
                        );
                        if (voiceKey) {
                          setSelectedVoice(VOICE_PRESETS[voiceKey as keyof typeof VOICE_PRESETS]);
                        }
                      }}
                      className="bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
                    >
                    {Object.entries(VOICE_PRESETS).map(([key, voice]) => (
                      <option key={key} value={voice.voiceId}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-900 hover:bg-black/10" onClick={handleMuteToggle}>
                    {muteVoice ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-900 hover:bg-black/10" onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Chat Area */}
              <ScrollArea className="flex-1 p-4 bg-slate-50/50" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                        m.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-white border text-slate-800 rounded-tl-none'
                      }`}>
                        {m.content}
                      </div>
                    </motion.div>
                  ))}
                  {(isSpeaking || isLoading) && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 items-center bg-white border p-2 rounded-full px-4 text-xs font-medium text-slate-500 italic">
                        {isSpeaking ? (
                          <>
                            <Volume2 className="w-3 h-3 animate-pulse text-primary" />
                            Speaking...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3 h-3 animate-pulse text-primary" />
                            Thinking...
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="p-4 bg-white border-t flex gap-2 items-center">
                <Button 
                  variant={isListening ? "destructive" : "outline"} 
                  size="icon" 
                  className={`rounded-full h-10 w-10 shrink-0 ${isListening ? 'animate-pulse' : ''}`}
                  onClick={startListening}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                  disabled={isLoading}
                />
                <Button 
                  size="icon" 
                  className="rounded-full h-10 w-10 shrink-0 bg-primary"
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? <MessageSquare className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full bg-primary shadow-lg flex items-center justify-center text-white ring-4 ring-primary/20 bg-gradient-to-br from-orange-500 to-green-600 transition-all"
      >
        <MessageSquare className="w-8 h-8" />
      </motion.button>
    </div>
  );
};