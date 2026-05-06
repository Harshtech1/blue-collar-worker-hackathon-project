import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/constants';

interface JobRequest {
  id: string;
  customer_id: string;
  customer_user_id?: string;
  worker_user_id?: string;
  category_id: string;
  address: string;
  city: string | null;
  description: string | null;
  base_price: number;
  worker_earning: number;
  total_price: number;
  is_emergency: boolean;
  is_instant: boolean;
  scheduled_at: string | null;
  created_at: string;
  updated_at?: string;
  paymentStatus?: string;
  latitude: number | null;
  longitude: number | null;
  status: 'pending' | 'matched' | 'accepted' | 'arriving' | 'otp_verify' | 'in_progress' | 'completed' | 'cancelled';
  customer?: {
    _id?: string;
    id?: string;
    user?: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
  };
  category?: {
    name: string;
    icon: string;
    color: string;
  };
}

const ACTIVE_STATUSES = ['accepted', 'arriving', 'otp_verify', 'in_progress'];

const normalizeJob = (job: any) => ({
  ...job,
  id: job.id || job._id,
  customer_user_id: job.customer_user_id || job.customerUserId || job.customer?.user || job.customer_id,
  worker_user_id: job.worker_user_id || job.workerUserId || job.worker?.user || job.worker_id,
  created_at: job.created_at || job.createdAt,
  updated_at: job.updated_at || job.updatedAt,
  scheduled_at: job.scheduled_at || job.scheduledAt,
});

export function useJobRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingJobs, setPendingJobs] = useState<JobRequest[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  const [allJobs, setAllJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchJobs = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const pendingRes = await fetch(`${API}/bookings?status=pending&is_worker_null=1&limit=10`, { headers });
      if (!pendingRes.ok) throw new Error('Failed to fetch pending jobs');
      const pendingData = await pendingRes.json();
      const pending = Array.isArray(pendingData) ? pendingData.map(normalizeJob) : [];

      const activeRes = await fetch(`${API}/bookings?worker_user_id=${user.id || (user as any)._id}`, { headers });
      if (!activeRes.ok) throw new Error('Failed to fetch active jobs');
      const activeDataRaw = await activeRes.json();
      const activeData = Array.isArray(activeDataRaw) ? activeDataRaw.map(normalizeJob) : [];

      setPendingJobs(pending as JobRequest[]);
      setActiveJobs(activeData.filter((job: JobRequest) => ACTIVE_STATUSES.includes(job.status)) as JobRequest[]);
      setAllJobs(activeData as JobRequest[]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptJob = async (jobId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'accepted' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to accept job');
      }

      toast({
        title: 'Job Accepted!',
        description: 'Navigate to the customer location to start the job.',
      });

      fetchJobs();
      return { error: null };
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept job. It may have been taken by another worker.',
        variant: 'destructive',
      });
      return { error: error as Error };
    }
  };

  const rejectJob = async (jobId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'declined' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to skip job');
      }

      setPendingJobs((prev) => prev.filter((job) => job.id !== jobId));
      toast({
        title: 'Job Skipped',
        description: 'No worries! You can accept other jobs.',
      });

      return { error: null };
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to skip job',
        variant: 'destructive',
      });
      return { error: error as Error };
    }
  };

  const updateJobStatus = async (jobId: string, status: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to update job status');

      fetchJobs();
      return { error: null };
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
      return { error: error as Error };
    }
  };

  const startJob = async (jobId: string, otp: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in_progress', otp, otp_verified: true, started_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          toast({
            title: 'Invalid OTP',
            description: 'Please ask the customer for the correct OTP.',
            variant: 'destructive',
          });
          return { error: new Error('Invalid OTP') };
        }
        throw new Error('Failed to start job');
      }

      toast({
        title: 'Job Started!',
        description: 'Complete the work and mark it as done.',
      });

      fetchJobs();
      return { error: null };
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start job',
        variant: 'destructive',
      });
      return { error: error as Error };
    }
  };

  const completeJob = async (jobId: string, otp?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed', otp, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          toast({
            title: 'Invalid OTP',
            description: 'Please ask the customer for the correct finish OTP.',
            variant: 'destructive',
          });
          return { error: new Error('Invalid OTP') };
        }
        throw new Error('Failed to complete job');
      }

      toast({
        title: 'Job Completed!',
        description: 'Payment can now be collected from the customer.',
      });

      fetchJobs();
      return { error: null };
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete job',
        variant: 'destructive',
      });
      return { error: error as Error };
    }
  };

  return {
    pendingJobs,
    activeJobs,
    allJobs,
    loading,
    acceptJob,
    rejectJob,
    updateJobStatus,
    startJob,
    completeJob,
    refreshJobs: fetchJobs,
  };
}
