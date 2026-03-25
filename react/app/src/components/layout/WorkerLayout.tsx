import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation, useMatch } from 'react-router-dom';
import { 
  Home, 
  Briefcase, 
  Wallet, 
  User, 
  Bell, 
  Calendar, 
  Menu, 
  X,
  LogOut,
  Circle,
  CircleCheck,
  Settings,
  Package,
  MapPin
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/db";
import { IncomingBookingModal } from "@/components/worker/IncomingBookingModal";
import { WorkerLocationTracker } from "@/components/worker/WorkerLocationTracker";

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

const WorkerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(0); // We'll update this based on actual notification count
  const [workerProfile, setWorkerProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const token = localStorage.getItem('token');
  
  // Check if we're on the notifications page to reset the count
  const isOnNotificationsPage = useMatch('/worker/notifications');
  
  // Reset notifications count when on notifications page
  useEffect(() => {
    if (isOnNotificationsPage && notifications > 0) {
      setNotifications(0);
    }
  }, [isOnNotificationsPage, notifications]);
  
  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Count unread notifications
        const unread = data.filter((n: any) => !n.read).length;
        setNotifications(unread);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // Poll for notifications every 30 seconds
  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  // Fetch worker profile and status
  useEffect(() => {
    if (user) {
      fetchWorkerProfile();
    }
  }, [user]);
  
  const fetchWorkerProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await db
        .collection('worker_profiles')
        .select('*')
        .eq('user_id', user.id || user._id)
        .single();
      
      if (data) {
        setWorkerProfile(data);
        setIsOnline(data.status === 'online');
      }
    } catch (error) {
      console.error('Error fetching worker profile:', error);
    }
  };
  
  const toggleOnlineStatus = async () => {
    if (!user || !workerProfile) return;
    
    try {
      const newStatus = isOnline ? 'offline' : 'online';
      const { error } = await db
        .collection('worker_profiles')
        .update({ status: newStatus })
        .eq('user_id', user.id || user._id);
      
      if (!error) {
        setIsOnline(!isOnline);
        // For now, we'll just update the status in the worker_profiles table
        // In a real implementation, we would create a notifications table or use a different approach
        console.log(`${profile?.full_name || 'Worker'} is now ${newStatus}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };
  
  const navItems = [
    { path: '/worker/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/worker/jobs', icon: Briefcase, label: 'My Jobs' },
    { path: '/worker/earnings', icon: Wallet, label: 'Earnings' },
    { path: '/worker/schedule', icon: Calendar, label: 'Schedule' },
    { path: '/worker/job-log', icon: Package, label: 'Job Log' },
    { path: '/worker/map', icon: MapPin, label: 'Map' },
    { path: '/worker/profile', icon: User, label: 'Profile' },
    { path: '/worker/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    console.log('Logging out worker...');
    await signOut();
    navigate('/');
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* REAL-TIME: IncomingBookingModal listens globally across all worker pages */}
      <IncomingBookingModal />
      {/* REAL-TIME: WorkerLocationTracker tracks worker live location for active bookings */}
      <WorkerLocationTracker />
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-gradient-to-b from-worker-primary to-worker-secondary shadow-xl">
        <div className="p-4 border-b border-worker-light/20">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white drop-shadow-sm">Worker Panel</h2>
              <p className="text-sm text-worker-light truncate opacity-90">Manage your services</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 transform hover:scale-[1.02] ${
                    isActive(item.path)
                      ? 'bg-white/25 text-white shadow-lg backdrop-blur-sm border border-white/30'
                      : 'text-worker-light hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-worker-light/20">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-worker-light hover:text-white hover:bg-red-500/20 transition-all duration-300 group"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-worker-primary to-worker-secondary border-r transform transition-transform duration-300 ease-in-out md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-worker-light/20">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Worker Panel</h2>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-worker-light hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-worker-light">Manage your services</p>
        </div>
        
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                    isActive(item.path)
                      ? 'bg-white/25 text-white shadow-lg backdrop-blur-sm border border-white/30'
                      : 'text-worker-light hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-worker-light/20">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-worker-light hover:text-white hover:bg-red-500/20 transition-all duration-300 group"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation bar */}
        <header className="bg-white/70 backdrop-blur-md border-b sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-10 w-10 rounded-full bg-worker-primary/90 text-white hover:bg-worker-primary hover:scale-110 transition-all duration-300"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 animate-slide-in-left">
                <div className="h-3 w-3 rounded-full bg-worker-accent animate-pulse"></div>
                <h1 className="text-xl font-bold text-gray-800">
                  {location.pathname.includes('dashboard') && 'Dashboard'}
                  {location.pathname.includes('jobs') && 'My Jobs'}
                  {location.pathname.includes('earnings') && 'Earnings'}
                  {location.pathname.includes('schedule') && 'Schedule'}
                  {location.pathname.includes('profile') && 'Profile'}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleOnlineStatus}
                  className={`flex items-center gap-2 transition-all duration-300 ${
                    isOnline 
                      ? 'border-green-500/50 text-green-700 hover:bg-green-50' 
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <CircleCheck className="h-4 w-4 text-green-500" />
                      <span className="hidden sm:inline font-medium">Online</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4 text-gray-500" />
                      <span className="hidden sm:inline font-medium">Offline</span>
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon" 
                  asChild
                  className="relative border-worker-primary/30 text-worker-primary hover:bg-worker-primary hover:text-white transition-all duration-300"
                >
                  <Link to="/worker/notifications">
                    <Bell className="h-5 w-5" />
                    {notifications > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-pulse-slow"
                      >
                        {notifications}
                      </Badge>
                    )}
                  </Link>
                </Button>
              </div>
              
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{profile?.full_name || 'Worker'}</p>
                  <p className="text-xs text-gray-600">Worker ID: {user?.id?.substring(0, 8) || 'N/A'}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-worker-primary to-worker-accent flex items-center justify-center text-white font-bold shadow-md hover:scale-110 transition-transform duration-300">
                  {profile?.full_name?.charAt(0) || 'W'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="animate-fade-in-up">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default WorkerLayout;
