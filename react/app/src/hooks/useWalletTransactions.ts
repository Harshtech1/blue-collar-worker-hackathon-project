import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

interface WalletTransaction {
  id: string;
  worker_id: string;
  booking_id: string | null;
  amount: number;
  transaction_type: 'earning' | 'withdrawal' | 'bonus';
  status: 'pending' | 'completed' | 'failed';
  upi_id: string | null;
  description: string | null;
  created_at: string;
}

export function useWalletTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const { data, error } = await db
        .collection('wallet_transactions')
        .select('*')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions((data || []) as WalletTransaction[]);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const withdrawToUPI = async (amount: number, upiId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    if (amount < 100) {
      toast({
        title: 'Minimum Withdrawal',
        description: 'Minimum withdrawal amount is ₹100',
        variant: 'destructive',
      });
      return { error: new Error('Minimum withdrawal is ₹100') };
    }

    setWithdrawing(true);

    try {
      const { data: profile, error: profileError } = await db
        .collection('worker_profiles')
        .select('wallet_balance')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile || (profile.wallet_balance || 0) < amount) {
        toast({
          title: 'Insufficient Balance',
          description: 'Your available wallet balance is too low for this withdrawal request.',
          variant: 'destructive',
        });
        return { error: new Error('Insufficient wallet balance') };
      }

      const { error } = await db
        .collection('wallet_transactions')
        .insert({
          worker_id: user.id,
          amount: -amount,
          transaction_type: 'withdrawal',
          status: 'pending',
          upi_id: upiId,
          description: `Withdrawal request to ${upiId}`,
        });

      if (error) throw error;

      toast({
        title: 'Withdrawal Requested',
        description: `Withdrawal of ₹${amount} is pending transfer to ${upiId}`,
      });

      fetchTransactions();
      return { error: null };
    } catch (error) {
      toast({
        title: 'Withdrawal Failed',
        description: 'Please try again later',
        variant: 'destructive',
      });
      return { error: error as Error };
    } finally {
      setWithdrawing(false);
    }
  };

  const getTodayEarnings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions
      .filter(t =>
        t.transaction_type === 'earning' &&
        new Date(t.created_at) >= today
      )
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getWeekEarnings = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return transactions
      .filter(t =>
        t.transaction_type === 'earning' &&
        new Date(t.created_at) >= weekAgo
      )
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return {
    transactions,
    loading,
    withdrawing,
    withdrawToUPI,
    getTodayEarnings,
    getWeekEarnings,
    refreshTransactions: fetchTransactions,
  };
}
