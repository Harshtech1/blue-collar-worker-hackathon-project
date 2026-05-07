import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, MapPin, Package, DollarSign, Bell, Clock, CheckCircle, AlertCircle, MessageCircle, TrendingUp, ArrowRight, BarChart3, BellRing, X, Navigation, Shield, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { db } from '@/lib/db';
import ChatDrawer from '@/components/ChatDrawer';
import { JobRequestCard } from '@/components/worker/JobRequestCard';
import { toast } from 'sonner';
import { useJobRequests } from '@/hooks/useJobRequests';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  UploadedMedia,
  SECURE_MEDIA_LAYER_OFFLINE_MESSAGE,
  extractMediaUrl,
  isSecureMediaLayerOfflineError,
  uploadFile,
} from '@/lib/upload';
import { API_ROOT } from '@/lib/constants';





const WorkerDashboard = () => {
  const navigate = useNavigate();
  const { isOnline } = useOutletContext<{ isOnline: boolean }>();
  const { user, profile } = useAuth();
  const { socket } = useSocket();
  const { activeJobs, pendingJobs, allJobs, acceptJob, rejectJob, updateJobStatus, startJob, completeJob, expirePendingJob, refreshJobs } = useJobRequests();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [showReminders, setShowReminders] = useState(false);

  // OTP State
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpType, setOtpType] = useState<'start' | 'finish'>('start');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [proofMedia, setProofMedia] = useState<UploadedMedia | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [otpStep, setOtpStep] = useState<'capture' | 'otp'>('capture');
  const [secureMediaError, setSecureMediaError] = useState<string | null>(null);
  const [mediaLayerReady, setMediaLayerReady] = useState<boolean | null>(null);
  const uploadNoticeToastRef = useRef<string | number | null>(null);
  
  const [selectedChatJob, setSelectedChatJob] = useState<any>(null);
  const currentUserId = user?._id || localStorage.getItem('userId') || '';

  const [apiStats, setApiStats] = useState({ totalEarnings: 0, totalCompleted: 0, activeJobs: 0, monthlyStats: [] as any[] });

  // Fetch jobs and profile data
  useEffect(() => {
    if (user && profile?.role === 'worker' && isOnline) {
      fetchDashboardData();
    }
  }, [user, profile, isOnline]);

  useEffect(() => {
    let isMounted = true;

    const fetchMediaStatus = async () => {
      try {
        const res = await fetch(`${API_ROOT}/api/health`);
        if (!res.ok) throw new Error('Failed to read backend health');
        const data = await res.json();
        if (!isMounted) return;
        setMediaLayerReady(Boolean(data?.media?.secureUploadsReady));
      } catch {
        if (!isMounted) return;
        setMediaLayerReady(false);
      }
    };

    fetchMediaStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleWaterfallExpiry = (data: { bookingId?: string; message?: string }) => {
      if (data.bookingId) expirePendingJob(data.bookingId);
      toast.info(data.message || 'This booking moved to the next ranked worker.');
      refreshJobs();
    };

    socket.on('booking_ping_expired', handleWaterfallExpiry);
    socket.on('CLEAR_JOB', handleWaterfallExpiry);
    socket.on('JOB_EXPIRED', handleWaterfallExpiry);
    socket.on('WATERFALL_TIMEOUT', handleWaterfallExpiry);

    return () => {
      socket.off('booking_ping_expired', handleWaterfallExpiry);
      socket.off('CLEAR_JOB', handleWaterfallExpiry);
      socket.off('JOB_EXPIRED', handleWaterfallExpiry);
      socket.off('WATERFALL_TIMEOUT', handleWaterfallExpiry);
    };
  }, [socket, expirePendingJob, refreshJobs]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.PROD ? 'https://blue-collar-worker-hackathon-project.onrender.com' : (import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000');
      
      const res = await fetch(`${API_BASE}/api/notifications?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }

      // Fetch Real-Time Earnings Stats
      const statsRes = await fetch(`${API_BASE}/api/worker/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setApiStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Dynamic Stats combining real API aggregation with active frontend state
  const stats = {
    todayJobs: allJobs.filter(j => {
      const today = new Date().toDateString();
      const jobDate = j.scheduled_at ? new Date(j.scheduled_at).toDateString() : new Date(j.created_at).toDateString();
      return jobDate === today;
    }).length,
    completedJobs: apiStats.totalCompleted || allJobs.filter(j => j.status === 'completed' || j.paymentStatus === 'paid').length, 
    pendingJobs: pendingJobs.length + allJobs.filter(j => j.status === 'pending').length,
    activeJobsCount: apiStats.activeJobs || allJobs.filter(j => ['accepted', 'arriving', 'otp_verify', 'in_progress'].includes(j.status)).length,
    upcomingJobs: allJobs.filter(j => ['accepted', 'arriving', 'otp_verify', 'in_progress'].includes(j.status)).length + pendingJobs.length,
    earningsToday: allJobs
      .filter(j => (j.paymentStatus === 'paid'))
      .filter(j => {
        const date = new Date(j.updated_at || j.created_at);
        return !isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
      })
      .reduce((sum, j) => sum + (j.worker_earning || j.total_price || 0), 0),
    totalEarnings: apiStats.totalEarnings || allJobs
      .filter(j => (j.paymentStatus === 'paid'))
      .reduce((sum, j) => sum + (j.worker_earning || j.total_price || 0), 0)
  };

  const jobStatusData = [
    { name: 'Completed', value: stats.completedJobs, color: '#10b981' },
    { name: 'Active', value: stats.activeJobsCount, color: '#6366f1' },
    { name: 'Pending', value: stats.pendingJobs, color: '#f59e0b' },
  ];

  // Generate monthly comparison data from real jobs (last 6 months)
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; current: number; previous: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      months[key] = { month: label, current: 0, previous: 0 };
    }

    if (apiStats.monthlyStats && apiStats.monthlyStats.length > 0) {
      apiStats.monthlyStats.forEach(stat => {
        if (months[stat._id]) {
          months[stat._id].current = stat.earnings;
        }
      });
      return Object.values(months);
    }

    allJobs
      .filter(j => j.paymentStatus === 'paid')
      .forEach(j => {
        const d = new Date(j.updated_at || j.created_at);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) months[key].current += j.worker_earning || j.total_price || 0;
        // Previous year same month
        const prevKey = `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[prevKey]) months[prevKey].previous += j.worker_earning || j.total_price || 0;
      });
    return Object.values(months);
  }, [allJobs, apiStats.monthlyStats]);

  // Generate earning trend from completed jobs
  const earningsData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toDateString();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    const dayEarnings = allJobs
      .filter(j => (j.status === 'completed' || j.paymentStatus === 'paid') && new Date(j.updated_at || j.created_at).toDateString() === dateStr)
      .reduce((sum, j) => sum + (j.worker_earning || j.total_price || 0), 0);
      
    return { day: dayName, earnings: dayEarnings };
  });


  const handleStartJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setOtpType('start');
    setOtp('');
    setProofMedia(null);
    setProofUploading(false);
    setOtpStep('capture');
    setSecureMediaError(mediaLayerReady === false ? SECURE_MEDIA_LAYER_OFFLINE_MESSAGE : null);
    setOtpDialogOpen(true);
  };

  const handleCompleteJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setOtpType('finish');
    setOtp('');
    setProofMedia(null);
    setProofUploading(false);
    setOtpStep('capture');
    setSecureMediaError(mediaLayerReady === false ? SECURE_MEDIA_LAYER_OFFLINE_MESSAGE : null);
    setOtpDialogOpen(true);
  };

  const resetOtpDialog = () => {
    setOtp('');
    setProofMedia(null);
    setSelectedJobId(null);
    setProofUploading(false);
    setOtpStep('capture');
    setSecureMediaError(null);
  };

  const handleProofUpload = async (file: File | undefined) => {
    if (!file) return;
    if (mediaLayerReady === false) {
      setSecureMediaError(SECURE_MEDIA_LAYER_OFFLINE_MESSAGE);
      toast.error(SECURE_MEDIA_LAYER_OFFLINE_MESSAGE);
      return;
    }

    setSecureMediaError(null);
    setProofMedia(null);
    setOtpStep('capture');
    setProofUploading(true);
    const slowUploadTimer = window.setTimeout(() => {
      uploadNoticeToastRef.current = toast.loading('Still uploading... please wait.');
    }, 3000);
    try {
      const result = await uploadFile(file, 'bookingProof');
      if (result.error || !result.media) {
        throw new Error(result.error || 'Photo upload failed');
      }
      setProofMedia(result.media);
      setOtpStep('otp');
      toast.success(otpType === 'start' ? 'Before photo uploaded' : 'After photo uploaded');
    } catch (error: any) {
      const rawMessage = error.message || 'Unable to upload proof photo';
      const friendlyMessage = isSecureMediaLayerOfflineError(rawMessage)
        ? SECURE_MEDIA_LAYER_OFFLINE_MESSAGE
        : rawMessage;
      setSecureMediaError(friendlyMessage);
      setOtpStep('capture');
      toast.error(friendlyMessage);
    } finally {
      window.clearTimeout(slowUploadTimer);
      if (uploadNoticeToastRef.current !== null) {
        toast.dismiss(uploadNoticeToastRef.current);
        uploadNoticeToastRef.current = null;
      }
      setProofUploading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!selectedJobId) return;
    if (otpStep !== 'otp' || !proofMedia) {
      toast.error(otpType === 'start' ? 'Upload a before-work photo first.' : 'Upload an after-work photo first.');
      return;
    }
    
    if (otpType === 'start') {
      const result = await startJob(selectedJobId, otp, proofMedia);
      if (!result.error) {
        setOtpDialogOpen(false);
        resetOtpDialog();
      }
    } else {
      const result = await completeJob(selectedJobId, otp, proofMedia);
      if (!result.error) {
        setOtpDialogOpen(false);
        resetOtpDialog();
      }
    }
  };

  const handleMarkNotificationRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    toast.success('Notification marked as read');
  };

  const handleDismissReminder = (id: number) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success('Reminder dismissed');
  };

  const handleCallCustomer = (phone: string) => {
    toast.info(`Calling ${phone}...`);
    // In a real app, this would trigger a phone call
  };

  const handleStartNavigation = (address: string) => {
    toast.info(`Starting navigation to ${address}`);
    navigate('/worker/map');
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <div className="container mx-auto py-6 px-4 animate-fade-in">
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-gray-500" />
          <div>
            <h3 className="font-bold text-gray-800">You are currently Offline</h3>
            <p className="text-sm text-gray-600">You won't receive any job requests or notifications until you go back online.</p>
          </div>
        </div>
      )}

      {/* Reminder Banner */}
      {reminders.filter(r => r.urgent).length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-300 rounded-xl animate-pulse">
          <div className="flex items-center gap-3">
            <BellRing className="h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-800">Upcoming Job Reminder</h3>
              <p className="text-sm text-amber-700">
                {reminders.find(r => r.urgent)?.title} - {reminders.find(r => r.urgent)?.time} {reminders.find(r => r.urgent)?.date}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-amber-500 text-amber-700 hover:bg-amber-100"
              onClick={() => setShowReminders(true)}
            >
              View All
            </Button>
          </div>
        </div>
      )}

      <div className="mb-8 p-6 bg-gradient-to-r from-worker-primary/5 to-worker-secondary/5 rounded-2xl border border-worker-primary/10 animate-slide-in-left">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-3 w-3 rounded-full bg-worker-accent animate-pulse"></div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome back, {profile?.full_name || 'Worker'}!</h1>
            </div>
            <p className="text-gray-700 font-medium">Here's what's happening with your work today.</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-worker-primary">
              <div className="h-2 w-2 rounded-full bg-worker-accent animate-pulse"></div>
              <span>You have {stats.todayJobs} jobs scheduled for today!</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="relative"
              onClick={() => navigate('/worker/notifications')}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowReminders(true)}
            >
              <BellRing className="h-5 w-5 text-amber-500" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-fade-in-up">
        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-worker-light/10 border-worker-primary/20 hover:border-worker-primary/40 hover-lift cursor-pointer" onClick={() => navigate('/worker/jobs')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Today's Jobs</CardTitle>
            <div className="p-2 rounded-lg bg-worker-primary/10">
              <Package className="h-5 w-5 text-worker-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.todayJobs}</div>
            <div className="flex items-center mt-1">
              <span className="text-sm font-medium text-green-600">↗ +{stats.todayJobs}</span>
              <span className="text-xs text-gray-500 ml-1">from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-worker-secondary/10 border-worker-secondary/20 hover:border-worker-secondary/40 hover-lift cursor-pointer" onClick={() => navigate('/worker/jobs')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Completed</CardTitle>
            <div className="p-2 rounded-lg bg-worker-secondary/10">
              <CheckCircle className="h-5 w-5 text-worker-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.completedJobs}</div>
            <p className="text-xs text-gray-600 mt-1">Total jobs completed</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-worker-secondary h-2 rounded-full" 
                style={{width: `${stats.completedJobs > 0 ? Math.min(100, (stats.completedJobs / (stats.completedJobs + stats.pendingJobs)) * 100) : 0}%`}}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-worker-accent/10 border-worker-accent/20 hover:border-worker-accent/40 hover-lift cursor-pointer" onClick={() => navigate('/worker/jobs')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Pending</CardTitle>
            <div className="p-2 rounded-lg bg-worker-accent/10">
              <AlertCircle className="h-5 w-5 text-worker-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.pendingJobs}</div>
            <p className="text-xs text-gray-600 mt-1">Jobs in progress</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-worker-accent h-2 rounded-full animate-pulse" 
                  style={{width: '65%'}}
                ></div>
              </div>
              <span className="text-xs text-worker-accent font-medium">65%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-amber-50 border-amber-300/30 hover:border-amber-400/50 hover-lift cursor-pointer" onClick={() => navigate('/worker/earnings')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Today's Earnings</CardTitle>
            <div className="p-2 rounded-lg bg-amber-100">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">₹{stats.earningsToday.toLocaleString()}</div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm font-medium text-green-600">+12%</span>
              <span className="text-xs text-gray-500 ml-1">vs yesterday</span>
            </div>
            <div className="mt-2 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full inline-block">
              Keep up the great work!
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Weekly Earnings Chart */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-worker-primary" />
              Weekly Earnings
            </CardTitle>
            <CardDescription>Your earnings over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value: number) => [`₹${value}`, 'Earnings']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorEarnings)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Job Status Pie Chart */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-worker-secondary" />
              Job Status Overview
            </CardTitle>
            <CardDescription>Distribution of your jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={jobStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {jobStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Chart */}
      <Card className="mb-8 hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Monthly Earnings Comparison
          </CardTitle>
          <CardDescription>Compare your earnings with previous months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                />
                <Legend />
                <Bar dataKey="current" name="This Year" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="previous" name="Last Year" fill="#d1d5db" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Jobs */}
        <div className="lg:col-span-2">
          <Card className="mb-6 overflow-hidden border-amber-300/30 bg-gradient-to-br from-white via-amber-50/40 to-indigo-50/40 shadow-sm transition-all duration-300 hover:shadow-lg">
            <CardHeader className="border-b border-amber-200/50 bg-gradient-to-r from-amber-50 to-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <div className="rounded-lg bg-amber-100 p-2">
                      <BellRing className="h-5 w-5 text-amber-600" />
                    </div>
                    Timed Offers
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-600">
                    New waterfall requests stay with you for 15 seconds before moving to the next worker.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                  {pendingJobs.length} live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {pendingJobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-900">No timed offers right now</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Stay online and we&apos;ll surface the next nearby request here first.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingJobs.slice(0, 3).map((job) => (
                    <JobRequestCard
                      key={job.id}
                      job={job}
                      onAccept={acceptJob}
                      onReject={rejectJob}
                      variant="pending"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 hover-lift border-worker-primary/10">
            <CardHeader className="bg-gradient-to-r from-worker-primary/5 to-worker-secondary/5">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <div className="p-2 rounded-lg bg-worker-primary/10">
                  <Package className="h-5 w-5 text-worker-primary" />
                </div>
                Active Jobs
              </CardTitle>
              <CardDescription className="text-gray-600">Your latest accepted or in-progress requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeJobs.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">No active jobs right now.</div>
                ) : (
                  activeJobs.map((job, index) => (
                    <div key={job.id || (job as any)._id || index} className="flex items-center justify-between p-4 border rounded-xl hover:bg-worker-light/20 transition-all duration-300 hover-scale border-worker-primary/10 animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{job.category?.icon || '🛠️'}</span>
                          <h3 className="font-bold text-gray-900">{job.category?.name || 'Service'}</h3>
                          <Badge 
                            variant={
                              job.status === 'completed' ? 'default' :
                              job.status === 'pending' ? 'secondary' :
                              job.status === 'in_progress' ? 'outline' :
                              'destructive'
                            }
                            className={
                              job.status === 'completed' ? 'bg-green-500 hover:bg-green-600' :
                              job.status === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' :
                              job.status === 'in_progress' ? 'border-blue-500 text-blue-600 bg-blue-50' :
                              job.status === 'accepted' || job.status === 'arriving' || job.status === 'otp_verify' ? 'border-purple-500 text-purple-600 bg-purple-50' :
                              'bg-red-500 hover:bg-red-600'
                            }
                          >
                            {job.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Clock className="h-4 w-4" />
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="h-4 w-4" />
                          {job.address} {job.city ? `, ${job.city}` : ''}
                        </p>
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-sm font-medium text-gray-700">{job.customer?.full_name || 'Customer'}</span>
                          <span className="text-sm font-bold text-green-600">₹{job.worker_earning || job.total_price}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        {job.status === 'accepted' && (
                          <Button 
                            size="sm"
                            className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
                            onClick={() => updateJobStatus(job.id, 'arriving')}
                          >
                            <Navigation className="w-4 h-4 mr-2" />
                            On the Way
                          </Button>
                        )}
                        {job.status === 'arriving' && (
                          <Button 
                            size="sm"
                            className="w-full bg-amber-600 hover:bg-amber-700 font-bold"
                            onClick={() => updateJobStatus(job.id, 'otp_verify')}
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Arrived
                          </Button>
                        )}
                        {job.status === 'otp_verify' && (
                          <>
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-[11px] font-bold leading-snug text-blue-800">
                              <div className="flex items-center gap-1.5">
                                <Camera className="h-3.5 w-3.5" />
                                Before photo required
                              </div>
                              <p className="mt-0.5 text-[10px] font-semibold text-blue-600">Upload proof before entering OTP.</p>
                            </div>
                            <Button 
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
                              onClick={() => handleStartJob(job.id)}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Proof + OTP
                            </Button>
                          </>
                        )}
                        {job.status === 'in_progress' && (
                          <>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] font-bold leading-snug text-emerald-800">
                              <div className="flex items-center gap-1.5">
                                <Camera className="h-3.5 w-3.5" />
                                After photo required
                              </div>
                              <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">Upload completion proof before final OTP.</p>
                            </div>
                            <Button 
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-700 font-bold"
                              onClick={() => handleCompleteJob(job.id)}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Proof + Complete
                            </Button>
                          </>
                        )}
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="w-full text-xs font-bold bg-worker-primary/10 text-worker-primary hover:bg-worker-primary/20 border-worker-primary/20 transition-all active:scale-95"
                          onClick={() => setSelectedChatJob(job)}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Chat Customer
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full text-xs"
                          onClick={() => handleStartNavigation(job.address)}
                        >
                          Navigate Map
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/worker/jobs')}
              >
                View All Jobs
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Notifications & Upcoming */}
        <div className="space-y-6">
          {/* Upcoming Jobs */}
          <Card className="hover:shadow-lg transition-all duration-300 hover-lift border-worker-secondary/20">
            <CardHeader className="bg-gradient-to-r from-worker-secondary/10 to-worker-accent/10">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <div className="p-2 rounded-lg bg-worker-secondary/10">
                  <Clock className="h-5 w-5 text-worker-secondary" />
                </div>
                Upcoming Jobs
              </CardTitle>
              <CardDescription className="text-gray-600">Jobs you need to complete</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-worker-light/20 rounded-lg">
                  <span className="font-medium text-gray-700">Total Upcoming</span>
                  <Badge variant="outline" className="bg-worker-secondary/10 text-worker-secondary border-worker-secondary/30 text-lg px-3 py-1">
                    {stats.upcomingJobs}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-medium text-gray-700">
                    <span>Pending Jobs</span>
                    <span className="text-worker-accent">{stats.pendingJobs}</span>
                  </div>
                  <Progress value={(stats.completedJobs / (stats.completedJobs + stats.pendingJobs)) * 100 || 0} className="h-3 bg-gray-200" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Completed: {stats.completedJobs}</span>
                    <span>In Progress: {stats.pendingJobs}</span>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Great progress! Keep going!</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="hover:shadow-lg transition-all duration-300 hover-lift border-worker-accent/20">
            <CardHeader className="bg-gradient-to-r from-worker-accent/10 to-amber-50">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <div className="p-2 rounded-lg bg-worker-accent/10">
                  <Bell className="h-5 w-5 text-worker-accent" />
                </div>
                Notifications
                {unreadNotifications > 0 && (
                  <Badge className="bg-red-500 text-white ml-2">{unreadNotifications} new</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-gray-600">Your recent alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.slice(0, 4).map((notification, index) => (
                  <div 
                    key={notification.id || notification._id || index} 
                    className={`p-4 rounded-xl border transition-all duration-300 hover-scale animate-fade-in cursor-pointer ${
                      notification.read 
                        ? 'bg-gray-50 border-gray-100' 
                        : 'bg-gradient-to-r from-worker-light/20 to-transparent border-worker-accent/20'
                    }`}
                    style={{animationDelay: `${index * 0.1}s`}}
                    onClick={() => handleMarkNotificationRead(notification.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${notification.read ? 'text-gray-600' : 'text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-worker-accent animate-pulse ml-2"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/worker/notifications')}
              >
                View All Notifications
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <Card className="hover:shadow-lg transition-all duration-300 hover-lift border-worker-primary/10">
          <CardHeader className="bg-gradient-to-r from-worker-primary/5 to-worker-secondary/5">
            <CardTitle className="text-gray-900">Quick Actions</CardTitle>
            <CardDescription className="text-gray-600">Manage your work efficiently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="flex flex-col items-start h-auto py-5 gap-2 border-worker-primary/30 text-worker-primary hover:bg-worker-primary hover:text-white transition-all duration-300 hover-scale rounded-xl"
                onClick={() => navigate('/worker/schedule')}
              >
                <Calendar className="h-6 w-6" />
                <span className="font-bold">View Schedule</span>
                <span className="text-xs opacity-90">Manage your appointments</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex flex-col items-start h-auto py-5 gap-2 border-worker-accent/30 text-worker-accent hover:bg-worker-accent hover:text-white transition-all duration-300 hover-scale rounded-xl"
                onClick={() => navigate('/worker/earnings')}
              >
                <DollarSign className="h-6 w-6" />
                <span className="font-bold">View Earnings</span>
                <span className="text-xs opacity-90">See your income</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex flex-col items-start h-auto py-5 gap-2 border-blue-300 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 hover-scale rounded-xl"
                onClick={() => navigate('/worker/map')}
              >
                <MapPin className="h-6 w-6" />
                <span className="font-bold">Open Map</span>
                <span className="text-xs opacity-90">View job locations</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex flex-col items-start h-auto py-5 gap-2 border-gray-300 text-gray-700 hover:bg-gray-700 hover:text-white transition-all duration-300 hover-scale rounded-xl" 
                onClick={() => activeJobs.length > 0 ? setSelectedChatJob(activeJobs[0]) : toast.info('No active jobs to chat')}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="font-bold">Chat</span>
                <span className="text-xs opacity-90">Communicate with customer</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Component */}
      {selectedChatJob && (
        <ChatDrawer
          isOpen={!!selectedChatJob}
          onClose={() => setSelectedChatJob(null)}
          bookingId={selectedChatJob.id || selectedChatJob._id}
          currentUserId={selectedChatJob.worker_user_id || selectedChatJob.workerUserId || currentUserId}
          otherUserId={
            selectedChatJob.customer_user_id
            || selectedChatJob.customerUserId
            || selectedChatJob.customer?.user
            || selectedChatJob.customer?._id
            || selectedChatJob.customer_id
            || ''
          }
          otherUserName={selectedChatJob.customer?.full_name || 'Customer'}
        />
      )}

      {/* Reminders Modal */}
      {showReminders && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-amber-500" />
                Upcoming Reminders
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowReminders(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reminders.map((reminder, index) => (
                  <div 
                    key={reminder.id || reminder._id || index} 
                    className={`p-4 rounded-xl border ${reminder.urgent ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{reminder.title}</h4>
                        <p className="text-sm text-gray-600">{reminder.time} - {reminder.date}</p>
                        <p className="text-xs text-gray-500 mt-1">Customer: {reminder.customer}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDismissReminder(reminder.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {reminders.length === 0 && (
                  <div className="text-center py-8">
                    <BellRing className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No upcoming reminders</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* OTP Dialog */}
      <Dialog open={otpDialogOpen} onOpenChange={(open) => {
        setOtpDialogOpen(open);
        if (!open) {
          resetOtpDialog();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {otpType === 'start' ? 'Enter Customer OTP to Start' : 'Enter Customer OTP to Finish'}
            </DialogTitle>
            <DialogDescription>
              {otpType === 'start' 
                ? 'Upload a photo of the work site, then ask the customer for the 4-digit OTP shown on their tracking screen to start the job.' 
                : 'Upload a photo of the finished work, then ask the customer for the 4-digit completion OTP to finish the job and process payment.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
              <Shield className="h-4 w-4" />
              Secure OTP verification. This step is audited by RAHI.
            </div>
            {secureMediaError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {secureMediaError}
              </div>
            )}
            <Input
              id="dashboard-proof-photo"
              type="file"
              accept="image/*"
              capture="environment"
              disabled={proofUploading}
              onChange={(e) => handleProofUpload(e.target.files?.[0])}
              className="sr-only"
            />
            {otpStep === 'capture' ? (
              <div className="space-y-3">
                <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">
                  Step 1 of 2 - Secure proof capture
                </div>
                {mediaLayerReady === null ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                    Checking secure media layer...
                  </div>
                ) : mediaLayerReady ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">
                      {otpType === 'start' ? 'Before-work proof photo' : 'After-work proof photo'}
                    </Label>
                    <Label
                      htmlFor="dashboard-proof-photo"
                      aria-disabled={proofUploading}
                      className={`flex min-h-28 cursor-pointer flex-col justify-center rounded-2xl border-2 border-dashed p-5 transition ${
                        proofUploading
                          ? 'pointer-events-none border-indigo-200 bg-indigo-50 opacity-80'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      <span className="text-base font-black">
                        {otpType === 'start' ? 'Capture Work-Site Proof' : 'Capture Finished-Work Proof'}
                      </span>
                      <span className="mt-1 text-xs font-medium text-muted-foreground">
                        The OTP field appears only after RAHI securely uploads this photo.
                      </span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      RAHI compresses the image under 500KB for faster upload in low-signal areas.
                    </p>
                    {proofUploading && (
                      <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm font-medium text-indigo-700">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        Streaming proof photo to the secure media layer...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                    {SECURE_MEDIA_LAYER_OFFLINE_MESSAGE}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Step 2 of 2 - OTP verification unlocked
                </div>
                {proofMedia && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <CheckCircle className="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-emerald-800">Proof photo uploaded</p>
                          <p className="text-xs text-emerald-700">RAHI verified job proof is attached to this OTP step.</p>
                        </div>
                      </div>
                      {extractMediaUrl(proofMedia) && (
                        <img
                          src={extractMediaUrl(proofMedia) || ''}
                          alt="Proof preview"
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                    </div>
                    <Label
                      htmlFor="dashboard-proof-photo"
                      aria-disabled={proofUploading}
                      className={`mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-300 px-4 text-sm font-semibold text-emerald-800 transition ${
                        proofUploading ? 'pointer-events-none opacity-70' : 'hover:border-emerald-400 hover:bg-emerald-100'
                      }`}
                    >
                      Retake photo
                    </Label>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="otp">OTP Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 4-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    disabled={proofUploading}
                    className="h-14 text-center text-2xl tracking-widest"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpDialogOpen(false)}>
              Cancel
            </Button>
            {otpStep === 'otp' ? (
              <Button onClick={handleVerifyOTP} disabled={otp.length !== 4 || !proofMedia || proofUploading}>
                {otpType === 'start' ? 'Verify & Start' : 'Verify & Finish'}
              </Button>
            ) : (
              <Button disabled>
                {mediaLayerReady === null
                  ? 'Checking Secure Media...'
                  : proofUploading
                    ? 'Uploading Proof...'
                    : mediaLayerReady
                      ? 'Capture Proof First'
                      : 'Secure Media Offline'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerDashboard;
