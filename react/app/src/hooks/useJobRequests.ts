import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/constants';

interface JobRequest {
  id: string;
  customer_id: string;
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

export function useJobRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingJobs, setPendingJobs] = useState<JobRequest[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  const [allJobs, setAllJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchJobs();
      // Realtime not implemented in this migration
    }
  }, [user]);

  const fetchJobs = async () => {
    if (!user) return;

    try {
      // Fetch pending jobs that need workers
      // Fetch pending jobs that need workers
      const pendingRes = await fetch(`${API}/bookings?status=pending&is_worker_null=1&limit=10`);
      if (!pendingRes.ok) throw new Error('Failed to fetch pending jobs');
      let pending = await pendingRes.json();
      if (Array.isArray(pending)) {
        pending = pending.map((j: any) => ({ ...j, id: j.id || j._id }));
      }

      // Fetch active jobs assigned to this worker by resolving worker profile
      const activeRes = await fetch(`${API}/bookings?worker_user_id=${user.id || (user as any)._id}`);
      if (!activeRes.ok) throw new Error('Failed to fetch active jobs');
      let activeData = await activeRes.json();
      if (Array.isArray(activeData)) {
        activeData = activeData.map((j: any) => ({ ...j, id: j.id || j._id }));
      }

      const activeFiltered = (activeData || []).filter((b: JobRequest) => ['pending', 'confirmed', 'accepted', 'arriving', 'otp_verify', 'in_progress'].includes(b.status));

      setPendingJobs((pending || []) as JobRequest[]);
      setActiveJobs((activeFiltered || []) as JobRequest[]);
      setAllJobs((activeData || []) as JobRequest[]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToJobs = () => {
    // Realtime not implemented in this migration. Placeholder for future websocket/SSE implementation.
    console.warn('subscribeToJobs is not implemented yet (no realtime).');
    return () => { };
  };

  const acceptJob = async (jobId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ worker: user.id, status: 'accepted', updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Failed to accept job');

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
    // For now, just remove from local state (no penalty policy)
    setPendingJobs(prev => prev.filter(job => job.id !== jobId));

    toast({
      title: 'Job Skipped',
      description: 'No worries! You can accept other jobs.',
    });

    return { error: null };
  };

  const updateJobStatus = async (jobId: string, status: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
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
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in_progress', otp, otp_verified: true, started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

  const completeJob = async (jobId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/bookings/${jobId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Failed to complete job');

      toast({
        title: 'Job Completed!',
        description: 'Your earnings have been added to your wallet.',
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
