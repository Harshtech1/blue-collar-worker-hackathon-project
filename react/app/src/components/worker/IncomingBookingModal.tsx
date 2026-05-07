/**
 * IncomingBookingModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Worker-side real-time component.
 *
 * Listens for `new_booking` socket events and pops a modal.
 * Handles the "first-wins" race condition:
 *   - If this worker is FIRST to accept → API returns 200, modal closes with success
 *   - If this worker is SECOND+ to accept → API returns 409, `booking_taken` socket
 *     event is received, modal auto-replaces with a "Job Taken" screen
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, Clock, CheckCircle, XCircle, BellRing, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';
import { API } from '@/lib/constants';

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
  matchScore?: number;
  distanceKm?: number;
  skillFit?: number;
  reliabilityScore?: number;
  assignedWorkerIndex?: number;
}

type ModalState = 'idle' | 'incoming' | 'taken';

export function IncomingBookingModal({ isOnline }: { isOnline: boolean }) {
  const { socket } = useSocket();
  const [booking, setBooking] = useState<IncomingBooking | null>(null);
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [takenByName, setTakenByName] = useState('Another worker');

  // ── Listen for new_booking events ──────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isOnline) return;

    const handleNewBooking = (data: IncomingBooking) => {
      console.log('📥 new_booking received:', data);
      setBooking(data);
      setModalState('incoming');
      setLoading(null);

      // Play custom notification sound
      new Audio('/sounds/faaaa.mp3').play().catch(e => console.log('Audio error:', e));

      // Browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Job Request! 🔔', {
          body: `${data.serviceName} from ${data.customerName}`,
        });
      }
    };

    socket.on('new_booking', handleNewBooking);
    return () => { socket.off('new_booking', handleNewBooking); };
  }, [socket, isOnline]);

  // ── Listen for booking_taken — another worker beat us to it ────────────────
  useEffect(() => {
    if (!socket) return;

    const handleBookingTaken = (data: { bookingId: string; takenBy: string; message: string }) => {
      console.log('⚡ booking_taken received:', data);
      // Only update UI if this modal is currently showing the same booking
      if (booking && booking.bookingId === data.bookingId) {
        setTakenByName(data.takenBy || 'Another worker');
        setModalState('taken');
        setLoading(null);
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          setModalState('idle');
          setBooking(null);
        }, 3000);
      }
    };

    socket.on('booking_taken', handleBookingTaken);
    return () => { socket.off('booking_taken', handleBookingTaken); };
  }, [socket, booking]);

  useEffect(() => {
    if (!socket) return;

    const handlePingExpired = (data: { bookingId: string; message?: string }) => {
      if (!booking || booking.bookingId !== data.bookingId) return;
      toast.info(data.message || 'This job moved to the next ranked worker.');
      setModalState('idle');
      setBooking(null);
      setLoading(null);
    };

    socket.on('booking_ping_expired', handlePingExpired);
    socket.on('CLEAR_JOB', handlePingExpired);
    return () => {
      socket.off('booking_ping_expired', handlePingExpired);
      socket.off('CLEAR_JOB', handlePingExpired);
    };
  }, [socket, booking]);

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

        // 409 = race condition — another worker was faster
        if (res.status === 409) {
          setTakenByName('Another worker');
          setModalState('taken');
          setLoading(null);
          setTimeout(() => {
            setModalState('idle');
            setBooking(null);
          }, 3000);
          return;
        }

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Update failed');
        }

        toast.success(
          status === 'accepted'
            ? `✅ Job accepted! Customer ${booking.customerName} has been notified.`
            : `❌ Job declined.`
        );
        setModalState('idle');
        setBooking(null);
      } catch (err: any) {
        toast.error(`Failed to update: ${err.message}`);
        setLoading(null);
      }
    },
    [booking]
  );

  const handleDismiss = () => {
    setModalState('idle');
    setBooking(null);
    setLoading(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {(modalState === 'incoming' || modalState === 'taken') && booking && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={modalState === 'incoming' ? handleDismiss : undefined}
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

              {/* ── STATE: Job already taken by another worker ── */}
              {modalState === 'taken' ? (
                <div className="p-8 flex flex-col items-center text-center gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                    className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center"
                  >
                    <AlertTriangle className="h-10 w-10 text-amber-500" />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Job Already Taken!</h2>
                    <p className="text-slate-500 mt-1 text-sm">
                      <span className="font-semibold text-slate-700">{takenByName}</span> was faster and accepted this job first.
                    </p>
                    <p className="text-xs text-slate-400 mt-3">This will close automatically…</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl h-12 border-2"
                    onClick={handleDismiss}
                  >
                    Got it
                  </Button>
                </div>
              ) : (
                /* ── STATE: Incoming booking — normal flow ── */
                <>
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
                    {/* Service + Amount */}
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
                      {booking.matchScore !== undefined && (
                        <div className="rounded-2xl border border-indigo-100 bg-white p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                            Ranked Match #{(booking.assignedWorkerIndex ?? 0) + 1}
                          </p>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold text-slate-600">
                            <span>Score {(booking.matchScore * 100).toFixed(0)}%</span>
                            {booking.distanceKm !== undefined && <span>{booking.distanceKm} km</span>}
                            {booking.reliabilityScore !== undefined && <span>Trust {(booking.reliabilityScore * 100).toFixed(0)}%</span>}
                          </div>
                        </div>
                      )}

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
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
