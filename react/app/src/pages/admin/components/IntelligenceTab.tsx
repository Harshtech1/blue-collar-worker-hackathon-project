import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Cpu,
  ListFilter,
  Loader2,
  MapPin,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  SimulationEngine,
  type SimulationCompletionPayload,
  type SimulationPhase,
  type SimulationTelemetryPayload,
} from "./SimulationEngine";
import { generateSimulationBatch, sectorSeeds } from "@/utils/simulationData";

interface DensityAnalysis {
  area: string;
  area_id: string;
  current_orders: number;
  current_workers: number;
  emergency_orders: number;
  history_points: number;
  predicted_demand: number;
  density_score: number;
  price_multiplier?: number;
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

interface InvestorAnalytics {
  summary: {
    totalBookings: number;
    completionRate: number;
    cancellationRate: number;
    churnRate: number;
    escalatedBookings: number;
    revenue: number;
    workerEarnings: number;
    platformCommission: number;
  };
  demandForecast: Array<{ label: string; actual: number; predicted: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  assignmentEscalations: Array<{
    bookingId: string;
    serviceName: string;
    areaId: string;
    suggestedPriceMultiplier: number;
    reason: string;
    escalatedAt?: string;
  }>;
  workerQuality: Array<{
    id: string;
    name: string;
    service: string;
    qualityScore: number;
    rating: number;
    completedJobs: number;
  }>;
}

type IntelligenceMode = "monitor" | "revenue" | "quality" | "risk";
type TimeLens = "24h" | "7d" | "30d";
type ChartView = "comparison" | "delta";
type HeroTone = "indigo" | "emerald" | "sky" | "amber" | "rose";

interface DemandSeriesPoint {
  label: string;
  actual: number;
  predicted: number;
  gap: number;
}

interface HeroSignalData {
  label: string;
  value: string;
  note: string;
  icon: typeof Activity;
  tone: HeroTone;
}

interface IntelligenceTabProps {
  routeZoneId?: string;
  onZoneChange?: (zoneId: string) => void;
}

interface CommandMapZone {
  id: string;
  label: string;
  city: string;
  center: [number, number];
  polygon: [number, number][];
}

interface ScenarioSnapshot {
  salariedCore: number;
  freelancerPool: number;
  totalWorkers: number;
  densityScore: number;
  priceMultiplier: number;
  projectedProfit: number;
  qualityScore: number;
  responseMinutes: number;
}

interface SimulationPreviewPoint {
  id: string;
  zoneId: string;
  label: string;
  position: [number, number];
  serviceType: string;
  estimatedValue: number;
  isEmergency: boolean;
}

interface StrategyBrief {
  signal: string;
  reasoning: string;
  procedures: string[];
  provider: string;
  model: string;
  historyId?: string | null;
  saved?: boolean;
  fallback?: boolean;
}

type StrategyTerminalStatus = "idle" | "thinking" | "ready" | "error";

interface LogicLogEntry {
  id: string;
  timestamp: string;
  message: string;
  tone: "info" | "success" | "warning" | "critical";
  source: "simulation" | "strategy" | "system";
}

const sectorSignals: SectorSignal[] = [
  {
    id: "all",
    label: "All Agra Zones",
    city: "Agra operations cluster",
    orders: 129,
    workers: 76,
    predicted: 157,
    confidence: 0.88,
    emergency: 17,
    spend: 64800,
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
    id: "taj-ganj",
    label: "Taj Ganj",
    city: "Agra",
    orders: 24,
    workers: 11,
    predicted: 32,
    confidence: 0.91,
    emergency: 4,
    spend: 7600,
  },
  {
    id: "fatehabad-road",
    label: "Fatehabad Road",
    city: "Agra",
    orders: 20,
    workers: 10,
    predicted: 27,
    confidence: 0.87,
    emergency: 3,
    spend: 6800,
  },
  {
    id: "civil-lines",
    label: "Civil Lines",
    city: "Agra",
    orders: 14,
    workers: 9,
    predicted: 18,
    confidence: 0.84,
    emergency: 2,
    spend: 4300,
  },
  {
    id: "sikandra",
    label: "Sikandra",
    city: "Agra",
    orders: 10,
    workers: 12,
    predicted: 13,
    confidence: 0.8,
    emergency: 1,
    spend: 3600,
  },
  {
    id: "dayalbagh",
    label: "Dayal Bagh",
    city: "Agra",
    orders: 9,
    workers: 8,
    predicted: 12,
    confidence: 0.79,
    emergency: 1,
    spend: 3100,
  },
  {
    id: "trans-yamuna",
    label: "Trans Yamuna",
    city: "Agra",
    orders: 16,
    workers: 9,
    predicted: 22,
    confidence: 0.83,
    emergency: 3,
    spend: 5400,
  },
  {
    id: "shamshabad-road",
    label: "Shamshabad Road",
    city: "Agra",
    orders: 8,
    workers: 7,
    predicted: 12,
    confidence: 0.77,
    emergency: 1,
    spend: 2900,
  },
];

const forecastBars = [42, 58, 46, 74, 68, 91, 83, 96, 88, 105, 112, 98];

const demoInvestorAnalytics: InvestorAnalytics = {
  summary: {
    totalBookings: 128,
    completionRate: 82.4,
    cancellationRate: 6.8,
    churnRate: 31.5,
    escalatedBookings: 2,
    revenue: 184500,
    workerEarnings: 156825,
    platformCommission: 27675,
  },
  demandForecast: [
    { label: "Mon", actual: 13, predicted: 15 },
    { label: "Tue", actual: 16, predicted: 18 },
    { label: "Wed", actual: 11, predicted: 14 },
    { label: "Thu", actual: 19, predicted: 22 },
    { label: "Fri", actual: 24, predicted: 27 },
    { label: "Sat", actual: 31, predicted: 35 },
    { label: "Sun", actual: 28, predicted: 32 },
  ],
  cancellationReasons: [
    { reason: "Worker too far", count: 4 },
    { reason: "Customer changed mind", count: 3 },
    { reason: "Parts unavailable", count: 2 },
  ],
  assignmentEscalations: [
    {
      bookingId: "demo-escalation-1",
      serviceName: "Emergency Plumbing",
      areaId: "agra-cantt",
      suggestedPriceMultiplier: 1.25,
      reason: "All ranked workers rejected or timed out.",
    },
    {
      bookingId: "demo-escalation-2",
      serviceName: "Deep Cleaning",
      areaId: "fatehabad-road",
      suggestedPriceMultiplier: 1.15,
      reason: "No ranked workers were available in the selected zone.",
    },
  ],
  workerQuality: [
    { id: "w1", name: "Ramesh Kumar", service: "Plumbing", qualityScore: 92, rating: 4.8, completedJobs: 86 },
    { id: "w2", name: "Sunita Devi", service: "Cleaning", qualityScore: 89, rating: 4.7, completedJobs: 73 },
    { id: "w3", name: "Imran Khan", service: "Electrical", qualityScore: 84, rating: 4.5, completedJobs: 58 },
  ],
};

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

const modeMeta: Record<IntelligenceMode, {
  label: string;
  eyebrow: string;
  title: string;
  body: string;
}> = {
  monitor: {
    label: "Live Monitor",
    eyebrow: "Operations pressure",
    title: "Watch zones, workers, and escalations in one command surface.",
    body: "This mode is for fast tactical decisions when demand, staffing, and surge signals need to be read together.",
  },
  revenue: {
    label: "Revenue Lens",
    eyebrow: "Margin control",
    title: "Track platform yield without losing worker trust.",
    body: "This mode highlights pricing, commission, and where demand pressure can defend better unit economics.",
  },
  quality: {
    label: "Quality Lens",
    eyebrow: "Service trust",
    title: "Use worker quality, completion, and repeatability as operating levers.",
    body: "This mode helps admins protect trust by promoting reliable workers and spotting quality drift early.",
  },
  risk: {
    label: "Risk Lens",
    eyebrow: "Escalation watch",
    title: "See where operational cracks appear before customers feel them.",
    body: "This mode surfaces rejection queues, cancellation drivers, and burn-control signals that need intervention.",
  },
};

const timeLensMeta: Record<TimeLens, { label: string; descriptor: string }> = {
  "24h": { label: "24H", descriptor: "intraday flow" },
  "7d": { label: "7D", descriptor: "weekly pattern" },
  "30d": { label: "30D", descriptor: "monthly outlook" },
};

const AGRA_MAP_CENTER: [number, number] = [27.19, 78.02];

const commandMapZones: CommandMapZone[] = sectorSeeds.map((seed) => ({
  id: seed.id,
  label: seed.label,
  city: seed.city,
  center: [
    Number(((seed.latRange[0] + seed.latRange[1]) / 2).toFixed(4)),
    Number(((seed.lngRange[0] + seed.lngRange[1]) / 2).toFixed(4)),
  ],
  polygon: [
    [seed.latRange[0], seed.lngRange[0]],
    [seed.latRange[0], seed.lngRange[1]],
    [seed.latRange[1], seed.lngRange[1]],
    [seed.latRange[1], seed.lngRange[0]],
  ],
}));

const previewSignalBatch = generateSimulationBatch({ batchIndex: 0, batchSize: 240 });

const previewSignalZoneMap = Object.fromEntries(
  sectorSignals.map((sector) => [sector.label, sector.id]),
);

const previewSignals: SimulationPreviewPoint[] = previewSignalBatch
  .map((point, index) => {
    const zoneId = previewSignalZoneMap[point.areaSector];
    if (!zoneId) return null;

    return {
      id: `preview-${index}`,
      zoneId,
      label: point.areaSector,
      position: [point.lat, point.lng] as [number, number],
      serviceType: point.serviceType,
      estimatedValue: point.estimatedValue,
      isEmergency: point.isEmergency,
    } satisfies SimulationPreviewPoint;
  })
  .filter((point): point is SimulationPreviewPoint => Boolean(point));

const getPriceMultiplier = (density: number) => (
  Number(Math.min(1.5, Math.max(0.85, 1 + (0.25 * (density - 1.2)))).toFixed(2))
);

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
    price_multiplier: getPriceMultiplier(density),
    confidence_score: sector.confidence,
    source: "demo_density_engine",
    service_warning: "Demo mode is active. This uses realistic synthetic demand signals for presentation.",
    ...strategy,
  };
};

const formatCurrency = (value: number) => `INR ${value.toLocaleString("en-IN")}`;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatTime = (value: Date | null) => (
  value
    ? value.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "--:--"
);

const formatAuditTimestamp = (value = new Date()) => (
  value.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
);

const clampNumber = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, value));

const getDensityTone = (density: number) => {
  if (density >= 2.1) return { fill: "#ef4444", stroke: "#b91c1c", label: "Critical density" };
  if (density >= 1.6) return { fill: "#f97316", stroke: "#c2410c", label: "High density" };
  if (density >= 1.15) return { fill: "#6366f1", stroke: "#4338ca", label: "Balanced density" };
  return { fill: "#0ea5e9", stroke: "#0369a1", label: "Freelancer-led" };
};

const buildScenarioSnapshot = (
  sector: SectorSignal,
  analysis: DensityAnalysis,
  salariedCore: number,
): ScenarioSnapshot => {
  const baselineCore = Math.max(1, Math.round(analysis.current_workers * analysis.salaried_ratio));
  const baselineFreelancers = Math.max(1, analysis.current_workers - baselineCore);
  const extraDemand = Math.max(0, analysis.predicted_demand - analysis.current_orders);
  const freelancerBuffer = baselineFreelancers + Math.max(0, Math.round(extraDemand / 6));
  const addedCore = Math.max(0, salariedCore - baselineCore);
  const totalWorkers = Math.max(analysis.current_workers, salariedCore + freelancerBuffer + addedCore);
  const densityScore = Number((analysis.predicted_demand / Math.max(1, totalWorkers)).toFixed(2));
  const priceMultiplier = getPriceMultiplier(densityScore);
  const averageTicket = Math.round(780 * priceMultiplier);
  const projectedRevenue = analysis.predicted_demand * averageTicket;
  const fixedPayroll = salariedCore * 1450;
  const freelancerPayout = freelancerBuffer * 430;
  const projectedProfit = Math.round(projectedRevenue - fixedPayroll - freelancerPayout - sector.spend);
  const qualityScore = Math.round(clampNumber(
    74
      + (salariedCore * 1.8)
      - Math.max(0, (densityScore - 1.2) * 12)
      + (analysis.confidence_score * 7)
      - (analysis.emergency_orders * 0.9),
    56,
    98,
  ));
  const responseMinutes = Math.round(clampNumber(34 - (salariedCore * 0.9) + (densityScore * 4.2), 8, 46));

  return {
    salariedCore,
    freelancerPool: freelancerBuffer,
    totalWorkers,
    densityScore,
    priceMultiplier,
    projectedProfit,
    qualityScore,
    responseMinutes,
  };
};

const buildStrategyFallback = ({
  zoneLabel,
  city,
  densityScore,
  predictedDemand,
  currentWorkers,
  emergencyOrders,
  priceMultiplier,
  timeLens,
  hottestSector,
  acquisitionCost,
  churnRate,
  marginLift,
}: {
  zoneLabel: string;
  city: string;
  densityScore: number;
  predictedDemand: number;
  currentWorkers: number;
  emergencyOrders: number;
  priceMultiplier: number;
  timeLens: TimeLens;
  hottestSector: string;
  acquisitionCost: number;
  churnRate: number;
  marginLift: number;
}): StrategyBrief => {
  if (densityScore > 2.5) {
    return {
      signal: `${zoneLabel} is overheating; density ${densityScore.toFixed(2)} is outpacing the current ${currentWorkers}-worker field capacity.`,
      reasoning: `The Density Rule treats ${zoneLabel} as a salaried-core zone because D=${densityScore.toFixed(2)} is above 2.5. With ${predictedDemand} forecast jobs and ${emergencyOrders} emergency orders, reliability matters more than freelancer flexibility.`,
      procedures: [
        `Deploy 5 salaried workers into ${zoneLabel} and route emergency demand there first until density cools below 2.3.`,
        `Hold pricing around ${priceMultiplier.toFixed(2)}x and defend fill rate before expanding acquisition in ${city}.`,
        `Run photo-proof QA checks in ${hottestSector} before the next ${timeLens} demand wave.`,
      ],
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  if (densityScore < 1.0) {
    return {
      signal: `${zoneLabel} is under-dense; D=${densityScore.toFixed(2)} means salaried hiring here is a burn trap right now.`,
      reasoning: `The Density Rule treats ${zoneLabel} as freelancer-led because D=${densityScore.toFixed(2)} is below 1.0. Fixed payroll would expand faster than service reliability, especially with acquisition cost already at ${formatCurrency(acquisitionCost)}.`,
      procedures: [
        `Pause salaried expansion in ${zoneLabel} and cover this zone with verified freelancers for the next ${timeLens}.`,
        `Shift referral bonuses to high-quality freelancers instead of adding fixed payroll in ${city}.`,
        `Re-open salaried hiring only if margin lift rises above ${formatCurrency(Math.max(0, marginLift))} while churn drops below ${churnRate.toFixed(1)}%.`,
      ],
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  return {
    signal: `${zoneLabel} is in the transition band; D=${densityScore.toFixed(2)} supports a hybrid workforce, but the next move should be paced carefully.`,
    reasoning: `The Density Rule keeps ${zoneLabel} hybrid because D=${densityScore.toFixed(2)} sits between 1.0 and 2.5. The zone can absorb a small salaried core, but churn at ${churnRate.toFixed(1)}% means burn control still matters.`,
    procedures: [
      `Add 2 salaried anchors in ${zoneLabel} while keeping flexible freelancer coverage for the next ${timeLens} cycle.`,
      `Keep pricing close to ${priceMultiplier.toFixed(2)}x until repeat demand rises faster than fixed labor cost.`,
      `Re-run the simulation after the next peak and promote ${zoneLabel} only if density stays above 1.8 for consecutive windows.`,
    ],
    provider: "rule_engine",
    model: "density-rule-fallback",
    saved: false,
    fallback: true,
  };
};

const buildSimulationLogicSignals = (
  simulation: SimulationCompletionPayload | null,
  zoneLabel: string,
) => {
  if (!simulation) {
    return [
      `Waiting for the 400k simulation evidence pack before briefing ${zoneLabel}.`,
    ];
  }

  const topSignals = simulation.topSignals.slice(0, 3).map((signal) => (
    `${signal.sector}: density ${signal.densityScore.toFixed(2)} with ${signal.projectedOrders.toLocaleString("en-IN")} projected orders across ${signal.activeWorkers} active workers.`
  ));

  return [
    `${simulation.hottestSector} emerged as the hottest sector in the latest ${simulation.totalPoints.toLocaleString("en-IN")} point run.`,
    ...topSignals,
  ].slice(0, 3);
};

const buildStrategyTerminalScript = ({
  status,
  activeSector,
  timeLensLabel,
  densityScore,
  strategyBrief,
  logicSignals,
}: {
  status: StrategyTerminalStatus;
  activeSector: SectorSignal;
  timeLensLabel: string;
  densityScore: number;
  strategyBrief: StrategyBrief | null;
  logicSignals: string[];
}) => {
  if (status === "thinking") {
    return [
      `$ rahi://strategy/${activeSector.id}`,
      `> Booting command lane for ${activeSector.label}`,
      `> Syncing ${timeLensLabel} density window at D=${densityScore.toFixed(2)}`,
      ...logicSignals.slice(0, 3).map((signal) => `> ${signal}`),
      "> Drafting CEO briefing...",
    ].join("\n");
  }

  if (!strategyBrief) {
    return [
      "$ rahi://strategy/awaiting-input",
      "> Select a zone or run the 400k simulation.",
      "> The strategy terminal will narrate the next move once live data arrives.",
    ].join("\n");
  }

  return [
    `$ rahi://strategy/${activeSector.id}`,
    `> SIGNAL: ${strategyBrief.signal}`,
    `> WHY: ${strategyBrief.reasoning}`,
    ...strategyBrief.procedures.map((procedure, index) => `> CMD-${index + 1}: ${procedure}`),
  ].join("\n");
};

const buildDemandSeries = (
  analytics: InvestorAnalytics,
  lens: TimeLens,
  sector: SectorSignal,
): DemandSeriesPoint[] => {
  if (lens === "24h") {
    const actualWeights = [0.08, 0.15, 0.19, 0.18, 0.22, 0.18];
    const predictedWeights = [0.1, 0.16, 0.2, 0.18, 0.21, 0.15];
    const labels = ["06h", "10h", "14h", "18h", "21h", "23h"];
    const base = Math.max(12, sector.orders);

    return labels.map((label, index) => {
      const actual = Math.max(2, Math.round(base * actualWeights[index]));
      const predicted = Math.max(actual, Math.round((sector.predicted || base) * predictedWeights[index]));
      return { label, actual, predicted, gap: predicted - actual };
    });
  }

  if (lens === "30d") {
    const blocks = [0, 3, 6, 9];
    return blocks.map((start, index) => {
      const slice = forecastBars.slice(start, start + 3);
      const predicted = Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length);
      const actual = Math.round(predicted * (0.82 + (index * 0.03)));
      return {
        label: `W${index + 1}`,
        actual,
        predicted,
        gap: predicted - actual,
      };
    });
  }

  return analytics.demandForecast.map((point) => ({
    label: point.label,
    actual: point.actual,
    predicted: point.predicted,
    gap: point.predicted - point.actual,
  }));
};

const buildModeSignals = (
  mode: IntelligenceMode,
  analysis: DensityAnalysis,
  analytics: InvestorAnalytics,
  sector: SectorSignal,
): HeroSignalData[] => {
  const priceMultiplier = analysis.price_multiplier ?? getPriceMultiplier(analysis.density_score);
  const marginShare = analytics.summary.revenue > 0
    ? (analytics.summary.platformCommission / analytics.summary.revenue) * 100
    : 0;
  const qualityLead = analytics.workerQuality[0];
  const liveGap = analysis.predicted_demand - analysis.current_orders;

  switch (mode) {
    case "revenue":
      return [
        {
          label: "Revenue at risk",
          value: formatCurrency(Math.round(analytics.summary.revenue * 0.18)),
          note: "If high-density zones stay under-staffed this cycle.",
          tone: "rose",
          icon: WalletCards,
        },
        {
          label: "Commission share",
          value: formatPercent(marginShare),
          note: "Current platform yield from completed jobs.",
          tone: "indigo",
          icon: TrendingUp,
        },
        {
          label: "Pricing posture",
          value: `${priceMultiplier.toFixed(2)}x`,
          note: `${sector.label} is currently ${priceMultiplier > 1.05 ? "surge-eligible" : "near baseline"}.`,
          tone: "amber",
          icon: ArrowUpRight,
        },
        {
          label: "Ops review queue",
          value: `${analytics.summary.escalatedBookings}`,
          note: "Bookings currently asking for manual margin decisions.",
          tone: "emerald",
          icon: TriangleAlert,
        },
      ];
    case "quality":
      return [
        {
          label: "Top quality lead",
          value: qualityLead ? `${qualityLead.qualityScore}` : "NA",
          note: qualityLead ? `${qualityLead.name} is the strongest service anchor right now.` : "No worker score available.",
          tone: "emerald",
          icon: ShieldCheck,
        },
        {
          label: "Completion confidence",
          value: formatPercent(analytics.summary.completionRate),
          note: "A strong completion rate supports premium positioning.",
          tone: "indigo",
          icon: CheckCircle2,
        },
        {
          label: "Churn pressure",
          value: formatPercent(analytics.summary.churnRate),
          note: "Repeat-demand trust still needs active protection.",
          tone: "amber",
          icon: TrendingDown,
        },
        {
          label: "High-signal workers",
          value: `${analytics.workerQuality.filter((worker) => worker.qualityScore >= 88).length}`,
          note: "Workers already behaving like dependable zone anchors.",
          tone: "sky",
          icon: UsersRound,
        },
      ];
    case "risk":
      return [
        {
          label: "Live demand gap",
          value: `${liveGap > 0 ? "+" : ""}${liveGap}`,
          note: "The difference between predicted jobs and current orders in the selected zone.",
          tone: liveGap > 0 ? "rose" : "emerald",
          icon: Activity,
        },
        {
          label: "Emergency bookings",
          value: `${analysis.emergency_orders}`,
          note: "Urgent jobs that can break the schedule if ignored.",
          tone: "amber",
          icon: TriangleAlert,
        },
        {
          label: "Cancellation risk",
          value: formatPercent(analytics.summary.cancellationRate),
          note: "The platform-wide drop-off level to keep watching.",
          tone: "indigo",
          icon: TrendingDown,
        },
        {
          label: "Escalations waiting",
          value: `${analytics.assignmentEscalations.length}`,
          note: "Rejected jobs asking for price or staffing intervention.",
          tone: "sky",
          icon: BellRing,
        },
      ];
    default:
      return [
        {
          label: "Predicted demand",
          value: `${analysis.predicted_demand} jobs`,
          note: `${sector.label} is the active watch zone.`,
          tone: "indigo",
          icon: BriefcaseBusiness,
        },
        {
          label: "Active workers",
          value: `${analysis.current_workers}`,
          note: "Workers available to absorb current demand.",
          tone: "sky",
          icon: UsersRound,
        },
        {
          label: "Density score",
          value: analysis.density_score.toFixed(2),
          note: "The live staffing pressure indicator for this zone.",
          tone: "emerald",
          icon: Radar,
        },
        {
          label: "Interventions live",
          value: `${analytics.summary.escalatedBookings}`,
          note: "Jobs needing tactical intervention from ops.",
          tone: "amber",
          icon: TriangleAlert,
        },
      ];
  }
};

export function IntelligenceTab({
  routeZoneId = "agra-cantt",
  onZoneChange,
}: IntelligenceTabProps) {
  const initialZoneId = findSector(routeZoneId).id;
  const [areaId, setAreaId] = useState(initialZoneId);
  const [analysis, setAnalysis] = useState<DensityAnalysis>(() => buildDemoAnalysis(initialZoneId));
  const [investorAnalytics, setInvestorAnalytics] = useState<InvestorAnalytics>(demoInvestorAnalytics);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("Checking live density engine...");
  const [activeMode, setActiveMode] = useState<IntelligenceMode>("monitor");
  const [timeLens, setTimeLens] = useState<TimeLens>("7d");
  const [chartView, setChartView] = useState<ChartView>("comparison");
  const [selectedSectorId, setSelectedSectorId] = useState(initialZoneId);
  const [selectedWeek, setSelectedWeek] = useState(7);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [resolvedEscalations, setResolvedEscalations] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [manualCoreWorkers, setManualCoreWorkers] = useState(4);
  const [latestSimulation, setLatestSimulation] = useState<SimulationCompletionPayload | null>(null);
  const [strategyBrief, setStrategyBrief] = useState<StrategyBrief | null>(null);
  const [strategyStatus, setStrategyStatus] = useState<StrategyTerminalStatus>("idle");
  const [strategyMessage, setStrategyMessage] = useState("Run the simulation or request a deep dive to generate the COO briefing.");
  const [logicLog, setLogicLog] = useState<LogicLogEntry[]>([
    {
      id: "logic-boot",
      timestamp: formatAuditTimestamp(),
      message: "Command center online. Launch the simulation or request a zone briefing to start the reasoning trail.",
      tone: "info",
      source: "system",
    },
  ]);
  const [simulationPhase, setSimulationPhase] = useState<SimulationPhase>("idle");
  const [simulationRunning, setSimulationRunning] = useState(false);
  const logScrollerRef = useRef<HTMLDivElement | null>(null);
  const lastTelemetryMessageRef = useRef<string | null>(null);

  const loadInvestorAnalytics = useCallback(async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API}/admin/investor-analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();

      if (response.ok && payload.data) {
        setInvestorAnalytics(payload.data);
      } else {
        setInvestorAnalytics(demoInvestorAnalytics);
      }
    } catch {
      setInvestorAnalytics(demoInvestorAnalytics);
    } finally {
      setLastSyncedAt(new Date());
    }
  }, []);

  const runAnalysis = useCallback(async (options?: { silent?: boolean; nextAreaId?: string }) => {
    const targetArea = options?.nextAreaId ?? areaId;
    setLoading(true);
    if (!options?.silent) {
      setNotice("Checking live density engine...");
    }

    try {
      const token = localStorage.getItem("adminToken");
      const isDemoAdmin = localStorage.getItem("adminDemoMode") === "true" || token === "rahi-demo-admin-token";

      if (isDemoAdmin) {
        setAnalysis(buildDemoAnalysis(targetArea));
        setNotice("");
        setLastSyncedAt(new Date());
        return;
      }

      const response = await fetch(`${API}/analytics/density/${encodeURIComponent(targetArea || "all")}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Density analysis failed");
      }

      setAnalysis(payload);
      setNotice(payload.source === "random_forest_service"
        ? "Live Random Forest prediction received from the Python analytics service."
        : "Live backend connected. Python Random Forest service is unavailable, so RAHI is using the backend density fallback.");
    } catch {
      setAnalysis(buildDemoAnalysis(targetArea));
      setNotice("Live density API was unreachable. Showing demo density signals until the backend or Python service is available.");
    } finally {
      setLoading(false);
      setLastSyncedAt(new Date());
    }
  }, [areaId]);

  useEffect(() => {
    void loadInvestorAnalytics();
  }, [loadInvestorAnalytics]);

  useEffect(() => {
    const normalizedZoneId = findSector(routeZoneId).id;
    setAreaId(normalizedZoneId);
    setSelectedSectorId(normalizedZoneId);
    void runAnalysis({ silent: true, nextAreaId: normalizedZoneId });
  }, [routeZoneId, runAnalysis]);

  useEffect(() => {
    void runAnalysis({ silent: true });
  }, [runAnalysis]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const intervalId = window.setInterval(() => {
      void Promise.all([
        loadInvestorAnalytics(),
        runAnalysis({ silent: true, nextAreaId: areaId }),
      ]);
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [areaId, autoRefresh, loadInvestorAnalytics, runAnalysis]);

  useEffect(() => {
    if (!selectedWorkerId && investorAnalytics.workerQuality.length > 0) {
      setSelectedWorkerId(investorAnalytics.workerQuality[0].id);
    }
  }, [investorAnalytics.workerQuality, selectedWorkerId]);

  const activeSector = useMemo(() => (
    sectorSignals.find((sector) => sector.id === selectedSectorId) || findSector(analysis.area_id || areaId)
  ), [analysis.area_id, areaId, selectedSectorId]);

  const activeMapZone = useMemo(() => (
    commandMapZones.find((zone) => zone.id === activeSector.id) || commandMapZones[0]
  ), [activeSector.id]);

  const zoneDensityMap = useMemo(() => {
    const entries = sectorSignals
      .filter((sector) => sector.id !== "all")
      .map((sector) => [sector.id, Number((sector.predicted / Math.max(1, sector.workers)).toFixed(2))]);

    return Object.fromEntries([
      ...entries,
      [analysis.area_id, analysis.density_score],
    ]) as Record<string, number>;
  }, [analysis.area_id, analysis.density_score]);

  const visiblePreviewSignals = useMemo(() => (
    previewSignals
      .filter((point) => selectedSectorId === "all" || point.zoneId === activeSector.id)
      .slice(0, selectedSectorId === "all" ? 72 : 24)
  ), [activeSector.id, selectedSectorId]);

  const demandSeries = useMemo(() => (
    buildDemandSeries(investorAnalytics, timeLens, activeSector)
  ), [activeSector, investorAnalytics, timeLens]);

  useEffect(() => {
    if (selectedWeek >= demandSeries.length) {
      setSelectedWeek(Math.max(0, demandSeries.length - 1));
    }
  }, [demandSeries.length, selectedWeek]);

  const selectedSeriesPoint = demandSeries[Math.min(selectedWeek, Math.max(0, demandSeries.length - 1))] || demandSeries[0];
  const selectedWorker = investorAnalytics.workerQuality.find((worker) => worker.id === selectedWorkerId)
    || investorAnalytics.workerQuality[0];
  const liveEscalations = investorAnalytics.assignmentEscalations.filter((item) => !resolvedEscalations.includes(item.bookingId));

  const salariedPercent = Math.round(analysis.salaried_ratio * 100);
  const freelancerPercent = Math.round(analysis.freelancer_ratio * 100);
  const burnRisk = analysis.density_score < 1.2 ? "Low" : analysis.density_score < 1.8 ? "Controlled" : "Protected by salaried core";
  const serviceRisk = analysis.density_score >= 1.8 ? "High without core staff" : "Manageable";
  const expansionSignal = analysis.density_score >= 1.8 ? "Hire core team" : analysis.density_score >= 1.2 ? "Keep hybrid" : "Stay freelancer-led";
  const priceMultiplier = analysis.price_multiplier ?? getPriceMultiplier(analysis.density_score);
  const pricingSignal = priceMultiplier > 1.05
    ? `${priceMultiplier}x surge`
    : priceMultiplier < 0.95
      ? `${priceMultiplier}x demand discount`
      : "standard pricing";

  const heroSignals = useMemo(() => (
    buildModeSignals(activeMode, analysis, investorAnalytics, activeSector)
  ), [activeMode, activeSector, analysis, investorAnalytics]);

  const currentCoreWorkers = useMemo(
    () => Math.max(1, Math.round(analysis.current_workers * analysis.salaried_ratio)),
    [analysis.current_workers, analysis.salaried_ratio],
  );
  const aiRecommendedCore = useMemo(
    () => Math.max(
      1,
      currentCoreWorkers + (analysis.density_score >= 1.8 ? 4 : analysis.density_score >= 1.2 ? 2 : 0),
    ),
    [analysis.density_score, currentCoreWorkers],
  );

  useEffect(() => {
    setManualCoreWorkers(aiRecommendedCore);
  }, [aiRecommendedCore, analysis.area_id]);

  const currentScenario = useMemo(
    () => buildScenarioSnapshot(activeSector, analysis, currentCoreWorkers),
    [activeSector, analysis, currentCoreWorkers],
  );
  const manualScenario = useMemo(
    () => buildScenarioSnapshot(activeSector, analysis, manualCoreWorkers),
    [activeSector, analysis, manualCoreWorkers],
  );
  const aiScenario = useMemo(
    () => buildScenarioSnapshot(activeSector, analysis, aiRecommendedCore),
    [activeSector, analysis, aiRecommendedCore],
  );

  const auditSignals = useMemo(() => ({
    photoVerificationSuccessRate: clampNumber(
      84 + (analysis.confidence_score * 11) - (analysis.emergency_orders * 1.2),
      68,
      98,
    ),
    beforeAfterCoverage: clampNumber(
      79 + (analysis.density_score * 7) - (liveEscalations.length * 1.5),
      62,
      97,
    ),
    cloudinaryVerifiedUploads: clampNumber(
      86 + (currentScenario.qualityScore - 80) * 0.6,
      70,
      99,
    ),
  }), [
    analysis.confidence_score,
    analysis.density_score,
    analysis.emergency_orders,
    currentScenario.qualityScore,
    liveEscalations.length,
  ]);

  const appendLogicEntry = useCallback((
    message: string,
    options?: Pick<LogicLogEntry, "tone" | "source">,
  ) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLogicLog((current) => {
      const lastMessage = current[current.length - 1]?.message;
      if (lastMessage === trimmed) {
        return current;
      }

      return [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          timestamp: formatAuditTimestamp(),
          message: trimmed,
          tone: options?.tone || "info",
          source: options?.source || "system",
        },
      ].slice(-14);
    });
  }, []);

  const simulationLogicSignals = useMemo(
    () => buildSimulationLogicSignals(latestSimulation, activeSector.label),
    [activeSector.label, latestSimulation],
  );

  const terminalScript = useMemo(() => (
    buildStrategyTerminalScript({
      status: strategyStatus,
      activeSector,
      timeLensLabel: timeLensMeta[timeLens].label,
      densityScore: analysis.density_score,
      strategyBrief,
      logicSignals: simulationLogicSignals,
    })
  ), [
    activeSector,
    analysis.density_score,
    simulationLogicSignals,
    strategyBrief,
    strategyStatus,
    timeLens,
  ]);

  const terminalText = useTypewriterText(
    terminalScript,
    strategyStatus === "thinking" ? 18 : 10,
  );

  useEffect(() => {
    if (!logScrollerRef.current) return;
    logScrollerRef.current.scrollTop = logScrollerRef.current.scrollHeight;
  }, [logicLog]);

  const requestStrategyBrief = useCallback(async (
    options?: {
      simulation?: SimulationCompletionPayload | null;
      deepDive?: boolean;
      silent?: boolean;
    },
  ) => {
    const simulation = options?.simulation ?? latestSimulation;
    const deepDive = Boolean(options?.deepDive);
    const token = localStorage.getItem("adminToken");
    const timeLensLabel = timeLensMeta[timeLens].label;
    const logicSignals = buildSimulationLogicSignals(simulation, activeSector.label);

    const payload = {
      routePath: `/admin-portal-2026/intelligence/${activeSector.id}`,
      zoneId: activeSector.id,
      zoneLabel: activeSector.label,
      city: activeSector.city,
      radiusKm: simulation?.zone.radiusKm ?? 4,
      timeLens: timeLensLabel,
      densityScore: analysis.density_score,
      predictedDemand: analysis.predicted_demand,
      currentOrders: analysis.current_orders,
      currentWorkers: analysis.current_workers,
      emergencyOrders: analysis.emergency_orders,
      allocationStrategy: analysis.allocation_strategy,
      priceMultiplier,
      pricingSignal,
      serviceWarning: analysis.service_warning || null,
      auditData: auditSignals,
      logicSignals,
      financials: {
        acquisitionCost: activeSector.spend,
        churnRate: investorAnalytics.summary.churnRate,
        projectedRevenue: manualScenario.projectedProfit + activeSector.spend + (manualScenario.totalWorkers * 430),
        projectedProfit: manualScenario.projectedProfit,
        platformCommission: investorAnalytics.summary.platformCommission,
        marginLift: (simulation?.marginLift ?? (aiScenario.projectedProfit - currentScenario.projectedProfit)),
      },
      forecast: demandSeries.map((point) => ({
        label: point.label,
        actual: point.actual,
        predicted: point.predicted,
        gap: point.gap,
      })),
      simulationSummary: simulation
        ? {
          totalPoints: simulation.totalPoints,
          totalProjectedOrders: simulation.totalProjectedOrders,
          totalTraditionalCost: simulation.totalTraditionalCost,
          totalOptimizedCost: simulation.totalOptimizedCost,
          marginLift: simulation.marginLift,
          averageSalariedRatio: simulation.averageSalariedRatio,
          hottestSector: simulation.hottestSector,
          modelVersion: simulation.modelVersion,
          sectors: simulation.sectors.map((sector) => ({
            sector: sector.sector,
            densityScore: sector.densityScore,
            salariedRatio: sector.salariedRatio,
            projectedOrders: sector.projectedOrders,
            burnRisk: sector.burnRisk,
            churnRisk: sector.churnRisk,
          })),
        }
        : undefined,
      deepDive,
      providerPreference: deepDive ? "gemini" : "groq",
    };

    setStrategyStatus("thinking");
    setStrategyMessage(
      deepDive
        ? `Deep strategy scan running for ${activeSector.label}. Gemini is drafting the CEO briefing.`
        : `Fast zone analysis running for ${activeSector.label}. Groq is reading the density stack.`,
    );
    appendLogicEntry(
      deepDive
        ? `Churn risk detected in ${activeSector.label}. Querying Gemini for an investor-grade retention and staffing strategy.`
        : `Scanning ${activeSector.label} for demand-supply delta before the next ${timeLensLabel} workforce shift.`,
      { tone: deepDive ? "warning" : "info", source: "strategy" },
    );
    logicSignals.slice(0, 2).forEach((signal) => {
      appendLogicEntry(signal, { tone: "info", source: "simulation" });
    });

    try {
      if (!token) {
        throw new Error("Admin authentication token is missing");
      }

      const response = await fetch(`${API}/admin/analyze-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.detail || "Strategy request failed");
      }

      setStrategyBrief(result);
      setStrategyStatus("ready");
      setStrategyMessage(
        result.fallback
          ? "Strategy terminal is using the local density rule engine because no external LLM provider was available."
          : `Strategy terminal updated by ${String(result.provider || "llm").toUpperCase()}.`,
      );
      appendLogicEntry(
        result.fallback
          ? "CEO briefing ready from the local density rule engine. External LLM provider was unavailable."
          : `CEO briefing ready via ${String(result.provider || "llm").toUpperCase()}.`,
        { tone: result.fallback ? "warning" : "success", source: "strategy" },
      );

      if (!options?.silent) {
        toast.success(deepDive ? "Deep strategy briefing is ready." : "Strategy briefing updated.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Strategy briefing failed";
      const fallbackBrief = buildStrategyFallback({
        zoneLabel: activeSector.label,
        city: activeSector.city,
        densityScore: analysis.density_score,
        predictedDemand: analysis.predicted_demand,
        currentWorkers: analysis.current_workers,
        emergencyOrders: analysis.emergency_orders,
        priceMultiplier,
        timeLens,
        hottestSector: simulation?.hottestSector || activeSector.label,
        acquisitionCost: activeSector.spend,
        churnRate: investorAnalytics.summary.churnRate,
        marginLift: simulation?.marginLift ?? (aiScenario.projectedProfit - currentScenario.projectedProfit),
      });

      setStrategyBrief(fallbackBrief);
      setStrategyStatus("error");
      setStrategyMessage(`Live strategy provider was unavailable. Showing fallback COO guidance. ${message}`);
      appendLogicEntry(
        `Live strategy provider unavailable. Falling back to the local density rule engine for ${activeSector.label}.`,
        { tone: "critical", source: "strategy" },
      );

      if (!options?.silent) {
        toast.error("Live strategy provider unavailable. Showing fallback briefing.");
      }
    }
  }, [
    activeSector.city,
    activeSector.id,
    activeSector.label,
    activeSector.spend,
    aiScenario.projectedProfit,
    analysis.allocation_strategy,
    analysis.current_orders,
    analysis.current_workers,
    analysis.density_score,
    analysis.emergency_orders,
    analysis.predicted_demand,
    analysis.service_warning,
    auditSignals,
    currentScenario.projectedProfit,
    demandSeries,
    investorAnalytics.summary.churnRate,
    investorAnalytics.summary.platformCommission,
    latestSimulation,
    manualScenario.projectedProfit,
    manualScenario.totalWorkers,
    appendLogicEntry,
    priceMultiplier,
    pricingSignal,
    timeLens,
  ]);

  const handleSimulationComplete = useCallback((summary: SimulationCompletionPayload) => {
    setLatestSimulation(summary);
    buildSimulationLogicSignals(summary, activeSector.label).forEach((signal, index) => {
      appendLogicEntry(
        index === 0 ? `Random Forest summary ready. ${signal}` : signal,
        { tone: index === 0 ? "success" : "info", source: "simulation" },
      );
    });
  }, [activeSector.label, appendLogicEntry]);

  const handleSimulationTelemetry = useCallback((telemetry: SimulationTelemetryPayload) => {
    setSimulationPhase(telemetry.phase);
    setSimulationRunning(telemetry.isRunning);

    const latestMessage = telemetry.statusFeed[0];
    if (!latestMessage || latestMessage === lastTelemetryMessageRef.current) {
      return;
    }

    lastTelemetryMessageRef.current = latestMessage;
    appendLogicEntry(latestMessage, {
      tone: telemetry.phase === "error"
        ? "critical"
        : telemetry.phase === "complete"
          ? "success"
          : telemetry.phase === "inferencing"
            ? "warning"
            : "info",
      source: "simulation",
    });
  }, [appendLogicEntry]);

  useEffect(() => {
    if (!latestSimulation) {
      return;
    }

    void requestStrategyBrief({
      simulation: latestSimulation,
      deepDive: false,
      silent: true,
    });
  }, [activeSector.id, latestSimulation, requestStrategyBrief, timeLens]);

  const zoneChecklist = useMemo(() => {
    const items = [
      `Zone confidence is ${(analysis.confidence_score * 100).toFixed(0)}%. Keep ${strategyLabel[analysis.allocation_strategy]} live in ${analysis.area}.`,
      analysis.emergency_orders > 0
        ? `${analysis.emergency_orders} emergency bookings need faster worker acceptance handling.`
        : "Emergency queue is calm. Use this window to improve fill rate quality.",
      priceMultiplier > 1.05
        ? `Pricing can defend quality here at ${priceMultiplier.toFixed(2)}x without over-stressing acquisition.`
        : "Pricing should stay close to baseline until density rises again.",
    ];

    if (activeMode === "quality") {
      items.push("Promote the highest quality worker in this zone before expanding freelancer supply.");
    }

    if (activeMode === "risk") {
      items.push("Treat every rejected booking in this zone like an early-warning sensor, not a cleanup task.");
    }

    return items;
  }, [activeMode, analysis, priceMultiplier]);

  const selectedWeekDetail = useMemo(() => {
    if (!selectedSeriesPoint) return null;

    return {
      label: selectedSeriesPoint.label,
      gap: selectedSeriesPoint.gap,
      actual: selectedSeriesPoint.actual,
      predicted: selectedSeriesPoint.predicted,
      cue: selectedSeriesPoint.gap > 0
        ? "Demand is pulling ahead of current order flow."
        : "Fulfillment is keeping pace with forecast pressure.",
    };
  }, [selectedSeriesPoint]);

  const handleZoneSelection = (zoneId: string) => {
    setAreaId(zoneId);
    setSelectedSectorId(zoneId);
    onZoneChange?.(zoneId);
    void runAnalysis({ silent: false, nextAreaId: zoneId });
  };

  const jumpToSimulationLab = () => {
    document.getElementById("simulation-lab")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCopyBrief = async () => {
    const lines = [
      `RAHI intelligence brief - ${modeMeta[activeMode].label}`,
      `Time lens: ${timeLensMeta[timeLens].label}`,
      `Zone: ${analysis.area}`,
      `Predicted demand: ${analysis.predicted_demand}`,
      `Active workers: ${analysis.current_workers}`,
      `Density score: ${analysis.density_score.toFixed(2)}`,
      `Pricing signal: ${pricingSignal}`,
      `Workforce decision: ${strategyLabel[analysis.allocation_strategy]}`,
      `Escalations live: ${liveEscalations.length}`,
      selectedWorker ? `Top worker: ${selectedWorker.name} (${selectedWorker.qualityScore})` : "",
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Intelligence brief copied.");
    } catch {
      toast.error("Copy failed. Browser clipboard permission was blocked.");
    }
  };

  const handleEscalationAction = (bookingId: string, action: "watch" | "route" | "resolve") => {
    if (action === "resolve") {
      setResolvedEscalations((current) => [...current, bookingId]);
      toast.success("Escalation moved out of the live queue.");
      return;
    }

    if (action === "watch") {
      toast.success("Escalation marked for pricing watch.");
      return;
    }

    toast.success("Escalation routed into the ops review lane.");
  };

  const handleWorkerAction = (workerName: string, action: "inspect" | "promote" | "coach") => {
    const verb = action === "inspect"
      ? "opened for QA review"
      : action === "promote"
        ? "tagged as a zone anchor"
        : "queued for coaching";
    toast.success(`${workerName} ${verb}.`);
  };

  return (
    <div className="space-y-8">
      <CommandCenterMotionStyles />
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(135deg,_#07111f_0%,_#0f172a_48%,_#10243d_100%)] p-6 text-white shadow-2xl shadow-slate-950/10 md:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative space-y-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
                  <Radar className="h-4 w-4" />
                  Intelligence Command Deck
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
                  RAHI admin ops
                </span>
              </div>

              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {modeMeta[activeMode].eyebrow}
              </p>
              <h2 className="mt-3 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight md:text-6xl">
                {modeMeta[activeMode].title}
              </h2>
              <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-slate-300 md:text-base">
                {modeMeta[activeMode].body}
              </p>
            </div>

            <div className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Live pulse</p>
                  <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 motion-safe:animate-pulse" />
                    {autoRefresh ? "Auto refresh active" : "Manual refresh"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoRefresh((current) => !current)}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-4 text-xs font-black uppercase tracking-[0.18em] transition",
                    autoRefresh
                      ? "border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  {autoRefresh ? "Pause live" : "Resume live"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MonitoringStat label="Current zone" value={analysis.area} hint={activeSector.city} />
                <MonitoringStat label="Last sync" value={formatTime(lastSyncedAt)} hint={timeLensMeta[timeLens].descriptor} />
                <MonitoringStat label="Escalations live" value={`${liveEscalations.length}`} hint="Needs admin review" />
                <MonitoringStat label="Top worker" value={selectedWorker ? selectedWorker.name : "NA"} hint={selectedWorker ? `${selectedWorker.qualityScore} quality score` : "No score yet"} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {(["monitor", "revenue", "quality", "risk"] as IntelligenceMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActiveMode(mode)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition",
                      activeMode === mode
                        ? "border-white/30 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10",
                    )}
                  >
                    {modeMeta[mode].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["24h", "7d", "30d"] as TimeLens[]).map((lens) => (
                <button
                  key={lens}
                  type="button"
                  onClick={() => setTimeLens(lens)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                    timeLens === lens
                      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10",
                  )}
                >
                  {timeLensMeta[lens].label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void Promise.all([
                    loadInvestorAnalytics(),
                    runAnalysis({ silent: false, nextAreaId: areaId }),
                  ]);
                }}
                disabled={loading}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync live signals
              </button>
              <button
                type="button"
                onClick={handleCopyBrief}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black text-white transition hover:bg-white/[0.12]"
              >
                <Copy className="h-4 w-4" />
                Copy briefing
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {heroSignals.map((signal) => (
              <HeroSignal
                key={signal.label}
                label={signal.label}
                value={signal.value}
                note={signal.note}
                icon={signal.icon}
                tone={signal.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Geospatial command map</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">Sector shape map with route-aware density context</h3>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Click any Agra zone to switch the route, fetch zone-specific density, and open the exact control surface for that geography.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Dynamic route</p>
                <p className="mt-2 text-sm font-black text-slate-950">/admin-portal-2026/intelligence/{activeSector.id}</p>
              </div>
            </div>
          </div>

          <div className="grid min-h-[34rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="relative min-h-[34rem] border-b border-slate-200 xl:border-b-0 xl:border-r">
              <MapContainer
                center={selectedSectorId === "all" ? AGRA_MAP_CENTER : activeMapZone.center}
                zoom={selectedSectorId === "all" ? 11 : 12}
                scrollWheelZoom
                preferCanvas
                className="h-full w-full"
              >
                <CommandMapView
                  center={selectedSectorId === "all" ? AGRA_MAP_CENTER : activeMapZone.center}
                  zoom={selectedSectorId === "all" ? 11 : 12}
                />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution="&copy; CARTO"
                />

                {commandMapZones.map((zone) => {
                  const density = zoneDensityMap[zone.id] ?? 0;
                  const tone = getDensityTone(density);
                  const active = zone.id === activeSector.id;

                  return (
                    <Polygon
                      key={zone.id}
                      positions={zone.polygon}
                      pathOptions={{
                        color: active ? "#0f172a" : tone.stroke,
                        weight: active ? 3 : 2,
                        fillColor: tone.fill,
                        fillOpacity: active ? 0.44 : 0.2,
                      }}
                      eventHandlers={{ click: () => handleZoneSelection(zone.id) }}
                    >
                      <LeafletTooltip sticky>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-slate-950">{zone.label}</p>
                          <p className="text-xs font-bold text-slate-500">{tone.label}</p>
                          <p className="text-xs font-bold text-slate-700">Density {density.toFixed(2)}</p>
                        </div>
                      </LeafletTooltip>
                    </Polygon>
                  );
                })}

                {visiblePreviewSignals.map((signal) => (
                  <CircleMarker
                    key={signal.id}
                    center={signal.position}
                    radius={signal.isEmergency ? 7 : 4}
                    pathOptions={{
                      color: signal.isEmergency ? "#b91c1c" : "#4338ca",
                      fillColor: signal.isEmergency ? "#f97316" : "#6366f1",
                      fillOpacity: signal.isEmergency ? 0.88 : 0.62,
                      weight: signal.isEmergency ? 2 : 1,
                    }}
                  >
                    <LeafletTooltip>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-950">{signal.label}</p>
                        <p className="text-xs font-bold text-slate-500">{signal.serviceType}</p>
                        <p className="text-xs font-bold text-slate-700">{formatCurrency(signal.estimatedValue)}</p>
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                ))}
              </MapContainer>

              <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Legend</p>
                <div className="mt-3 space-y-2 text-xs font-bold text-slate-600">
                  {[
                    { label: "Critical density", color: "bg-rose-500" },
                    { label: "High density", color: "bg-orange-500" },
                    { label: "Balanced density", color: "bg-indigo-500" },
                    { label: "Freelancer-led", color: "bg-sky-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", item.color)} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Synthetic load sample</p>
                <p className="mt-2 text-sm font-black text-slate-950">
                  {visiblePreviewSignals.length} preview points from the 400k simulation engine
                </p>
              </div>

              {(simulationRunning || strategyStatus === "thinking") && (
                <>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.12),_transparent_55%)]" />
                  <div className="rahi-scanline pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-indigo-400/25 to-transparent" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="rahi-command-pin relative h-4 w-4 rounded-full bg-indigo-600 shadow-[0_0_0_8px_rgba(79,70,229,0.18)]">
                      <span className="absolute inset-0 rounded-full border border-white/90" />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-4 right-4 rounded-2xl border border-indigo-300/40 bg-slate-950/85 px-4 py-3 text-white shadow-xl shadow-indigo-950/20 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">AI overlay</p>
                    <p className="mt-2 text-sm font-black">
                      {simulationRunning
                        ? "Random Forest is scanning the heatmap in live batches."
                        : "Strategy engine is tracing the current zone before briefing the CEO."}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="bg-[linear-gradient(180deg,_rgba(15,23,42,0.02),_rgba(79,70,229,0.08))] p-4">
              <div className="rahi-glass-panel h-full rounded-[1.5rem] border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Live audit log</p>
                    <h4 className="mt-2 text-lg font-black text-slate-950">System thoughts and model checkpoints</h4>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                    simulationRunning || strategyStatus === "thinking"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500",
                  )}>
                    {simulationRunning ? "Streaming" : strategyStatus === "thinking" ? "Drafting" : "Standby"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <MonitoringStat
                    label="Strategy lane"
                    value={strategyStatus === "ready" ? "Briefed" : strategyStatus === "thinking" ? "Thinking" : "Idle"}
                    hint={strategyBrief ? `${String(strategyBrief.provider || "rule_engine").toUpperCase()} provider` : "No active briefing yet"}
                    light
                  />
                  <MonitoringStat
                    label="Simulation phase"
                    value={simulationPhase.replace("_", " ")}
                    hint={latestSimulation ? `${latestSimulation.totalPoints.toLocaleString("en-IN")} points captured` : "No batch results attached yet"}
                    light
                  />
                </div>

                <div ref={logScrollerRef} className="mt-4 max-h-[25.5rem] space-y-3 overflow-y-auto pr-1">
                  {logicLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "rounded-[1.25rem] border px-4 py-3 shadow-sm backdrop-blur",
                        entry.tone === "success" && "border-emerald-200 bg-emerald-50/85",
                        entry.tone === "warning" && "border-amber-200 bg-amber-50/90",
                        entry.tone === "critical" && "border-rose-200 bg-rose-50/90",
                        entry.tone === "info" && "border-white/80 bg-white/80",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          [{entry.timestamp}]
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {entry.source}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(135deg,_#07111f_0%,_#0f172a_52%,_#10243d_100%)] p-6 text-white shadow-xl shadow-slate-950/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/80">Strategy terminal</p>
                <h3 className="mt-2 text-2xl font-black">RAHI COO briefing for {activeSector.label}</h3>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-300">
                  This terminal reads the selected zone, current density, and the latest simulation summary to recommend the next operating move.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Provider lane</p>
                <p className="mt-2 text-sm font-black text-white">
                  {strategyBrief ? String(strategyBrief.provider || "rule_engine").toUpperCase() : "WAITING"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MonitoringStat
                label="Zone route"
                value={`/intelligence/${activeSector.id}`}
                hint={activeSector.city}
              />
              <MonitoringStat
                label="Simulation state"
                value={latestSimulation ? "Attached" : "Waiting"}
                hint={latestSimulation ? `${latestSimulation.totalPoints.toLocaleString("en-IN")} points ready` : "Run the 400k engine to attach batch evidence"}
              />
              <MonitoringStat
                label="Forecast lens"
                value={timeLensMeta[timeLens].label}
                hint={`${analysis.predicted_demand} predicted jobs in view`}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void requestStrategyBrief({ deepDive: false })}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
              >
                {strategyStatus === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Run zone briefing
              </button>
              <button
                type="button"
                onClick={() => void requestStrategyBrief({ deepDive: true })}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.12]"
              >
                <Cpu className="h-4 w-4" />
                Request deep dive
              </button>
              <button
                type="button"
                onClick={jumpToSimulationLab}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/20"
              >
                <ChevronRight className="h-4 w-4" />
                Open simulation lab
              </button>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border",
                  strategyStatus === "thinking"
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : strategyStatus === "ready"
                      ? "border-indigo-300/30 bg-indigo-300/10 text-indigo-100"
                      : strategyStatus === "error"
                        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                        : "border-white/10 bg-white/[0.04] text-slate-300",
                )}>
                  {strategyStatus === "thinking" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : strategyStatus === "ready" ? (
                    <BrainTerminalIcon />
                  ) : strategyStatus === "error" ? (
                    <TriangleAlert className="h-5 w-5" />
                  ) : (
                    <Cpu className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Terminal status</p>
                  <p className="mt-1 text-sm font-black text-white">{strategyMessage}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rahi-terminal-shell rounded-[1.4rem] border border-indigo-300/20 bg-black/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200/80">Typewritten briefing stream</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        The command center shows the reasoning path instead of waiting on a blank spinner.
                      </p>
                    </div>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                      strategyStatus === "thinking"
                        ? "bg-emerald-300/12 text-emerald-100"
                        : strategyStatus === "error"
                          ? "bg-amber-300/12 text-amber-100"
                          : "bg-indigo-300/12 text-indigo-100",
                    )}>
                      {strategyStatus === "thinking" ? "Streaming" : strategyStatus === "error" ? "Fallback" : "Ready"}
                    </span>
                  </div>

                  <pre className="mt-4 min-h-[14rem] whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-indigo-50">
                    {terminalText}
                    <span className={cn("rahi-terminal-caret", strategyStatus !== "error" && "bg-emerald-200")} />
                  </pre>
                </div>

                {strategyBrief ? (
                  <>
                    <div className="grid gap-3">
                      {strategyBrief.procedures.map((procedure, index) => (
                        <div
                          key={`${procedure}-${index}`}
                          className="rahi-glass-panel flex gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-3"
                        >
                          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-xs font-black text-indigo-100">
                            {index + 1}
                          </span>
                          <p className="text-sm font-semibold leading-6 text-slate-100">{procedure}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MonitoringStat
                        label="Model"
                        value={strategyBrief.model || "density-rule-fallback"}
                        hint={strategyBrief.fallback ? "Fallback rules are active" : "LLM-backed strategy"}
                      />
                      <MonitoringStat
                        label="History"
                        value={strategyBrief.saved ? "Persisted" : "Local only"}
                        hint={strategyBrief.historyId ? `History id ${strategyBrief.historyId}` : "No Mongo history row written"}
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 px-4 py-5 text-sm font-semibold leading-6 text-slate-300">
                    No strategy briefing yet. Run the simulation or trigger a zone briefing to see the signal, reasoning, and next procedures.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Scenario console</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">Workforce slider and AI comparison</h3>
              </div>
              <div className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                {strategyLabel[analysis.allocation_strategy]}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected zone</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{activeSector.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Live density</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{analysis.density_score.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
                  <span>Salaried core override</span>
                  <span>{manualCoreWorkers} workers</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(18, aiRecommendedCore + 6)}
                  value={manualCoreWorkers}
                  onChange={(event) => setManualCoreWorkers(Number(event.target.value))}
                  className="h-3 w-full accent-slate-950"
                />
                <div className="mt-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <span>Current core {currentCoreWorkers}</span>
                  <span>AI target {aiRecommendedCore}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <ScenarioCard
                title="Current status"
                tone="slate"
                density={currentScenario.densityScore}
                quality={currentScenario.qualityScore}
                response={currentScenario.responseMinutes}
                profit={currentScenario.projectedProfit}
                workforce={`${currentScenario.salariedCore} salaried / ${currentScenario.freelancerPool} flex`}
              />
              <ScenarioCard
                title="Manual scenario"
                tone="indigo"
                density={manualScenario.densityScore}
                quality={manualScenario.qualityScore}
                response={manualScenario.responseMinutes}
                profit={manualScenario.projectedProfit}
                workforce={`${manualScenario.salariedCore} salaried / ${manualScenario.freelancerPool} flex`}
              />
              <ScenarioCard
                title="AI recommended"
                tone="emerald"
                density={aiScenario.densityScore}
                quality={aiScenario.qualityScore}
                response={aiScenario.responseMinutes}
                profit={aiScenario.projectedProfit}
                workforce={`${aiScenario.salariedCore} salaried / ${aiScenario.freelancerPool} flex`}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MonitoringStat label="Margin swing" value={formatCurrency(manualScenario.projectedProfit - currentScenario.projectedProfit)} hint="Projected lift from the manual workforce change" light />
              <MonitoringStat label="Quality delta" value={`${manualScenario.qualityScore - currentScenario.qualityScore > 0 ? "+" : ""}${manualScenario.qualityScore - currentScenario.qualityScore}`} hint="Service score shift versus current state" light />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton label="Route to AI target" onClick={() => setManualCoreWorkers(aiRecommendedCore)} />
              <ActionButton label="Open 400k stress lab" onClick={jumpToSimulationLab} />
              <ActionButton label="Copy zone path" onClick={() => void navigator.clipboard.writeText(`/admin-portal-2026/intelligence/${activeSector.id}`)} />
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Why this page matters</p>
            <h3 className="mt-2 text-2xl font-black">This is now a zone operating system, not a poster.</h3>
            <div className="mt-5 grid gap-3">
              <MonitoringStat label="Route context" value={activeSector.id} hint="Every click can become a shareable zone URL." />
              <MonitoringStat label="Map logic" value={`${commandMapZones.length} sectors`} hint="Density is visualized as shaped geography instead of generic cards." />
              <MonitoringStat label="Stress path" value="400k simulation" hint="The load lab already runs against the analytics simulation endpoint." />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Run allocation forecast</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Analyze a live launch zone</h3>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-black text-slate-800 outline-none transition focus:border-slate-900 focus:bg-white sm:w-64"
                  placeholder="agra-cantt, taj-ganj, civil-lines"
                />
              </div>
              <button
                onClick={() => void runAnalysis({ nextAreaId: areaId })}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run density model
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {sectorSignals.map((sector) => (
              <button
                key={sector.id}
                type="button"
                onClick={() => handleZoneSelection(sector.id)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                  analysis.area_id === sector.id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900",
                )}
              >
                {sector.label}
              </button>
            ))}
          </div>

          {notice && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
              <Sparkles className="mt-0.5 h-4 w-4" />
              <span>{notice}</span>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <RiskCard icon={ShieldCheck} label="Service risk" value={serviceRisk} />
            <RiskCard icon={TrendingDown} label="Burn control" value={burnRisk} />
            <RiskCard icon={ArrowUpRight} label="Next move" value={expansionSignal} />
            <RiskCard icon={Target} label="Confidence" value={`${Math.round(analysis.confidence_score * 100)}%`} />
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-800">
            Dynamic pricing signal: {pricingSignal}. Formula: clamp(0.85, 1.50, 1 + 0.25 x (density - 1.2)).
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Zone snapshot</p>
                <h4 className="mt-2 text-xl font-black text-slate-950">{activeSector.label}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">{activeSector.city}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Focus demand" onClick={() => setActiveMode("monitor")} />
                <ActionButton label="Check margin" onClick={() => setActiveMode("revenue")} />
                <ActionButton label="Review risk" onClick={() => setActiveMode("risk")} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <MiniStat label="Orders live" value={`${activeSector.orders}`} />
              <MiniStat label="Emergency" value={`${activeSector.emergency}`} />
              <MiniStat label="Spend" value={formatCurrency(activeSector.spend)} />
              <MiniStat label="Source" value={analysis.source === "random_forest_service" ? "RF model" : "Fallback"} />
            </div>

            <div className="mt-5 space-y-3">
              {zoneChecklist.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                  <ChevronRight className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <MonitoringStat label="Pressure ratio" value={analysis.density_score.toFixed(2)} hint="Predicted jobs per worker" light />
            <MonitoringStat label="Price posture" value={`${priceMultiplier.toFixed(2)}x`} hint="Dynamic pricing guidance" light />
            <MonitoringStat label="Current queue" value={`${analysis.current_orders}`} hint="Orders currently in the zone" light />
            <MonitoringStat label="Emergency share" value={`${analysis.emergency_orders}`} hint="Urgent bookings in the queue" light />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ops playbook</p>
                <p className="mt-2 text-lg font-black">
                  {activeMode === "quality"
                    ? "Protect trust before scaling capacity."
                    : activeMode === "revenue"
                      ? "Use price pressure only where service speed is defendable."
                      : activeMode === "risk"
                        ? "Stabilize rejections before they turn into churn."
                        : "Keep labor mix proportional to density, not instinct."}
                </p>
              </div>
              <Cpu className="hidden h-7 w-7 text-emerald-300 sm:block" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton inverse label="Trigger live sync" onClick={() => void Promise.all([loadInvestorAnalytics(), runAnalysis({ silent: false, nextAreaId: areaId })])} />
              <ActionButton inverse label="Promote zone" onClick={() => toast.success(`${analysis.area} marked for expansion review.`)} />
              <ActionButton inverse label="Prepare brief" onClick={handleCopyBrief} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Zone portfolio</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Density decides the workforce model</h3>
            </div>
            <ListFilter className="hidden h-6 w-6 text-slate-300 sm:block" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_1fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
              <span>Zone</span>
              <span>Demand</span>
              <span>Workers</span>
              <span>Density</span>
              <span>Decision</span>
            </div>
            {sectorSignals.map((sector) => {
              const density = sector.predicted / sector.workers;
              const strategy = getStrategyFromDensity(density);
              const selected = activeSector.id === sector.id;

              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => handleZoneSelection(sector.id)}
                  className={cn(
                    "grid w-full grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_1fr] items-center gap-2 border-t border-slate-100 px-4 py-4 text-left text-sm transition hover:bg-slate-50",
                    selected && "bg-emerald-50/60",
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

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected zone drill-down</p>
                <h4 className="mt-2 text-xl font-black text-slate-950">{activeSector.label}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {activeSector.city} is running at {analysis.density_score.toFixed(2)} density with {analysis.current_workers} workers active.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Worker roster" onClick={() => setActiveMode("quality")} />
                <ActionButton label="Escalation queue" onClick={() => setActiveMode("risk")} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Predicted jobs" value={`${analysis.predicted_demand}`} />
              <MiniStat label="Confidence" value={`${Math.round(analysis.confidence_score * 100)}%`} />
              <MiniStat label="Suggested price" value={`${priceMultiplier.toFixed(2)}x`} />
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">12-week demand forecast</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Growth pressure curve</h3>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>

          <div className="mt-8 flex h-64 items-end gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {forecastBars.map((value, index) => {
              const isActive = selectedWeek === index;
              const tone = index > 8 ? "bg-emerald-500" : index > 4 ? "bg-amber-400" : "bg-slate-300";
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedWeek(index)}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      "w-full rounded-t-xl transition-all duration-300",
                      tone,
                      isActive && "scale-y-105 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-300/50",
                    )}
                    style={{ height: `${Math.max(22, value * 1.7)}px` }}
                  />
                  <span className={cn("text-[10px] font-black", isActive ? "text-slate-950" : "text-slate-400")}>
                    W{index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected week pulse</p>
                <h4 className="mt-2 text-xl font-black">Week {selectedWeek + 1} demand marker</h4>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
                {forecastBars[selectedWeek]} pressure points
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
              Investor narrative: RAHI is not only booking jobs. It is measuring local demand density so expansion decisions protect quality and control salary burn.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Investor-grade business brain</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Predicted demand vs. actual orders</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChartView("comparison")}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                  chartView === "comparison"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white",
                )}
              >
                Actual vs predicted
              </button>
              <button
                type="button"
                onClick={() => setChartView("delta")}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                  chartView === "delta"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white",
                )}
              >
                Gap pressure
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {demandSeries.map((point, index) => (
                <button
                  key={point.label}
                  type="button"
                  onClick={() => setSelectedWeek(index)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition",
                    selectedWeek === index
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  {point.label}
                </button>
              ))}
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === "comparison" ? (
                  <LineChart data={demandSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe4ef" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                    <RechartsTooltip content={<DemandTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#0f172a"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: "#0f172a" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: "#4f46e5" }}
                    />
                  </LineChart>
                ) : (
                  <AreaChart data={demandSeries}>
                    <defs>
                      <linearGradient id="gapFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe4ef" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                    <RechartsTooltip content={<GapTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="gap"
                      stroke="#0f766e"
                      strokeWidth={3}
                      fill="url(#gapFill)"
                      activeDot={{ r: 6, strokeWidth: 0, fill: "#0f766e" }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {selectedWeekDetail && (
            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected checkpoint</p>
                  <h4 className="mt-2 text-xl font-black text-slate-950">{selectedWeekDetail.label}</h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{selectedWeekDetail.cue}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Actual" value={`${selectedWeekDetail.actual}`} />
                  <MiniStat label="Predicted" value={`${selectedWeekDetail.predicted}`} />
                  <MiniStat label="Gap" value={`${selectedWeekDetail.gap > 0 ? "+" : ""}${selectedWeekDetail.gap}`} />
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            <MetricButton
              label="Completion"
              value={formatPercent(investorAnalytics.summary.completionRate)}
              active={activeMode === "quality"}
              onClick={() => setActiveMode("quality")}
            />
            <MetricButton
              label="Cancel rate"
              value={formatPercent(investorAnalytics.summary.cancellationRate)}
              active={activeMode === "risk"}
              onClick={() => setActiveMode("risk")}
            />
            <MetricButton
              label="Churn risk"
              value={formatPercent(investorAnalytics.summary.churnRate)}
              active={activeMode === "risk"}
              onClick={() => setActiveMode("risk")}
            />
            <MetricButton
              label="Ops review"
              value={`${investorAnalytics.summary.escalatedBookings}`}
              active={activeMode === "monitor"}
              onClick={() => setActiveMode("monitor")}
            />
            <MetricButton
              label="Revenue"
              value={formatCurrency(investorAnalytics.summary.revenue)}
              active={activeMode === "revenue"}
              onClick={() => setActiveMode("revenue")}
            />
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Revenue split</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">Worker earnings vs. platform commission</h3>
              </div>
              <WalletCards className="h-6 w-6 text-indigo-500" />
            </div>

            <div className="mt-6 space-y-4">
              <RevenueStrip
                label="Worker earnings"
                value={investorAnalytics.summary.workerEarnings}
                total={investorAnalytics.summary.revenue}
                tone="bg-indigo-500"
              />
              <RevenueStrip
                label="RAHI commission"
                value={investorAnalytics.summary.platformCommission}
                total={investorAnalytics.summary.revenue}
                tone="bg-emerald-500"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              Gross booking value tracked here: {formatCurrency(investorAnalytics.summary.revenue)}.
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Top worker quality scores</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">Service quality roster</h3>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
            </div>

            <div className="mt-4 space-y-3">
              {investorAnalytics.workerQuality.slice(0, 3).map((worker) => {
                const selected = selectedWorker?.id === worker.id;

                return (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => setSelectedWorkerId(worker.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{worker.name}</p>
                        <p className="text-xs font-bold text-slate-500">{worker.service} - {worker.completedJobs} jobs - {worker.rating}/5</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">
                        {worker.qualityScore}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedWorker && (
              <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected worker</p>
                    <h4 className="mt-2 text-xl font-black">{selectedWorker.name}</h4>
                    <p className="mt-1 text-sm font-semibold text-slate-300">{selectedWorker.service}</p>
                  </div>
                  <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-sm font-black text-emerald-200">
                    {selectedWorker.qualityScore}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <MonitoringStat label="Rating" value={`${selectedWorker.rating}/5`} hint="Customer trust signal" />
                  <MonitoringStat label="Jobs closed" value={`${selectedWorker.completedJobs}`} hint="Completed jobs" />
                  <MonitoringStat label="Readiness" value={`${Math.min(99, selectedWorker.qualityScore + 3)}%`} hint="Ops confidence score" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ActionButton inverse label="Inspect QA" onClick={() => handleWorkerAction(selectedWorker.name, "inspect")} />
                  <ActionButton inverse label="Promote anchor" onClick={() => handleWorkerAction(selectedWorker.name, "promote")} />
                  <ActionButton inverse label="Queue coaching" onClick={() => handleWorkerAction(selectedWorker.name, "coach")} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700/70">Rejected job escalation queue</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">Queue requiring admin intervention</h3>
              </div>
              <TriangleAlert className="h-6 w-6 text-amber-600" />
            </div>

            <div className="mt-4 space-y-3">
              {liveEscalations.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-4 text-sm font-bold text-emerald-700">
                  The live escalation queue is clear.
                </div>
              ) : (
                liveEscalations.slice(0, 3).map((item) => (
                  <div key={item.bookingId} className="rounded-2xl border border-amber-200 bg-white/75 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{item.serviceName}</p>
                        <p className="mt-1 text-xs font-bold text-amber-800">{item.areaId} - {item.reason}</p>
                      </div>
                      <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-black text-amber-950">
                        {item.suggestedPriceMultiplier.toFixed(2)}x
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <ActionButton label="Route to ops" onClick={() => handleEscalationAction(item.bookingId, "route")} />
                      <ActionButton label="Watch pricing" onClick={() => handleEscalationAction(item.bookingId, "watch")} />
                      <ActionButton label="Resolve" onClick={() => handleEscalationAction(item.bookingId, "resolve")} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <LensCard title="Operational Lens" body="Density tells operations where a reliable salaried core is needed, and where a freelancer-first model protects burn." icon={MapPin} />
        <LensCard title="Predictive Lens" body="Forecast controls now react to time windows so admins can move between intraday pulse and monthly planning." icon={Cpu} />
        <LensCard title="Trust Lens" body="Worker quality and escalation actions sit inside the same surface, so service trust becomes something the admin can actively steer." icon={Clock3} />
      </section>

      <section id="simulation-lab" className="scroll-mt-24">
        <SimulationEngine
          onSimulationComplete={handleSimulationComplete}
          onTelemetryChange={handleSimulationTelemetry}
        />
      </section>
    </div>
  );
}

function CommandCenterMotionStyles() {
  return (
    <style>{`
      @keyframes rahi-scanline {
        0% { transform: translateY(-12%); opacity: 0; }
        12% { opacity: 0.72; }
        100% { transform: translateY(1450%); opacity: 0; }
      }

      @keyframes rahi-command-pin {
        0% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.22); }
        70% { transform: scale(1.08); box-shadow: 0 0 0 18px rgba(79, 70, 229, 0); }
        100% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
      }

      @keyframes rahi-terminal-caret {
        0%, 42% { opacity: 1; }
        43%, 100% { opacity: 0; }
      }

      .rahi-scanline {
        animation: rahi-scanline 2.8s linear infinite;
      }

      .rahi-command-pin {
        animation: rahi-command-pin 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }

      .rahi-terminal-shell {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 50px rgba(15,23,42,0.2);
      }

      .rahi-glass-panel {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
      }

      .rahi-terminal-caret {
        display: inline-block;
        width: 0.65ch;
        height: 1.1em;
        margin-left: 0.2ch;
        vertical-align: text-bottom;
        border-radius: 999px;
        background: rgba(224, 231, 255, 0.95);
        animation: rahi-terminal-caret 1s steps(1) infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .rahi-scanline,
        .rahi-command-pin,
        .rahi-terminal-caret {
          animation: none !important;
        }
      }
    `}</style>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener?.("change", updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}

function HeroSignal({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Activity;
  tone: HeroTone;
}) {
  const toneMap = {
    indigo: "border-indigo-300/30 bg-indigo-300/10 text-indigo-100",
    emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    sky: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  } as const;

  return (
    <button
      type="button"
      className={cn(
        "rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-1 hover:bg-white/10",
        toneMap[tone],
      )}
    >
      <Icon className="mb-4 h-5 w-5" />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">{note}</p>
    </button>
  );
}

function BrainTerminalIcon() {
  return (
    <div className="relative h-5 w-5">
      <span className="absolute inset-0 rounded-full border border-current opacity-60" />
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      <span className="absolute left-1 top-1/2 h-px w-3 translate-y-[-50%] bg-current opacity-80" />
      <span className="absolute left-1/2 top-1 h-3 w-px translate-x-[-50%] bg-current opacity-80" />
    </div>
  );
}

function MonitoringStat({
  label,
  value,
  hint,
  light = false,
}: {
  label: string;
  value: string;
  hint: string;
  light?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      light ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.04]",
    )}>
      <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", light ? "text-slate-400" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-2 text-sm font-black", light ? "text-slate-950" : "text-white")}>{value}</p>
      <p className={cn("mt-2 text-xs font-semibold", light ? "text-slate-500" : "text-slate-300")}>{hint}</p>
    </div>
  );
}

function RiskCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white">
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-black text-slate-950">{value}</p>
    </div>
  );
}

function ScenarioCard({
  title,
  tone,
  density,
  quality,
  response,
  profit,
  workforce,
}: {
  title: string;
  tone: "slate" | "indigo" | "emerald";
  density: number;
  quality: number;
  response: number;
  profit: number;
  workforce: string;
}) {
  const toneStyles = {
    slate: "border-slate-200 bg-white text-slate-950",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  } as const;

  return (
    <div className={cn("rounded-[1.5rem] border p-4", toneStyles[tone])}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <div className="mt-4 grid gap-3">
        <ScenarioMetric label="Density" value={density.toFixed(2)} />
        <ScenarioMetric label="Quality" value={`${quality}/100`} />
        <ScenarioMetric label="Response" value={`${response} min`} />
        <ScenarioMetric label="Profit" value={formatCurrency(profit)} />
      </div>
      <p className="mt-4 text-xs font-bold leading-5 text-slate-500">{workforce}</p>
    </div>
  );
}

function ScenarioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className="text-sm font-black text-current">{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  inverse = false,
}: {
  label: string;
  onClick: () => void;
  inverse?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
        inverse
          ? "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950",
      )}
    >
      {label}
    </button>
  );
}

function MetricButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-0.5",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", active ? "text-slate-400" : "text-slate-400")}>{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </button>
  );
}

function RevenueStrip({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const ratio = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
        <span>{label}</span>
        <span>{formatCurrency(value)}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-700", tone)} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function LensCard({ title, body, icon: Icon }: { title: string; body: string; icon: typeof MapPin }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <Icon className="mb-5 h-6 w-6 text-slate-400" />
      <h4 className="text-lg font-black text-slate-950">{title}</h4>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function CommandMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, map, zoom]);

  return null;
}

function DemandTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 space-y-1 text-sm font-bold">
        <p className="text-slate-900">Actual: {payload[0]?.value}</p>
        <p className="text-indigo-600">Predicted: {payload[1]?.value}</p>
      </div>
    </div>
  );
}

function GapTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 text-sm font-bold text-emerald-700">
        Gap pressure: {payload[0]?.value > 0 ? "+" : ""}{payload[0]?.value}
      </div>
    </div>
  );
}
