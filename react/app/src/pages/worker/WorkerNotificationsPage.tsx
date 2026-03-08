import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Mail, Calendar, Package, AlertTriangle, CheckCircle, XCircle, MessageSquare, MoreVertical, Loader2, RefreshCw, Briefcase, MapPin, IndianRupee, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

const WorkerNotificationsPage = () => {
  const { user, profile } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // ── Listen for new_booking & booking_updated socket events to auto-refresh ──
  useEffect(() => {
    if (!socket) return;

    const handleNewBooking = (data: any) => {
      // Auto-refresh notifications list when a new booking comes in
      fetchNotifications();
      toast.info('🔔 New booking request received!', {
        description: `${data.customerName || 'A customer'} needs ${data.serviceName || 'a service'}`,
        duration: 5000,
      });
    };

    const handleBookingUpdated = () => {
      // Auto-refresh when any booking status changes
      fetchNotifications();
    };

    socket.on('new_booking', handleNewBooking);
    socket.on('booking_updated', handleBookingUpdated);

    return () => {
      socket.off('new_booking', handleNewBooking);
      socket.off('booking_updated', handleBookingUpdated);
    };
  }, [socket]);

  const fetchNotifications = async () => {
    if (!user || !token) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('Error fetching notifications:', await res.text());
      } else {
        const notificationsData = await res.json();
        setNotifications(notificationsData || []);
        const unread = notificationsData?.filter((n: any) => !n.read).length || 0;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('Error marking notification as read');
        return;
      }

      setNotifications(prev =>
        prev.map(n =>
          n._id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('Error marking all notifications as read');
        return;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_booking':
        return <Briefcase className="h-5 w-5 text-orange-500" />;
      case 'booking_confirmed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'booking_cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'booking_pending':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'status_update':
        return <Package className="h-5 w-5 text-blue-500" />;
      case 'payment_received':
      case 'payment':
        return <Mail className="h-5 w-5 text-purple-500" />;
      case 'job_invite':
        return <Briefcase className="h-5 w-5 text-orange-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_booking':
      case 'job_invite':
        return 'border-l-4 border-l-orange-400 bg-orange-50/50';
      case 'booking_confirmed':
        return 'border-l-4 border-l-green-400 bg-green-50/50';
      case 'booking_cancelled':
        return 'border-l-4 border-l-red-400 bg-red-50/50';
      case 'booking_pending':
        return 'border-l-4 border-l-yellow-400 bg-yellow-50/50';
      case 'status_update':
        return 'border-l-4 border-l-blue-400 bg-blue-50/50';
      case 'payment_received':
      case 'payment':
        return 'border-l-4 border-l-purple-400 bg-purple-50/50';
      default:
        return 'border-l-4 border-l-gray-300 bg-gray-50/50';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  const renderNotificationItem = (notification: any) => (
    <div
      key={notification._id}
      className={`p-5 transition-all hover:bg-slate-50 ${!notification.read ? getNotificationColor(notification.type) : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className={`mt-1 h-10 w-10 rounded-xl flex items-center justify-center ${!notification.read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold text-sm truncate ${!notification.read ? 'text-slate-900' : 'text-slate-600'}`}>
              {notification.title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {!notification.read && (
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                {formatTime(notification.createdAt)}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{notification.message}</p>
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs h-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
              onClick={() => markAsRead(notification._id)}
            >
              Mark as read
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const filterNotifications = (filterFn: (n: any) => boolean) => {
    const filtered = notifications.filter(filterFn);
    if (filtered.length === 0) {
      return (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">No notifications</h3>
          <p className="text-slate-400">Nothing here yet.</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-slate-100">
        {filtered.map(renderNotificationItem)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600">Stay updated with your job alerts and messages</p>
      </div>

      {/* Notification Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-blue-500 font-medium">All notifications</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{unreadCount}</div>
            <p className="text-xs text-blue-500 font-medium">Unread messages</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter(n =>
                new Date(n.createdAt).toDateString() === new Date().toDateString()
              ).length}
            </div>
            <p className="text-xs text-green-500 font-medium">Today's notifications</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter(n => {
                const notificationDate = new Date(n.createdAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return notificationDate >= weekAgo;
              }).length}
            </div>
            <p className="text-xs text-purple-500 font-medium">This week's notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={markAllAsRead}>
              <CheckCircle className="h-4 w-4 mr-2" /> Mark All as Read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="all" className="rounded-lg">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{notifications.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="rounded-lg">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="rounded-lg">Bookings</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              {filterNotifications(() => true)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread">
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              {filterNotifications(n => !n.read)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              {filterNotifications(n =>
                ['new_booking', 'booking_confirmed', 'booking_cancelled', 'booking_pending', 'status_update', 'job_invite'].includes(n.type)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              {filterNotifications(n =>
                ['payment_received', 'payment'].includes(n.type)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="mt-8">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your notifications efficiently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button variant="outline" className="flex flex-col items-start h-auto py-4 rounded-xl">
                <Bell className="h-5 w-5 mb-2" />
                <span className="font-medium">Set Reminders</span>
                <span className="text-xs text-gray-500">Configure notification settings</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-start h-auto py-4 rounded-xl">
                <MessageSquare className="h-5 w-5 mb-2" />
                <span className="font-medium">Chat with Support</span>
                <span className="text-xs text-gray-500">Get help with notifications</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-start h-auto py-4 rounded-xl">
                <Calendar className="h-5 w-5 mb-2" />
                <span className="font-medium">Schedule Notifications</span>
                <span className="text-xs text-gray-500">Manage notification timing</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkerNotificationsPage;