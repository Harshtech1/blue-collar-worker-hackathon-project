import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'rahi_pwa_prompt_dismissed';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already running in standalone (installed) mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Don't show if user dismissed recently (7 days)
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissed = new Date(dismissedAt);
      const daysSince = (Date.now() - dismissed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay to not interrupt initial page load
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
    setIsInstalling(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      className={`
        fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50
        transform transition-all duration-500 ease-out
        ${showPrompt ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}
      `}
      role="dialog"
      aria-label="Install RAHI App"
    >
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-100 dark:border-blue-900 overflow-hidden">
        {/* Gradient top bar */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

        <div className="p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            {/* App Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden shadow-md border border-blue-200">
              <img
                src="/rahi-icon-192.png"
                alt="RAHI App"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Install RAHI App
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Add to your home screen for instant access — works offline too!
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm gap-1.5 text-xs"
              onClick={handleInstall}
              disabled={isInstalling}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {isInstalling ? 'Installing...' : 'Add to Home Screen'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs px-3"
              onClick={handleDismiss}
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
