import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, User, Phone, Mail, Lock, Loader2,
  Users, Home, Briefcase, Building2, CheckCircle2,
  Sparkles, Shield, Star, Navigation, Heart, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const roles = [
  { id: 'customer', icon: Home, labelEn: 'Customer', labelHi: 'ग्राहक', color: 'bg-primary', descEn: 'Book services effortlessly', descHi: 'आसानी से सेवाएं बुक करें' },
  { id: 'worker', icon: Users, labelEn: 'Worker', labelHi: 'कारीगर', color: 'bg-amber-500', descEn: 'Earn directly with 10% commission', descHi: 'सीधे 10% कमीशन के साथ कमाएं' },
  { id: 'thekedar', icon: Briefcase, labelEn: 'Thekedar', labelHi: 'ठेकेदार', color: 'bg-emerald-500', descEn: 'Manage teams and site visits', descHi: 'टीम और साइट विजिट प्रबंधित करें' },
];

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, verifyOTP } = useAuth();
  const { t, language } = useLanguage();

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(searchParams.get('role') || '');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!fullName || !phone || !email || !password) {
      toast.error(language === 'hi' ? 'कृपया सभी फ़ील्ड भरें' : 'Please fill all fields');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName, `+91${phone}`, selectedRole);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setPendingEmail(email);
      setStep(3); // OTP Step
      toast.success(language === 'hi' ? 'OTP भेजा गया!' : 'OTP sent!');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return toast.error("Please enter OTP");
    setLoading(true);
    const { error } = await verifyOTP(pendingEmail, otp, false);
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(language === 'hi' ? 'खाता सत्यापित! कृपया लॉगिन करें।' : 'Account verified! Please login.');
      navigate('/login');
    }
  };

  // Re-implementing with consistent flow assuming Context updates coming
  // I'll update the Context in next step.
  // Using a local verify helper for now to bypass context issue if needed or assuming context fix.

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
      {/* Left Branding (Split view) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] -ml-64 -mb-64" />

        <div className="relative z-10 max-w-lg text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-2xl shadow-primary/40 mb-8 bg-white">
              <img src="/images/rahi_logo.jpeg" alt="RAHI Logo" className="h-full w-full object-contain p-1" />
            </div>
            <h2 className="text-5xl font-black mb-6 leading-tight">Start your journey with RAHI.</h2>
            <p className="text-xl text-slate-400 font-medium">Whether you're looking for help or lookin to work, you're in the right place.</p>
          </motion.div>

          <div className="space-y-6">
            {[
              { icon: Shield, text: "Privacy-first, ethical marketplace" },
              { icon: Heart, text: "Worker welfare fund participation" },
              { icon: CheckCircle2, text: "Instant payouts for every professional" }
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

      {/* Right Form */}
      <div className="flex-1 flex flex-col p-6 lg:p-12 items-center justify-center bg-white relative">
        <div className="absolute top-6 left-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate('/') : setStep(step - 1)} className="rounded-full bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn("h-1 w-8 rounded-full transition-all duration-500", s <= step ? "bg-primary" : "bg-slate-100")} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <h1 className="text-4xl font-black text-slate-900 mb-2">Create Account</h1>
            <p className="text-slate-500 font-medium">Join the RAHI community today.</p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {roles.map((role, idx) => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={cn(
                      "w-full flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all duration-300 group",
                      selectedRole === role.id ? "border-primary bg-primary/5 shadow-xl shadow-primary/5" : "border-slate-100 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0", role.color)}>
                      <role.icon className="h-7 w-7" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-black text-slate-800">{language === 'hi' ? role.labelHi : role.labelEn}</h3>
                      <p className="text-xs text-slate-500 font-medium">{language === 'hi' ? role.descHi : role.descEn}</p>
                    </div>
                    <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center", selectedRole === role.id ? "border-primary bg-primary" : "border-slate-200")}>
                      {selectedRole === role.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : step === 2 ? (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 space-y-5"
              >
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 ml-1">Full Name</Label>
                  <Input
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 ml-1">Phone Number</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold border-r border-slate-100 pr-3">+91</span>
                    <Input
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-16 h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 ml-1">Email address</Label>
                  <Input
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 ml-1">Secure Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <Button onClick={handleSubmit} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 mt-4">
                  {loading ? <Loader2 className="animate-spin" /> : "Complete Registration"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 space-y-5 text-center"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold">Verify Email</h3>
                <p className="text-slate-500">We've sent a code to <span className="font-bold text-slate-900">{email}</span></p>

                <Input
                  placeholder="Enter OTP (e.g. 123456)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold text-center text-2xl tracking-widest"
                  maxLength={6}
                />

                <Button onClick={handleVerifyOtp} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 mt-4">
                  {loading ? <Loader2 className="animate-spin" /> : "Verify & Login"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-slate-400 font-bold">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
