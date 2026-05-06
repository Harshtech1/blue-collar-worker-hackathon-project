import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  MapPin,
  Radar,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface DensityAnalysis {
  area: string;
  area_id: string;
  current_orders: number;
  current_workers: number;
  emergency_orders: number;
  history_points: number;
  predicted_demand: number;
  density_score: number;
  allocation_strategy: "salaried_core" | "hybrid" | "freelancer_pool";
  salaried_ratio: number;
  freelancer_ratio: number;
  confidence_score: number;
  reasoning: string;
  source: string;
  service_warning?: string;
}

interface SectorSignal {
  id: string;
  label: string;
  city: string;
  orders: number;
  workers: number;
  predicted: number;
  confidence: number;
  emergency: number;
  spend: number;
}

const sectorSignals: SectorSignal[] = [
  {
    id: "all",
    label: "All Active Zones",
    city: "RAHI launch cluster",
    orders: 34,
    workers: 16,
    predicted: 41,
    confidence: 0.86,
    emergency: 5,
    spend: 12800,
  },
  {
    id: "sector-15-noida",
    label: "Sector 15",
    city: "Noida",
    orders: 29,
    workers: 9,
    predicted: 37,
    confidence: 0.89,
    emergency: 4,
    spend: 9400,
  },
  {
    id: "agra-cantt",
    label: "Agra Cantt",
    city: "Agra",
    orders: 17,
    workers: 10,
    predicted: 21,
    confidence: 0.82,
    emergency: 2,
    spend: 5200,
  },
  {
    id: "greater-noida-west",
    label: "Greater Noida West",
    city: "Greater Noida",
    orders: 8,
    workers: 12,
    predicted: 10,
    confidence: 0.78,
    emergency: 1,
    spend: 3100,
  },
];

const forecastBars = [42, 58, 46, 74, 68, 91, 83, 96, 88, 105, 112, 98];

const strategyLabel = {
  salaried_core: "Salaried Core",
  hybrid: "Hybrid Fleet",
  freelancer_pool: "Freelancer Pool",
};

const strategyTone = {
  salaried_core: "border-emerald-200 bg-emerald-50 text-emerald-800",
  hybrid: "border-amber-200 bg-amber-50 text-amber-800",
  freelancer_pool: "border-sky-200 bg-sky-50 text-sky-800",
};

const getStrategyFromDensity = (density: number) => {
  if (density >= 1.8) {
    return {
      allocation_strategy: "salaried_core" as const,
      salaried_ratio: 0.8,
      freelancer_ratio: 0.2,
      reasoning:
        "Demand pressure is high. Keep a salaried core team in this zone so service quality and acceptance speed do not depend on freelancer availability.",
    };
  }

  if (density >= 1.2) {
    return {
      allocation_strategy: "hybrid" as const,
      salaried_ratio: 0.45,
      freelancer_ratio: 0.55,
      reasoning:
        "Demand is active but still flexible. Hold a smaller salaried base and use freelancers to absorb peak-hour spikes.",
    };
  }

  return {
    allocation_strategy: "freelancer_pool" as const,
    salaried_ratio: 0.15,
    freelancer_ratio: 0.85,
    reasoning:
      "Demand is scattered. Avoid fixed salary burn here and cover the area with verified freelancers until order volume improves.",
  };
};

const findSector = (area: string) => {
  const normalized = area.trim().toLowerCase();
  return sectorSignals.find((sector) => (
    sector.id === normalized
    || sector.label.toLowerCase() === normalized
    || sector.city.toLowerCase() === normalized
  )) || sectorSignals[0];
};

const buildDemoAnalysis = (area: string): DensityAnalysis => {
  const sector = findSector(area || "all");
  const density = sector.predicted / Math.max(1, sector.workers);
  const strategy = getStrategyFromDensity(density);

  return {
    area: sector.label,
    area_id: sector.id,
    current_orders: sector.orders,
    current_workers: sector.workers,
    emergency_orders: sector.emergency,
    history_points: 180,
    predicted_demand: sector.predicted,
    density_score: Number(density.toFixed(2)),
    confidence_score: sector.confidence,
    source: "demo_density_engine",
    service_warning: "Demo mode is active. This uses realistic synthetic demand signals for presentation.",
    ...strategy,
  };
};

export function IntelligenceTab() {
  const [areaId, setAreaId] = useState("all");
  const [analysis, setAnalysis] = useState<DensityAnalysis>(() => buildDemoAnalysis("all"));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("Demo density model loaded. Connect backend + Python service for live Random Forest output.");

  const salariedPercent = Math.round(analysis.salaried_ratio * 100);
  const freelancerPercent = Math.round(analysis.freelancer_ratio * 100);
  const burnRisk = analysis.density_score < 1.2 ? "Low" : analysis.density_score < 1.8 ? "Controlled" : "Protected by salaried core";
  const serviceRisk = analysis.density_score >= 1.8 ? "High without core staff" : "Manageable";
  const expansionSignal = analysis.density_score >= 1.8 ? "Hire core team" : analysis.density_score >= 1.2 ? "Keep hybrid" : "Stay freelancer-led";

  const runAnalysis = async () => {
    setLoading(true);
    setNotice("");

    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API}/analytics/density/${encodeURIComponent(areaId || "all")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Density analysis failed");
      }

      setAnalysis(payload);
      setNotice(payload.source === "random_forest_service"
        ? "Live Random Forest prediction received from the Python analytics service."
        : "Backend fallback generated this recommendation because the Python model was unavailable.");
    } catch {
      setAnalysis(buildDemoAnalysis(areaId));
      setNotice("Backend is offline, so the local demo density model generated this recommendation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#07111f] p-6 text-white shadow-2xl shadow-slate-950/10 md:p-8">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
                <Radar className="h-4 w-4" />
                Density Intelligence Console
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
                Phase 2 POC
              </span>
            </div>

            <h2 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-tight md:text-6xl">
              Turn worker allocation into a measurable density decision.
            </h2>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-300 md:text-base">
              RAHI forecasts demand, compares it with active worker capacity, and recommends the right salaried-to-freelancer mix for each zone.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <HeroSignal icon={BriefcaseBusiness} label="Predicted Demand" value={`${analysis.predicted_demand} jobs`} />
              <HeroSignal icon={UsersRound} label="Active Workers" value={`${analysis.current_workers}`} />
              <HeroSignal icon={Activity} label="Density Score" value={analysis.density_score.toFixed(2)} emphasis />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">The operating formula</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-sm font-bold text-slate-400">Density</p>
              <div className="mt-3 flex items-center gap-3 text-2xl font-black text-white">
                <span>{analysis.predicted_demand}</span>
                <span className="text-slate-500">/</span>
                <span>{analysis.current_workers}</span>
                <span className="text-slate-500">=</span>
                <span className="text-emerald-300">{analysis.density_score.toFixed(2)}</span>
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">
                Predicted orders divided by active workers in the selected zone.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <FormulaTile label="High density" value="Core staff" tone="emerald" />
              <FormulaTile label="Low density" value="Freelancers" tone="sky" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Run allocation forecast</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Analyze a launch zone</h3>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-black text-slate-800 outline-none transition focus:border-slate-900 focus:bg-white sm:w-64"
                  placeholder="all, sector-15-noida"
                />
              </div>
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run Density Model
              </button>
            </div>
          </div>

          {notice && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
              {notice}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <RiskCard icon={ShieldCheck} label="Service risk" value={serviceRisk} />
            <RiskCard icon={TrendingDown} label="Burn control" value={burnRisk} />
            <RiskCard icon={ArrowUpRight} label="Next move" value={expansionSignal} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Recommended workforce mix</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">{strategyLabel[analysis.allocation_strategy]}</h3>
            </div>
            <span className={cn("rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider", strategyTone[analysis.allocation_strategy])}>
              {analysis.source === "random_forest_service" ? "Random Forest" : analysis.source === "demo_density_engine" ? "Demo Model" : "Fallback"}
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{analysis.reasoning}</p>

          <div className="mt-6 space-y-5">
            <AllocationBar label="Salaried core staff" value={salariedPercent} color="bg-emerald-500" />
            <AllocationBar label="Verified freelancer pool" value={freelancerPercent} color="bg-sky-500" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Zone portfolio</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Density decides the workforce model</h3>
            </div>
            <Cpu className="hidden h-6 w-6 text-slate-300 sm:block" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
              <span>Zone</span>
              <span>Demand</span>
              <span>Workers</span>
              <span>Density</span>
              <span>Decision</span>
            </div>
            {sectorSignals.map((sector) => {
              const density = sector.predicted / sector.workers;
              const strategy = getStrategyFromDensity(density);

              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => {
                    setAreaId(sector.id);
                    setAnalysis(buildDemoAnalysis(sector.id));
                    setNotice(`${sector.label} loaded from the demo density portfolio.`);
                  }}
                  className={cn(
                    "grid w-full grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1fr] items-center border-t border-slate-100 px-4 py-4 text-left text-sm transition hover:bg-slate-50",
                    analysis.area_id === sector.id && "bg-emerald-50/60",
                  )}
                >
                  <span>
                    <span className="block font-black text-slate-950">{sector.label}</span>
                    <span className="text-xs font-bold text-slate-400">{sector.city}</span>
                  </span>
                  <span className="font-black text-slate-800">{sector.predicted}</span>
                  <span className="font-black text-slate-800">{sector.workers}</span>
                  <span className="font-black text-emerald-700">{density.toFixed(2)}</span>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-600">
                    {strategyLabel[strategy.allocation_strategy]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">12-week demand forecast</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Growth pressure curve</h3>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>

          <div className="mt-8 flex h-64 items-end gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {forecastBars.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={cn(
                    "w-full rounded-t-xl transition-all",
                    index > 8 ? "bg-emerald-500" : index > 4 ? "bg-amber-400" : "bg-slate-300",
                  )}
                  style={{ height: `${Math.max(22, value * 1.7)}px` }}
                />
                <span className="text-[10px] font-black text-slate-400">W{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
              <p className="text-sm font-semibold leading-6 text-slate-200">
                Investor narrative: RAHI is not only booking jobs. It is measuring local demand density so expansion decisions protect quality and control salary burn.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <LensCard title="Operational Lens" body="Density tells operations where a reliable salaried core is needed." icon={MapPin} />
        <LensCard title="Predictive Lens" body="Random Forest forecasts tomorrow's order pressure from history, spend, and worker supply." icon={Cpu} />
        <LensCard title="POC Lens" body="Synthetic demo data proves the logic before large-scale real demand arrives." icon={Clock3} />
      </section>
    </div>
  );
}

function HeroSignal({ label, value, icon: Icon, emphasis = false }: { label: string; value: string; icon: typeof Activity; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", emphasis ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]")}>
      <Icon className={cn("mb-4 h-5 w-5", emphasis ? "text-emerald-300" : "text-slate-400")} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function FormulaTile({ label, value, tone }: { label: string; value: string; tone: "emerald" | "sky" }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      tone === "emerald" ? "border-emerald-300/20 bg-emerald-300/10" : "border-sky-300/20 bg-sky-300/10",
    )}>
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-2 text-sm font-black", tone === "emerald" ? "text-emerald-200" : "text-sky-200")}>{value}</p>
    </div>
  );
}

function RiskCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="mb-4 h-5 w-5 text-slate-400" />
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function AllocationBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function LensCard({ title, body, icon: Icon }: { title: string; body: string; icon: typeof MapPin }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <Icon className="mb-5 h-6 w-6 text-slate-400" />
      <h4 className="text-lg font-black text-slate-950">{title}</h4>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{body}</p>
    </div>
  );
}
