/**
 * IncomingBookingModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Worker-side real-time component.
 *
 * Listens for `new_booking` socket events and pops a modal with:
 *   - Customer name, phone, service, address, amount
 *   - "Accept" button → PATCH /api/bookings/:id/status { status: 'accepted' }
 *   - "Decline" button → PATCH /api/bookings/:id/status { status: 'declined' }
 *
 * USAGE: Drop this once into WorkerLayout.tsx or WorkerDashboard.tsx:
 *   <IncomingBookingModal />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, IndianRupee, Clock, CheckCircle, XCircle, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface IncomingBooking {
  bookingId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  amount: number;
  scheduled_at: string | null;
  customer_user_id: string | null;
}

export function IncomingBookingModal() {
  const { socket } = useSocket();
  const [booking, setBooking] = useState<IncomingBooking | null>(null);
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);

  // ── Listen for new_booking events ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewBooking = (data: IncomingBooking) => {
      console.log('📥 new_booking received:', data);
      setBooking(data);
      // Play browser notification sound if available
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Job Request! 🔔', {
          body: `${data.serviceName} from ${data.customerName}`,
        });
      }
    };

    socket.on('new_booking', handleNewBooking);
    return () => { socket.off('new_booking', handleNewBooking); };
  }, [socket]);

  // ── Accept / Decline handler ───────────────────────────────────────────────
  const handleStatusUpdate = useCallback(
    async (status: 'accepted' | 'declined') => {
      if (!booking) return;
      setLoading(status === 'accepted' ? 'accept' : 'decline');

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/bookings/${booking.bookingId}/respond`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Update failed');
        }

        toast.success(
          status === 'accepted'
            ? `✅ Job accepted! Customer ${booking.customerName} has been notified.`
            : `❌ Job declined. The customer will be notified.`
        );
        setBooking(null); // Close modal
      } catch (err: any) {
        toast.error(`Failed to update: ${err.message}`);
      } finally {
        setLoading(null);
      }
    },
    [booking]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {booking && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setBooking(null)}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <BellRing className="h-5 w-5 animate-bounce" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">New Job Request!</h2>
                    <p className="text-indigo-200 text-sm">Respond quickly to secure this job</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Service badge */}
                <div className="flex items-center justify-between">
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 px-3 py-1 text-sm font-semibold">
                    {booking.serviceName}
                  </Badge>
                  <span className="text-2xl font-black text-emerald-600">
                    ₹{booking.amount.toLocaleString()}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-3 bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="h-8 w-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{booking.customerName}</p>
                      <p className="text-sm text-slate-500">{booking.customerPhone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-slate-700">
                    <div className="h-8 w-8 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="h-4 w-4 text-rose-600" />
                    </div>
                    <p className="text-sm">
                      {booking.address}
                      {booking.city && `, ${booking.city}`}
                    </p>
                  </div>

                  {booking.scheduled_at && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <div className="h-8 w-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-medium">
                        {new Date(booking.scheduled_at).toLocaleDateString('en-IN', {
                          weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="h-14 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold text-base"
                    disabled={loading !== null}
                    onClick={() => handleStatusUpdate('declined')}
                  >
                    {loading === 'decline' ? (
                      <span className="animate-pulse">Declining…</span>
                    ) : (
                      <><XCircle className="h-5 w-5 mr-2" /> Decline</>
                    )}
                  </Button>

                  <Button
                    className="h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-200"
                    disabled={loading !== null}
                    onClick={() => handleStatusUpdate('accepted')}
                  >
                    {loading === 'accept' ? (
                      <span className="animate-pulse">Accepting…</span>
                    ) : (
                      <><CheckCircle className="h-5 w-5 mr-2" /> Accept</>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-slate-400">
                  Tap outside to dismiss without responding
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
