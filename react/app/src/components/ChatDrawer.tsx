import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, MessageSquare, Send, Smile, Wifi, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { API } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  bookingId?: string;
  clientMessageId?: string;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
}

const QUICK_REPLIES = [
  'I am at the gate.',
  'I am on my way.',
  'Please share the exact landmark.',
  'I will reach in 5 minutes.',
  'Can you confirm the OTP when I arrive?',
];

const makeClientMessageId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeMessage = (message: Message): Message => ({
  ...message,
  _id: String(message._id || message.clientMessageId || makeClientMessageId()),
  bookingId: message.bookingId ? String(message.bookingId) : message.bookingId,
  senderId: String(message.senderId || ''),
  receiverId: String(message.receiverId || ''),
  timestamp: message.timestamp || new Date().toISOString(),
  status: message.status || 'sent',
});

const upsertMessage = (messages: Message[], incoming: Message) => {
  const normalized = normalizeMessage(incoming);
  const existingIndex = messages.findIndex((message) => {
    if (normalized._id && message._id === normalized._id) return true;
    if (normalized.clientMessageId && message.clientMessageId === normalized.clientMessageId) return true;
    return false;
  });

  if (existingIndex === -1) return [...messages, normalized];

  return messages.map((message, index) => (
    index === existingIndex ? { ...message, ...normalized, status: normalized.status || 'sent' } : message
  ));
};

export default function ChatDrawer({
  isOpen,
  onClose,
  bookingId,
  currentUserId,
  otherUserId,
  otherUserName,
}: ChatDrawerProps) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatReady, setChatReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveCurrentUserId = useMemo(
    () => currentUserId || user?.id || user?._id || localStorage.getItem('userId') || '',
    [currentUserId, user?.id, user?._id],
  );

  const canSend = Boolean(socket && isConnected && bookingId && effectiveCurrentUserId && inputText.trim());

  useEffect(() => {
    if (!isOpen) return;
    fetchMessages();
  }, [isOpen, bookingId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!socket || !isOpen || !bookingId) return;

    setChatReady(false);
    socket.emit('join_booking_chat', { bookingId, userId: effectiveCurrentUserId });

    const handleJoined = (payload: { bookingId?: string }) => {
      if (payload.bookingId === bookingId) setChatReady(true);
    };

    const handleReceiveMessage = (message: Message) => {
      if (message.bookingId !== bookingId) return;
      setMessages((prev) => upsertMessage(prev, message));

      if (message.senderId !== effectiveCurrentUserId) {
        new Audio('/sounds/notification.mp3').play().catch(() => {});
      }
    };

    const handleMessageSent = (message: Message) => {
      if (message.bookingId !== bookingId) return;
      setMessages((prev) => upsertMessage(prev, { ...message, status: 'sent' }));
    };

    const handleChatError = (payload: { bookingId?: string; clientMessageId?: string; message?: string }) => {
      if (payload.bookingId && payload.bookingId !== bookingId) return;
      if (payload.clientMessageId) {
        setMessages((prev) => prev.map((message) => (
          message.clientMessageId === payload.clientMessageId
            ? { ...message, status: 'failed' }
            : message
        )));
      }
      toast.error(payload.message || 'Chat is temporarily unavailable.');
    };

    socket.on('chat_joined', handleJoined);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('chat_error', handleChatError);

    return () => {
      socket.off('chat_joined', handleJoined);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('chat_error', handleChatError);
    };
  }, [socket, isOpen, bookingId, effectiveCurrentUserId]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token || !bookingId) {
        setMessages([]);
        return;
      }

      const res = await fetch(`${API}/bookings/${bookingId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to load chat history');
      }

      const data = await res.json();
      setMessages(Array.isArray(data) ? data.map(normalizeMessage) : []);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Unable to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (text?: string) => {
    const finalText = (text || inputText).trim();
    if (!finalText || !socket || !bookingId || !effectiveCurrentUserId) return;

    if (!isConnected) {
      toast.error('Chat is reconnecting. Please try again in a moment.');
      return;
    }

    const clientMessageId = makeClientMessageId();
    const optimisticMessage: Message = {
      _id: clientMessageId,
      clientMessageId,
      bookingId,
      senderId: effectiveCurrentUserId,
      receiverId: otherUserId || '',
      text: finalText,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    setMessages((prev) => upsertMessage(prev, optimisticMessage));
    setInputText('');

    socket.emit('send_message', {
      bookingId,
      senderId: effectiveCurrentUserId,
      receiverId: otherUserId || undefined,
      text: finalText,
      clientMessageId,
    });
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
            className="fixed inset-0 z-[2000] bg-slate-950/65 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 z-[2001] flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl"
          >
            <div className="border-b border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-base font-black text-white">
                    {(otherUserName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">{otherUserName || 'RAHI Partner'}</h3>
                    <div className="mt-1 flex items-center gap-1.5">
                      {isConnected ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {isConnected ? (chatReady ? 'Live chat ready' : 'Connecting room') : 'Reconnecting'}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full hover:bg-rose-50 hover:text-rose-500"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 scroll-smooth">
              {loading ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <MessageSquare className="mb-4 h-12 w-12 text-slate-300" />
                  <p className="text-sm font-bold text-slate-500">No messages yet.</p>
                  <p className="mt-2 text-xs font-medium leading-5 text-slate-400">
                    Send a quick coordination update so the customer and worker stay aligned.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.senderId === effectiveCurrentUserId;
                  return (
                    <motion.div
                      key={msg._id || msg.clientMessageId || idx}
                      initial={{ scale: 0.96, opacity: 0, y: 8 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className={cn('flex w-full', isMine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[82%] rounded-3xl px-4 py-3 shadow-sm',
                          isMine
                            ? 'rounded-tr-md bg-slate-950 text-white'
                            : 'rounded-tl-md border border-slate-200 bg-white text-slate-800',
                          msg.status === 'failed' && 'ring-2 ring-rose-300',
                        )}
                      >
                        <p className="text-sm font-semibold leading-relaxed">{msg.text}</p>
                        <div className={cn('mt-2 flex items-center justify-end gap-1', isMine ? 'text-white/60' : 'text-slate-400')}>
                          <span className="text-[10px] font-black">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            msg.status === 'failed'
                              ? <span className="text-[10px] font-black text-rose-200">Failed</span>
                              : <CheckCheck className={cn('h-3.5 w-3.5', msg.status === 'pending' && 'opacity-40')} />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 bg-white px-4 py-3">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => handleSendMessage(reply)}
                    disabled={!socket || !isConnected || !effectiveCurrentUserId}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1.5">
                <Button variant="ghost" size="icon" className="shrink-0 rounded-full text-slate-400 hover:text-slate-900">
                  <Smile className="h-5 w-5" />
                </Button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isConnected ? 'Type a message...' : 'Reconnecting chat...'}
                  className="flex-1 border-none bg-transparent px-2 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!canSend}
                  size="icon"
                  className={cn(
                    'h-10 w-10 shrink-0 rounded-full shadow-lg transition active:scale-95',
                    canSend ? 'bg-slate-950 hover:bg-slate-800' : 'bg-slate-300',
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
