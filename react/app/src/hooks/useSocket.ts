/**
 * useSocket.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared Socket.IO client hook.
 * Usage: const { socket } = useSocket();
 *
 * The hook:
 *  1. Creates a single socket connection per app session.
 *  2. Automatically joins the user's private room on connect.
 *  3. Reconnects and re-joins if the userId changes (login/logout).
 *  4. Cleans up on unmount.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

// Module-level singleton so we don't create multiple connections
let socketSingleton: Socket | null = null;

export const useSocket = () => {
  const { user, profile } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create socket only once
    if (!socketSingleton) {
      socketSingleton = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    socketRef.current = socketSingleton;

    // Join the user's private room whenever we have a userId
    const userId = user?.id || user?._id;
    const role = profile?.role || 'customer';
    if (userId && socketSingleton.connected) {
      socketSingleton.emit('join', { userId, role });
    }

    socketSingleton.on('connect', () => {
      const uid = user?.id || user?._id;
      const r = profile?.role || 'customer';
      if (uid) {
        socketSingleton?.emit('join', { userId: uid, role: r });
        console.log(`🔌 Socket connected — joined room: ${uid} (${r})`);
      }
    });

    return () => {
      // Don't disconnect on unmount — keep the singleton alive
      socketSingleton?.off('connect');
    };
  }, [user]);

  return { socket: socketRef.current };
};
