/**
 * BookingStatusBanner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer-side real-time status tracker.
 *
 * Listens for `booking_updated` socket events and instantly updates the
 * booking status badge without a page refresh.
 *
 * USAGE: Drop into MyBookings.tsx or the booking confirmation page:
 *   <BookingStatusBanner bookingId={bookingId} initialStatus="pending" />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSocket } from '@/hooks/useSocket';

type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'confirmed';

interface Props {
  bookingId: string;
  initialStatus?: BookingStatus;
}

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; icon: React.ReactNode; pulse: boolean }
> = {
  pending: {
    label: 'Waiting for Worker',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    pulse: true,
  },
  accepted: {
    label: 'Accepted by Worker ✓',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle className="h-4 w-4" />,
    pulse: false,
  },
  declined: {
    label: 'Declined — Finding another worker',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="h-4 w-4" />,
    pulse: false,
  },
  in_progress: {
    label: 'Worker is on the way',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Clock className="h-4 w-4" />,
    pulse: true,
  },
  completed: {
    label: 'Job Completed',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <CheckCircle className="h-4 w-4" />,
    pulse: false,
  },
  confirmed: {
    label: 'Confirmed & Paid',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <CheckCircle className="h-4 w-4" />,
    pulse: false,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <AlertCircle className="h-4 w-4" />,
    pulse: false,
  },
};

export function BookingStatusBanner({ bookingId, initialStatus = 'pending' }: Props) {
  const { socket } = useSocket();
  const [status, setStatus] = useState<BookingStatus>(initialStatus);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdate = (data: {
      bookingId: string;
      status: BookingStatus;
    }) => {
      // Only react to events for THIS booking
      if (data.bookingId !== bookingId) return;

      console.log(`📡 booking_updated for ${bookingId}:`, data.status);
      setStatus(data.status);

      // Flash a highlight animation
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 2000);
    };

    socket.on('booking_updated', handleBookingUpdate);
    return () => { socket.off('booking_updated', handleBookingUpdate); };
  }, [socket, bookingId]);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.3 }}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-semibold text-sm
          transition-all duration-500
          ${config.color}
          ${justUpdated ? 'ring-2 ring-offset-2 ring-indigo-400 scale-105' : ''}
        `}
      >
        {config.pulse ? (
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex">{config.icon}</span>
          </span>
        ) : (
          config.icon
        )}
        <span>{config.label}</span>
      </motion.div>
    </AnimatePresence>
  );
}
