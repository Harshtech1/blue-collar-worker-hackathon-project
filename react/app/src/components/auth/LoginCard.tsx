import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Mail, Lock, Loader2, Shield, 
  Zap, Star, CheckCircle2, Sparkles, Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export function LoginCard() {
  const navigate = useNavigate();
  const { signIn, signInWithOTP, verifyOTP } = useAuth();
  const { language } = useLanguage();
  
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
      // Refresh current page or redirect to appropriate dashboard
      window.location.reload(); 
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
      window.location.reload();
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 bg-white">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto h-12 w-12 rounded-2xl overflow-hidden mb-4 bg-white">
          <img src="/images/rahi_logo.jpeg" alt="RAHI Logo" className="h-full w-full object-contain p-0.5" />
        </div>
        <CardTitle className="text-3xl font-black text-slate-900">Welcome Back</CardTitle>
        <CardDescription className="text-slate-500 font-medium">
          {language === 'hi' ? 'अपने अकाउंट में लॉगिन करें' : 'Access your account to manage bookings'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
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
                    <Button onClick={handleSendOTP} disabled={loading || phone.length < 10} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white transition-all transform hover:scale-[1.02]">
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
                    <Button onClick={handleVerifyOTP} disabled={loading || otp.length < 6} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white transition-all transform hover:scale-[1.02]">
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
               <Button onClick={handleEmailLogin} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white transition-all transform hover:scale-[1.02]">
                  {loading ? <Loader2 className="animate-spin" /> : "Login with Email"}
               </Button>
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-8 text-center text-sm font-bold">
          <span className="text-slate-400">New to RAHI? </span>
          <Link to="/register" className="text-primary hover:underline">Create account</Link>
        </div>
      </CardContent>
    </Card>
  );
}
