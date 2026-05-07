import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { API_ROOT as BACKEND_URL } from '@/lib/constants';

let socketSingleton: Socket | null = null;

export const useSocket = () => {
  const { user, profile } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(socketSingleton);
  const [isConnected, setIsConnected] = useState(() => socketSingleton?.connected || false);

  useEffect(() => {
    if (!socketSingleton) {
      socketSingleton = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 8,
        reconnectionDelay: 800,
      });
    }

    const activeSocket = socketSingleton;
    setSocket(activeSocket);
    setIsConnected(activeSocket.connected);

    const joinPrivateRoom = () => {
      const userId = user?.id || user?._id || localStorage.getItem('userId');
      const role = profile?.role || user?.role || 'customer';
      const areaId = profile?.areaId || profile?.area_id || profile?.city || user?.city;

      if (userId) {
        activeSocket.emit('join', { userId, role, areaId });
        if (role === 'worker' && areaId) {
          activeSocket.emit('join_area', { areaId });
        }
        console.log(`Socket joined private room: ${userId} (${role})`);
      }
    };

    const handleConnect = () => {
      setIsConnected(true);
      joinPrivateRoom();
    };

    const handleDisconnect = () => setIsConnected(false);

    if (activeSocket.connected) {
      joinPrivateRoom();
    }

    activeSocket.on('connect', handleConnect);
    activeSocket.on('disconnect', handleDisconnect);
    document.addEventListener('visibilitychange', joinPrivateRoom);

    return () => {
      activeSocket.off('connect', handleConnect);
      activeSocket.off('disconnect', handleDisconnect);
      document.removeEventListener('visibilitychange', joinPrivateRoom);
    };
  }, [user?.id, user?._id, user?.role, profile?.role]);

  return { socket, isConnected };
};
