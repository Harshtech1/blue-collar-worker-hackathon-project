import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronRight,
  Droplets,
  GraduationCap,
  Grid3X3,
  Hammer,
  HardHat,
  Heart,
  Home,
  Settings,
  Shield,
  Shirt,
  Sparkles,
  Tent,
  Utensils,
  Zap,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useServices } from '@/hooks/useServices';
import { StaggerContainer, StaggerItem, HoverScale } from '@/components/ui/animated-container';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  droplets: Droplets,
  zap: Zap,
  hammer: Hammer,
  home: Home,
  settings: Settings,
  'grid-3x3': Grid3X3,
  'hard-hat': HardHat,
  tent: Tent,
  shirt: Shirt,
  utensils: Utensils,
  'graduation-cap': GraduationCap,
  sparkles: Sparkles,
};

const CATEGORIES = [
  { id: 'all', label: 'All Services', icon: Grid3X3 },
  { id: 'repair', label: 'Repairs', icon: Settings },
  { id: 'cleaning', label: 'Cleaning', icon: Droplets },
  { id: 'home', label: 'Home Care', icon: Hammer },
];

export function EnhancedServiceGrid() {
  const navigate = useNavigate();
  const { data, isLoading } = useServices();

  const [services, setServices] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    if (data && Array.isArray(data)) {
      setServices(data);
    }
  }, [data]);

  const filteredServices = useMemo(() => {
    if (!services || services.length === 0) return [];

    if (activeCategory === 'all') {
      return services.slice(0, 10);
    }

    return services
      .filter((service) => service.category?.toLowerCase() === activeCategory)
      .slice(0, 10);
  }, [services, activeCategory]);

  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="container px-4">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-blue-600">
              Verified Local Professionals
            </p>
            <h2 className="text-4xl font-black tracking-tight text-slate-950">
              Popular Services Near You
            </h2>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-500">
              Book trusted workers for repairs, home support, events, laundry, food, and student assistance.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/services')}
            className="h-11 rounded-xl border-slate-200 px-5 font-bold"
          >
            Explore All Services
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="mb-10 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-black transition',
                activeCategory === category.id
                  ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/10'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800',
              )}
            >
              <category.icon className="h-4 w-4" />
              {category.label}
            </button>
          ))}
        </div>

        <StaggerContainer className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && services.length === 0 && (
            [...Array(8)].map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-3xl bg-slate-100" />
            ))
          )}

          {!isLoading && filteredServices.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400">
              No services found.
            </div>
          )}

          {filteredServices.map((service) => {
            const Icon = iconMap[service.icon] || Settings;

            return (
              <StaggerItem key={service.id}>
                <HoverScale scale={1.03}>
                  <Card
                    onClick={() => navigate(`/book/${service.id}`)}
                    className="group h-full cursor-pointer rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/80"
                  >
                    <CardContent className="flex min-h-[230px] flex-col p-6">
                      <div className="mb-6">
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: `${service.color}20` }}
                        >
                          <Icon className="h-6 w-6" style={{ color: service.color }} />
                        </div>
                      </div>

                      <h3 className="mb-2 text-lg font-black tracking-tight text-slate-950">
                        {service.name}
                      </h3>

                      <p className="mb-5 line-clamp-3 text-sm font-medium leading-6 text-slate-500">
                        {service.description}
                      </p>

                      <div className="mt-auto flex items-center justify-between">
                        <span className="rounded-full bg-slate-50 px-3 py-1.5 text-sm font-black text-slate-950">
                          From Rs 299
                        </span>
                        <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
                      </div>
                    </CardContent>
                  </Card>
                </HoverScale>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-20 rounded-3xl bg-slate-950 p-10 text-white shadow-2xl shadow-slate-200/70"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <h4 className="text-xl font-black">
                  Built on trust, safety, and transparent pricing.
                </h4>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  Every professional is verified before joining the RAHI network.
                </p>
              </div>
            </div>
            <Heart className="h-7 w-7 text-rose-300" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
