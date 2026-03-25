import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, MapPin, User, Clock, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';

const JobLog = () => {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [currentJobs, setCurrentJobs] = useState<any[]>([]);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchJobs();
    }
  }, [user, profile]);

  const fetchJobs = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch worker profile to get worker ID
      const { data: workerProfile, error: profileError } = await db
        .collection('worker_profiles')
        .select('id')
        .eq('user_id', user.id || (user as any)._id)
        .single();

      if (!workerProfile || profileError) {
        console.error('Error fetching worker profile:', profileError);
        setLoading(false);
        return;
      }

      // Fetch all bookings for this worker
      const { data: jobsData, error: jobsError } = await db
        .collection('bookings')
        .select(`
          id,
          service_id,
          customer_id,
          status,
          scheduled_at,
          address,
          city,
          created_at,
          services (name, description),
          customers (full_name, phone, email)
        `)
        .eq('worker_id', workerProfile.id)
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
      } else if (jobsData) {
        setJobs(jobsData);
        
        // Categorize jobs by status
        const pending = jobsData.filter((job: any) => 
          job.status === 'pending' || job.status === 'matched' || job.status === 'accepted'
        );
        const current = jobsData.filter((job: any) => job.status === 'in_progress');
        const completed = jobsData.filter((job: any) => job.status === 'completed');
        
        setPendingJobs(pending);
        setCurrentJobs(current);
        setCompletedJobs(completed);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: string; icon: React.ReactNode }> = {
      pending: { variant: 'secondary', icon: <AlertCircle className="h-3 w-3" /> },
      matched: { variant: 'secondary', icon: <AlertCircle className="h-3 w-3" /> },
      accepted: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      in_progress: { variant: 'default', icon: <Clock className="h-3 w-3" /> },
      completed: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      cancelled: { variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
    };

    const config = statusMap[status] || { variant: 'secondary', icon: <AlertCircle className="h-3 w-3" /> };
    
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        {config.icon}
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Log</h1>
        <p className="text-gray-600">Track your work history and current assignments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingJobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs awaiting action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentJobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedJobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs finished</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Jobs</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingJobs.length})</TabsTrigger>
          <TabsTrigger value="current">In Progress ({currentJobs.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Jobs</CardTitle>
              <CardDescription>All jobs you've been assigned to</CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">#{job.id.substring(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{job.customers?.full_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{job.customers?.phone || 'N/A'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{job.services?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{job.city || job.address?.split(',').slice(-1)[0] || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{job.scheduled_at ? formatDate(job.scheduled_at) : 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">View Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No jobs found</h3>
                  <p className="text-gray-500">You don't have any jobs assigned yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Jobs</CardTitle>
              <CardDescription>Jobs awaiting your action</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">#{job.id.substring(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{job.customers?.full_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{job.customers?.phone || 'N/A'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{job.services?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{job.city || job.address?.split(',').slice(-1)[0] || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{job.scheduled_at ? formatDate(job.scheduled_at) : 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">View Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Jobs</CardTitle>
              <CardDescription>Jobs you're currently working on</CardDescription>
            </CardHeader>
            <CardContent>
              {currentJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">#{job.id.substring(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{job.customers?.full_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{job.customers?.phone || 'N/A'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{job.services?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{job.city || job.address?.split(',').slice(-1)[0] || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{job.created_at ? formatDate(job.created_at) : 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">View Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No current jobs</h3>
                  <p className="text-gray-500">You don't have any jobs in progress right now.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Jobs</CardTitle>
              <CardDescription>Your completed work history</CardDescription>
            </CardHeader>
            <CardContent>
              {completedJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Completed Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">#{job.id.substring(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{job.customers?.full_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{job.customers?.phone || 'N/A'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{job.services?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{job.city || job.address?.split(',').slice(-1)[0] || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>{job.created_at ? formatDate(job.created_at) : 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">View Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      </Tabs>
    </div>
  );
};

export default JobLog;