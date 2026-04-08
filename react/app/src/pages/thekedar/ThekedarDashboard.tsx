import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Bell, 
  Users,
  TrendingUp,
  ArrowRight,
  BarChart3,
  PieChart as PieChartIcon,
  BellRing,
  X,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
// import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  Legend,
  LineChart,
  Line
} from 'recharts';

// Mock data for charts
const revenueData = [
  { month: 'Jan', revenue: 125000, commission: 12500 },
  { month: 'Feb', revenue: 148000, commission: 14800 },
  { month: 'Mar', revenue: 165000, commission: 16500 },
  { month: 'Apr', revenue: 182000, commission: 18200 },
  { month: 'May', revenue: 195000, commission: 19500 },
  { month: 'Jun', revenue: 210000, commission: 21000 },
];

const projectStatusData = [
  { name: 'Completed', value: 45, color: '#10b981' },
  { name: 'In Progress', value: 12, color: '#f59e0b' },
  { name: 'Scheduled', value: 8, color: '#6366f1' },
  { name: 'Pending', value: 5, color: '#ef4444' },
];

const teamPerformanceData = [
  { name: 'Ramesh', jobs: 28, rating: 4.8 },
  { name: 'Suresh', jobs: 24, rating: 4.6 },
  { name: 'Mohan', jobs: 22, rating: 4.7 },
  { name: 'Ravi', jobs: 18, rating: 4.5 },
  { name: 'Amit', jobs: 15, rating: 4.4 },
];

const weeklyVisitsData = [
  { day: 'Mon', visits: 4, completed: 3 },
  { day: 'Tue', visits: 6, completed: 5 },
  { day: 'Wed', visits: 3, completed: 3 },
  { day: 'Thu', visits: 5, completed: 4 },
  { day: 'Fri', visits: 7, completed: 6 },
  { day: 'Sat', visits: 8, completed: 7 },
  { day: 'Sun', visits: 2, completed: 2 },
];

// Dummy site visits
const dummySiteVisits = [
  {
    id: '1',
    customer: 'Rajesh Sharma',
    address: '123, Sector 15, Noida',
    phone: '+91 98765 43210',
    status: 'scheduled',
    date: '2024-01-29',
    time: '10:00 AM',
    service: 'AC Installation',
    estimatedAmount: 15000,
  },
  {
    id: '2',
    customer: 'Priya Gupta',
    address: '456, Green Park, Delhi',
    phone: '+91 87654 32109',
    status: 'pending',
    date: '2024-01-30',
    time: '2:00 PM',
    service: 'Home Renovation',
    estimatedAmount: 85000,
  },
  {
    id: '3',
    customer: 'Amit Verma',
    address: '789, Model Town, Gurgaon',
    phone: '+91 76543 21098',
    status: 'completed',
    date: '2024-01-27',
    time: '11:00 AM',
    service: 'Electrical Work',
    estimatedAmount: 25000,
  },
];

// Dummy notifications
const dummyNotifications = [
  { id: 1, title: 'New site visit request from Priya Gupta', titleHi: 'प्रिया गुप्ता से नई साइट विजिट अनुरोध', type: 'visit', time: '2 hours ago', read: false },
  { id: 2, title: 'Ramesh completed AC Installation job', titleHi: 'रमेश ने एसी इंस्टॉलेशन कार्य पूरा किया', type: 'job', time: '5 hours ago', read: false },
  { id: 3, title: 'Payment of ₹15,000 received', titleHi: '₹15,000 का भुगतान प्राप्त हुआ', type: 'payment', time: '1 day ago', read: true },
  { id: 4, title: 'New team member request', titleHi: 'नई टीम सदस्य अनुरोध', type: 'team', time: '2 days ago', read: true },
];

// Dummy reminders
const dummyReminders = [
  { id: 1, title: 'Site visit at Sector 15', titleHi: 'सेक्टर 15 में साइट विजिट', time: '10:00 AM', date: 'Tomorrow', customer: 'Rajesh Sharma', urgent: true },
  { id: 2, title: 'Team meeting', titleHi: 'टीम मीटिंग', time: '3:00 PM', date: 'Tomorrow', customer: 'All team', urgent: false },
  { id: 3, title: 'Project deadline: Model Town', titleHi: 'प्रोजेक्ट डेडलाइन: मॉडल टाउन', time: '6:00 PM', date: 'Day After', customer: 'Amit Verma', urgent: true },
];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── CSV Export Utility ────────────────────────────────────────────────────────
const downloadTeamEarningsReport = (teamData: typeof teamPerformanceData, statsData: typeof revenueData) => {
  const today = new Date().toISOString().split('T')[0];
  
  // --- Sheet 1: Team Performance ---
  const teamHeaders = 'Worker Name,Jobs Completed,Rating (/ 5)\n';
  const teamRows = teamData
    .map(w => `"${w.name}",${w.jobs},${w.rating}`)
    .join('\n');

  // --- Sheet 2: Monthly Revenue Trend ---
  const revenueHeaders = '\n\nMonth,Revenue (INR),Commission (INR)\n';
  const revenueRows = statsData
    .map(r => `${r.month},${r.revenue},${r.commission}`)
    .join('\n');

  const csvContent = teamHeaders + teamRows + revenueHeaders + revenueRows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('hidden', '');
  link.setAttribute('href', url);
  link.setAttribute('download', `RAHI_Team_Report_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
// ──────────────────────────────────────────────────────────────────────────────

const ThekedarDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [stats, setStats] = useState({
    upcomingVisits: 0,
    activeProjects: 0,
    teamMembers: 0,
    totalEarnings: 0,
    monthlyEarnings: 0,
    commissionEarned: 0,
    projectCompletionRate: 0,
    totalJobs: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  
  const fetchStats = async () => {
    if (!user || profile?.role !== 'thekedar') return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/thekedar/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      
      // Map backend data to frontend stats
      setStats({
        upcomingVisits: data.activeJobs || 0, // Using active jobs as a proxy for upcoming for now
        activeProjects: data.activeJobs || 0,
        teamMembers: data.teamSize || 0,
        totalEarnings: data.totalEarnings || 0,
        monthlyEarnings: data.totalEarnings / 12, // Rough estimate if trend data isn't parsed yet
        commissionEarned: (data.totalEarnings || 0) * 0.1, // Assuming 10% commission
        projectCompletionRate: data.totalJobs > 0 ? Math.round(((data.totalJobs - data.activeJobs) / data.totalJobs) * 100) : 0,
        totalJobs: data.totalJobs || 0
      });
      
      // You could also update revenueData chart with data.monthlyTrends if available
    } catch (err) {
      console.error(err);
      // toast.error('Failed to load dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user, profile]);
  
  const [siteVisits, setSiteVisits] = useState(dummySiteVisits);
  const [notifications, setNotifications] = useState(dummyNotifications);
  const [reminders, setReminders] = useState(dummyReminders);
  const [showReminders, setShowReminders] = useState(false);

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleMarkNotificationRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    toast.success(language === 'hi' ? 'अधिसूचना पढ़ा के रूप में चिह्नित' : 'Notification marked as read');
  };

  const handleDismissReminder = (id: number) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success(language === 'hi' ? 'रिमाइंडर खारिज' : 'Reminder dismissed');
  };

  const handleCallCustomer = (phone: string) => {
    toast.info(language === 'hi' ? `${phone} पर कॉल कर रहे हैं...` : `Calling ${phone}...`);
  };

  const handleStartNavigation = (address: string) => {
    toast.info(language === 'hi' ? `${address} पर नेविगेट कर रहे हैं` : `Starting navigation to ${address}`);
    navigate('/thekedar/map');
  };

  return (
    <div className="space-y-6">
      {/* Reminder Banner */}
      {reminders.filter(r => r.urgent).length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-300 rounded-xl animate-pulse">
          <div className="flex items-center gap-3">
            <BellRing className="h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-800">
                {language === 'hi' ? 'आगामी कार्य अनुस्मारक' : 'Upcoming Work Reminder'}
              </h3>
              <p className="text-sm text-amber-700">
                {language === 'hi' 
                  ? reminders.find(r => r.urgent)?.titleHi 
                  : reminders.find(r => r.urgent)?.title} - {reminders.find(r => r.urgent)?.time} {reminders.find(r => r.urgent)?.date}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-amber-500 text-amber-700 hover:bg-amber-100"
              onClick={() => setShowReminders(true)}
            >
              {language === 'hi' ? 'सभी देखें' : 'View All'}
            </Button>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <div className="p-6 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-2xl border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {language === 'hi' 
                ? `स्वागत है, ${profile?.full_name || 'ठेकेदार'}!` 
                : `Welcome back, ${profile?.full_name || 'Thekedar'}!`}
            </h1>
            <p className="text-muted-foreground mt-2">
              {language === 'hi' 
                ? 'अपनी टीम और प्रोजेक्ट्स को कुशलता से प्रबंधित करें' 
                : 'Manage your team and projects efficiently'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
              <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></div>
              <span>
                {language === 'hi' 
                  ? `आज आपके ${stats.upcomingVisits} साइट विजिट हैं!` 
                  : `You have ${stats.upcomingVisits} site visits scheduled!`}
              </span>
            </div>
          </div>
        <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="relative"
              onClick={() => navigate('/thekedar/notifications')}
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
            {/* CSV Report Download */}
            <Button
              variant="outline"
              className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all"
              onClick={() => {
                downloadTeamEarningsReport(teamPerformanceData, revenueData);
                toast.success(
                  language === 'hi'
                    ? 'रिपोर्ट डाउनलोड हो रही है...'
                    : 'Downloading monthly report as CSV...'
                );
              }}
              title="Download Monthly Report"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">
                {language === 'hi' ? 'रिपोर्ट डाउनलोड' : 'Download Report'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-purple-50 border-purple-200 cursor-pointer" onClick={() => navigate('/thekedar/site-visits')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'hi' ? 'आगामी विजिट' : 'Upcoming Visits'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-100">
              <MapPin className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingVisits}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'hi' ? 'साइट विजिट निर्धारित' : 'Site visits scheduled'}
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto text-purple-600 mt-2"
              onClick={(e) => { e.stopPropagation(); navigate('/thekedar/site-visits'); }}
            >
              {language === 'hi' ? 'सभी देखें' : 'View all'} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50 border-blue-200 cursor-pointer" onClick={() => navigate('/thekedar/projects')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'hi' ? 'सक्रिय प्रोजेक्ट्स' : 'Active Projects'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-100">
              <Briefcase className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'hi' ? 'प्रगति में प्रोजेक्ट्स' : 'Projects in progress'}
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto text-blue-600 mt-2"
              onClick={(e: any) => { e.stopPropagation(); navigate('/thekedar/projects'); }}
            >
              {language === 'hi' ? 'सभी देखें' : 'View all'} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-green-50 border-green-200 cursor-pointer" onClick={() => navigate('/thekedar/team')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'hi' ? 'टीम सदस्य' : 'Team Members'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-100">
              <Users className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teamMembers}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'hi' ? 'सक्रिय टीम सदस्य' : 'Active team members'}
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto text-green-600 mt-2"
              onClick={(e: any) => { e.stopPropagation(); navigate('/thekedar/team'); }}
            >
              {language === 'hi' ? 'टीम प्रबंधित करें' : 'Manage team'} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-amber-50 border-amber-200 cursor-pointer" onClick={() => navigate('/thekedar/earnings')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'hi' ? 'मासिक आय' : 'Monthly Earnings'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-100">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.monthlyEarnings.toLocaleString()}</div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm font-medium text-green-600">+15%</span>
              <span className="text-xs text-muted-foreground ml-1">
                {language === 'hi' ? 'पिछले महीने से' : 'vs last month'}
              </span>
            </div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-amber-600 mt-2"
              onClick={(e: any) => { e.stopPropagation(); navigate('/thekedar/earnings'); }}
            >
              {language === 'hi' ? 'विवरण देखें' : 'View details'} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              {language === 'hi' ? 'राजस्व रुझान' : 'Revenue Trend'}
            </CardTitle>
            <CardDescription>
              {language === 'hi' ? 'मासिक राजस्व और कमीशन अवलोकन' : 'Monthly revenue and commission overview'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name={language === 'hi' ? 'राजस्व' : 'Revenue'}
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="commission" 
                    name={language === 'hi' ? 'कमीशन' : 'Commission'}
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCommission)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Project Status Pie Chart */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-500" />
              {language === 'hi' ? 'प्रोजेक्ट स्थिति वितरण' : 'Project Status Distribution'}
            </CardTitle>
            <CardDescription>
              {language === 'hi' ? 'आपके सभी प्रोजेक्ट्स का अवलोकन' : 'Overview of all your projects'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {projectStatusData.map((entry, index) => (
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

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance Bar Chart */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              {language === 'hi' ? 'टीम प्रदर्शन' : 'Team Performance'}
            </CardTitle>
            <CardDescription>
              {language === 'hi' ? 'टीम सदस्यों द्वारा पूर्ण कार्य' : 'Jobs completed by team members'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={60} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="jobs" name={language === 'hi' ? 'पूर्ण कार्य' : 'Jobs Completed'} fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Visits Line Chart */}
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              {language === 'hi' ? 'साप्ताहिक साइट विजिट' : 'Weekly Site Visits'}
            </CardTitle>
            <CardDescription>
              {language === 'hi' ? 'इस सप्ताह निर्धारित बनाम पूर्ण विजिट' : 'Visits scheduled vs completed this week'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyVisitsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="visits" name={language === 'hi' ? 'निर्धारित' : 'Scheduled'} stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                  <Line type="monotone" dataKey="completed" name={language === 'hi' ? 'पूर्ण' : 'Completed'} stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Site Visits */}
        <div className="lg:col-span-2">
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-500" />
                {language === 'hi' ? 'हालिया साइट विजिट' : 'Recent Site Visits'}
              </CardTitle>
              <CardDescription>
                {language === 'hi' ? 'आपकी आगामी और हालिया साइट विजिट' : 'Your upcoming and recent site visits'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {siteVisits.map((visit, index) => (
                  <div key={visit.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-purple-50 transition-colors animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{visit.service}</h3>
                        <Badge 
                          variant="outline"
                          className={
                            visit.status === 'completed' ? 'bg-green-100 text-green-700 border-green-300' :
                            visit.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                            'bg-purple-100 text-purple-700 border-purple-300'
                          }
                        >
                          {visit.status === 'completed' 
                            ? (language === 'hi' ? 'पूर्ण' : 'Completed')
                            : visit.status === 'pending' 
                              ? (language === 'hi' ? 'लंबित' : 'Pending')
                              : (language === 'hi' ? 'निर्धारित' : 'Scheduled')
                          }
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{visit.customer}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {visit.date} at {visit.time}
                      </p>
                      <p className="text-sm font-medium text-green-600 mt-1">₹{visit.estimatedAmount.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCallCustomer(visit.phone)}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        {language === 'hi' ? 'कॉल' : 'Call'}
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleStartNavigation(visit.address)}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        {language === 'hi' ? 'नेविगेट' : 'Navigate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/thekedar/site-visits')}
              >
                {language === 'hi' ? 'सभी विजिट देखें' : 'View All Visits'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Notifications & Team */}
        <div className="space-y-6">
          {/* Notifications */}
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                {language === 'hi' ? 'सूचनाएं' : 'Notifications'}
                {unreadNotifications > 0 && (
                  <Badge className="bg-red-500 text-white ml-2">{unreadNotifications} {language === 'hi' ? 'नई' : 'new'}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {language === 'hi' ? 'हालिया अलर्ट' : 'Recent alerts'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.slice(0, 4).map((notification, index) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      notification.read ? 'bg-gray-50' : 'bg-amber-50 border border-amber-200'
                    }`}
                    onClick={() => handleMarkNotificationRead(notification.id)}
                    style={{animationDelay: `${index * 0.1}s`}}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`text-sm ${notification.read ? 'text-gray-600' : 'font-medium'}`}>
                          {language === 'hi' ? notification.titleHi : notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                {language === 'hi' ? 'प्रदर्शन' : 'Performance'}
              </CardTitle>
              <CardDescription>
                {language === 'hi' ? 'आपके व्यापार मेट्रिक्स' : 'Your business metrics'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>{language === 'hi' ? 'प्रोजेक्ट पूर्णता' : 'Project Completion'}</span>
                  <span>{stats.projectCompletionRate}%</span>
                </div>
                <Progress value={stats.projectCompletionRate} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{language === 'hi' ? 'कुल कमीशन' : 'Total Commission'}</span>
                  <span className="font-medium">₹{stats.commissionEarned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{language === 'hi' ? 'कुल प्रोजेक्ट्स' : 'Total Projects'}</span>
                  <span className="font-medium">{stats.activeProjects + 45}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/thekedar/analytics')}
              >
                {language === 'hi' ? 'एनालिटिक्स देखें' : 'View Analytics'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle>{language === 'hi' ? 'त्वरित कार्रवाई' : 'Quick Actions'}</CardTitle>
          <CardDescription>
            {language === 'hi' ? 'अपने व्यापार को कुशलता से प्रबंधित करें' : 'Manage your business efficiently'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              className="flex flex-col items-start h-auto py-4 bg-purple-600 hover:bg-purple-700"
              onClick={() => navigate('/thekedar/site-visits')}
            >
              <MapPin className="h-5 w-5 mb-2" />
              <span className="font-medium">{language === 'hi' ? 'साइट विजिट निर्धारित करें' : 'Schedule Site Visit'}</span>
              <span className="text-xs text-muted-foreground">{language === 'hi' ? 'ग्राहक विजिट की योजना बनाएं' : 'Plan customer visits'}</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-start h-auto py-4 border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => navigate('/thekedar/team')}
            >
              <Users className="h-5 w-5 mb-2" />
              <span className="font-medium">{language === 'hi' ? 'टीम प्रबंधित करें' : 'Manage Team'}</span>
              <span className="text-xs text-muted-foreground">{language === 'hi' ? 'सदस्य जोड़ें/हटाएं' : 'Add/remove members'}</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-start h-auto py-4 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => navigate('/thekedar/earnings')}
            >
              <DollarSign className="h-5 w-5 mb-2" />
              <span className="font-medium">{language === 'hi' ? 'आय देखें' : 'View Earnings'}</span>
              <span className="text-xs text-muted-foreground">{language === 'hi' ? 'कमीशन ट्रैक करें' : 'Track commissions'}</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-start h-auto py-4 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => navigate('/thekedar/map')}
            >
              <MapPin className="h-5 w-5 mb-2" />
              <span className="font-medium">{language === 'hi' ? 'मैप खोलें' : 'Open Map'}</span>
              <span className="text-xs text-muted-foreground">{language === 'hi' ? 'टीम स्थान देखें' : 'View team locations'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminders Modal */}
      {showReminders && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-amber-500" />
                {language === 'hi' ? 'आगामी अनुस्मारक' : 'Upcoming Reminders'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowReminders(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reminders.map((reminder) => (
                  <div 
                    key={reminder.id} 
                    className={`p-4 rounded-xl border ${reminder.urgent ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">
                          {language === 'hi' ? reminder.titleHi : reminder.title}
                        </h4>
                        <p className="text-sm text-gray-600">{reminder.time} - {reminder.date}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {language === 'hi' ? 'ग्राहक' : 'Customer'}: {reminder.customer}
                        </p>
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
                    <p className="text-gray-500">
                      {language === 'hi' ? 'कोई आगामी अनुस्मारक नहीं' : 'No upcoming reminders'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ThekedarDashboard;