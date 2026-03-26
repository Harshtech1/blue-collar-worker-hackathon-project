import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X, MapPin, ChevronDown, User, LogOut,
  Settings, Bell, Search, Globe, Shield, Sparkles, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, languageOptions, Language } from '@/contexts/LanguageContext';
import { useLocation as useAppLocation } from '@/contexts/LocationContext';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { location: appLocation, detectLocation, loading: locationLoading } = useAppLocation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/services', label: t('nav.services') },
    { href: '/bookings', label: t('nav.bookings') },
    { href: '/help', label: t('nav.help') },
  ];

  const workerLinks = [
    { href: '/worker/dashboard', label: 'Dashboard' },
    { href: '/worker/jobs', label: 'Jobs' },
    { href: '/worker/earnings', label: 'Earnings' },
  ];

  const currentLinks = profile?.role === 'worker' ? workerLinks : navLinks;

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-500",
      isScrolled
        ? "bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm py-3"
        : "bg-transparent py-5"
    )}>
      <div className="container flex items-center justify-between px-4">

        {/* Logo Section */}
        <div className="flex items-center gap-3">
          {location.pathname !== '/' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="lg:hidden h-10 w-10 rounded-xl bg-slate-50 border border-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden shadow-lg shadow-primary/20 bg-white"
            >
              <img src="/images/rahi_logo.jpeg" alt="RAHI Logo" className="h-full w-full object-contain p-0.5" />
            </motion.div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black tracking-tighter text-slate-900 group-hover:text-primary transition-colors">RAHI</span>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Karigar 360</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
          {currentLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  isActive
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">

          {/* Location Picker - Hidden on very small screens */}
          <button 
            onClick={() => detectLocation()}
            disabled={locationLoading}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/50 hover:bg-white hover:border-primary/30 transition-all duration-300 text-sm font-bold text-slate-600"
          >
            <MapPin className={cn("h-4 w-4 text-primary", locationLoading && "animate-bounce")} />
            <span className="max-w-[100px] truncate text-xs">
              {locationLoading ? 'Detecting...' : appLocation?.city || 'Set Location'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* User Section */}
          <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-3 rounded-lg font-bold gap-2 text-slate-600">
                  <Globe className="h-4 w-4" />
                  {language === 'en' ? 'EN' : 'HI'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl p-1">
                {languageOptions.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code as Language)}
                    className={cn("rounded-lg font-medium", language === lang.code && 'bg-primary/5 text-primary')}
                  >
                    {lang.nativeName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {user && <NotificationBell />}

            <div className="w-px h-6 bg-slate-100 mx-1" />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-lg p-0 bg-primary/5 hover:bg-primary/10 transition-colors">
                    <div className="h-7 w-7 rounded-md bg-primary text-white flex items-center justify-center font-black text-xs">
                      {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-xl mb-2">
                    <p className="font-black text-slate-800 leading-none">{profile?.full_name}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-wider">{profile?.role}</p>
                  </div>
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="rounded-xl py-3 cursor-pointer">
                    <User className="mr-3 h-4 w-4 text-slate-400" />
                    <span className="font-bold">My Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-xl py-3 cursor-pointer">
                    <Settings className="mr-3 h-4 w-4 text-slate-400" />
                    <span className="font-bold">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem onClick={handleSignOut} className="rounded-xl py-3 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                    <LogOut className="mr-3 h-4 w-4" />
                    <span className="font-bold">Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <Button
                  size="sm"
                  className="h-9 px-6 rounded-lg font-black shadow-lg shadow-primary/20"
                >
                  Login / Register
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[350px] p-0 border-none">
              <div className="h-full flex flex-col bg-white">
                <div className="p-6 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-white">
                      <img src="/images/rahi_logo.jpeg" alt="RAHI Logo" className="h-full w-full object-contain p-0.5" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter">RAHI</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><X className="h-6 w-6" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Main Menu</p>
                    {currentLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-lg text-slate-700"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div className="space-y-4">
                    <button 
                      onClick={() => detectLocation()}
                      disabled={locationLoading}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <MapPin className={cn("h-5 w-5 text-primary", locationLoading && "animate-bounce")} />
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {locationLoading ? 'Detecting Location...' : 'Your Location'}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">
                            {appLocation?.address || 'Tap to detect location'}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>

                {!user && (
                  <div className="p-6 bg-slate-50">
                    <Button onClick={() => { setIsOpen(false); navigate('/login'); }} className="w-full h-14 rounded-2xl font-black text-lg">
                      Login / Register
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

        </div>
      </div>
    </header >
  );
}
