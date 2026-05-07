import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { WithdrawalDialog } from '@/components/worker/WithdrawalDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkerProfile } from '@/hooks/useWorkerProfile';
import { useWalletTransactions } from '@/hooks/useWalletTransactions';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Wallet, 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar,
  RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function WorkerEarnings() {
  const { t } = useLanguage();
  const { profile, loading: authLoading } = useAuth();
  const { workerProfile, loading: profileLoading } = useWorkerProfile();
  const { 
    transactions, 
    loading: transactionsLoading, 
    withdrawToUPI, 
    withdrawing,
    getTodayEarnings,
    getWeekEarnings,
    refreshTransactions 
  } = useWalletTransactions();

  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Redirect non-workers
  if (!authLoading && profile?.role !== 'worker') {
    return <Navigate to="/" replace />;
  }

  const isLoading = authLoading || profileLoading || transactionsLoading;

  const stats = [
    {
      label: t('worker.earnings_today'),
      value: getTodayEarnings(),
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      label: t('worker.earnings_week'),
      value: getWeekEarnings(),
      icon: Calendar,
      color: 'text-blue-600',
    },
    {
      label: t('worker.earnings_total'),
      value: workerProfile?.total_earnings || 0,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ];

  return (
    <Layout>
      <div className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('nav.earnings')}</h1>
          <Button variant="ghost" size="icon" onClick={refreshTransactions}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        {/* Wallet Balance Card */}
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-primary-foreground/20">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm opacity-80">Wallet Balance</p>
                  <p className="text-3xl font-bold">
                    ₹{(workerProfile?.wallet_balance || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                onClick={() => setWithdrawOpen(true)}
                disabled={(workerProfile?.wallet_balance || 0) < 100}
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                {t('worker.withdraw')} to UPI
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-3 text-center">
                  <stat.icon className={cn('w-5 h-5 mx-auto mb-1', stat.color)} />
                  <p className={cn('text-lg font-bold', stat.color)}>
                    ₹{stat.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No transactions yet</p>
                <p className="text-sm">Complete jobs to earn money</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-full',
                          tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                        )}
                      >
                        {tx.amount > 0 ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-600" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {tx.transaction_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-bold',
                          tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString()}
                      </p>
                      <Badge
                        variant={tx.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal Dialog */}
        <WithdrawalDialog
          open={withdrawOpen}
          onOpenChange={setWithdrawOpen}
          walletBalance={workerProfile?.wallet_balance || 0}
          onWithdraw={withdrawToUPI}
          withdrawing={withdrawing}
        />
      </div>
    </Layout>
  );
}
