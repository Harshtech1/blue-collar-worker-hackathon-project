import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

export function WorkerLocationTracker() {
  const { user, profile } = useAuth();
  const { socket } = useSocket();
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // 1. Fetch active bookings for this worker
  const fetchActiveBooking = async () => {
    if (!user || profile?.role !== 'worker') return;
    
    try {
      const token = localStorage.getItem('token');
      // Fetch bookings where this worker is assigned and status is 'accepted' or 'matched' or 'arriving'
      const res = await fetch(`${API_BASE}/api/bookings?worker_user_id=${user.id || user._id}&status=accepted,matched,arriving,in_progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const bookings = await res.json();
        // Take the first active booking for tracking
        if (bookings && bookings.length > 0) {
          setActiveBooking(bookings[0]);
        } else {
          setActiveBooking(null);
        }
      }
    } catch (err) {
      console.error('Error fetching active bookings for tracking:', err);
    }
  };

  // 2. Poll for active bookings every 10 seconds if none exists
  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchActiveBooking();
      const interval = setInterval(fetchActiveBooking, 10000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  // 3. Track location if an active booking exists
  useEffect(() => {
    if (activeBooking && socket) {
      console.log('🚀 Starting live location tracking for booking:', activeBooking._id);
      
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`📍 Sending location update: ${latitude}, ${longitude}`);
            
            socket.emit('location_update', {
              userId: user.id || user._id,
              lat: latitude,
              lng: longitude,
              bookingId: activeBooking._id || activeBooking.id,
              customerId: activeBooking.customer_user_id
            });
          },
          (error) => {
            console.error('Error watching position:', error);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        console.log('🛑 Stopped live location tracking');
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeBooking, socket, user]);

  // This component doesn't render anything visible
  return null;
}
