import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, Phone, MessageCircle, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
// import { Database } from '@/integrations/supabase/types';

interface Booking {
  id: string;
  category_id: string;  // Based on the schema, it's category_id not service_id
  customer_id: string;
  status: 'pending' | 'matched' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | null;
  scheduled_at: string | null;  // Based on schema, it's scheduled_at not separate date/time
  address: string;
  total_price: number;  // Based on schema, it's total_price not total_amount
  // Other potential fields based on schema
  description?: string | null;
  city?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  worker_id?: string | null;
  base_price?: number;
  platform_fee?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

const WorkerSchedulePage = () => {
  const { user, profile } = useAuth();
  const [schedule, setSchedule] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchSchedule();
    }
  }, [user, profile, selectedDate]);

  const fetchSchedule = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
      
      // Fetch all bookings for this worker via API
      const res = await fetch(`${API_BASE}/api/bookings?worker_user_id=${user.id || user._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch schedule');
      }

      const allJobs = await res.json();
      
      // Filter by selected date
      const scheduleData = allJobs.filter((job: any) => {
        if (!job.scheduled_at) return false;
        return new Date(job.scheduled_at).toISOString().split('T')[0] === selectedDate;
      });

      setSchedule(scheduleData);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleJobAction = async (jobId: string, action: string) => {
    try {
      if (!user) return;

      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

      // Update job status based on action
      let newStatus = '';
      switch (action) {
        case 'start':
          newStatus = 'in_progress';
          break;
        case 'complete':
          newStatus = 'completed';
          break;
        case 'cancel':
          newStatus = 'cancelled';
          break;
        default:
          return;
      }

      const res = await fetch(`${API_BASE}/api/bookings/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        throw new Error('Error updating job status');
      }

      // Refresh schedule
      fetchSchedule();
    } catch (error) {
      console.error('Error handling job action:', error);
    }
  };

  // Generate date options for the next 7 days
  const getDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Schedule</h1>
        <p className="text-gray-600">Manage your appointments and upcoming jobs</p>
      </div>

      {/* Date Selection */}
      <div className="mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {getDateOptions().map((date) => (
                <Button
                  key={date}
                  variant={selectedDate === date ? 'default' : 'outline'}
                  onClick={() => setSelectedDate(date)}
                  className="capitalize"
                >
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedule.length}</div>
            <p className="text-xs text-muted-foreground">Scheduled for {new Date(selectedDate).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedule.filter(job => job.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">Jobs finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedule.filter(job => ['pending', 'matched', 'accepted'].includes(job.status || '')).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Appointment
            </Button>
          </CardTitle>
          <CardDescription>Your appointments for the selected date</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : schedule.length > 0 ? (
            <div className="space-y-4">
              {schedule.map((appointment) => (
                <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">Service</h3>
                          <Badge className={getStatusColor(appointment.status || 'pending')}>
                            {(appointment.status || 'pending').replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-1">Service appointment</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{appointment.scheduled_at ? new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not set'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{appointment.address || 'Address not specified'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>Customer</span>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            <span>Phone</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <span>₹{appointment.total_price}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 min-w-[150px]">
                        {(appointment.status === 'matched' || appointment.status === 'accepted') && (
                          <Button 
                            size="sm" 
                            onClick={() => handleJobAction(appointment.id, 'start')}
                          >
                            Start Job
                          </Button>
                        )}
                        {appointment.status === 'in_progress' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleJobAction(appointment.id, 'complete')}
                          >
                            Mark Complete
                          </Button>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" className="flex-1">
                            <Phone className="h-4 w-4 mr-1" />
                            Call
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Chat
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No appointments scheduled</h3>
              <p className="text-gray-500">You don't have any appointments for {new Date(selectedDate).toLocaleDateString()}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Overview</CardTitle>
            <CardDescription>Your schedule for the week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {getDateOptions().map((date) => {
                const daySchedule = schedule.filter(job => job.scheduled_at?.startsWith(date));
                return (
                  <div key={date} className="border rounded-lg p-3 text-center">
                    <div className="text-sm font-medium">
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(date).toLocaleDateString('en-US', { day: 'numeric' })}
                    </div>
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {daySchedule.length} jobs
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkerSchedulePage;