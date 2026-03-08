import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, MessageSquare, Shield, Star, Clock,
  Check, MapPin, User, IndianRupee, Copy, Navigation,
  AlertCircle, ChevronRight, Share2, Info, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Layout } from '@/components/layout/Layout';
import TrackingMap from '@/components/TrackingMap';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type BookingStatus = 'pending' | 'accepted' | 'matched' | 'arriving' | 'otp_verify' | 'in_progress' | 'completed';

const statusSteps = [
  { id: 'matched', labelEn: 'Assigned', labelHi: 'चुना गया', icon: User, color: 'text-blue-500' },
  { id: 'arriving', labelEn: 'On Way', labelHi: 'रास्ते में', icon: Navigation, color: 'text-primary' },
  { id: 'otp_verify', labelEn: 'Verify', labelHi: 'सत्यापन', icon: Shield, color: 'text-amber-500' },
  { id: 'in_progress', labelEn: 'Working', labelHi: 'कार्यरत', icon: Clock, color: 'text-emerald-500' },
  { id: 'completed', labelEn: 'Done', labelHi: 'समाप्त', icon: Check, color: 'text-emerald-600' },
];

interface WorkerDetails {
  name: string;
  phone: string;
  initials: string;
  specialty: string;
}

export default function Tracking() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { subscribeToBooking } = useNotifications();
  const { socket } = useSocket();

  const [status, setStatus] = useState<BookingStatus>('pending');
  const [eta, setEta] = useState(25);
  const [startOtp] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [finishOtp] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<any>(null);
  const [workerDetails, setWorkerDetails] = useState<WorkerDetails>({
    name: 'Worker',
    phone: '',
    initials: 'W',
    specialty: 'Service Professional',
  });

  // Map state
  const userLocation = useMemo<[number, number]>(() => [28.6139, 77.2090], []);
  const [workerLocation, setWorkerLocation] = useState<[number, number]>([28.6300, 77.2200]);

  // ── Fetch booking data from API ────────────────────────────────────────
  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/bookings/${bookingId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setBookingData(data);

          // Set worker info from booking data
          if (data.workerName) {
            const name = data.workerName;
            setWorkerDetails({
              name,
              phone: data.workerPhone || '',
              initials: name.split(' ').map((w: string) => w.charAt(0).toUpperCase()).join('').slice(0, 2),
              specialty: data.serviceName || 'Service Professional',
            });
          }

          // Map booking status to tracking status
          if (data.status === 'accepted' || data.status === 'matched') {
            setStatus('matched');
          } else if (data.status === 'pending') {
            setStatus('pending');
          } else if (data.status === 'in_progress') {
            setStatus('in_progress');
          } else if (data.status === 'completed') {
            setStatus('completed');
          } else {
            setStatus('matched');
          }
        }
      } catch (err) {
        console.error('Failed to fetch booking:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  // ── Listen for real-time booking_updated events ────────────────────────
  useEffect(() => {
    if (!socket || !bookingId) return;

    const handleBookingUpdated = (data: any) => {
      if (data.bookingId !== bookingId) return;

      if (data.status === 'accepted') {
        setStatus('matched');
        if (data.workerName) {
          const name = data.workerName;
          setWorkerDetails({
            name,
            phone: data.workerPhone || '',
            initials: name.split(' ').map((w: string) => w.charAt(0).toUpperCase()).join('').slice(0, 2),
            specialty: bookingData?.serviceName || 'Service Professional',
          });
        }
        toast.success(
          language === 'hi'
            ? `✅ ${data.workerName || 'कारीगर'} ने स्वीकार किया!`
            : `✅ ${data.workerName || 'Worker'} accepted!`
        );
      }
    };

    socket.on('booking_updated', handleBookingUpdated);
    return () => { socket.off('booking_updated', handleBookingUpdated); };
  }, [socket, bookingId, bookingData, language]);

  // Simulate movement when arriving
  useEffect(() => {
    if (status === 'arriving') {
      const interval = setInterval(() => {
        setWorkerLocation(prev => {
          const latDiff = userLocation[0] - prev[0];
          const lngDiff = userLocation[1] - prev[1];
          if (Math.abs(latDiff) < 0.0001 && Math.abs(lngDiff) < 0.0001) return prev;
          return [prev[0] + latDiff * 0.05, prev[1] + lngDiff * 0.05];
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, userLocation]);

  // Auto-progress simulation (once matched → arriving → otp)
  useEffect(() => {
    if (status === 'matched') {
      const timer1 = setTimeout(() => setStatus('arriving'), 3000);
      return () => clearTimeout(timer1);
    }
    if (status === 'arriving') {
      const timer2 = setTimeout(() => setEta(5), 4000);
      const timer3 = setTimeout(() => setStatus('otp_verify'), 8000);
      return () => { clearTimeout(timer2); clearTimeout(timer3); };
    }
  }, [status]);

  const handleStartWork = () => {
    setStatus('in_progress');
    toast.success("Work Started Successfully!");
  };

  const handleFinishWork = () => {
    setStatus('completed');
    toast.success("Work Completed Successfully!");

    setTimeout(() => {
      const amount = bookingData?.amount || location.state?.amount || 329;
      navigate(`/payment?bookingId=${bookingId}&amount=${amount}&type=payment`);
    }, 1500);
  };

  const currentStepIndex = statusSteps.findIndex(s => s.id === status);
  const progress = ((currentStepIndex + 1) / statusSteps.length) * 100;

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // If booking is still pending (no worker accepted yet), show waiting screen
  if (status === 'pending') {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="relative mb-8 mx-auto w-32 h-32">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping" style={{ animationDelay: '0.7s' }} />
              <div className="relative z-10 h-32 w-32 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-primary">
                <User className="h-16 w-16 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              {language === 'hi' ? 'कारीगर की प्रतीक्षा...' : 'Waiting for a Worker...'}
            </h2>
            <p className="text-slate-500 mb-6">
              {language === 'hi'
                ? 'आपकी बुकिंग सभी कारीगरों को भेजी गई है।'
                : 'Your booking has been sent to available workers.'}
            </p>
            <div className="flex gap-2 justify-center">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-3 w-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4 font-bold">
              Booking ID: #{bookingId?.slice(0, 8)}...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50">
        <div className="container max-w-4xl px-4 py-6">

          {/* Header Card */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Tracking Your Service</h1>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">Booking ID: #{bookingId?.slice(0, 8) || 'N/A'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" className="rounded-full shadow-sm hover:bg-slate-50">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="rounded-full shadow-sm hover:bg-slate-50">
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column: Map and Worker Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map Container */}
              <div className="aspect-[4/3] md:aspect-video rounded-[2.5rem] bg-slate-200 overflow-hidden relative border-4 border-white shadow-xl">
                <TrackingMap
                  userLocation={userLocation}
                  workerLocation={workerLocation}
                />

                {/* Map Overlays */}
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-white/50 flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-bold text-slate-800">
                      {status === 'arriving' ? `Arriving in ${eta} min` : status === 'matched' ? 'Worker Assigned' : 'Worker Arrived'}
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-6 right-6">
                  <Button size="icon" className="h-12 w-12 rounded-2xl shadow-xl">
                    <Navigation className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Worker Card — DYNAMIC */}
              <Card className="rounded-[2.5rem] border-slate-100 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6">
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">
                    <Shield className="h-3 w-3 mr-1" /> Verified Pro
                  </Badge>
                </div>
                <CardContent className="p-8">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-[1.5rem] bg-gradient-to-br from-primary/10 to-emerald-50 flex items-center justify-center text-3xl font-black text-primary border border-primary/20">
                        {workerDetails.initials}
                      </div>
                      <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center text-amber-500">
                        <Star className="h-4 w-4 fill-amber-500" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black text-slate-800">{workerDetails.name}</h3>
                      <p className="text-slate-500 font-bold mb-4 flex items-center gap-2">
                        {workerDetails.specialty}
                      </p>
                      <div className="flex gap-4">
                        <Button
                          className="rounded-2xl h-11 px-6 font-bold flex-1 md:flex-none"
                          onClick={() => workerDetails.phone && window.open(`tel:${workerDetails.phone}`)}
                          disabled={!workerDetails.phone}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {language === 'hi'
                            ? `${workerDetails.name.split(' ')[0]} को कॉल करें`
                            : `Call ${workerDetails.name.split(' ')[0]}`}
                        </Button>
                        <Button variant="outline" className="rounded-2xl h-11 px-6 font-bold flex-1 md:flex-none">
                          <MessageSquare className="h-4 w-4 mr-2" /> Message
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Status Timeline & Summary */}
            <div className="space-y-6">
              <Card className="rounded-[2.5rem] border-slate-100 shadow-lg overflow-hidden">
                <CardContent className="p-8">
                  <h3 className="font-black text-xl mb-8 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" /> Service Progress
                  </h3>

                  <div className="relative space-y-8">
                    <div className="absolute top-2 bottom-2 left-5 w-0.5 bg-slate-100 -z-10" />
                    <div
                      className="absolute top-2 left-5 w-0.5 bg-primary -z-10 transition-all duration-1000 origin-top"
                      style={{ height: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }}
                    />

                    {statusSteps.map((step, i) => {
                      const isCompleted = i < currentStepIndex;
                      const isActive = i === currentStepIndex;
                      const isUpcoming = i > currentStepIndex;

                      return (
                        <div key={step.id} className="flex gap-6 items-start">
                          <div className={cn(
                            "h-10 w-10 rounded-2xl flex items-center justify-center transition-all duration-500 z-10 shadow-sm border-2",
                            isCompleted ? "bg-primary border-primary text-white" :
                              isActive ? "bg-white border-primary text-primary scale-125 shadow-xl shadow-primary/20" :
                                "bg-white border-slate-100 text-slate-300"
                          )}>
                            {isCompleted ? <Check className="h-5 w-5 stroke-[3]" /> : <step.icon className="h-5 w-5" />}
                          </div>
                          <div>
                            <h4 className={cn(
                              "font-bold text-sm leading-tight transition-colors",
                              isActive ? "text-slate-900" : isCompleted ? "text-slate-600" : "text-slate-400"
                            )}>
                              {language === 'hi' ? step.labelHi : step.labelEn}
                            </h4>
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-0.5">
                              {isActive ? 'Ongoing' : isCompleted ? 'Completed' : 'Upcoming'}
                            </p>

                            {isActive && step.id === 'otp_verify' && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Your OTP (to Start)</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-2xl font-black tracking-widest text-slate-800">{startOtp}</span>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => {
                                    navigator.clipboard.writeText(startOtp);
                                    toast.success("OTP Copied");
                                  }}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Button onClick={handleStartWork} className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 font-bold">
                                  Verify {startOtp} & Start
                                </Button>
                              </motion.div>
                            )}

                            {isActive && step.id === 'in_progress' && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Work Finishing OTP (Worker will give)</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-2xl font-black tracking-widest text-slate-800">{finishOtp}</span>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => {
                                    navigator.clipboard.writeText(finishOtp);
                                    toast.success("OTP Copied");
                                  }}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Button onClick={handleFinishWork} className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 font-bold">
                                  Enter {finishOtp} to Finish
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Summary Mini */}
              <Card className="rounded-[2.5rem] border-slate-100 bg-slate-900 text-white overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Fee</p>
                      <h4 className="text-3xl font-black">₹{bookingData?.amount || location.state?.amount || 300}</h4>
                    </div>
                    <Badge className="bg-white/10 text-white border-none py-1">UPI Pay</Badge>
                  </div>
                  <div className="space-y-3 pt-6 border-t border-white/10">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Service</span>
                      <span className="text-emerald-400">{bookingData?.serviceName || 'Service'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Worker</span>
                      <span>{workerDetails.name}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// TrendingUp icon (inline SVG)
function TrendingUp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
