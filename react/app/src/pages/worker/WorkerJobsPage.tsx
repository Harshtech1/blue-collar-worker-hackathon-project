import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Package, Clock, CheckCircle, AlertCircle, FileText, Phone, MessageCircle, DollarSign, Play, Navigation } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useJobRequests } from '@/hooks/useJobRequests';
import { db } from '@/lib/db';
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
import { toast } from 'sonner';

const WorkerJobsPage = () => {
  const { user, profile } = useAuth();
  const { startJob, completeJob } = useJobRequests();
  const [jobs, setJobs] = useState<any[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  // OTP State
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpType, setOtpType] = useState<'start' | 'finish'>('start');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

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
        fetchJobs(); // Refresh list
      }
    } else {
      const result = await completeJob(selectedJobId, otp);
      if (!result.error) {
        setOtpDialogOpen(false);
        setOtp('');
        setSelectedJobId(null);
        fetchJobs(); // Refresh list
      }
    }
  };

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchJobs();
    }
  }, [user, profile]);

  const fetchJobs = async () => {
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
        throw new Error('Failed to fetch jobs');
      }

      let jobsData = await res.json();
      if (Array.isArray(jobsData)) {
        jobsData = jobsData.map((j: any) => ({ ...j, id: j.id || j._id }));
      }
      setJobs(jobsData || []);
      setFilteredJobs(jobsData || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobs.length > 0) {
      switch (activeTab) {
        case 'pending':
          setFilteredJobs(jobs.filter(job => ['pending', 'accepted', 'in_progress'].includes(job.status)));
          break;
        case 'completed':
          setFilteredJobs(jobs.filter(job => job.status === 'completed'));
          break;
        case 'cancelled':
          setFilteredJobs(jobs.filter(job => job.status === 'cancelled'));
          break;
        default:
          setFilteredJobs(jobs);
      }
    } else {
      setFilteredJobs([]);
    }
  }, [activeTab, jobs]);

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
        case 'accept':
          newStatus = 'accepted';
          break;
        case 'arriving':
          newStatus = 'arriving';
          break;
        case 'otp_verify':
          newStatus = 'otp_verify';
          break;
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

      // Refresh jobs
      fetchJobs();
    } catch (error) {
      console.error('Error handling job action:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-gray-600">Manage your service requests and appointments</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Jobs</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Jobs</CardTitle>
              <CardDescription>Overview of all your service requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg">{job.serviceName || job.services?.name || 'Service'}</h3>
                              <Badge className={getStatusColor(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-gray-600 mb-1">{job.description || job.services?.description || 'Service description'}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'Instant'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{job.address || 'Address not specified'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                <span>₹{job.total_amount || job.amount}</span>
                              </div>
                            </div>

                            <div className="mt-2">
                              <p className="text-sm font-medium">Customer: {job.customerName || job.customers?.full_name || 'N/A'}</p>
                              <p className="text-sm text-gray-500">Contact: {job.customerPhone || job.customers?.phone || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {job.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleJobAction(job.id, 'accept')}
                                >
                                  Accept
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleJobAction(job.id, 'cancel')}
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                            {job.status === 'accepted' && (
                              <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => handleJobAction(job.id, 'arriving')}
                              >
                                <Navigation className="h-4 w-4 mr-2" />
                                On the Way
                              </Button>
                            )}
                            {job.status === 'arriving' && (
                              <Button 
                                size="sm" 
                                className="bg-amber-600 hover:bg-amber-700"
                                onClick={() => handleJobAction(job.id, 'otp_verify')}
                              >
                                <MapPin className="h-4 w-4 mr-2" />
                                Arrived
                              </Button>
                            )}
                            {job.status === 'otp_verify' && (
                              <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => handleStartJob(job.id)}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Enter OTP
                              </Button>
                            )}
                            {job.status === 'in_progress' && (
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleCompleteJob(job.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Complete
                              </Button>
                            )}
                            <div className="flex gap-2 pt-2">
                              <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(`tel:${job.customers?.phone || job.customerPhone}`, '_self')}>
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
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No jobs found</h3>
                  <p className="text-gray-500">You don't have any jobs in this category yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Jobs</CardTitle>
              <CardDescription>Jobs awaiting your action</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg">{job.serviceName || job.services?.name || 'Service'}</h3>
                              <Badge className={getStatusColor(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-gray-600 mb-1">{job.description || job.services?.description || 'Service description'}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'Instant'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{job.address || 'Address not specified'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                <span>₹{job.total_amount || job.amount}</span>
                              </div>
                            </div>

                            <div className="mt-2">
                              <p className="text-sm font-medium">Customer: {job.customerName || job.customers?.full_name || 'N/A'}</p>
                              <p className="text-sm text-gray-500">Contact: {job.customerPhone || job.customers?.phone || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {job.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleJobAction(job.id, 'accept')}
                                >
                                  Accept
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleJobAction(job.id, 'cancel')}
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                            {job.status === 'accepted' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleJobAction(job.id, 'start')}
                              >
                                Start Job
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
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No pending jobs</h3>
                  <p className="text-gray-500">You don't have any pending jobs at the moment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Jobs</CardTitle>
              <CardDescription>Jobs you have successfully completed</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg">{job.serviceName || job.services?.name || 'Service'}</h3>
                              <Badge className={getStatusColor(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-gray-600 mb-1">{job.description || job.services?.description || 'Service description'}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'Instant'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{job.address || 'Address not specified'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                <span>₹{job.total_amount || job.amount}</span>
                              </div>
                            </div>

                            <div className="mt-2">
                              <p className="text-sm font-medium">Customer: {job.customerName || job.customers?.full_name || 'N/A'}</p>
                              <p className="text-sm text-gray-500">Contact: {job.customerPhone || job.customers?.phone || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[150px]">
                            <Button size="sm" variant="outline" className="flex-1">
                              <FileText className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1">
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Chat Review
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No completed jobs</h3>
                  <p className="text-gray-500">You haven't completed any jobs yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled">
          <Card>
            <CardHeader>
              <CardTitle>Cancelled Jobs</CardTitle>
              <CardDescription>Jobs that were cancelled</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg">{job.serviceName || job.services?.name || 'Service'}</h3>
                              <Badge className={getStatusColor(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-gray-600 mb-1">{job.description || job.services?.description || 'Service description'}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'Instant'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{job.address || 'Address not specified'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                <span>₹{job.total_amount || job.amount}</span>
                              </div>
                            </div>

                            <div className="mt-2">
                              <p className="text-sm font-medium">Customer: {job.customerName || job.customers?.full_name || 'N/A'}</p>
                              <p className="text-sm text-gray-500">Contact: {job.customerPhone || job.customers?.phone || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[150px]">
                            <Button size="sm" variant="outline" className="flex-1">
                              <FileText className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No cancelled jobs</h3>
                  <p className="text-gray-500">You don't have any cancelled jobs.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Job Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <p className="text-xs text-muted-foreground">All time jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.filter(job => job.status === 'completed').length}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {jobs.length > 0 
                ? Math.round((jobs.filter(job => job.status === 'completed').length / jobs.length) * 100) 
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

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

export default WorkerJobsPage;
