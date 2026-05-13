import type { ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Droplets,
  Hammer,
  Heart,
  Paintbrush,
  Settings,
  Shield,
  Thermometer,
  Zap,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HOME_SERVICE_CATEGORIES } from '@/data/services/homeCategories';

const iconMap: Record<string, ElementType> = {
  droplets: Droplets,
  zap: Zap,
  hammer: Hammer,
  paintbrush: Paintbrush,
  settings: Settings,
  thermometer: Thermometer,
};

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function EnhancedServiceGrid() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="container px-4">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-blue-600">
              Verified Local Professionals
            </p>
            <h2 className="text-4xl font-black tracking-tight text-slate-950">
              Choose a Service Category
            </h2>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-500">
              Pick a main category first, then explore its subcategories before booking the right worker.
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

        <motion.div
          initial="hidden"
          animate="visible"
          variants={gridVariants}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
        >
          {HOME_SERVICE_CATEGORIES.map((category) => {
            const Icon = iconMap[category.icon] || Settings;

            return (
              <motion.div key={category.id} variants={cardVariants}>
                <button
                  type="button"
                  onClick={() => navigate(`/book/${category.id}`)}
                  className="group h-full w-full rounded-3xl text-left transition duration-300 hover:-translate-y-1"
                >
                  <Card className="h-full rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 group-hover:border-slate-300 group-hover:shadow-xl group-hover:shadow-slate-200/80">
                    <CardContent className="flex min-h-[250px] flex-col p-6">
                      <div className="mb-6 flex items-center justify-between gap-4">
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: `${category.color}20` }}
                        >
                          <Icon className="h-6 w-6" style={{ color: category.color }} />
                        </div>
                        <span
                          className="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]"
                          style={{ backgroundColor: `${category.color}12`, color: category.color }}
                        >
                          {category.subcategories.length} items
                        </span>
                      </div>

                      <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-950">
                        {category.name}
                      </h3>

                      <p className="mb-6 text-sm font-medium leading-6 text-slate-500">
                        {category.description}
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-4">
                        <span className="text-sm font-black text-slate-950">
                          Click to view subcategories
                        </span>
                        <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            );
          })}
        </motion.div>

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
