import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Package, Clock, CheckCircle, AlertCircle, FileText, Phone, MessageCircle, DollarSign, Navigation, Shield, Camera } from 'lucide-react';
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
import { API as API_BASE_FROM_ENV, API_ROOT } from '@/lib/constants';
import {
  UploadedMedia,
  SECURE_MEDIA_LAYER_OFFLINE_MESSAGE,
  extractMediaUrl,
  isSecureMediaLayerOfflineError,
  uploadFile,
} from '@/lib/upload';

// Remove '/api' from the end of the constant if present to match the expected format in this file
const API_BASE = API_BASE_FROM_ENV.replace(/\/api$/, '');

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
  const [proofMedia, setProofMedia] = useState<UploadedMedia | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [otpStep, setOtpStep] = useState<'capture' | 'otp'>('capture');
  const [secureMediaError, setSecureMediaError] = useState<string | null>(null);
  const [mediaLayerReady, setMediaLayerReady] = useState<boolean | null>(null);
  const uploadNoticeToastRef = useRef<string | number | null>(null);
  const isOtpReady = otp.length === 4 || otp.length === 6;

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
        fetchJobs(); // Refresh list
      }
    } else {
      const result = await completeJob(selectedJobId, otp, proofMedia);
      if (!result.error) {
        setOtpDialogOpen(false);
        resetOtpDialog();
        fetchJobs(); // Refresh list
      }
    }
  };

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchJobs();
    }
  }, [user, profile]);

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

  const fetchJobs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      
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
          setFilteredJobs(jobs.filter(job => ['pending', 'accepted', 'arriving', 'otp_verify', 'in_progress'].includes(job.status)));
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
          toast.error('Follow the secure arrival and OTP flow to start this job.');
          return;
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
                                  className="bg-blue-600 hover:bg-blue-700"
                                  onClick={() => handleStartJob(job.id)}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
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
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleCompleteJob(job.id)}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
                                  Proof + Complete
                                </Button>
                              </>
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
                                  className="bg-blue-600 hover:bg-blue-700"
                                  onClick={() => handleStartJob(job.id)}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
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
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleCompleteJob(job.id)}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
                                  Proof + Complete
                                </Button>
                              </>
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
                ? 'Upload a photo of the work site, then ask the customer for the start OTP shown on their tracking screen to start the job.' 
                : 'Upload a photo of the finished work, then ask the customer for the completion OTP to finish the job and process payment.'}
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
              id="proof-photo"
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
                  Step 1 of 2 · Secure proof capture
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
                      htmlFor="proof-photo"
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
                  Step 2 of 2 · OTP verification unlocked
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
                      htmlFor="proof-photo"
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
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
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
              <Button onClick={handleVerifyOTP} disabled={!isOtpReady || !proofMedia || proofUploading}>
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

export default WorkerJobsPage;
