import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Shield,
  Star,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Navigation,
  HardHat,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

export function EnhancedHeroSection() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  // ✅ Memoized slides (performance optimized)
  const slides = useMemo(
    () => [
      {
        badge:
          language === 'hi'
            ? 'भारत का नंबर 1'
            : "India's #1 Service Platform",
        title:
          language === 'hi'
            ? 'कारीगर, जिनका आप \nभरोसा कर सकते हैं'
            : 'Handpicked Experts \nYou Can Trust',
        subtitle:
          language === 'hi'
            ? '60 सेकंड में मैच'
            : 'Matched in 60 Seconds',
        description:
          language === 'hi'
            ? 'सत्यापित पेशेवरों के साथ अपने घर के कामों को आसान बनाएं। कोई छिपी हुई फीस नहीं।'
            : "Turn your home to-do list into a 'done' list with verified professionals.",
        image:
          'img2.jpg'
      },
      {
        badge:
          language === 'hi'
            ? 'पारदर्शी मूल्य'
            : 'Pay What You See',
        title:
          language === 'hi'
            ? 'प्रीमियम सेवाएं \nकिफायती दामों पर'
            : 'Premium Help \nAt Fair Prices',
        subtitle:
          language === 'hi'
            ? '10% कमीशन मॉडल'
            : 'Fair 10% Commission',
        description:
          language === 'hi'
            ? 'बिचौलियों को हटाएं। सीधे कारीगरों के साथ जुड़ें और 30% तक बचत करें।'
            : 'Cut out the middleman. Connect directly with workers and save up to 30%.',
        image:
          'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800'
      }
    ],
    [language]
  );

  // ✅ Safe interval reset when slides change
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleSearch = () => {
    navigate(
      searchQuery
        ? `/services?search=${encodeURIComponent(searchQuery)}`
        : '/services'
    );
  };

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-white">

      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[100px]" />

      <div className="container relative z-10 px-4 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* LEFT CONTENT */}
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-4">

              <Badge className="py-1.5 px-4 bg-primary/5 text-primary rounded-full font-bold">
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                {slides[currentSlide].badge}
              </Badge>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] text-slate-900">
                {slides[currentSlide].title.split('\n').map((line, i) => (
                  <span key={i} className="block">
                    {line}
                    {i === 0 && (
                      <span className="text-primary italic">.</span>
                    )}
                  </span>
                ))}
              </h1>

              <h2 className="text-2xl md:text-3xl font-bold text-primary">
                {slides[currentSlide].subtitle}
              </h2>

              <p className="text-lg text-slate-500 max-w-xl leading-relaxed">
                {slides[currentSlide].description}
              </p>
            </div>

            {/* SEARCH BOX */}
            <div className="relative max-w-2xl">
              <div className="flex flex-col sm:flex-row gap-3 p-3 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-300/40">

                <div className="flex-1 flex items-center px-4">
                  <Search className="h-6 w-6 text-slate-400 mr-4" />
                  <Input
                    aria-label="Search services"
                    placeholder={
                      language === 'hi'
                        ? 'सेवा खोजें...'
                        : 'What help do you need?'
                    }
                    className="border-none shadow-none focus-visible:ring-0 text-lg p-0 h-12"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  className="h-14 px-10 rounded-2xl text-lg font-bold"
                >
                  Book Professional
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* QUICK STATS */}
            <div className="flex flex-wrap gap-8 pt-6">
              {[
                { label: 'Verified Pros', val: '12,400+', icon: Shield },
                { label: 'Avg Rating', val: '4.9/5', icon: Star },
                { label: 'Happy Users', val: '80k+', icon: Users }
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary border border-slate-100">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {s.val}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                      {s.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT VISUAL */}
          <div className="relative hidden lg:block">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="relative aspect-square rounded-[4rem] bg-slate-100 overflow-hidden shadow-xl border-8 border-white"
              >
                <img
                  src={slides[currentSlide].image}
                  alt="Service Professional"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Floating Verified Badge */}
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="absolute top-12 -left-5 bg-white p-5 rounded-3xl shadow-xl shadow-slate-300/40 max-w-[200px]"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-bold text-slate-800">
                      Govt. Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pre-vetted with Aadhaar & Police checks.
                  </p>
                </motion.div>

                {/* Speed Card */}
                <motion.div
                  animate={{ x: [0, 12, 0] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1
                  }}
                  className="absolute bottom-12 -right-2 bg-slate-900 p-6 rounded-3xl text-white max-w-[220px]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Navigation className="h-5 w-5 text-primary" />
                    <span className="font-bold">
                      Lightning Fast
                    </span>
                  </div>

                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '80%' }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="h-full bg-primary"
                    />
                  </div>

                  <p className="text-[10px] uppercase tracking-widest text-slate-400">
                    Avg matching time: 58s
                  </p>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
