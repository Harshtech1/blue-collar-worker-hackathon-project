import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, Loader2,
  Shield, CheckCircle2,
  Sparkles, Heart, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function EnhancedLogin() {
  const navigate = useNavigate();
  const { signIn, verifyOTP } = useAuth();
  const { language } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP State
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      if (showOtp) {
        // Verify OTP Step
        // We need to pass true for shouldLogin (default)
        const { error, data } = await verifyOTP(email, otp);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Login Successful!");

          // Use the 'data' we already destructured above
          if (data && data.user) {
            // Optional: check role here
          }

          // Force reload to ensure fresh context state
          window.location.href = "/";
        }
      } else {
        // Initial Login Step
        const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

        const res = await fetch(`${API}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Login failed');
        }

        if (data.requireOtp) {
          setShowOtp(true);
          toast.info("OTP sent to your email!");
        } else {
          // Standard login (token received)
          if (data.role === 'admin') {
            localStorage.setItem('adminToken', data.token);
            // AdminDashboard checks for 'adminToken'
            window.location.href = "/admin-portal-2026";
            return;
          }
          localStorage.setItem('token', data.token);
          // Reload to sync context
          window.location.reload();
        }
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

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
            <h2 className="text-5xl font-black mb-6 leading-tight">Welcome back to RAHI.</h2>
            <p className="text-xl text-slate-400 font-medium">Log in to manage your bookings, earnings, and teams.</p>
          </motion.div>

          <div className="space-y-6">
            {[
              { icon: Shield, text: "Secure 2FA Login Protection" },
              { icon: Heart, text: "Wait-free instant access" },
              { icon: CheckCircle2, text: "Manage everything in one place" }
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
            <h1 className="text-4xl font-black text-slate-900 mb-2">
              {showOtp ? "Verify Login" : (language === 'hi' ? 'लॉगिन करें' : 'Welcome Back')}
            </h1>
            <p className="text-slate-500 font-medium">
              {showOtp ? `Enter code sent to ${email}` : (language === 'hi' ? 'अपना खाता एक्सेस करें' : 'Sign in to your account')}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!showOtp ? (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 space-y-5"
              >
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 ml-1">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="font-bold text-slate-600">Password</Label>
                    <Link to="/forgot-password" className="text-xs font-bold text-primary hover:underline">Forgot?</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12 h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold"
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

                <Button onClick={handleLogin} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 mt-4">
                  {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 space-y-5 text-center"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold">Two-Factor Auth</h3>
                <p className="text-slate-500">Enter the security code sent to <br /><span className="font-bold text-slate-900">{email}</span></p>

                <Input
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-bold text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />

                <Button onClick={handleLogin} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 mt-4">
                  {loading ? <Loader2 className="animate-spin" /> : "Verify & Login"}
                </Button>

                <button onClick={() => setShowOtp(false)} className="text-sm font-bold text-slate-400 hover:text-slate-600 mt-4">
                  Back to Login
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-slate-400 font-bold">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Create Account</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}