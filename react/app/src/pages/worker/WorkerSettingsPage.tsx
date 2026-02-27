import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  CreditCard, 
  Lock, 
  Eye, 
  EyeOff, 
  Camera, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  IndianRupee, 
  Clock, 
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Key,
  Trash2,
  Download,
  Upload
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { uploadFile } from '@/lib/upload';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const settingsSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10-digit phone number"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().min(6, "Invalid pincode"),
  preferred_language: z.string(),
  bio: z.string().optional(),
  experience_years: z.coerce.number().min(0, "Experience cannot be negative"),
  base_price: z.coerce.number().min(0, "Base price cannot be negative"),
  service_radius_km: z.coerce.number().min(1, "Radius must be > 0"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const WorkerSettingsPage = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [profileData, setProfileData] = useState<any>({});
  
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      pincode: '',
      preferred_language: 'en',
      bio: '',
      experience_years: 0,
      base_price: 0,
      service_radius_km: 10
    }
  });
  
  // Notification preferences
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    sms_notifications: true,
    push_notifications: true,
    job_alerts: true,
    payment_notifications: true,
    system_updates: false
  });
  
  // Security settings
  const [security, setSecurity] = useState({
    two_factor_enabled: false,
    session_timeout: '30', // minutes
    password_reset_required: false
  });
  
  // Preferences
  const [preferences, setPreferences] = useState({
    dark_mode: false,
    timezone: 'Asia/Kolkata',
    auto_accept_jobs: false,
    min_job_rating: 0
  });
  
  useEffect(() => {
    if (user && profile) {
      loadSettingsData();
    }
  }, [user, profile]);

  const loadSettingsData = async () => {
    if (!user) return;

    try {
      // Load profile data
      setProfileData({ avatar_url: profile?.avatar_url || null });

      let wData = null;
      if (profile?.role === 'worker') {
        const { data: workerProfile } = await db
          .collection('worker_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        wData = workerProfile;
      }
      
      reset({
        full_name: profile?.full_name || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
        city: profile?.city || '',
        state: profile?.state || '',
        pincode: profile?.pincode || '',
        preferred_language: profile?.preferred_language || 'en',
        bio: wData?.bio || '',
        experience_years: wData?.experience_years || 0,
        base_price: wData?.base_price || 0,
        service_radius_km: wData?.service_radius_km || 10
      });
      
      // Load notification preferences (would come from a settings table)
      // For now, using default values
      setNotifications({
        email_notifications: true,
        sms_notifications: true,
        push_notifications: true,
        job_alerts: true,
        payment_notifications: true,
        system_updates: false
      });
      
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploadingAvatar(true);
    
    try {
      const { url, error } = await uploadFile(file);
      
      if (error) {
        alert(error);
        return;
      }
      
      if (url) {
        setProfileData((prev: any) => ({ ...prev, avatar_url: url }));
        alert('Image uploaded successfully. Remember to save changes to apply.');
      }
    } catch (err: any) {
      alert('Error uploading image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSubmitProfile = async (data: SettingsFormValues) => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Update profiles table
      const { error: profileError } = await db
        .collection('profiles')
        .update({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          preferred_language: data.preferred_language,
        })
        .eq('id', user.id);
      
      if (profileError) throw profileError;
      
      // Update worker_profiles table if worker
      if (profile?.role === 'worker') {
        const { error: workerError } = await db
          .collection('worker_profiles')
          .update({
            bio: data.bio,
            experience_years: data.experience_years,
            base_price: data.base_price,
            service_radius_km: data.service_radius_km
          })
          .eq('user_id', user.id);
        
        if (workerError) throw workerError;
      }
      
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationUpdate = async () => {
    setSaving(true);
    try {
      // Save notification preferences (would go to a settings table)
      console.log('Notification preferences updated:', notifications);
      alert('Notification preferences updated!');
    } catch (error) {
      console.error('Error updating notifications:', error);
      alert('Error updating notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleSecurityUpdate = async () => {
    setSaving(true);
    try {
      // Save security settings (would go to a settings table)
      console.log('Security settings updated:', security);
      alert('Security settings updated!');
    } catch (error) {
      console.error('Error updating security:', error);
      alert('Error updating security settings.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setSaving(true);
    try {
      // Save preferences (would go to a settings table)
      console.log('Preferences updated:', preferences);
      alert('Preferences updated!');
    } catch (error) {
      console.error('Error updating preferences:', error);
      alert('Error updating preferences.');
    } finally {
      setSaving(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Picture Section */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Picture</CardTitle>
                  <CardDescription>Update your profile image</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={profileData.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl">
                        {profileData.full_name?.charAt(0) || 'W'}
                      </AvatarFallback>
                    </Avatar>
                    <Button 
                      size="icon" 
                      className="absolute bottom-0 right-0 rounded-full"
                      variant="outline"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      disabled={uploadingAvatar}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="file" 
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('avatar-upload')?.click()} disabled={uploadingAvatar}>
                      {uploadingAvatar ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Details */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal and professional details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmitProfile)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          {...register('full_name')}
                          placeholder="Enter your full name"
                        />
                        {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          {...register('email')}
                          placeholder="Enter your email"
                        />
                        {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          {...register('phone')}
                          placeholder="Enter your phone number"
                        />
                        {errors.phone && <span className="text-xs text-red-500">{errors.phone.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="preferred_language">Language</Label>
                        <Controller
                          name="preferred_language"
                          control={control}
                          render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="hi">Hindi</SelectItem>
                              <SelectItem value="mr">Marathi</SelectItem>
                              <SelectItem value="ta">Tamil</SelectItem>
                            </SelectContent>
                          </Select>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        {...register('bio')}
                        placeholder="Tell us about yourself and your expertise"
                        rows={4}
                      />
                      {errors.bio && <span className="text-xs text-red-500">{errors.bio.message}</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="experience">Years of Experience</Label>
                        <Input
                          id="experience"
                          type="number"
                          {...register('experience_years')}
                          placeholder="0"
                        />
                        {errors.experience_years && <span className="text-xs text-red-500">{errors.experience_years.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="base_price">Hourly Rate (₹)</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            id="base_price"
                            type="number"
                            {...register('base_price')}
                            placeholder="0"
                            className="pl-8"
                          />
                        </div>
                        {errors.base_price && <span className="text-xs text-red-500">{errors.base_price.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="service_radius">Service Radius (km)</Label>
                        <Input
                          id="service_radius"
                          type="number"
                          {...register('service_radius_km')}
                          placeholder="10"
                        />
                        {errors.service_radius_km && <span className="text-xs text-red-500">{errors.service_radius_km.message}</span>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          {...register('city')}
                          placeholder="Enter your city"
                        />
                        {errors.city && <span className="text-xs text-red-500">{errors.city.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          {...register('state')}
                          placeholder="Enter your state"
                        />
                        {errors.state && <span className="text-xs text-red-500">{errors.state.message}</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode</Label>
                        <Input
                          id="pincode"
                          {...register('pincode')}
                          placeholder="Enter pincode"
                        />
                        {errors.pincode && <span className="text-xs text-red-500">{errors.pincode.message}</span>}
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notifications.email_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, email_notifications: checked})
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">SMS Notifications</h3>
                    <p className="text-sm text-gray-500">Receive notifications via text message</p>
                  </div>
                  <Switch
                    checked={notifications.sms_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, sms_notifications: checked})
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Push Notifications</h3>
                    <p className="text-sm text-gray-500">Receive notifications in the app</p>
                  </div>
                  <Switch
                    checked={notifications.push_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, push_notifications: checked})
                    }
                  />
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4">Specific Notifications</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Job Alerts</h4>
                        <p className="text-sm text-gray-500">New job opportunities</p>
                      </div>
                      <Switch
                        checked={notifications.job_alerts}
                        onCheckedChange={(checked) => 
                          setNotifications({...notifications, job_alerts: checked})
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Payment Notifications</h4>
                        <p className="text-sm text-gray-500">Payment received or processed</p>
                      </div>
                      <Switch
                        checked={notifications.payment_notifications}
                        onCheckedChange={(checked) => 
                          setNotifications({...notifications, payment_notifications: checked})
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">System Updates</h4>
                        <p className="text-sm text-gray-500">Platform updates and announcements</p>
                      </div>
                      <Switch
                        checked={notifications.system_updates}
                        onCheckedChange={(checked) => 
                          setNotifications({...notifications, system_updates: checked})
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleNotificationUpdate} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage your account security and privacy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-500">Add an extra layer of security</p>
                  </div>
                  <Switch
                    checked={security.two_factor_enabled}
                    onCheckedChange={(checked) => 
                      setSecurity({...security, two_factor_enabled: checked})
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
                  <Select
                    value={security.session_timeout}
                    onValueChange={(value) => setSecurity({...security, session_timeout: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="0">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4">Account Actions</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      Download Account Data
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSecurityUpdate} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Security Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Preferences
              </CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Dark Mode</h3>
                    <p className="text-sm text-gray-500">Switch to dark theme</p>
                  </div>
                  <Switch
                    checked={preferences.dark_mode}
                    onCheckedChange={(checked) => 
                      setPreferences({...preferences, dark_mode: checked})
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">Time Zone</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(value) => setPreferences({...preferences, timezone: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                      <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Auto-Accept Jobs</h3>
                    <p className="text-sm text-gray-500">Automatically accept jobs that match your criteria</p>
                  </div>
                  <Switch
                    checked={preferences.auto_accept_jobs}
                    onCheckedChange={(checked) => 
                      setPreferences({...preferences, auto_accept_jobs: checked})
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="min_rating">Minimum Job Rating</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="min_rating"
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      value={preferences.min_job_rating}
                      onChange={(e) => setPreferences({...preferences, min_job_rating: parseFloat(e.target.value) || 0})}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-500">stars</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handlePreferencesUpdate} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing & Payments
              </CardTitle>
              <CardDescription>Manage your payment methods and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Bank Account</h3>
                      <p className="text-sm text-gray-500">**** **** **** 1234</p>
                    </div>
                  </div>
                  <Badge variant="default">Primary</Badge>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4">Payment History</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Job Payment</h4>
                        <p className="text-sm text-gray-500">Dec 15, 2024</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₹2,500</p>
                        <Badge variant="default">Completed</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Commission Deduction</h4>
                        <p className="text-sm text-gray-500">Dec 10, 2024</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-600">-₹250</p>
                        <Badge variant="default">Deducted</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4">Actions</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Add Payment Method
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      Download Payment History
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkerSettingsPage;