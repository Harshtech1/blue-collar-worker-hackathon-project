import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, MapPin, Phone, Mail, Calendar, IndianRupee, ShieldCheck, Clock, Edit3, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { uploadFile } from '@/lib/upload';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10-digit phone number"),
  email: z.string().email("Invalid email address"),
  bio: z.string().optional(),
  experience_years: z.coerce.number().min(0, "Experience cannot be negative"),
  base_price: z.coerce.number().min(0, "Base price cannot be negative"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  status: z.enum(['online', 'offline', 'busy'])
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const WorkerProfilePage = () => {
  const { user, profile } = useAuth();
  const [workerProfile, setWorkerProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      bio: '',
      experience_years: 0,
      base_price: 0,
      address: '',
      city: '',
      state: '',
      status: 'online'
    }
  });

  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchWorkerProfile();
    }
  }, [user, profile]);

  const fetchWorkerProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch worker profile
      const { data: workerData, error: workerError } = await db
        .collection('worker_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (workerError) {
        console.error('Error fetching worker profile:', workerError);
      } else if (workerData) {
        setWorkerProfile(workerData);
        reset({
          full_name: profile?.full_name || '',
          phone: profile?.phone || '',
          email: profile?.email || '',
          bio: workerData.bio || '',
          experience_years: workerData.experience_years || 0,
          base_price: workerData.base_price || 0,
          address: profile?.address || '',
          city: profile?.city || '',
          state: profile?.state || '',
          status: workerData.status as any || 'online'
        });
      }
    } catch (error) {
      console.error('Error fetching worker profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    try {
      // Update profile in profiles table
      const { error: profileError } = await db
        .collection('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return;
      }

      // Update worker profile in worker_profiles table
      const { error: workerProfileError } = await db
        .collection('worker_profiles')
        .update({
          bio: data.bio,
          experience_years: data.experience_years,
          base_price: data.base_price,
          status: data.status
        })
        .eq('user_id', user.id);

      if (workerProfileError) {
        console.error('Error updating worker profile:', workerProfileError);
        return;
      }

      // Refresh the profile data
      fetchWorkerProfile();
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'aadhaar' | 'pan') => {
    e.preventDefault();
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (!user) {
      alert("Please login first to upload documents.");
      return;
    }
    
    const file = e.target.files[0];
    setUploadingDoc(true);
    
    try {
      const { url, error } = await uploadFile(file);
      
      if (error) {
        alert(error);
        return;
      }
      
      if (url) {
        // Save the URL to the worker profile in the database
        const updateData: any = {};
        if (targetField === 'aadhaar') updateData.aadhaar_url = url;
        if (targetField === 'pan') updateData.pan_url = url;

        const { error: dbError } = await db
          .collection('worker_profiles')
          .update(updateData)
          .eq('user_id', user.id);

        if (dbError) {
           alert("Uploaded but failed to save to profile.");
           return;
        }

        alert('Document uploaded successfully!');
        fetchWorkerProfile();
      }
    } catch (err: any) {
      alert('Error uploading document');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600">Manage your personal and professional information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="items-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src="/placeholder-avatar.jpg" alt="Profile" />
                <AvatarFallback>
                  {profile?.full_name?.charAt(0) || 'W'}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-xl mt-2">{profile?.full_name || 'Worker'}</CardTitle>
              <CardDescription>
                ID: {user?.id?.substring(0, 8) || 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    {workerProfile?.verification_status === 'verified' ? 'Verified Worker' : 'Unverified Worker'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline">
                    {workerProfile?.status === 'online' ? 'Online' : 
                     workerProfile?.status === 'offline' ? 'Offline' : 'Busy'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Experience</span>
                  <span className="font-medium">{workerProfile?.experience_years || 0} years</span>
                 </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Base Price</span>
                  <span className="font-medium">₹{workerProfile?.base_price || 0}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rating</span>
                  <span className="font-medium">4.8 ★</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Jobs Completed</span>
                  <span className="font-medium">128</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Personal Information
                </div>
                {!isEditing ? (
                  <Button type="button" onClick={() => setIsEditing(true)} size="sm">
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => { setIsEditing(false); reset(); }} size="sm">
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Update your personal and professional details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  {isEditing ? (
                    <>
                    <Input
                      id="full_name"
                      {...register('full_name')}
                      placeholder="Enter your full name"
                    />
                    {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message}</span>}
                    </>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted">
                      {workerProfile?.full_name || profile?.full_name || 'Not set'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  {isEditing ? (
                    <>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="Enter your 10 digit phone number"
                    />
                    {errors.phone && <span className="text-xs text-red-500">{errors.phone.message}</span>}
                    </>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {profile?.phone || 'Not set'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  {isEditing ? (
                    <>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="Enter your email address"
                    />
                    {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                    </>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {profile?.email || 'Not set'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Availability Status</Label>
                  {isEditing ? (
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="offline">Offline</SelectItem>
                          <SelectItem value="busy">Busy</SelectItem>
                        </SelectContent>
                      </Select>
                      )}
                    />
                  ) : (
                    <div className="p-2 border rounded-md bg-muted">
                      {workerProfile?.status === 'online' ? 'Online' : 
                       workerProfile?.status === 'offline' ? 'Offline' : 'Busy'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  {isEditing ? (
                    <>
                    <Input
                      id="experience_years"
                      type="number"
                      {...register('experience_years')}
                      placeholder="Enter years of experience"
                    />
                    {errors.experience_years && <span className="text-xs text-red-500">{errors.experience_years.message}</span>}
                    </>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {workerProfile?.experience_years || 0} years
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_price">Hourly Rate (₹)</Label>
                  {isEditing ? (
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        id="base_price"
                        type="number"
                        {...register('base_price')}
                        placeholder="Enter your hourly rate"
                        className="pl-8"
                      />
                      {errors.base_price && <span className="text-xs text-red-500 mt-1 block">{errors.base_price.message}</span>}
                    </div>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" />
                      ₹{workerProfile?.base_price || 0}/hr
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  {isEditing ? (
                    <>
                    <Textarea
                      id="bio"
                      {...register('bio')}
                      placeholder="Tell us about yourself and your expertise"
                      rows={4}
                    />
                    {errors.bio && <span className="text-xs text-red-500">{errors.bio.message}</span>}
                    </>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted min-h-[100px]">
                      {workerProfile?.bio || 'No bio set'}
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  {isEditing ? (
                    <>
                    <Textarea
                      id="address"
                      {...register('address')}
                      placeholder="Enter your address"
                      rows={2}
                    />
                    {errors.address && <span className="text-xs text-red-500">{errors.address.message}</span>}
                    </>
                  ) : (
                    <div className="p-2 border rounded-md bg-muted flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      {profile?.address || 'Not set'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    {isEditing ? (
                      <>
                      <Input
                        id="city"
                        {...register('city')}
                        placeholder="Enter your city"
                      />
                      {errors.city && <span className="text-xs text-red-500">{errors.city.message}</span>}
                      </>
                    ) : (
                      <div className="p-2 border rounded-md bg-muted">
                        {profile?.city || 'Not set'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    {isEditing ? (
                      <>
                      <Input
                        id="state"
                        {...register('state')}
                        placeholder="Enter your state"
                      />
                      {errors.state && <span className="text-xs text-red-500">{errors.state.message}</span>}
                      </>
                    ) : (
                      <div className="p-2 border rounded-md bg-muted">
                        {profile?.state || 'Not set'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            </form>
          </Card>

          {/* Verification Status */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>
                Your verification status and required documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                  <ShieldCheck className="h-8 w-8 text-green-500 mb-2" />
                  <span className="font-medium">Aadhaar</span>
                  <Badge variant="default" className="mt-2">
                    {workerProfile?.aadhaar_verified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                  <ShieldCheck className="h-8 w-8 text-green-500 mb-2" />
                  <span className="font-medium">PAN Card</span>
                  <Badge variant="secondary" className="mt-2">
                    {workerProfile?.pan_verified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                  <ShieldCheck className="h-8 w-8 text-green-500 mb-2" />
                  <span className="font-medium">Skills</span>
                  <Badge variant="default" className="mt-2">
                    {workerProfile?.skills_verified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
                <div className="relative">
                  <input 
                    type="file" 
                    id="aadhaar-upload"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleDocumentUpload(e, 'aadhaar')}
                  />
                  <Button variant="outline" onClick={() => document.getElementById('aadhaar-upload')?.click()} disabled={uploadingDoc}>
                    {uploadingDoc ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload Aadhaar
                  </Button>
                </div>
                
                <div className="relative">
                  <input 
                    type="file" 
                    id="pan-upload"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleDocumentUpload(e, 'pan')}
                  />
                  <Button variant="outline" onClick={() => document.getElementById('pan-upload')?.click()} disabled={uploadingDoc}>
                    {uploadingDoc ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload PAN
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkerProfilePage;