import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, MessageSquare, X, Smartphone, MapPin, 
  Clock, CheckCheck, Smile, Paperclip 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSocket } from '@/hooks/useSocket';
import { useLanguage } from '@/contexts/LanguageContext';
import { API } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  status: string;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
}

const QUICK_REPLIES = {
  en: [
    "I am at the gate.",
    "Please send me your location via WhatsApp.",
    "How much time will it take?",
    "I'll be there in 5 minutes.",
    "Is there parking available?"
  ],
  hi: [
    "मैं गेट पर हूँ।",
    "कृपया मुझे व्हाट्सएप पर लोकेशन भेजें।",
    "इसमें कितना समय लगेगा?",
    "मैं 5 मिनट में वहां पहुंचूंगा।",
    "क्या वहां पार्किंग उपलब्ध है?"
  ],
  pa: [
    "ਮੈਂ ਗੇਟ ਤੇ ਹਾਂ।",
    "ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਵਟਸਐਪ 'ਤੇ ਲੋਕੇਸ਼ਨ ਭੇਜੋ।",
    "ਇਸ ਵਿੱਚ ਕਿੰਨਾ ਸਮਾਂ ਲੱਗੇਗਾ?",
    "ਮੈਂ 5 ਮਿੰਟ ਵਿੱਚ ਉੱਥੇ ਪਹੁੰਚ ਜਾਵਾਂਗਾ।",
    "ਕੀ ਉੱਥੇ ਪਾਰਕਿੰਗ ਉਪਲਬਧ ਹੈ?"
  ]
};

export default function ChatDrawer({ 
  isOpen, 
  onClose, 
  bookingId, 
  currentUserId, 
  otherUserId, 
  otherUserName 
}: ChatDrawerProps) {
  const { socket } = useSocket();
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen, bookingId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: Message) => {
      if (message.bookingId === bookingId) {
        setMessages(prev => [...prev, message]);
        // Play notification sound
        new Audio('/sounds/notification.mp3').play().catch(e => {});
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, bookingId]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${bookingId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (text?: string) => {
    const finalText = text || inputText;
    if (!finalText.trim() || !socket) return;

    const newMessage = {
      bookingId,
      senderId: currentUserId,
      receiverId: otherUserId,
      text: finalText,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    socket.emit('send_message', newMessage);
    
    // Add to local state manually as sender
    setMessages(prev => [...prev, { ...newMessage, _id: Date.now().toString() } as Message]);
    setInputText('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-[2001] flex flex-col"
          >
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {otherUserName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{otherUserName}</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Online</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-full hover:bg-rose-50 hover:text-rose-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages Feed */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                  <MessageSquare className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-500">No messages yet. Send a quick reply to start coordinating.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.senderId === currentUserId;
                  return (
                    <motion.div
                      key={msg._id || idx}
                      initial={{ scale: 0.8, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className={cn(
                        "flex w-full mb-2",
                        isMine ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[80%] p-3 rounded-2xl shadow-sm",
                        isMine 
                          ? "bg-primary text-white rounded-tr-none" 
                          : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                      )}>
                        <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                        <div className={cn(
                          "flex items-center gap-1 mt-1 justify-end",
                          isMine ? "text-white/60" : "text-slate-400"
                        )}>
                          <span className="text-[8px] font-bold">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && <CheckCheck className="h-3 w-3" />}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Quick Replies Drawer */}
            <div className="px-4 py-3 bg-white border-t border-slate-100">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                {(QUICK_REPLIES[language as keyof typeof QUICK_REPLIES] || QUICK_REPLIES.en).map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(reply)}
                    className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-full text-[11px] font-bold text-slate-600 transition-all active:scale-95 border border-slate-200/50"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-full border border-slate-200">
                <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-primary shrink-0">
                  <Smile className="h-5 w-5" />
                </Button>
                <input 
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={language === 'hi' ? 'संदेश लिखें...' : 'Type a message...'}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium px-2 py-2 text-slate-700 outline-none"
                />
                <Button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  size="icon" 
                  className={cn(
                    "rounded-full h-10 w-10 shrink-0 shadow-lg transition-transform active:scale-90",
                    !inputText.trim() ? "bg-slate-300" : "bg-primary hover:bg-primary/90"
                  )}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
