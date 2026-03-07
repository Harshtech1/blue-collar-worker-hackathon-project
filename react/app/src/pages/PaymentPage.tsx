import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, CreditCard, IndianRupee, Wallet, Landmark, 
  Smartphone, Shield, Check, AlertCircle, TrendingUp,
  Receipt, ArrowUpRight, ArrowDownLeft, Clock, Info,
  Plus, History, Settings, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PaymentGatewayCard } from '@/components/payment/PaymentGatewayCard';
import { BookingStatusBanner } from '@/components/customer/BookingStatusBanner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PaymentPage() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const amount = searchParams.get('amount') || '500';
  const bookingId = searchParams.get('bookingId');
  const type = searchParams.get('type') || (profile?.role === 'customer' ? 'payment' : 'payout');

  const [selectedMethod, setSelectedMethod] = useState<string>('upi');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(1240);

  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // PRIORITY 5 FIX: Real API call — creates payment record + updates booking in MongoDB.
  // Replaces the 2.5-second setTimeout mock that previously always "succeeded"
  // without any backend interaction.
  const handleAction = async () => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bookingId: bookingId || null,
          amount: Number(amount),
          method: selectedMethod,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Payment failed');
      }

      const data = await res.json();
      setTransactionId(data.transactionId);
      setSuccess(true);
      toast.success(
        type === 'payment'
          ? (language === 'hi' ? 'भुगतान सफल रहा!' : `Payment successful! Ref: ${data.transactionId}`)
          : (language === 'hi' ? 'निकासी अनुरोध भेज दिया गया है' : 'Payout request sent successfully')
      );
    } catch (err: any) {
      toast.error(`Payment failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            className="h-32 w-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 shadow-glow"
          >
            <Check className="h-16 w-16 stroke-[4]" />
          </motion.div>
          <h1 className="text-4xl font-black text-slate-900 mb-4">
            {type === 'payment' ? 'Success! Order Placed' : 'Transfer Initiated!'}
          </h1>
          <p className="text-xl text-slate-500 max-w-md mb-12">
            {type === 'payment' 
              ? `Your payment of ₹${amount} has been confirmed. A professional is assigned to your service.`
              : `₹${amount} will be credited to your bank account within 30 minutes.`
            }
          </p>
          <Button onClick={() => navigate('/')} size="lg" className="rounded-2xl h-16 px-12 text-lg font-bold">
            Return to Home
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-20">
        <div className="container max-w-5xl px-4 py-8">
          
          {/* Header */}
          <div className="flex items-center gap-4 mb-10">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white shadow-sm">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                {type === 'payment' ? 'Complete Payment' : 'Earnings & Payouts'}
              </h1>
              <p className="text-slate-500 font-medium">
                {language === 'hi' 
                  ? 'सुरक्षित और तेज़ डिजिटल लेनदेन' 
                  : 'Secure and lightning-fast digital transactions'
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Role-Specific Details */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Wallet Card */}
              <Card className="rounded-[3rem] border-slate-900 bg-slate-900 text-white overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -mr-32 -mt-32" />
                <CardContent className="p-10 relative z-10">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Available Balance</p>
                      <h2 className="text-6xl font-black">₹{walletBalance.toLocaleString()}</h2>
                    </div>
                    <Badge className="bg-white/10 text-white border-none py-2 px-4 backdrop-blur-md">
                      <Shield className="h-3 w-3 mr-2 text-emerald-400" /> Secure RAHI Pay
                    </Badge>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 rounded-[1.5rem] h-14 bg-white/5 border-white/20 hover:bg-white/10 font-bold">
                       <Plus className="h-5 w-5 mr-2" /> Add Money
                    </Button>
                    {profile?.role !== 'customer' && (
                       <Button className="flex-1 rounded-[1.5rem] h-14 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20">
                          <ArrowUpRight className="h-5 w-5 mr-2" /> Quick Payout
                       </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary / History */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" /> {type === 'payment' ? 'Order Details' : 'Recent Transactions'}
                  </h3>
                  <Button variant="ghost" className="text-primary font-bold">View More</Button>
                </div>

                {type === 'payment' ? (
                  <Card className="rounded-[2.5rem] border-slate-100 shadow-lg p-8">
                     <div className="space-y-6">
                        <div className="flex items-center gap-4">
                           <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
                              <Receipt className="h-8 w-8" />
                           </div>
                           <div className="flex-1">
                              <h4 className="font-bold text-lg">Booking #RAHI-2241</h4>
                              <p className="text-sm text-slate-500">AC Power Jet Service</p>
                           </div>
                           <Badge variant="outline" className="text-slate-400 font-bold">PENDING</Badge>
                        </div>
                        
                        <div className="space-y-3 pt-6 border-t border-slate-50">
                           <div className="flex justify-between text-slate-500 font-medium">
                              <span>Service Base Charge</span>
                              <span className="text-slate-900">₹{parseInt(amount) - 20}</span>
                           </div>
                           <div className="flex justify-between text-slate-500 font-medium">
                              <span>Safety & Insurance</span>
                              <span className="text-slate-900">₹20</span>
                           </div>
                           <div className="flex justify-between pt-4 text-xl font-black text-slate-900">
                              <span>Payable Amount</span>
                              <span className="text-primary">₹{amount}</span>
                           </div>
                        </div>
                     </div>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {[
                      { title: 'Plumbing Job #882', date: 'Yesterday', amount: '+ 450', type: 'in' },
                      { title: 'Payout to HDFC Bank', date: '21 Jan 2024', amount: '- 2500', type: 'out' },
                      { title: 'Electrical Job #731', date: '19 Jan 2024', amount: '+ 1200', type: 'in' },
                    ].map((tx, idx) => (
                      <Card key={idx} className="rounded-3xl border-slate-100 hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center",
                                tx.type === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                              )}>
                                 {tx.type === 'in' ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                              </div>
                              <div>
                                 <h4 className="font-bold text-slate-800">{tx.title}</h4>
                                 <p className="text-xs text-slate-400 font-medium">{tx.date}</p>
                              </div>
                           </div>
                           <span className={cn("text-lg font-black", tx.type === 'in' ? "text-emerald-600" : "text-slate-800")}>
                             {tx.amount}
                           </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Gateway Options */}
            <div className="lg:col-span-5">
              <Card className="rounded-[3rem] border-slate-100 shadow-2xl overflow-hidden bg-white sticky top-8">
                 <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
                   <CardTitle className="flex items-center gap-2">
                     <Lock className="h-5 w-5 text-emerald-500" />
                     {type === 'payment' ? 'Select Payment Method' : 'Payout Destination'}
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-8">
                   <div className="space-y-8">
                     <PaymentGatewayCard 
                        selectedId={selectedMethod} 
                        onSelect={setSelectedMethod} 
                        language={language as 'en' | 'hi'}
                     />

                     {selectedMethod === 'upi' && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                         <div className="space-y-2">
                           <Label className="font-bold text-slate-700">Enter UPI ID</Label>
                           <Input placeholder="yourname@upi" className="rounded-xl h-14 bg-slate-50 border-slate-200" />
                         </div>
                         <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <Info className="h-3 w-3" /> Securely verify your identity via SMS or Auth App
                         </p>
                       </motion.div>
                     )}

                     <Button 
                       disabled={processing} 
                       onClick={handleAction} 
                       className="w-full h-16 rounded-2xl text-xl font-black shadow-xl shadow-primary/30 group"
                     >
                       {processing ? (
                         <>
                           <Clock className="mr-2 h-6 w-6 animate-spin" />
                           {type === 'payment' ? 'Establishing Connection...' : 'Verifying Account...'}
                         </>
                       ) : (
                         <>
                           {type === 'payment' ? `PAY ₹${amount} NOW` : 'CONFIRM WITHDRAWAL'}
                           <ArrowRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-2" />
                         </>
                       )}
                     </Button>
                     
                     <div className="flex items-center justify-center gap-6 pt-4 grayscale opacity-40">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" alt="UPI" className="h-6" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="MC" className="h-6" />
                     </div>
                   </div>
                 </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
