import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, Phone, User } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface JobRequestCardProps {
  job: {
    id: string;
    address: string;
    city: string | null;
    description: string | null;
    base_price: number;
    worker_earning: number;
    is_emergency: boolean;
    is_instant: boolean;
    scheduled_at: string | null;
    created_at: string;
    customer?: {
      full_name: string;
      phone: string;
      avatar_url: string | null;
    };
    category?: {
      name: string;
      icon: string;
      color: string;
    };
  };
  onAccept: (jobId: string) => Promise<{ error: Error | null }>;
  onReject: (jobId: string) => Promise<{ error: Error | null }>;
  variant?: 'pending' | 'active';
}

const OFFER_WINDOW_MS = 15_000;
const COUNTDOWN_RADIUS = 20;
const COUNTDOWN_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RADIUS;

export function JobRequestCard({ job, onAccept, onReject, variant = 'pending' }: JobRequestCardProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);

  const getRemainingMs = () => {
    if (variant !== 'pending') return OFFER_WINDOW_MS;
    const createdAtMs = new Date(job.created_at).getTime();
    if (Number.isNaN(createdAtMs)) return OFFER_WINDOW_MS;
    return Math.max(0, OFFER_WINDOW_MS - (Date.now() - createdAtMs));
  };

  const [remainingMs, setRemainingMs] = useState(getRemainingMs);

  const formattedTimeAgo = useMemo(
    () => formatDistanceToNow(new Date(job.created_at), { addSuffix: true }),
    [job.created_at],
  );

  useEffect(() => {
    if (variant !== 'pending') return;

    setRemainingMs(getRemainingMs());
    const interval = window.setInterval(() => {
      setRemainingMs(getRemainingMs());
    }, 250);

    return () => window.clearInterval(interval);
  }, [job.created_at, variant]);

  const hasExpired = variant === 'pending' && remainingMs <= 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const countdownProgress = remainingMs / OFFER_WINDOW_MS;
  const countdownOffset = COUNTDOWN_CIRCUMFERENCE * (1 - countdownProgress);

  const handleAccept = async () => {
    if (hasExpired) return;
    setLoading('accept');
    try {
      await onAccept(job.id);
    } catch (error) {
      console.error('Error accepting job:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (hasExpired) return;
    setLoading('reject');
    try {
      await onReject(job.id);
    } catch (error) {
      console.error('Error rejecting job:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      layout
    >
      <Card
        className={
          hasExpired
            ? 'border-amber-300/80 bg-gradient-to-br from-amber-50 to-white shadow-sm'
            : job.is_emergency
              ? 'border-destructive/50 bg-destructive/5 shadow-sm'
              : 'border-worker-primary/15 bg-gradient-to-br from-white to-worker-light/10 shadow-sm'
        }
      >
        <CardContent className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {job.category && (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${job.category.color}20` }}
                >
                  {job.category.icon}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-slate-900">{job.category?.name || 'Service'}</h3>
                <p className="text-sm text-muted-foreground">{formattedTimeAgo}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {variant === 'pending' && (
                <div className="flex flex-col items-center gap-1">
                  <div className="relative h-12 w-12">
                    <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                      <circle
                        cx="24"
                        cy="24"
                        r={COUNTDOWN_RADIUS}
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.28)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r={COUNTDOWN_RADIUS}
                        fill="none"
                        stroke={hasExpired ? '#f59e0b' : '#4f46e5'}
                        strokeLinecap="round"
                        strokeWidth="4"
                        strokeDasharray={COUNTDOWN_CIRCUMFERENCE}
                        strokeDashoffset={countdownOffset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900">
                      {hasExpired ? '0s' : `${remainingSeconds}s`}
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${hasExpired ? 'text-amber-700' : 'text-worker-primary'}`}>
                    {hasExpired ? 'Expired' : 'Timed Offer'}
                  </span>
                </div>
              )}

              <div className="flex flex-col items-end gap-1">
                <span className="text-lg font-bold text-green-600">
                  {`₹${job.worker_earning}`}
                </span>
                {job.is_emergency && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Emergency
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {variant === 'pending' && (
            <div className={`mb-3 rounded-xl border px-3 py-2 ${hasExpired ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-worker-primary/15 bg-worker-primary/5 text-slate-700'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {hasExpired ? 'Offer expired' : 'Priority booking window is live'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasExpired
                      ? 'This request is moving to the next available worker.'
                      : 'Accept quickly before this request is passed to the next worker.'}
                  </p>
                </div>
                {!hasExpired && (
                  <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">
                    {remainingSeconds}s left
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="mb-3 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="line-clamp-2 text-muted-foreground">
              {job.address}
              {job.city ? `, ${job.city}` : ''}
            </span>
          </div>

          {job.description && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
          )}

          {variant === 'active' && job.customer && (
            <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/50 p-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{job.customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{job.customer.phone}</p>
              </div>
              <Button size="icon" variant="ghost" asChild>
                <a href={`tel:${encodeURIComponent(job.customer.phone)}`}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}

          {job.scheduled_at && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Scheduled: {new Date(job.scheduled_at).toLocaleString()}</span>
            </div>
          )}

          {variant === 'pending' && (
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="min-h-11 flex-1 border-slate-300"
                onClick={handleReject}
                disabled={loading !== null || hasExpired}
              >
                {hasExpired ? 'Expired' : loading === 'reject' ? 'Skipping...' : t('worker.reject')}
              </Button>
              <Button
                className="min-h-11 flex-1 bg-green-600 shadow-sm hover:bg-green-700"
                onClick={handleAccept}
                disabled={loading !== null || hasExpired}
              >
                {hasExpired ? 'Offer Closed' : loading === 'accept' ? 'Accepting...' : t('worker.accept')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
