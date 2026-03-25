import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAuth } from '@/contexts/AuthContext';
import { useJobRequests } from '@/hooks/useJobRequests';
// import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { MapPin, Clock, Phone, User, CheckCircle, Play, Navigation } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function WorkerJobs() {
  const { profile, user, loading: authLoading } = useAuth();
  const { activeJobs, loading: jobsLoading, startJob, completeJob, updateJobStatus } = useJobRequests();
  const { toast } = useToast();
  
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(true);

  // Fetch completed jobs
  useState(() => {
    const fetchCompletedJobs = async () => {
      if (!user) return;
      
      const { data } = await db
        .collection('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, phone),
          category:service_categories(name, icon)
        `)
        .eq('worker_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      setCompletedJobs(data || []);
      setLoadingCompleted(false);
    };

    fetchCompletedJobs();
  });

  // Redirect non-workers
  if (!authLoading && profile?.role !== 'worker') {
    return <Navigate to="/" replace />;
  }

  const handleStartJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setOtpDialogOpen(true);
  };

  const handleVerifyOTP = async () => {
    if (!selectedJobId) return;
    
    const result = await startJob(selectedJobId, otp);
    
    if (!result.error) {
      setOtpDialogOpen(false);
      setOtp('');
      setSelectedJobId(null);
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    await completeJob(jobId);
  };

  const openNavigation = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const isLoading = authLoading || jobsLoading;

  return (
    <Layout>
      <div className="container max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">My Jobs</h1>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : activeJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No active jobs</p>
                  <p className="text-sm">Accept jobs from the dashboard</p>
                </CardContent>
              </Card>
            ) : (
              activeJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden">
                  <CardHeader className="pb-2 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {job.category?.icon} {job.category?.name}
                      </CardTitle>
                      <Badge variant={job.status === 'in_progress' ? 'default' : 'secondary'}>
                        {job.status === 'in_progress' ? 'In Progress' : 'Accepted'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{job.customer?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{job.customer?.phone}</p>
                      </div>
                      <Button size="icon" variant="outline" asChild>
                        <a href={`tel:${job.customer?.phone}`}>
                          <Phone className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <p className="text-sm">{job.address}</p>
                        {job.city && <p className="text-sm text-muted-foreground">{job.city}</p>}
                      </div>
                      {job.latitude && job.longitude && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openNavigation(job.latitude!, job.longitude!)}
                        >
                          <Navigation className="w-4 h-4 mr-1" />
                          Navigate
                        </Button>
                      )}
                    </div>

                    {/* Earnings */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                      <span className="text-sm font-medium">Your Earning</span>
                      <span className="text-lg font-bold text-green-600">₹{job.worker_earning}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {job.status === 'accepted' && (
                        <Button 
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          onClick={() => updateJobStatus(job.id, 'arriving')}
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          On the Way
                        </Button>
                      )}
                      {job.status === 'arriving' && (
                        <Button 
                          className="flex-1 bg-amber-600 hover:bg-amber-700"
                          onClick={() => updateJobStatus(job.id, 'otp_verify')}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          Arrived
                        </Button>
                      )}
                      {job.status === 'otp_verify' && (
                        <Button 
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleStartJob(job.id)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Enter OTP & Start
                        </Button>
                      )}
                      {job.status === 'in_progress' && (
                        <Button 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleCompleteJob(job.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-4">
            {loadingCompleted ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : completedJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>No completed jobs yet</p>
                </CardContent>
              </Card>
            ) : (
              completedJobs.map((job) => (
                <Card key={job.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{job.category?.icon}</div>
                        <div>
                          <p className="font-medium">{job.category?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {job.customer?.full_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">+₹{job.worker_earning}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* OTP Dialog */}
        <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Customer OTP</DialogTitle>
              <DialogDescription>
                Ask the customer for the 4-digit OTP to start the job
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
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOtpDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleVerifyOTP} disabled={otp.length !== 4}>
                Verify & Start
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
