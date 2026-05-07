import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Upload, MapPin, IdCard, Briefcase, Calendar, Clock, 
  IndianRupee, Camera, Sparkles, CheckCircle2, ChevronRight,
  Shield, User, Smartphone, Building2, Star, Lock
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FormData = {
  personal: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    dob: string;
    gender: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  professional: {
    services: string[];
    experience: string;
    certifications: string;
    portfolio: string;
    availability: {
      weekdays: boolean;
      weekends: boolean;
      flexible: boolean;
    };
    preferredHours: string;
    hourlyRate: string;
  };
  documents: {
    aadhaar: File | null;
    pan: File | null;
    bankDetails: File | null;
    certificates: File | null;
  };
  terms: boolean;
};

const WorkerOnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    personal: {
      firstName: profile?.full_name?.split(' ')[0] || '',
      lastName: profile?.full_name?.split(' ').slice(1).join(' ') || '',
      phone: profile?.phone || '',
      email: profile?.email || '',
      dob: '',
      gender: '',
      address: '',
      city: profile?.city || '',
      state: profile?.state || '',
      pincode: profile?.pincode || ''
    },
    professional: {
      services: [],
      experience: '',
      certifications: '',
      portfolio: '',
      availability: {
        weekdays: true,
        weekends: true,
        flexible: false
      },
      preferredHours: '9am-6pm',
      hourlyRate: ''
    },
    documents: {
      aadhaar: null,
      pan: null,
      bankDetails: null,
      certificates: null
    },
    terms: false
  });

  const totalSteps = 4;

  const handleInputChange = (section: keyof FormData, field: string, value: any) => {
    setFormData(prev => {
      if (section === 'terms') return { ...prev, terms: value };
      
      const currentSection = prev[section] as any;
      return {
        ...prev,
        [section]: {
          ...currentSection,
          [field]: value
        }
      };
    });
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      professional: {
        ...prev.professional,
        services: prev.professional.services.includes(service)
          ? prev.professional.services.filter(s => s !== service)
          : [...prev.professional.services, service]
      }
    }));
  };

  const handleDocumentChange = (field: keyof FormData['documents'], file: File | null) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [field]: file,
      }
    }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // 1. Update Profile Role
      await db
        .collection('profiles')
        .update({ role: 'worker' })
        .eq('id', user.id);

      // 2. Create Worker Profile
      const { error: workerError } = await db
        .collection('worker_profiles')
        .upsert({
          user_id: user.id,
          experience_years: parseInt(formData.professional.experience) || 0,
          bio: formData.professional.portfolio,
          base_price: parseFloat(formData.professional.hourlyRate) || 300,
          status: 'online',
          kyc_status: 'pending'
        } as any);

      if (workerError) throw workerError;

      toast.success('Onboarding completed successfully!');
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = '/worker/dashboard';
      }, 1500);

    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error('Failed to save profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const stepDetails = [
    { title: 'Personal', icon: User, color: 'text-blue-500' },
    { title: 'Professional', icon: Briefcase, color: 'text-indigo-500' },
    { title: 'Documents', icon: IdCard, color: 'text-amber-500' },
    { title: 'Finalize', icon: Sparkles, color: 'text-emerald-500' },
  ];

  return (
    <Layout hideBottomNav>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-50 via-white to-blue-50 pb-20 pt-10">
        <div className="container max-w-4xl px-4">
          
          {/* Header Progress */}
          <div className="mb-12 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-6"
            >
              <Sparkles className="h-4 w-4" />
              <span>Step {step} of {totalSteps}: {stepDetails[step-1].title}</span>
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Join the <span className="bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">RAHI Elite</span> Team
            </h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
              Complete your professional profile to start receiving service requests in your area.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar Steps (Desktop) */}
            <div className="hidden lg:col-span-3 lg:flex flex-col gap-4">
              {stepDetails.map((s, i) => {
                const isActive = step === i + 1;
                const isCompleted = step > i + 1;
                return (
                  <div key={i} className={cn(
                    "relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-500",
                    isActive ? "bg-white border-primary shadow-xl shadow-primary/5 scale-105 z-10" : 
                    isCompleted ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                    "bg-slate-50 border-transparent text-slate-400 opacity-60"
                  )}>
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                      isActive ? "bg-primary text-white" : 
                      isCompleted ? "bg-emerald-500 text-white" : "bg-slate-200"
                    )}>
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                    </div>
                    <span className="font-bold">{s.title}</span>
                  </div>
                );
              })}
            </div>

            {/* Main Form Content */}
            <div className="lg:col-span-9">
              <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                <div className="h-2 w-full bg-slate-100 italic relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(step / totalSteps) * 100}%` }}
                    className="absolute inset-y-0 bg-gradient-to-r from-primary to-orange-500"
                  />
                </div>
                
                <CardContent className="p-8 md:p-12">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      {step === 1 && (
                        <div className="space-y-8">
                          <HeaderSection 
                            title="Personal Identity" 
                            subtitle="Verify your credentials and contact info" 
                            icon={User}
                            color="text-blue-600"
                          />
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField 
                              label="First Name" 
                              value={formData.personal.firstName}
                              onChange={(v: any) => handleInputChange('personal', 'firstName', v)}
                              placeholder="e.g. Rahul"
                            />
                            <InputField 
                              label="Last Name" 
                              value={formData.personal.lastName}
                              onChange={(v: any) => handleInputChange('personal', 'lastName', v)}
                              placeholder="e.g. Sharma"
                            />
                            <InputField 
                              label="Phone Number" 
                              value={formData.personal.phone}
                              onChange={(v: any) => handleInputChange('personal', 'phone', v)}
                              placeholder="+91 00000 00000"
                              disabled
                            />
                            <InputField 
                              label="Email Address" 
                              value={formData.personal.email}
                              onChange={(v: any) => handleInputChange('personal', 'email', v)}
                              placeholder="rahul@example.com"
                            />
                          </div>

                          <div className="space-y-4">
                            <Label className="text-lg font-bold">Gender</Label>
                            <div className="flex flex-wrap gap-4">
                              {['Male', 'Female', 'Other'].map(g => (
                                <button
                                  key={g}
                                  onClick={() => handleInputChange('personal', 'gender', g)}
                                  className={cn(
                                    "px-8 py-3 rounded-2xl font-bold border-2 transition-all",
                                    formData.personal.gender === g 
                                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                                      : "bg-white border-slate-100 text-slate-600 hover:border-primary/30"
                                  )}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <Label className="text-lg font-bold">Full Address</Label>
                            <Textarea 
                              className="rounded-2xl border-slate-100 bg-slate-50/50 p-6 min-h-[120px] focus:ring-primary focus:bg-white transition-all text-lg font-medium"
                              value={formData.personal.address}
                              onChange={(e) => handleInputChange('personal', 'address', e.target.value)}
                              placeholder="Building Name, Locality, Landmark..."
                            />
                          </div>
                        </div>
                      )}

                      {step === 2 && (
                        <div className="space-y-8">
                          <HeaderSection 
                            title="Professional Skills" 
                            subtitle="List your expertise and set your rates" 
                            icon={Briefcase}
                            color="text-indigo-600"
                          />

                          <div className="space-y-4">
                            <Label className="text-lg font-bold">Services You Offer</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {['AC Repair', 'Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'Masonry', 'Gardening'].map((service) => {
                                const isSelected = formData.professional.services.includes(service);
                                return (
                                  <button
                                    key={service}
                                    onClick={() => toggleService(service)}
                                    className={cn(
                                      "p-4 rounded-2xl border-2 text-left transition-all",
                                      isSelected 
                                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold" 
                                        : "bg-white border-slate-100 text-slate-600 hover:border-indigo-300"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={cn("h-4 w-4 rounded-full border-2", isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-200")} />
                                      {service}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                             <InputField 
                                label="Years of Experience" 
                                value={formData.professional.experience}
                                onChange={(v: any) => handleInputChange('professional', 'experience', v)}
                                placeholder="e.g. 5"
                                type="number"
                             />
                             <div className="space-y-3">
                               <Label className="text-lg font-bold">Desired Hourly Rate (₹)</Label>
                               <div className="relative">
                                 <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                 <Input 
                                   className="pl-12 h-14 rounded-2xl border-slate-100 bg-slate-50/50 font-bold text-xl"
                                   value={formData.professional.hourlyRate}
                                   onChange={(e) => handleInputChange('professional', 'hourlyRate', e.target.value)}
                                   placeholder="e.g. 500"
                                 />
                               </div>
                             </div>
                          </div>

                          <div className="space-y-4">
                            <Label className="text-lg font-bold">Brief Portfolio / About You</Label>
                            <Textarea 
                              className="rounded-2xl border-slate-100 bg-slate-50/50 p-6 min-h-[120px]"
                              value={formData.professional.portfolio}
                              onChange={(e) => handleInputChange('professional', 'portfolio', e.target.value)}
                              placeholder="Describe your previous work experience and notable projects..."
                            />
                          </div>
                        </div>
                      )}

                      {step === 3 && (
                        <div className="space-y-10">
                          <HeaderSection 
                            title="Verification Documents" 
                            subtitle="Safe and secure document verification" 
                            icon={Lock}
                            color="text-amber-600"
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <UploadCard 
                               title="Aadhaar Card" 
                               subtitle="Front and Back copy"
                                icon={IdCard}
                                file={formData.documents.aadhaar}
                                onFileSelected={(file: File | null) => handleDocumentChange('aadhaar', file)}
                              />
                              <UploadCard 
                                title="PAN Card" 
                                subtitle="Clear photograph of front"
                                icon={Smartphone}
                                file={formData.documents.pan}
                                onFileSelected={(file: File | null) => handleDocumentChange('pan', file)}
                              />
                              <UploadCard 
                                title="Bank Passbook" 
                                subtitle="For direct payments"
                                icon={Building2}
                                file={formData.documents.bankDetails}
                                onFileSelected={(file: File | null) => handleDocumentChange('bankDetails', file)}
                              />
                              <UploadCard 
                                title="Certificates" 
                                subtitle="Any skill certifications"
                                optional
                                icon={Star}
                                file={formData.documents.certificates}
                                onFileSelected={(file: File | null) => handleDocumentChange('certificates', file)}
                              />
                          </div>

                          <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 flex gap-4">
                            <div className="h-10 w-10 shrink-0 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center">
                              <Shield className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-bold text-amber-900">High Security Encryption</p>
                              <p className="text-sm text-amber-700">Your documents are encrypted and only used for KYC. RAHI never shares your sensitive data with third parties.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 4 && (
                        <div className="space-y-10 text-center py-6">
                          <div className="relative inline-block">
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', damping: 10 }}
                              className="h-32 w-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-glow"
                            >
                              <CheckCircle2 className="h-16 w-16 stroke-[3]" />
                            </motion.div>
                            <div className="absolute -top-2 -right-2 h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
                              <Sparkles className="h-6 w-6" />
                            </div>
                          </div>
                          
                          <div>
                            <h2 className="text-4xl font-black text-slate-900 mb-4">You're Almost Ready!</h2>
                            <p className="text-xl text-slate-500 max-w-lg mx-auto leading-relaxed">
                              By joining RAHI, you're becoming part of a community that values 
                              <span className="text-indigo-600 font-bold"> worker autonomy, ethical pay, and professional growth.</span>
                            </p>
                          </div>

                          <div className="max-w-md mx-auto p-8 rounded-[2rem] bg-indigo-50/50 border-2 border-dashed border-indigo-200 space-y-4">
                            <div className="flex items-start gap-3 text-left">
                              <Checkbox 
                                id="terms" 
                                className="mt-1 h-5 w-5 rounded-md"
                                checked={formData.terms}
                                onCheckedChange={(c) => setFormData({...formData, terms: c === true})}
                              />
                              <Label htmlFor="terms" className="text-sm text-slate-700 cursor-pointer">
                                I agree to RAHIs Terms of Service and Code of Ethics, committing to provide quality work with honesty.
                              </Label>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4">
                             <div className="flex justify-center gap-8 text-sm font-bold text-slate-400">
                               <div className="flex items-center gap-1"><Shield className="h-4 w-4" /> Secure</div>
                               <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Near You</div>
                               <div className="flex items-center gap-1"><IndianRupee className="h-4 w-4" /> Same-day Pay</div>
                             </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="p-8 md:p-12 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row gap-4">
                  <Button 
                    variant="ghost" 
                    onClick={handleBack}
                    disabled={step === 1 || loading}
                    className="md:w-32 h-14 rounded-2xl font-bold text-slate-500 hover:text-slate-900"
                  >
                    Back
                  </Button>
                  <div className="flex-1" />
                  {step < totalSteps ? (
                    <Button 
                      onClick={handleNext} 
                      className="w-full md:w-64 h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 group"
                    >
                      Continue
                      <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSubmit} 
                      disabled={!formData.terms || loading}
                      className="w-full md:w-64 h-14 rounded-2xl font-black text-lg bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 flex items-center justify-center"
                    >
                      {loading ? (
                        <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Complete Registration'
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// --- Sub-components ---

const HeaderSection = ({ title, subtitle, icon: Icon, color }: any) => (
  <div className="flex items-center gap-5 border-b border-slate-50 pb-8">
    <div className={cn("h-16 w-16 rounded-[1.5rem] flex items-center justify-center bg-white shadow-lg", color)}>
      <Icon className="h-8 w-8" />
    </div>
    <div>
      <h3 className="text-2xl font-black text-slate-900">{title}</h3>
      <p className="text-slate-500 font-medium">{subtitle}</p>
    </div>
  </div>
);

const InputField = ({ label, value, onChange, placeholder, disabled, type = 'text' }: any) => (
  <div className="space-y-3">
    <Label className="text-lg font-bold">{label}</Label>
    <Input 
      disabled={disabled}
      type={type}
      className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 px-6 font-medium focus:ring-primary focus:bg-white transition-all text-lg"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const UploadCard = ({ title, subtitle, optional, icon: Icon, file, onFileSelected }: any) => {
  const inputId = `${title.toLowerCase().replace(/\s+/g, '-')}-upload`;

  return (
    <div className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center bg-slate-50/50 hover:bg-white hover:border-primary/50 transition-all cursor-pointer">
      <input
        id={inputId}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        onChange={(e) => onFileSelected?.(e.target.files?.[0] || null)}
      />
      <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
        <Icon className="h-8 w-8 text-slate-400 group-hover:text-primary" />
      </div>
      <div className="flex flex-col gap-1 mb-6">
        <h4 className="font-bold text-slate-800 flex items-center justify-center gap-2">
          {title} 
          {optional && <span className="text-[10px] uppercase bg-slate-200 px-2 py-0.5 rounded text-slate-500">Optional</span>}
        </h4>
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        {file && (
          <p className="text-xs font-semibold text-primary">{file.name}</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => document.getElementById(inputId)?.click()}
        className="rounded-xl border-slate-200 font-bold bg-white shadow-sm group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all"
      >
        <Upload className="h-4 w-4 mr-2" />
        {file ? 'Replace File' : 'Upload File'}
      </Button>
    </div>
  );
};

export default WorkerOnboardingPage;
