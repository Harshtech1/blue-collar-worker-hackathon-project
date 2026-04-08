import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, MapPin, Navigation, Phone, MessageSquare, 
  Clock, Shield, CheckCircle2, Star, Timer
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TrackingMap from '@/components/TrackingMap';

export default function LiveTrackingPage() {
  const navigate = useNavigate();
  const [eta, setEta] = useState(12);
  const [status, setStatus] = useState('on_the_way');
  const [workerLocation, setWorkerLocation] = useState<[number, number] | null>([28.7000, 77.0900]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEta((prev) => (prev > 1 ? prev - 1 : 1));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 relative flex flex-col">
        {/* Map Container */}
        <div className="flex-1 bg-slate-200 relative overflow-hidden">
          <TrackingMap
            userLocation={[28.7041, 77.1025]}
            workerLocation={workerLocation}
          />
        </div>

        {/* Tracking Card (Bottom Sheet Style on Mobile) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
           <motion.div 
             initial={{ y: 50, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
           >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold">Worker is on the way</span>
                 </div>
                 <Badge variant="outline" className="border-white/20 text-white font-bold">
                    <Timer className="h-3 w-3 mr-2" />
                    ETA: {eta} mins
                 </Badge>
              </div>
              
              <CardContent className="p-8">
                 <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-100">
                    <div className="relative">
                       <img src="https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=150" alt="Worker" className="h-20 w-20 rounded-2xl object-cover border-4 border-slate-50" />
                       <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-white text-white">
                          <CheckCircle2 className="h-4 w-4" />
                       </div>
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900">Ramesh Kumar</h3>
                       <p className="text-slate-500 font-bold mb-2">Senior Electrician • 5yr Exp</p>
                       <div className="flex items-center gap-1 text-amber-500 font-black">
                          <Star className="h-4 w-4 fill-amber-500" />
                          <span>4.9</span>
                          <span className="text-slate-300 mx-2 text-sm">|</span>
                          <span className="text-slate-400 text-sm">DL 4567 8901</span>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4 mb-4">
                    <Button variant="outline" className="h-14 rounded-2xl font-black gap-2 border-slate-200 hover:bg-slate-50">
                       <MessageSquare className="h-5 w-5 text-primary" />
                       Chat
                    </Button>
                    <Button className="h-14 rounded-2xl font-black gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200">
                       <Phone className="h-5 w-5" />
                       Call Worker
                    </Button>
                 </div>
                 
                 <Button variant="ghost" onClick={() => navigate('/bookings')} className="w-full h-10 text-slate-400 font-bold hover:text-primary">
                    Manage Booking Details
                 </Button>
              </CardContent>
           </motion.div>
        </div>

        {/* Back Button */}
        <div className="absolute top-20 left-6">
           <Button variant="secondary" onClick={() => navigate(-1)} className="rounded-full h-12 w-12 p-0 shadow-lg">
              <ArrowLeft className="h-6 w-6" />
           </Button>
        </div>
      </div>
    </Layout>
  );
}