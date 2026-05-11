import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Step = 'request' | 'verify' | 'reset';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { requestPasswordResetOtp, verifyPasswordResetOtp, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRequestOtp = async () => {
    if (!email.trim()) {
      toast.error('Enter your email address first');
      return;
    }

    setLoading(true);
    const { data, error } = await requestPasswordResetOtp(email);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(data?.message || 'If your account exists, a reset OTP has been sent.');
    setStep('verify');
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      toast.error('Enter the 6-digit OTP from your email');
      return;
    }

    setLoading(true);
    const { data, error } = await verifyPasswordResetOtp(email, otp);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setResetToken(data?.resetToken || '');
    setStep('reset');
    toast.success('OTP verified. You can now create a new password.');
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const { data, error } = await resetPassword(email, resetToken, newPassword);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(data?.message || 'Password reset successful');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_24%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-xl rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/60"
      >
        <div className="mb-8 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/login')} className="rounded-full bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Secure recovery
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-900">Reset your password</h1>
          <p className="mt-3 text-base font-medium text-slate-500">
            We will send a one-time OTP to your email, verify it, and then let you set a new password.
          </p>
        </div>

        <div className="mb-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
          <div className={`h-2 flex-1 rounded-full ${step === 'request' ? 'bg-slate-900' : 'bg-emerald-500'}`} />
          <div className={`h-2 flex-1 rounded-full ${step === 'verify' ? 'bg-slate-900' : step === 'reset' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          <div className={`h-2 flex-1 rounded-full ${step === 'reset' ? 'bg-slate-900' : 'bg-slate-200'}`} />
        </div>

        {step === 'request' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-12 font-semibold"
                />
              </div>
            </div>

            <Button onClick={handleRequestOtp} disabled={loading} className="h-14 w-full rounded-2xl text-base font-black">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send reset OTP'}
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              We sent a 6-digit OTP to <span className="font-black">{email}</span>.
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Password reset OTP</Label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-12 text-center text-2xl font-black tracking-[0.4em]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('request')} className="h-14 flex-1 rounded-2xl font-bold">
                Change email
              </Button>
              <Button onClick={handleVerifyOtp} disabled={loading} className="h-14 flex-1 rounded-2xl font-black">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify OTP'}
              </Button>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              OTP verified. Set a strong password for your RAHI account.
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">New password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder="At least 8 characters"
                  className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-12 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Re-enter your new password"
                  className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-12 font-semibold"
                />
              </div>
            </div>

            <Button onClick={handleResetPassword} disabled={loading} className="h-14 w-full rounded-2xl text-base font-black">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset password'}
            </Button>
          </div>
        )}

        <p className="mt-8 text-center text-sm font-bold text-slate-400">
          Back to <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
