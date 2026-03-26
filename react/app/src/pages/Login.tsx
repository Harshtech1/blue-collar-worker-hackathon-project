import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Mail, Lock, ArrowLeft, Loader2, Shield, 
  Zap, Star, CheckCircle2, Heart, Sparkles, Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signInWithOTP, verifyOTP } = useAuth();
  const { t, language } = useLanguage();
  
  const [loginMethod, setLoginMethod] = useState<'otp' | 'email'>('otp');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error(language === 'hi' ? 'कृपया वैध फोन नंबर दर्ज करें' : 'Please enter a valid phone number');
      return;
    }
    setLoading(true);
    const { error } = await signInWithOTP(`+91${phone}`);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      setOtpSent(true);
      toast.success(language === 'hi' ? 'OTP भेजा गया!' : 'OTP sent!');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error(language === 'hi' ? 'कृपया 6 अंकों का OTP दर्ज करें' : 'Please enter 6-digit OTP');
      return;
    }
    setLoading(true);
    const { error } = await verifyOTP(`+91${phone}`, otp);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(language === 'hi' ? 'सफलतापूर्वक लॉगिन!' : 'Login successful!');
      navigate('/');
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error(language === 'hi' ? 'कृपया ईमेल और पासवर्ड दर्ज करें' : 'Please enter email and password');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(language === 'hi' ? 'सफलतापूर्वक लॉगिन!' : 'Login successful!');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side: Visual/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -ml-64 -mb-64" />
        
        <div className="relative z-10 max-w-lg text-white">
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
           >
             <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-2xl shadow-primary/40 mb-8 bg-white">
                <img src="/images/rahi_logo.jpeg" alt="RAHI Logo" className="h-full w-full object-contain p-1" />
             </div>
             <h2 className="text-5xl font-black mb-6 leading-tight">Welcome back to the RAHI ecosystem.</h2>
             <p className="text-xl text-slate-400 font-medium">Join 80,000+ users who trust RAHI for ethical and professional home services.</p>
           </motion.div>

           <div className="space-y-6">
             {[
               { icon: CheckCircle2, text: "Vetted professionals at 10% commission" },
               { icon: Navigation, text: "Real-time tracking for every booking" },
               { icon: Star, text: "4.9/5 Average service rating" }
             ].map((item, i) => (
               <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4 text-slate-300 font-bold"
               >
                 <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                    <item.icon className="h-5 w-5" />
                 </div>
                 <span>{item.text}</span>
               </motion.div>
             ))}
           </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex flex-col p-6 lg:p-12 items-center justify-center bg-white relative">
        <div className="absolute top-6 left-6 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <h1 className="text-4xl font-black text-slate-900 mb-2">Login</h1>
            <p className="text-slate-500 font-medium">Access your account to manage bookings.</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50">
            <Tabs
              value={loginMethod}
              onValueChange={(v: string) => {
                if (v === 'otp' || v === 'email') setLoginMethod(v);
              }}
            >
              <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-8 h-12">
                <TabsTrigger value="otp" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">OTP</TabsTrigger>
                <TabsTrigger value="email" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Email</TabsTrigger>
              </TabsList>

              <TabsContent value="otp" className="space-y-6">
                <AnimatePresence mode="wait">
                  {!otpSent ? (
                    <motion.div key="phone" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                      <div className="space-y-4">
                        <div className="space-y-2">
                           <Label className="font-bold text-slate-600 ml-1">Phone Number</Label>
                           <div className="relative group">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold border-r border-slate-100 pr-3">+91</span>
                              <Input 
                                type="tel" 
                                placeholder="9876543210" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                className="pl-16 h-14 bg-slate-50 border-slate-100 focus:bg-white rounded-2xl text-lg font-bold transition-all"
                              />
                           </div>
                        </div>
                        <Button onClick={handleSendOTP} disabled={loading || phone.length < 10} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20">
                          {loading ? <Loader2 className="animate-spin" /> : "Request OTP"}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                      <div className="space-y-6">
                        <div className="text-center p-4 bg-primary/5 rounded-2xl border border-primary/10">
                           <p className="text-sm font-bold text-primary">OTP sent to +91{phone}</p>
                           <button onClick={() => setOtpSent(false)} className="text-xs font-black uppercase tracking-widest text-slate-400 mt-2 hover:text-primary transition-colors">Change Number</button>
                        </div>
                        <div className="space-y-2">
                           <Label className="font-bold text-slate-600 ml-1">Enter 6-digit OTP</Label>
                           <Input 
                            type="text" 
                            placeholder="••••••" 
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="h-16 text-3xl text-center tracking-[0.5em] font-black bg-slate-50 border-slate-100 rounded-2xl"
                           />
                        </div>
                        <Button onClick={handleVerifyOTP} disabled={loading || otp.length < 6} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20">
                          {loading ? <Loader2 className="animate-spin" /> : "Verify & Login"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>

              <TabsContent value="email" className="space-y-6">
                <div className="space-y-5">
                   <div className="space-y-2">
                      <Label className="font-bold text-slate-600 ml-1">Email</Label>
                      <Input 
                        placeholder="you@example.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
                      />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between ml-1">
                        <Label className="font-bold text-slate-600">Password</Label>
                        <button className="text-xs font-bold text-primary">Forgot?</button>
                      </div>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
                      />
                   </div>
                   <Button onClick={handleEmailLogin} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20">
                      {loading ? <Loader2 className="animate-spin" /> : "Login with Email"}
                   </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-center text-slate-400 font-bold">
            New to RAHI? <Link to="/register" className="text-primary hover:underline">Create account</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}