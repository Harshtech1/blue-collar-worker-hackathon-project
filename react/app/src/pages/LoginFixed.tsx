import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, Lock, ArrowLeft, Loader2, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { FadeIn, ScaleIn } from '@/components/ui/animated-container';

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
    
    if (error) {
      toast.error(error.message);
    } else {
      new Audio('/sounds/faaaa.mp4').play().catch(e => console.log('Audio error:', e));
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
    
    if (error) {
      toast.error(error.message);
    } else {
      new Audio('/sounds/faaaa.mp4').play().catch(e => console.log('Audio error:', e));
      toast.success(language === 'hi' ? 'सफलतापूर्वक लॉगिन!' : 'Login successful!');
      // Small delay to ensure state is settled before navigation
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
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
    
    if (error) {
      toast.error(error.message);
    } else {
      new Audio('/sounds/faaaa.mp4').play().catch(e => console.log('Audio error:', e));
      toast.success(language === 'hi' ? 'सफलतापूर्वक लॉगिन!' : 'Login successful!');
      // Small delay to ensure state is settled before navigation
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <FadeIn className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <ScaleIn delay={0.1}>
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground font-bold text-4xl mb-4 shadow-lg">
                R
              </div>
            </ScaleIn>
            <h1 className="text-3xl font-bold text-primary">{t('app.name')}</h1>
            <p className="text-muted-foreground mt-2">{t('auth.welcome')}</p>
          </div>

          {/* Login Form */}
          <motion.div 
            className="bg-card rounded-3xl p-6 shadow-xl border"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Tabs
              value={loginMethod}
              onValueChange={(v: string) => {
                if (v === 'otp' || v === 'email') setLoginMethod(v);
              }}
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="otp" className="gap-2">
                  <Phone className="h-4 w-4" />
                  OTP
                </TabsTrigger>
                <TabsTrigger value="email" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              </TabsList>

              <TabsContent value="otp" className="space-y-4">
                <AnimatePresence mode="wait">
                  {!otpSent ? (
                    <motion.div
                      key="phone"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="phone">{t('auth.phone')}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            +91
                          </span>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="9876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="pl-12 h-12 text-lg rounded-xl"
                            maxLength={10}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleSendOTP}
                        disabled={loading || phone.length < 10}
                        className="w-full h-12 text-lg rounded-xl"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          t('auth.send_otp')
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="otp"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          {language === 'hi' 
                            ? `OTP भेजा गया +91${phone}` 
                            : `OTP sent to +91${phone}`
                          }
                        </p>
                        <button 
                          onClick={() => setOtpSent(false)}
                          className="text-sm text-primary hover:underline"
                        >
                          {t('common.change')}
                        </button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="otp">{t('auth.otp')}</Label>
                        <Input
                          id="otp"
                          type="text"
                          placeholder="000000"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="h-12 text-2xl text-center tracking-[0.5em] rounded-xl"
                          maxLength={6}
                        />
                      </div>
                      <Button
                        onClick={handleVerifyOTP}
                        disabled={loading || otp.length !== 6}
                        className="w-full h-12 text-lg rounded-xl"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          t('auth.verify')
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="w-full"
                      >
                        {language === 'hi' ? 'OTP दोबारा भेजें' : 'Resend OTP'}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>

              <TabsContent value="email" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleEmailLogin}
                  disabled={loading}
                  className="w-full h-12 text-lg rounded-xl"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    t('nav.login')
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {language === 'hi' ? 'नया खाता?' : "Don't have an account?"}{' '}
                <Link to="/register" className="text-primary font-semibold hover:underline">
                  {language === 'hi' ? 'रजिस्टर करें' : 'Register'}
                </Link>
              </p>
            </div>
          </motion.div>

          {/* Trust Badges */}
          <div className="flex justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>{language === 'hi' ? 'सुरक्षित' : 'Secure'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span>{language === 'hi' ? 'तेज़' : 'Fast'}</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}