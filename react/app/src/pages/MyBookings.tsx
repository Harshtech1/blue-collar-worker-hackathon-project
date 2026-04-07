import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, Phone, Star, MessageCircle, 
  ArrowRight, Package, CheckCircle, AlertCircle, XCircle,
  Search, Filter, IndianRupee, ChevronRight, Briefcase
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { useEffect } from 'react';
import { API } from '@/lib/constants';

const statusConfig = {
  pending: { label: 'Pending', labelHi: 'लंबित', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle },
  in_progress: { label: 'Active', labelHi: 'प्रगति में', color: 'text-primary', bg: 'bg-primary/10', icon: Clock },
  completed: { label: 'Completed', labelHi: 'पूर्ण', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
  cancelled: { label: 'Cancelled', labelHi: 'रद्द', color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle },
};

export default function MyBookings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/bookings?customer_user_id=${user._id || user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBookings(data);
        }
      } catch (err) {
        console.error("Failed to fetch bookings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesFilter = activeFilter === 'all' || b.status === activeFilter;
      const serviceName = b.serviceName || '';
      const address = b.address || '';
      const matchesSearch = serviceName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            address.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [bookings, activeFilter, searchQuery]);

  if (!user) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
          <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <Package className="h-10 w-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Please Login</h2>
          <p className="text-slate-500 mb-8 max-w-xs">Login to view your booking history and track active services.</p>
          <Button onClick={() => navigate('/login')} className="rounded-full px-8">Login to My Account</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-20">
        {/* Header Section */}
        <div className="bg-white border-b">
          <div className="container px-4 py-12">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-black text-slate-900 mb-2">
                {language === 'hi' ? 'मेरी बुकिंग' : 'My Bookings'}
              </h1>
              <p className="text-slate-500">Manage and track your service history.</p>
            </motion.div>

            {/* Filters & Search */}
            <div className="mt-8 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 no-scrollbar">
                {['all', 'pending', 'in_progress', 'completed'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border",
                      activeFilter === f 
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {language === 'hi' ? (f === 'all' ? 'सभी' : statusConfig[f as keyof typeof statusConfig]?.labelHi) : (f === 'all' ? 'All Bookings' : statusConfig[f as keyof typeof statusConfig]?.label)}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search service or address..." 
                  className="pl-10 h-11 rounded-xl" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="container px-4 py-8">
           {loading ? (
             <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
               <h3 className="text-xl font-bold text-slate-800">Loading bookings...</h3>
             </div>
           ) : (
           <AnimatePresence mode="popLayout">
            {filteredBookings.length > 0 ? (
               <motion.div layout className="grid gap-6">
                 {filteredBookings.map((booking) => {
                   const config = statusConfig[booking.status as keyof typeof statusConfig];
                   const StatusIcon = config.icon;
                   return (
                     <motion.div
                       key={booking._id}
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                       layout
                     >
                       <Card className="rounded-[2rem] border-slate-200/60 hover:border-primary/40 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden bg-white">
                          <CardContent className="p-6 md:p-8">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                             {/* Service Icon Area */}
                             <div 
                               className="h-16 w-16 md:h-20 md:w-20 rounded-[1.5rem] flex items-center justify-center shadow-inner shrink-0 bg-blue-50"
                             >
                               <Briefcase className="h-8 w-8 md:h-10 md:w-10 text-blue-500" />
                             </div>

                             {/* Booking Info */}
                             <div className="flex-1 space-y-4">
                               <div className="flex flex-wrap items-center gap-3">
                                 <h3 className="text-xl font-black text-slate-900">
                                   {booking.serviceName || 'Service'}
                                 </h3>
                                 <Badge className={cn("rounded-full px-3 py-1 font-bold", config?.bg || 'bg-slate-100', config?.color || 'text-slate-500')}>
                                   {StatusIcon && <StatusIcon className="h-3 w-3 mr-1.5" />}
                                   {language === 'hi' ? config?.labelHi : config?.label}
                                 </Badge>
                               </div>

                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm text-slate-500 font-medium">
                                 <div className="flex items-center gap-3">
                                   <Calendar className="h-4 w-4 text-slate-400" /> {new Date(booking.createdAt).toLocaleDateString()}
                                 </div>
                                 <div className="flex items-center gap-3">
                                   <Clock className="h-4 w-4 text-slate-400" /> {new Date(booking.createdAt).toLocaleTimeString()}
                                 </div>
                                 <div className="flex items-start gap-3 sm:col-span-2">
                                   <MapPin className="h-4 w-4 text-slate-400 mt-0.5" /> {booking.address || 'Address not specified'}
                                 </div>
                               </div>

                               {booking.workerName && (
                                 <div className="pt-4 border-t border-slate-50 mt-4 flex items-center gap-3">
                                   <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                     {booking.workerName.charAt(0).toUpperCase()}
                                   </div>
                                   <span className="text-sm font-bold text-slate-700">Assigned Pro: {booking.workerName}</span>
                                 </div>
                                )}
                             </div>

                             {/* Action/Price Area */}
                             <div className="flex flex-col items-start md:items-end gap-6 shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-slate-50">
                               <div className="md:text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Paid</p>
                                 <p className="text-3xl font-black text-slate-900">₹{booking.amount}</p>
                               </div>
                               
                               <div className="flex gap-2 w-full">
                                 {booking.status === 'in_progress' || booking.status === 'pending' || booking.status === 'accepted' ? (
                                   <Button 
                                     onClick={() => navigate(`/tracking/${booking._id}`)}
                                     className="rounded-xl px-6 font-bold flex-1 md:flex-none shadow-lg shadow-primary/20"
                                   >
                                     Track Live
                                   </Button>
                                 ) : booking.status === 'completed' ? (
                                   <Button 
                                     variant="outline"
                                     className="rounded-xl px-6 font-bold flex-1 md:flex-none"
                                     onClick={() => toast.success("Opening invoice...")}
                                   >
                                     Invoice
                                   </Button>
                                 ) : (
                                   <Button 
                                     variant="outline"
                                     className="rounded-xl px-6 font-bold flex-1 md:flex-none"
                                     onClick={() => toast.info("Booking details loading...")}
                                   >
                                     Details
                                   </Button>
                                 )}
                                 
                                 {(booking.status === 'completed' || booking.status === 'cancelled') && (
                                    <Button 
                                      className="rounded-xl px-4 font-bold"
                                      onClick={() => navigate(`/book/${(booking.serviceName || 'general').toLowerCase().replace(/\s+/g, '-')}`)}
                                    >
                                      Rebook <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                 )}
                               </div>
                             </div>
                           </div>
                         </CardContent>
                       </Card>
                     </motion.div>
                   );
                 })}
               </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <Package className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800">No bookings yet</h3>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto">Your service history will appear here once you book a professional.</p>
                <Button onClick={() => navigate('/services')} className="rounded-full px-10">Start Booking</Button>
              </motion.div>
            )}
           </AnimatePresence>
           )}
        </div>
      </div>
    </Layout>
  );
}
