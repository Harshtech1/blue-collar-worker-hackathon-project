import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Star,
  Zap,
  Settings,
  Droplets,
  ArrowRight,
  Paintbrush,
  Thermometer,
  Hammer,
} from 'lucide-react';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useServices, ServiceCategory } from '@/hooks/useServices';
import { useLanguage } from '@/contexts/LanguageContext';
import { StaggerContainer, StaggerItem, HoverScale } from '@/components/ui/animated-container';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  droplets: Droplets,
  zap: Zap,
  settings: Settings,
  hammer: Hammer,
  paintbrush: Paintbrush,
  thermometer: Thermometer,
};

const CATEGORIES = [
  { id: 'all', label: 'All Services', icon: Settings },
  { id: 'plumbing', label: 'Plumbing', icon: Droplets },
  { id: 'electrical', label: 'Electrical', icon: Zap },
  { id: 'carpentry', label: 'Carpentry', icon: Hammer },
  { id: 'painting', label: 'Painting', icon: Paintbrush },
  { id: 'appliance-repair', label: 'Appliance Repair', icon: Settings },
  { id: 'ac-repair', label: 'AC Service', icon: Thermometer },
];

export default function Services() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading } = useServices();
  const { language } = useLanguage();

  const [services, setServices] = useState<ServiceCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState('all');

  // Keep previous services to avoid disappearing issue
  useEffect(() => {
    if (data && Array.isArray(data)) {
      setServices(data);
    }
  }, [data]);

  const filteredServices = useMemo(() => {
    if (!services.length) return [];

    const query = searchQuery.toLowerCase();
    const category = activeCategory.toLowerCase();

    return services.filter((service) => {
      const name = service.name?.toLowerCase() || '';
      const localizedName = service.localizedName?.toLowerCase() || '';
      const description = service.description?.toLowerCase() || '';
      const serviceCategory = service.category?.toLowerCase() || '';

      const matchesSearch =
        !searchQuery ||
        name.includes(query) ||
        localizedName.includes(query) ||
        description.includes(query);

      const matchesCategory =
        activeCategory === 'all' ||
        serviceCategory === category;

      return matchesSearch && matchesCategory;
    });
  }, [services, searchQuery, activeCategory]);

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">

        {/* Header */}
        <div className="container py-12">
          <h1 className="text-4xl font-bold mb-6">
            {language === 'hi'
              ? 'विशेषज्ञ सेवाएं, आपके घर पर'
              : 'Expert Services, at Your Doorstep'}
          </h1>

          <div className="flex gap-3 max-w-xl">
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button>
              Search
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Categories */}
        <div className="container mb-10">
          <div className="flex gap-3 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-5 py-2 rounded-full border font-medium flex items-center gap-2",
                  activeCategory === cat.id
                    ? "bg-primary text-white"
                    : "bg-white text-slate-600"
                )}
              >
                <cat.icon className="h-4 w-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="container pb-20">
          {isLoading && !services.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-3xl" />
              ))}
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredServices.map((service) => {
                const Icon = iconMap[service.icon || ''] || Settings;

                return (
                  <StaggerItem key={service.id}>
                    <HoverScale>
                      <Card
                        onClick={() => navigate(`/book/${service.id}`)}
                        className="cursor-pointer rounded-3xl hover:shadow-xl transition"
                      >
                        <CardContent className="p-6">
                          <div
                            className="h-12 w-12 flex items-center justify-center rounded-xl mb-4"
                            style={{ backgroundColor: `${service.color || '#6366f1'}20` }}
                          >
                            <Icon
                              className="h-6 w-6"
                              style={{ color: service.color || '#6366f1' }}
                            />
                          </div>

                          <h3 className="text-lg font-bold mb-2">
                            {service.localizedName || service.name}
                          </h3>

                          <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                            {service.description || 'No description available.'}
                          </p>

                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900">
                              ₹299
                            </span>
                            <Star className="h-4 w-4 text-amber-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </HoverScale>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}

          {!isLoading && filteredServices.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No services found.
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
