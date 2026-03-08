import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, Clock, Calendar, Zap, AlertTriangle,
  ChevronRight, Check, Loader2, Shield, Star, IndianRupee,
  User, Phone, MessageSquare, X, Info, Sparkles, Navigation, Briefcase,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { FadeIn, HoverScale, ScaleIn } from '@/components/ui/animated-container';
import { cn } from '@/lib/utils';
import {
  Droplets, Zap as ZapIcon, Hammer, Paintbrush, Grid3X3, Settings,
  HardHat, Tent, Thermometer
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import LocationPicker from '../components/LocationPicker';
import { SERVICE_DATA_MAP, ServiceItem } from '@/data/services/detailedServices';

const iconMap: Record<string, React.ElementType> = {
  droplets: Droplets,
  zap: ZapIcon,
  hammer: Hammer,
  paintbrush: Paintbrush,
  'grid-3x3': Grid3X3,
  settings: Settings,
  'hard-hat': HardHat,
  tent: Tent,
  sparkles: Sparkles,
  thermometer: Thermometer,
};

const fallbackServices = [
  { id: 'ac-repair', name: 'AC Repair', name_hi: 'एसी मरम्मत', icon: 'thermometer', color: '#3b82f6', localizedName: 'AC Repair', description: 'AC installation, repair & servicing' },
  { id: 'plumbing', name: 'Plumbing', name_hi: 'प्लंबिंग', icon: 'droplets', color: '#06b6d4', localizedName: 'Plumbing', description: 'Pipe repair, leakage & installation' },
  { id: 'electrical', name: 'Electrical', name_hi: 'बिजली का काम', icon: 'zap', color: '#f59e0b', localizedName: 'Electrical', description: 'Wiring, repair & installation' },
  { id: 'carpentry', name: 'Carpentry', name_hi: 'बढ़ईगीरी', icon: 'hammer', color: '#8b5cf6', localizedName: 'Carpentry', description: 'Furniture repair & woodwork' },
  { id: 'painting', name: 'Painting', name_hi: 'पेंटिंग', icon: 'paintbrush', color: '#ec4899', localizedName: 'Painting', description: 'Wall painting & polishing' },
  { id: 'cleaning', name: 'Cleaning', name_hi: 'सफाई', icon: 'sparkles', color: '#10b981', localizedName: 'Cleaning', description: 'Home & office cleaning' },
  { id: 'appliance-repair', name: 'Appliance Repair', name_hi: 'उपकरण मरम्मत', icon: 'settings', color: '#6366f1', localizedName: 'Appliance Repair', description: 'TV, Fridge, Washing machine repair' },
  { id: 'construction', name: 'Construction', name_hi: 'निर्माण', icon: 'hard-hat', color: '#f97316', localizedName: 'Construction', description: 'Civil work & renovation' },
  { id: 'thekedar', name: 'Thekedar', name_hi: 'ठेकेदार', icon: 'hard-hat', color: '#10b981', localizedName: 'Thekedar', description: 'Big / Complex work planning' },
];

type BookingType = 'instant' | 'scheduled' | 'emergency';

export default function BookService() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: services } = useServices();
  const { t, language } = useLanguage();
  const { subscribeToBooking } = useNotifications();
  const { socket } = useSocket();

  const [step, setStep] = useState(1);
  const [bookingType, setBookingType] = useState<BookingType>('instant');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [workerFound, setWorkerFound] = useState(false);
  const [workerDeclined, setWorkerDeclined] = useState(false);
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
  const [workerInfo, setWorkerInfo] = useState<{ name: string; phone: string } | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Get detailed items for the current service
  const detailedItems = useMemo(() => {
    const key = serviceId?.toLowerCase();
    if (key?.includes('plumbing')) return SERVICE_DATA_MAP.plumbing;
    if (key?.includes('electrical') || key?.includes('electrician')) return SERVICE_DATA_MAP.electrical;
    if (key?.includes('carpentry') || key?.includes('carpenter')) return SERVICE_DATA_MAP.carpentry;
    if (key?.includes('painting') || key?.includes('painter')) return SERVICE_DATA_MAP.painting;
    if (key?.includes('ac-repair') || key?.includes('ac-services')) return SERVICE_DATA_MAP['ac-repair'];
    if (key?.includes('thekedar')) return SERVICE_DATA_MAP.thekedar;
    return null;
  }, [serviceId]);

  // If detailed items exist, we have 4 steps, otherwise 3
  const hasSubItems = !!detailedItems;
  const totalSteps = hasSubItems ? 4 : 3;

  const findService = (serviceList: any[], id: string | undefined) => {
    if (!id) return null;

    // 1. Exact ID match (covers UUIDs)
    const exactMatch = serviceList.find(s => s.id === id);
    if (exactMatch) return exactMatch;

    // 2. Slug match
    const slugMatch = serviceList.find(s => {
      const slug = s.name.toLowerCase().replace(/\s+/g, '-');
      return slug === id;
    });
    if (slugMatch) return slugMatch;

    // 3. Common aliases / Fuzzy match
    const normalizedId = id.toLowerCase().replace(/-/g, ' ');
    const fuzzyMatch = serviceList.find(s => {
      const name = s.name.toLowerCase();
      // Handle common variations
      if (normalizedId === 'electrician' && name === 'electrical') return true;
      if (normalizedId === 'plumber' && name === 'plumbing') return true;
      if (normalizedId === 'carpenter' && name === 'carpentry') return true;
      if (normalizedId === 'painter' && name === 'painting') return true;

      return name.includes(normalizedId) || normalizedId.includes(name);
    });

    return fuzzyMatch || null;
  };

  const service = useMemo(() => {
    return (services && services.length > 0
      ? findService(services, serviceId)
      : null) || findService(fallbackServices, serviceId);
  }, [services, serviceId]);

  const Icon = service ? iconMap[service.icon] || Settings : Settings;

  const priceDetails = useMemo(() => {
    const base = selectedItem ? selectedItem.price : 299;
    const fee = Math.round(base * 0.1);
    const total = base + fee;
    return { base, fee, total, workerShare: Math.round(base * 0.8) };
  }, [selectedItem]);

  useEffect(() => {
    if (!user) {
      toast.error(language === 'hi' ? 'कृपया पहले लॉगिन करें' : 'Please login first');
      navigate('/');
    }
  }, [user, navigate, language]);

  // ── Listen for booking_updated socket event from workers ───────────────
  useEffect(() => {
    if (!socket || !newBookingId) return;

    const handleBookingUpdated = (data: any) => {
      if (data.bookingId !== newBookingId) return;

      if (data.status === 'accepted') {
        setSearching(false);
        setWorkerFound(true);
        setWorkerDeclined(false);
        setWorkerInfo({
          name: data.workerName || 'Worker',
          phone: data.workerPhone || '',
        });
        toast.success(
          language === 'hi'
            ? `✅ ${data.workerName || 'कारीगर'} ने आपकी बुकिंग स्वीकार कर ली!`
            : `✅ ${data.workerName || 'Worker'} accepted your booking!`
        );
      } else if (data.status === 'declined') {
        setWorkerDeclined(true);
        toast.info(
          language === 'hi'
            ? 'कारीगर ने मना कर दिया। दूसरा खोज रहे हैं...'
            : 'Worker declined. Searching for another...'
        );
        // Keep searching state, worker declined but another may accept
      }
    };

    socket.on('booking_updated', handleBookingUpdated);
    return () => { socket.off('booking_updated', handleBookingUpdated); };
  }, [socket, newBookingId, language]);

  // ── Create real booking via API and wait for worker response ───────────
  const handleBooking = async () => {
    if (!address) {
      toast.error(language === 'hi' ? 'कृपया पता दर्ज करें' : 'Please enter address');
      return;
    }

    setSearching(true);
    setWorkerFound(false);
    setWorkerDeclined(false);
    setWorkerInfo(null);

    try {
      const userId = user?.id || user?._id;
      const token = localStorage.getItem('token');

      const bookingPayload = {
        serviceName: selectedItem?.name || service?.localizedName || service?.name || 'Service',
        customer_user_id: userId,
        customerId: userId,
        customerName: profile?.full_name || 'Customer',
        customerPhone: profile?.phone || '',
        address: address,
        city: profile?.city || '',
        amount: priceDetails.total,
        bookingType: bookingType,
        description: description || selectedItem?.name || '',
        scheduled_at: bookingType === 'scheduled'
          ? `${scheduledDate}T${scheduledTime}:00`
          : null,
      };

      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Booking creation failed');
      }

      const data = await res.json();
      const bookingId = data.bookingId || data._id?.toString();
      setNewBookingId(bookingId);

      toast.info(
        language === 'hi'
          ? '🔍 बुकिंग बनाई गई! कारीगर खोज रहे हैं...'
          : '🔍 Booking created! Searching for workers...'
      );
      // Now we wait for socket event `booking_updated` from a worker

    } catch (error: any) {
      console.error('Booking error:', error);
      setSearching(false);
      toast.error(
        language === 'hi'
          ? `बुकिंग में त्रुटि: ${error.message}`
          : `Booking failed: ${error.message}`
      );
    }
  };

  const goToTracking = () => {
    if (newBookingId) {
      navigate(`/tracking/${newBookingId}`, { state: { amount: priceDetails.total } });
    }
  };

  if (!service) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
          <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="h-10 w-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Service Not Found</h2>
          <p className="text-slate-500 mb-8 max-w-xs">The service you're looking for doesn't exist or is currently unavailable.</p>
          <Button onClick={() => navigate('/services')} className="rounded-full px-8">Browse All Services</Button>
        </div>
      </Layout>
    );
  }

  const steps = hasSubItems ? [
    { titleEn: 'Service', titleHi: 'सेवा' },
    { titleEn: 'Type', titleHi: 'प्रकार' },
    { titleEn: 'Details', titleHi: 'विवरण' },
    { titleEn: 'Confirm', titleHi: 'पुष्टि' }
  ] : [
    { titleEn: 'Type', titleHi: 'प्रकार' },
    { titleEn: 'Details', titleHi: 'विवरण' },
    { titleEn: 'Confirm', titleHi: 'पुष्टि' }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-20">
        <div className="container max-w-2xl px-4 py-8">

          {/* Step Indicator Header */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-8">
            <div className="flex items-center justify-between mb-8">
              <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h1 className="font-bold text-lg">{selectedItem ? selectedItem.name : service.localizedName}</h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  {language === 'hi' ? `चरण ${step}` : `Step ${step}`} OF {totalSteps}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${service.color}15` }}>
                <Icon className="h-6 w-6" style={{ color: service.color }} />
              </div>
            </div>

            <div className="flex justify-between relative px-2">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500"
                style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
              />

              {steps.map((s, i) => {
                const isCompleted = i + 1 < step;
                const isActive = i + 1 === step;
                return (
                  <div key={i} className="relative z-10 flex flex-col items-center">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                      isCompleted ? "bg-primary border-primary text-white" :
                        isActive ? "bg-white border-primary text-primary shadow-lg shadow-primary/20 scale-110" :
                          "bg-white border-slate-200 text-slate-400"
                    )}>
                      {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    <span className={cn(
                      "text-[10px] mt-2 font-bold uppercase tracking-wider",
                      isActive ? "text-primary" : "text-slate-400"
                    )}>
                      {language === 'hi' ? s.titleHi : s.titleEn}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Subcategory Selection (Only if hasSubItems) */}
            {hasSubItems && step === 1 && (
              <motion.div
                key="subcategory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800">
                    {language === 'hi' ? 'विशिष्ट सेवा चुनें' : 'Select Specific Service'}
                  </h2>
                  <p className="text-slate-500">Pick exactly what you need help with.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {detailedItems?.map((item) => (
                    <Card
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setStep(2);
                      }}
                      className={cn(
                        "group cursor-pointer border-2 transition-all duration-300 rounded-3xl overflow-hidden hover:shadow-lg",
                        selectedItem?.id === item.id ? "border-primary bg-primary/5 shadow-primary/10" : "border-slate-100"
                      )}
                    >
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Sparkles className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800">{item.name}</h3>
                            <p className="text-sm text-slate-500">Starts at ₹{item.price}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 1/2: Booking Type Selection */}
            {((!hasSubItems && step === 1) || (hasSubItems && step === 2)) && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800">
                    {language === 'hi' ? 'कैसे बुक करना चाहते हैं?' : 'How do you want to book?'}
                  </h2>
                  <p className="text-slate-500">Choose the timing that works best for you.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'instant', icon: Zap, label: 'Instant Service', desc: 'Worker arrives in 45-60 min', color: 'blue' },
                    { id: 'scheduled', icon: Calendar, label: 'Schedule Visit', desc: 'Pick a date and time slot', color: 'emerald' },
                    { id: 'emergency', icon: AlertTriangle, label: 'Emergency', desc: 'Varies by availability, 2x price', color: 'rose' }
                  ].map((type) => (
                    <Card
                      key={type.id}
                      onClick={() => setBookingType(type.id as BookingType)}
                      className={cn(
                        "group cursor-pointer border-2 transition-all duration-300 rounded-[2rem] overflow-hidden",
                        bookingType === type.id ? "border-primary bg-primary/5 shadow-xl shadow-primary/5" : "border-slate-100 hover:border-slate-300"
                      )}
                    >
                      <CardContent className="p-6 flex items-center gap-5">
                        <div className={cn(
                          "h-16 w-16 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110",
                          bookingType === type.id ? "bg-primary text-white" : "bg-slate-50 text-slate-400"
                        )}>
                          <type.icon className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn("font-bold text-lg", bookingType === type.id ? "text-primary" : "text-slate-700")}>
                            {type.label}
                          </h3>
                          <p className="text-sm text-slate-500">{type.desc}</p>
                        </div>
                        <div className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center",
                          bookingType === type.id ? "border-primary bg-primary" : "border-slate-200"
                        )}>
                          {bookingType === type.id && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {bookingType === 'scheduled' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-white rounded-3xl border border-slate-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-600">Select Date</Label>
                        <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="rounded-xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-600">Select Time</Label>
                        <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="rounded-xl h-12" />
                      </div>
                    </div>
                  </motion.div>
                )}

                <Button onClick={() => setStep(step + 1)} className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/30 mt-4">
                  Continue to Address
                </Button>
              </motion.div>
            )}

            {/* Step 2/3: Address Selection */}
            {((!hasSubItems && step === 2) || (hasSubItems && step === 3)) && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800">
                    {language === 'hi' ? 'कहाँ आना है?' : 'Where should we come?'}
                  </h2>
                  <p className="text-slate-500">Provide your location and any specific details.</p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Service Address
                    </Label>
                    <div className="relative">
                      <Textarea
                        placeholder="House no, Building, Street Name..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="rounded-3xl min-h-[120px] p-5 bg-white border-slate-200 focus:ring-primary focus:border-primary"
                      />
                      <Button
                        variant="link"
                        onClick={() => setShowMapPicker(true)}
                        className="absolute bottom-4 right-4 text-primary font-bold flex items-center gap-2 hover:no-underline"
                      >
                        <Navigation className="h-4 w-4" /> Pick from Map
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" /> Instructions (Optional)
                    </Label>
                    <Input
                      placeholder="e.g. Broken knob, water leakage..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-xl h-14 bg-white border-slate-200"
                    />
                  </div>
                </div>

                <Button onClick={() => setStep(step + 1)} disabled={!address} className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/30 mt-4">
                  Review & Book
                </Button>
              </motion.div>
            )}

            {step === totalSteps && !searching && !workerFound && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-slate-800">Review Booking</h2>
                  <p className="text-slate-500">Transparent pricing, no hidden charges.</p>
                </div>

                <div className="grid gap-4">
                  <Card className="rounded-[2rem] border-slate-100 overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${service.color}15` }}>
                          <Icon className="h-7 w-7" style={{ color: service.color }} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800">{service.localizedName}</h4>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] uppercase">{bookingType}</Badge>
                            <span className="text-xs text-slate-400 font-medium">Verified Prof.</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-primary mt-1" />
                          <p className="text-sm text-slate-600 leading-relaxed font-medium">{address}</p>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                          <Clock className="h-4 w-4 text-primary" />
                          {bookingType === 'instant' ? 'Arriving today in 60 min' : `${scheduledDate} at ${scheduledTime}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[2rem] border-primary/20 bg-gradient-to-br from-white to-primary/5">
                    <CardContent className="p-6">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-primary" /> Price Summary
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Base Service Fee</span>
                          <span className="font-bold">₹{priceDetails.base}</span>
                        </div>
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Worker Earning</span>
                          <span className="font-bold">₹{priceDetails.workerShare}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>Safety & Insurance</span>
                          <span className="font-bold">₹{priceDetails.fee}</span>
                        </div>
                        <div className="pt-3 border-t border-slate-200 flex justify-between">
                          <span className="font-bold text-slate-800">Total Amount</span>
                          <span className="text-2xl font-black text-primary">₹{priceDetails.total}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button onClick={handleBooking} disabled={searching} className="w-full h-16 rounded-[2rem] text-xl font-black shadow-xl shadow-primary/30 mt-4 group">
                  {searching ? (
                    <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Creating Booking...</>
                  ) : (
                    <><Zap className="mr-2 h-6 w-6 transition-transform group-hover:scale-125 group-hover:rotate-12" /> CONFIRM & BOOK</>
                  )}
                </Button>
              </motion.div>
            )}

            {/* ── WAITING FOR WORKER ── */}
            {searching && (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center justify-center">
                <div className="relative mb-12">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping h-32 w-32" />
                  <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping h-32 w-32" style={{ animationDelay: '0.7s' }} />
                  <div className="relative z-10 h-32 w-32 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-primary">
                    <Icon className="h-16 w-16 text-primary" />
                  </div>
                </div>

                <h2 className="text-2xl font-black text-slate-800 mb-2">
                  {language === 'hi' ? 'कारीगर खोज रहे हैं...' : 'Waiting for a Worker...'}
                </h2>
                <p className="text-slate-500 font-medium text-center max-w-sm">
                  {language === 'hi'
                    ? 'आपकी बुकिंग सभी उपलब्ध कारीगरों को भेजी गई है। कोई जल्दी ही स्वीकार करेगा!'
                    : 'Your booking has been sent to all available workers. Someone will accept it shortly!'}
                </p>

                {workerDeclined && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {language === 'hi'
                      ? 'एक कारीगर ने मना किया। दूसरा खोज रहे हैं...'
                      : 'A worker declined. Searching for another...'}
                  </motion.div>
                )}

                <div className="mt-8 flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-3 w-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>

                <p className="text-xs text-slate-400 mt-6 font-bold">
                  {language === 'hi' ? 'बुकिंग ID: ' : 'Booking ID: '}
                  {newBookingId?.slice(0, 8)}...
                </p>
              </motion.div>
            )}

            {/* ── WORKER ACCEPTED ── */}
            {workerFound && (
              <motion.div key="found" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="h-24 w-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200"
                  >
                    <Check className="h-12 w-12 stroke-[4]" />
                  </motion.div>
                  <h2 className="text-3xl font-black text-emerald-600">
                    {language === 'hi' ? 'कारीगर मिल गया!' : 'Worker Accepted!'}
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {language === 'hi'
                      ? 'बधाई! एक कारीगर ने आपकी बुकिंग स्वीकार कर ली है।'
                      : 'Great! A worker has accepted your booking request.'}
                  </p>
                </div>

                <Card className="rounded-[2.5rem] border-slate-100 shadow-2xl shadow-slate-200 overflow-hidden bg-white">
                  <CardContent className="p-8">
                    <div className="flex items-center gap-6">
                      <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-emerald-50 to-primary/10 flex items-center justify-center text-3xl font-black text-primary shadow-inner border border-slate-100">
                        {workerInfo?.name?.charAt(0)?.toUpperCase() || 'W'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-2xl font-extrabold text-slate-800">
                            {workerInfo?.name || 'Worker'}
                          </h3>
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">
                            <Shield className="h-3 w-3 mr-1" /> Verified
                          </Badge>
                        </div>
                        {workerInfo?.phone && (
                          <p className="text-slate-500 font-bold mb-4 flex items-center gap-2">
                            <Phone className="h-4 w-4" /> {workerInfo.phone}
                          </p>
                        )}
                        <div className="flex gap-3">
                          {workerInfo?.phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full font-bold border-slate-200"
                              onClick={() => window.open(`tel:${workerInfo.phone}`)}
                            >
                              <Phone className="h-4 w-4 mr-2" /> Call
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="rounded-full font-bold border-slate-200">
                            <MessageSquare className="h-4 w-4 mr-2" /> Chat
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 p-6 bg-gradient-to-r from-emerald-50 to-primary/5 rounded-3xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-emerald-600" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none">
                            {language === 'hi' ? 'अनुमानित पहुँच' : 'Estimated Arrival'}
                          </p>
                          <p className="text-lg font-black text-slate-800">
                            {bookingType === 'emergency' ? '15' : bookingType === 'instant' ? '30-45' : '—'} {language === 'hi' ? 'मिनट' : 'Minutes'}
                          </p>
                        </div>
                      </div>
                      <Button onClick={goToTracking} className="rounded-2xl px-8 font-bold shadow-lg shadow-primary/20">
                        {language === 'hi' ? 'ट्रैक करें' : 'Track Now'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center">
                  <p className="text-xs text-slate-400 font-bold">
                    {language === 'hi' ? 'बुकिंग ID: ' : 'Booking ID: '}{newBookingId?.slice(0, 8)}...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={showMapPicker} onOpenChange={setShowMapPicker}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[2rem]">
          <div className="h-[500px] relative">
            <LocationPicker
              onConfirm={(loc) => {
                setAddress(loc.address);
                setShowMapPicker(false);
                toast.success("Location updated!");
              }}
              onCancel={() => setShowMapPicker(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
