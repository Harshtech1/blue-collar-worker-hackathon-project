import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

interface WorkerProfile {
  id: string;
  user_id: string;
  status: 'online' | 'offline' | 'busy';
  rating: number;
  total_jobs: number;
  total_earnings: number;
  wallet_balance: number;
  base_price: number;
  experience_years: number;
  bio: string | null;
  kyc_status: 'pending' | 'verified' | 'rejected';
  aadhaar_verified: boolean;
}

export function useWorkerProfile() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchWorkerProfile();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  const fetchWorkerProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await db
        .collection('worker_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWorkerProfile(data as WorkerProfile);
      }
    } catch (error) {
      console.error('Error fetching worker profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: 'online' | 'offline' | 'busy') => {
    if (!workerProfile) return { error: new Error('No worker profile') };

    try {
      const { error } = await db
        .collection('worker_profiles')
        .update({
          status,
          last_online_at: status === 'online' ? new Date().toISOString() : undefined
        })
        .eq('user_id', workerProfile.user_id);

      if (error) throw error;

      setWorkerProfile(prev => prev ? { ...prev, status } : null);

      toast({
        title: status === 'online' ? 'You are now online' : 'You are now offline',
        description: status === 'online' ? 'You will receive job requests' : 'You will not receive new job requests',
      });

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

  const refreshProfile = () => {
    fetchWorkerProfile();
  };

  return {
    workerProfile,
    loading,
    updateStatus,
    refreshProfile,
  };
}
