import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Bot, User, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/lib/constants';

interface Message {
  _id?: string;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

const QUICK_REPLIES = [
  { text: "I'm at the gate", hint: "मैं दरवाजे पर हूं", hintPunjabi: "ਮੈਂ ਗੇਟ 'ਤੇ ਹਾਂ" },
  { text: "Sending location on WhatsApp", hint: "WhatsApp पर location bhej raha hoon", hintPunjabi: "WhatsApp 'ਤੇ ਲੋਕੇਸ਼ਨ ਭੇਜ ਰਿਹਾ ਹਾਂ" },
  { text: "I'll be there in 5 minutes", hint: "5 minute mein pahunch raha hoon", hintPunjabi: "5 ਮਿੰਟ 'ਚ ਪਹੁੰਚ ਰਿਹਾ ਹਾਂ" },
  { text: "Please wait, almost done", hint: "Thoda wait karo, almost ho gaya", hintPunjabi: "ਥੋੜਾ ਇੰਤਜ਼ਾਰ ਕਰੋ, ਲਗਭਗ ਹੋ ਗਿਆ" },
  { text: "Work completed", hint: "Kaam ho gaya", hintPunjabi: "ਕੰਮ ਹੋ ਗਿਆ" },
];

interface ChatComponentProps {
  title?: string;
  bookingId?: string;
  receiverId?: string;
  receiverName?: string;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ 
  title = "Chat", 
  bookingId, 
  receiverId, 
  receiverName 
}) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    let socketInstance: any = null;
    let isMounted = true;

    const initSocket = async () => {
      if (!user?.id) return;
      
      const { io } = await import('socket.io-client');
      const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
      
      socketInstance = io(API_URL, {
        transports: ['websocket', 'polling'],
      });

      socketInstance.on('connect', () => {
        if (isMounted) {
          setIsConnected(true);
          socketInstance.emit('join', { 
            userId: user.id, 
            role: profile?.role || 'customer' 
          });
        }
      });

      socketInstance.on('receive_message', (msg: Message) => {
        if (isMounted && msg.senderId === receiverId) {
          setMessages(prev => [...prev, { ...msg, timestamp: new Date(msg.timestamp) }]);
        }
      });

      socketInstance.on('disconnect', () => {
        if (isMounted) setIsConnected(false);
      });

      if (isMounted) setSocket(socketInstance);
    };

    initSocket();

    return () => {
      isMounted = false;
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [user?.id, profile?.role, receiverId]);

  useEffect(() => {
    if (bookingId && receiverId) {
      fetchMessages();
    }
  }, [bookingId, receiverId]);

  const fetchMessages = async () => {
    if (!bookingId || !receiverId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${bookingId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (text?: string) => {
    const messageText = text || inputValue;
    if (messageText.trim() === '' || !user?.id || !receiverId) return;

    const newMessage: Message = {
      text: messageText,
      senderId: user.id,
      receiverId,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    if (socket && isConnected) {
      socket.emit('send_message', {
        bookingId,
        senderId: user.id,
        receiverId,
        text: messageText
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
    };

    recognition.start();
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {title}
          </div>
          {isConnected && (
            <span className="text-[10px] text-green-500 font-medium">Connected</span>
          )}
        </CardTitle>
        {receiverName && (
          <p className="text-xs text-muted-foreground">Chatting with {receiverName}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col flex-1 p-0">
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-3 pr-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Quick replies available below 👇</p>
              </div>
            )}
            {messages.map((message, idx) => (
              <div
                key={message._id || idx}
                className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    message.senderId === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p>{message.text}</p>
                  <span className="text-[10px] opacity-60 block mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Replies */}
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick Replies</p>
          <div className="flex flex-wrap gap-1">
            {QUICK_REPLIES.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(reply.text)}
                className="text-[10px] px-2 py-1 bg-background border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors text-left truncate max-w-[120px]"
                title={`${reply.hint}`}
              >
                {reply.text}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-3 border-t flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVoiceInput}
            className={isListening ? 'animate-pulse bg-red-100 border-red-300' : ''}
            title="Voice input"
          >
            {isListening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type or speak..."
            className="flex-1"
          />
          <Button onClick={() => handleSend()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatComponent;