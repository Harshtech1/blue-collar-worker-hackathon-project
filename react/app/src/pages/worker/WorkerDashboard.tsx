import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, MapPin, Package, DollarSign, Bell, Clock, CheckCircle, AlertCircle, MessageCircle, TrendingUp, ArrowRight, BarChart3, BellRing, X, Play, Navigation } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { db } from '@/lib/db';
import ChatComponent from '@/components/chat/ChatComponent';
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



// Mock monthly comparison data
const monthlyData = [
  { month: 'Jan', current: 18500, previous: 15200 },
  { month: 'Feb', current: 22300, previous: 18900 },
  { month: 'Mar', current: 24500, previous: 21000 },
];

// Dynamic Data replaces mock ones

const WorkerDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeJobs, pendingJobs, allJobs, updateJobStatus, startJob, completeJob } = useJobRequests();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  // OTP State
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpType, setOtpType] = useState<'start' | 'finish'>('start');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  // Fetch jobs and profile data
  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchDashboardData();
    }
  }, [user, profile]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
      
      const res = await fetch(`${API_BASE}/api/notifications?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Dynamic Stats calculated from real jobs
  const stats = {
    todayJobs: allJobs.filter(j => {
      const today = new Date().toDateString();
      const jobDate = j.scheduled_at ? new Date(j.scheduled_at).toDateString() : new Date(j.created_at).toDateString();
      return jobDate === today;
    }).length,
    completedJobs: allJobs.filter(j => j.status === 'completed' || j.paymentStatus === 'paid').length, 
    pendingJobs: pendingJobs.length + allJobs.filter(j => j.status === 'pending').length,
    activeJobsCount: allJobs.filter(j => ['accepted', 'arriving', 'otp_verify', 'in_progress'].includes(j.status)).length,
    upcomingJobs: allJobs.filter(j => ['accepted', 'arriving', 'otp_verify', 'in_progress'].includes(j.status)).length + pendingJobs.length,
    earningsToday: allJobs
      .filter(j => (j.paymentStatus === 'paid'))
      .filter(j => {
        const date = new Date(j.updated_at || j.created_at);
        return !isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
      })
      .reduce((sum, j) => sum + (j.worker_earning || j.total_price || 0), 0),
    totalEarnings: allJobs
      .filter(j => (j.paymentStatus === 'paid'))
      .reduce((sum, j) => sum + (j.worker_earning || j.total_price || 0), 0)
  };

  const jobStatusData = [
    { name: 'Completed', value: stats.completedJobs, color: '#10b981' },
    { name: 'Active', value: stats.activeJobsCount, color: '#6366f1' },
    { name: 'Pending', value: stats.pendingJobs, color: '#f59e0b' },
  ];

  // Generate earnings trend from completed jobs
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
    setOtpDialogOpen(true);
  };

  const handleCompleteJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setOtpType('finish');
    setOtpDialogOpen(true);
  };

  const handleVerifyOTP = async () => {
    if (!selectedJobId) return;
    
    if (otpType === 'start') {
      const result = await startJob(selectedJobId, otp);
      if (!result.error) {
        setOtpDialogOpen(false);
        setOtp('');
        setSelectedJobId(null);
      }
    } else {
      const result = await completeJob(selectedJobId, otp);
      if (!result.error) {
        setOtpDialogOpen(false);
        setOtp('');
        setSelectedJobId(null);
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
                          <Button 
                            size="sm"
                            className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
                            onClick={() => handleStartJob(job.id)}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Enter OTP
                          </Button>
                        )}
                        {job.status === 'in_progress' && (
                          <Button 
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700 font-bold"
                            onClick={() => handleCompleteJob(job.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Complete
                          </Button>
                        )}
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
                onClick={() => setShowChat(true)}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="font-bold">Chat</span>
                <span className="text-xs opacity-90">Communicate with team</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Component */}
      {showChat && (
        <div className="fixed bottom-4 right-4 z-50 w-96 h-[500px]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Worker Chat</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ChatComponent title="Worker Chat" />
            </CardContent>
          </Card>
        </div>
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
      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {otpType === 'start' ? 'Enter Customer OTP to Start' : 'Enter Customer OTP to Finish'}
            </DialogTitle>
            <DialogDescription>
              {otpType === 'start' 
                ? 'Ask the customer for the 4-digit OTP shown on their tracking screen to start the job.' 
                : 'Ask the customer for the 4-digit completion OTP to finish the job and process payment.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 4-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className="text-center text-2xl tracking-widest h-14"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerifyOTP} disabled={otp.length !== 4}>
              {otpType === 'start' ? 'Verify & Start' : 'Verify & Finish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerDashboard;