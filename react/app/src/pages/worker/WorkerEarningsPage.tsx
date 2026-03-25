import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, IndianRupee } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';

import { useNavigate } from 'react-router-dom';

const WorkerEarningsPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [earningsData, setEarningsData] = useState({
    today: 0,
    projectedToday: 0,
    weekly: 0,
    monthly: 0,
    total: 0,
    commissionRate: 0.15, // 15% commission
    insuranceFee: 0,
    platformFee: 0,
    completedCount: 0
  });
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchEarningsData();
      
      // Auto-refresh every 30 seconds to show new payments
      const interval = setInterval(fetchEarningsData, 30000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  const fetchEarningsData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
      
      // Fetch all bookings for this worker via API
      const res = await fetch(`${API_BASE}/api/bookings?worker_user_id=${user.id || (user as any)._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch jobs for earnings');
      }

      let allJobs = await res.json();
      if (Array.isArray(allJobs)) {
        allJobs = allJobs.map((j: any) => ({ ...j, id: j.id || j._id }));
      }
      
      // Filter jobs by status
      const completedJobs = allJobs.filter((j: any) => j.status === 'completed' || j.paymentStatus === 'paid');
      const activeJobs = allJobs.filter((j: any) => ['pending', 'confirmed', 'accepted', 'arriving', 'otp_verify', 'in_progress'].includes(j.status) && j.paymentStatus !== 'paid');

      // Get today's date
      const today = new Date().toDateString();
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      
      const todayCompleted = completedJobs.filter((j: any) => {
        const date = new Date(j.updatedAt || j.updated_at || j.completed_at || j.created_at);
        return !isNaN(date.getTime()) && date.toDateString() === today;
      });
      const weeklyCompleted = completedJobs.filter((j: any) => {
        const date = new Date(j.updatedAt || j.updated_at || j.completed_at || j.created_at);
        return !isNaN(date.getTime()) && date >= startOfWeek;
      });
      const monthlyCompleted = completedJobs.filter((j: any) => {
        const date = new Date(j.updatedAt || j.updated_at || j.completed_at || j.created_at);
        return !isNaN(date.getTime()) && date >= startOfMonth;
      });

      // Calculate earnings
      const todayEarnings = todayCompleted.reduce((sum: number, job: any) => sum + (job.worker_earning || job.total_price || 0), 0);
      const weeklyEarnings = weeklyCompleted.reduce((sum: number, job: any) => sum + (job.worker_earning || job.total_price || 0), 0);
      const monthlyEarnings = monthlyCompleted.reduce((sum: number, job: any) => sum + (job.worker_earning || job.total_price || 0), 0);
      const totalEarnings = completedJobs.reduce((sum: number, job: any) => sum + (job.worker_earning || job.total_price || 0), 0);
      const projectedToday = activeJobs.reduce((sum: number, job: any) => sum + (job.worker_earning || job.total_price || 0), 0);

      // Calculate fees
      const commissionRate = 0.15;
      const insuranceFee = totalEarnings * 0.02;
      const platformFee = totalEarnings * 0.03;

      setEarningsData({
        today: todayEarnings,
        projectedToday: todayEarnings + projectedToday,
        weekly: weeklyEarnings,
        monthly: monthlyEarnings,
        total: totalEarnings,
        commissionRate,
        insuranceFee,
        platformFee,
        completedCount: completedJobs.length
      });

      // Transactions (completed jobs)
      setTransactions(completedJobs.slice(0, 10));

      // Fetch payout history (Mocked for now as backend route doesn't exist)
      setPayouts([]);
      /*
      try {
        const payoutRes = await fetch(`${API_BASE}/api/payouts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          setPayouts(payoutData || []);
        }
      } catch (e) {
        console.warn('Payouts API not available yet');
      }
      */
      
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNetEarnings = () => {
    const gross = earningsData.total;
    const commission = gross * earningsData.commissionRate;
    const insurance = earningsData.insuranceFee;
    const platform = earningsData.platformFee;
    return gross - commission - insurance - platform;
  };

  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'accepted':
        return 'text-blue-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Earnings</h1>
        <p className="text-gray-600">Track your income, commissions, and payment history</p>
      </div>

      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{earningsData.today.toFixed(2)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Earned today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projected Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{earningsData.projectedToday.toFixed(2)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Expected today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{earningsData.weekly.toFixed(2)}</div>
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{earningsData.monthly.toFixed(2)}</div>
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{earningsData.total.toFixed(2)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Earnings Breakdown
              </CardTitle>
              <CardDescription>Detailed view of your earnings and deductions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Gross Earnings</span>
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{earningsData.total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span>Platform Commission ({(earningsData.commissionRate * 100).toFixed(0)}%)</span>
                    <Badge variant="outline" className="text-xs">Fee</Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span>-{(earningsData.total * earningsData.commissionRate).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span>Insurance Fee (2%)</span>
                    <Badge variant="outline" className="text-xs">Fee</Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span>-{earningsData.insuranceFee.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span>Platform Fee (3%)</span>
                    <Badge variant="outline" className="text-xs">Fee</Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span>-{earningsData.platformFee.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-4 border-t-2 border-gray-200 font-bold text-lg">
                  <span>Net Earnings</span>
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span>{calculateNetEarnings().toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="font-medium mb-3">Earnings Distribution</h3>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${(calculateNetEarnings() / earningsData.total) * 100 || 0}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Net Earnings: {(calculateNetEarnings() / earningsData.total) * 100 || 0}%</span>
                  <span>Deductions: {((earningsData.total - calculateNetEarnings()) / earningsData.total) * 100 || 0}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Quick Stats
            </CardTitle>
            <CardDescription>Your financial performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Commission Rate</span>
                <span className="font-medium">{(earningsData.commissionRate * 100).toFixed(0)}%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Jobs Completed</span>
                <span className="font-medium">{earningsData.completedCount}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Avg. Earning/Job</span>
                <span className="font-medium">
                  <IndianRupee className="h-3 w-3 inline" />
                  {earningsData.completedCount > 0 ? (earningsData.total / earningsData.completedCount).toFixed(2) : '0.00'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Best Day</span>
                <span className="font-medium">₹0.00</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Payment Pending</span>
                <span className="font-medium">
                  <IndianRupee className="h-3 w-3 inline" />
                  0.00
                </span>
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={() => navigate('/payment?type=payout&amount=' + calculateNetEarnings())} 
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Request Payout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions and Payouts Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your completed service payments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => {
                      const transactionDate = new Date(transaction.updatedAt || transaction.updated_at || transaction.completed_at || transaction.created_at);
                      return (
                        <TableRow key={transaction.id || transaction._id || index}>
                          <TableCell className="font-medium">
                            {transaction.serviceName || transaction.services?.name || 'Service'}
                          </TableCell>
                          <TableCell>
                            {!isNaN(transactionDate.getTime()) ? transactionDate.toLocaleDateString() : 'Recent'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getTransactionStatusColor(transaction.status)}>
                              {transaction.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-baseline gap-1 justify-end">
                              <IndianRupee className="h-3 w-3 text-muted-foreground" />
                              <span>{(transaction.worker_earning || transaction.total_price || 0).toFixed(2)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No transactions yet</h3>
                  <p className="text-gray-500">You don't have any completed transactions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>Your payment withdrawal history</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : payouts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout, index) => (
                      <TableRow key={payout.id || payout._id || index}>
                        <TableCell>
                          {new Date(payout.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{payout.description || 'Payout Request'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              payout.status === 'completed' ? 'default' : 
                              payout.status === 'pending' ? 'secondary' : 
                              'destructive'
                            }
                          >
                            {payout.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-baseline gap-1 justify-end">
                            <IndianRupee className="h-3 w-3 text-muted-foreground" />
                            <span>{payout.amount?.toFixed(2) || '0.00'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No payouts yet</h3>
                  <p className="text-gray-500">You haven't initiated any payouts.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Earnings Trend</CardTitle>
                <CardDescription>Your earnings over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Chart visualization would appear here
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Completion Rate</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">0%</span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Customer Rating</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">0.0</span>
                      <span className="text-sm text-gray-500">(0 reviews)</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Response Time</span>
                    <span className="font-medium">0 min avg</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Repeat Customers</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">0%</span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkerEarningsPage;