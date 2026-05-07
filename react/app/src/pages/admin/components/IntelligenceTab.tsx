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
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  SimulationEngine,
  type SimulationCompletionPayload,
  type SimulationGeoSelectionPayload,
  type SimulationPhase,
  type SimulationTelemetryPayload,
} from "./SimulationEngine";
import { MarketCommandSearch } from "@/components/maps/MarketCommandSearch";
import { Slider } from "@/components/ui/slider";
import {
  StrategyTerminal,
  type StrategyTerminalBrief as StrategyBrief,
  type StrategyTerminalStatus,
} from "./StrategyTerminal";
import {
  buildDynamicSimulationGeoConfig,
  buildSimulationGeoConfig,
  DEFAULT_SIMULATION_CITY_ID,
  generateSimulationBatch,
  getGlobalSimulationCity,
  sectorSeeds,
  type SimulationGeoConfig,
} from "@/utils/simulationData";
import type { GeocodedMarketResult } from "@/utils/geocoding";

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

interface CommandViewportTelemetry {
  center: [number, number];
  zoom: number;
}

interface ExpansionSignalSnapshot {
  routeId: string;
  zoneLabel: string;
  city: string;
  center: [number, number];
  radiusKm: number;
  densityScore: number;
  predictedDemand: number;
  currentWorkers: number;
  emergencyOrders: number;
  priceMultiplier: number;
  acquisitionCost: number;
  auditCoverage: number;
  marginLift: number;
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

type InterventionActionKey =
  | "deploy_core"
  | "adjust_payout"
  | "freeze_core"
  | "promote_anchor"
  | "trigger_audit"
  | "hold_hybrid";

interface InterventionActionSpec {
  key: InterventionActionKey;
  label: string;
}

interface InterventionState {
  badge: string;
  headline: string;
  summary: string;
  tone: "rose" | "amber" | "sky" | "emerald";
  primaryAction: InterventionActionSpec;
  secondaryAction: InterventionActionSpec;
}

interface LogicLogEntry {
  id: string;
  timestamp: string;
  message: string;
  tag: string;
  tone: "info" | "success" | "warning" | "critical";
  source: "simulation" | "strategy" | "system" | "ops";
}

interface MarketLeapState {
  geoConfig: SimulationGeoConfig;
  selectedAddress: string;
  source: SimulationGeoSelectionPayload["source"];
  scenario: SimulationCompletionPayload["scenario"];
}

interface CompetitorPulse {
  id: string;
  competitor: string;
  zoneId: string;
  zoneLabel: string;
  discountPercent: number;
  response: string;
}

interface LlmProviderHealth {
  provider: string;
  model: string;
  configured: boolean;
  status: string;
  lastCheckedAt: string | null;
  lastError: string | null;
}

interface LlmHealthSummary {
  mode: "ready" | "fallback";
  summary: string;
  primaryProvider: string | null;
  providers: LlmProviderHealth[];
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
  salaried_core: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  hybrid: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  freelancer_pool: "border-sky-300/20 bg-sky-300/10 text-sky-100",
};

const monoMetricFont = "\"JetBrains Mono\", \"Fira Code\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const mapLabelFont = "\"Inter\", \"Plus Jakarta Sans\", system-ui, sans-serif";

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
const INITIAL_COMMAND_GEO_CONFIG = buildSimulationGeoConfig({
  cityId: DEFAULT_SIMULATION_CITY_ID,
  center: { lat: AGRA_MAP_CENTER[0], lng: AGRA_MAP_CENTER[1] },
  radiusKm: 12,
});
const INITIAL_COMMAND_SELECTION: SimulationGeoSelectionPayload = {
  geoConfig: INITIAL_COMMAND_GEO_CONFIG,
  selectedAddress: INITIAL_COMMAND_GEO_CONFIG.marketLabel,
  scenario: "baseline",
  source: "bootstrap",
  cityChanged: false,
};

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

const estimateObservationAltitude = (latitude: number, zoom: number) => {
  const earthCircumference = 40075016.686;
  const latAdjustment = Math.cos((latitude * Math.PI) / 180);
  const metersPerPixel = (earthCircumference * latAdjustment) / Math.pow(2, zoom + 8);
  return Math.max(80, metersPerPixel * 760);
};

const formatAltitude = (meters: number) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }

  return `${Math.round(meters)} m`;
};

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

const competitorPulseFeed: CompetitorPulse[] = [
  {
    id: "intel-taj-ganj",
    competitor: "UrbanX",
    zoneId: "taj-ganj",
    zoneLabel: "Taj Ganj",
    discountPercent: 20,
    response: "Maintain price integrity and lead with RAHI Verified Pro proof in customer messaging.",
  },
  {
    id: "intel-agra-cantt",
    competitor: "QuickFixer",
    zoneId: "agra-cantt",
    zoneLabel: "Agra Cantt",
    discountPercent: 15,
    response: "Protect repeat customers with loyalty nudges instead of matching city-wide discounting.",
  },
  {
    id: "intel-fatehabad-road",
    competitor: "ServiceSprint",
    zoneId: "fatehabad-road",
    zoneLabel: "Fatehabad Road",
    discountPercent: 18,
    response: "Hold the margin floor and emphasize on-time arrival plus audit-backed proof of work.",
  },
];

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

const calculateDistanceKm = (
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(right.lat - left.lat);
  const dLng = toRadians(right.lng - left.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(left.lat)) * Math.cos(toRadians(right.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildExpansionSignalSnapshot = (geoConfig: SimulationGeoConfig): ExpansionSignalSnapshot => {
  const cityTierMultiplier = geoConfig.cityTier === "tier_1"
    ? 1.24
    : geoConfig.cityTier === "tier_2"
      ? 1.08
      : geoConfig.cityTier === "tier_3"
        ? 0.96
        : geoConfig.cityTier === "international"
          ? 1.18
          : 0.9;
  const densityScore = Number(clampNumber(
    Number((geoConfig.demandScale * 1.16) + (geoConfig.emergencyScale * 2.25) + ((14 - geoConfig.radiusKm) * 0.035)),
    0.92,
    2.84,
  ).toFixed(2));
  const predictedDemand = Math.max(72, Math.round(geoConfig.demandScale * geoConfig.marketingScale * 118));
  const currentWorkers = Math.max(24, Math.round(geoConfig.workerScale * 78));
  const emergencyOrders = Math.max(3, Math.round(predictedDemand * geoConfig.emergencyScale * 0.38));
  const priceMultiplier = getPriceMultiplier(densityScore);
  const acquisitionCost = Math.round(geoConfig.marketingScale * 5400 * cityTierMultiplier);
  const auditCoverage = Math.round(clampNumber(
    82 + ((geoConfig.historicalTraffic - 1) * 24) + ((geoConfig.workerScale - 1) * 16),
    78,
    95,
  ));
  const projectedRevenue = predictedDemand * Math.round(820 * priceMultiplier);
  const operatingCost = (currentWorkers * 420) + Math.round(acquisitionCost * 0.65);
  const marginLift = Math.round((projectedRevenue * 0.28) - operatingCost);

  return {
    routeId: `${geoConfig.cityId}-${geoConfig.hasHistoricalData ? "command-radius" : "launch-ring"}`,
    zoneLabel: geoConfig.hasHistoricalData
      ? `${geoConfig.cityLabel} Command Radius`
      : `${geoConfig.cityLabel} Launch Corridor`,
    city: geoConfig.cityLabel,
    center: [geoConfig.center.lat, geoConfig.center.lng],
    radiusKm: geoConfig.radiusKm,
    densityScore,
    predictedDemand,
    currentWorkers,
    emergencyOrders,
    priceMultiplier,
    acquisitionCost,
    auditCoverage,
    marginLift,
  };
};

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
  radiusKm = 4,
  purpose = "zone_brief",
  scenario = "baseline",
  competitorSignal,
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
  radiusKm?: number;
  purpose?: "zone_brief" | "expansion_brief";
  scenario?: SimulationCompletionPayload["scenario"];
  competitorSignal?: string | null;
}): StrategyBrief => {
  const competitorReasoning = competitorSignal
    ? ` ${competitorSignal} The operating response should protect trust and margin instead of matching blanket discounting.`
    : "";
  const competitorProcedure = competitorSignal
    ? `Keep pricing disciplined in ${zoneLabel} and counter the live discount with Verified Pro proof plus loyalty retention messaging.`
    : null;

  if (purpose === "expansion_brief") {
    return {
      signal: `New geography detected: ${city} is ready for a burn-first market-entry read, and ${zoneLabel} is the active launch corridor at D=${densityScore.toFixed(2)}.`,
      reasoning: `Expansion mode protects runway before it chases share. ${city} is being scored against the Density Rule first, so acquisition cost at ${formatCurrency(acquisitionCost)} and margin lift of ${formatCurrency(Math.max(0, marginLift))} must stay disciplined before fixed labor widens.${competitorReasoning}`,
      procedures: [
        `Open ${zoneLabel} inside the current ${radiusKm} km radius with a ${densityScore >= 2.3 ? "shadow-launch salaried-core pilot" : densityScore < 1.0 ? "verified-freelancer reserve" : "hybrid shadow launch mix"} instead of a city-wide rollout.`,
        `Protect burn by capping launch CAC near ${formatCurrency(acquisitionCost)} and widening salaried coverage only if margin lift stays above ${formatCurrency(Math.max(0, marginLift))}.`,
        competitorProcedure || `Keep a growth reserve for ${city}: expand only after density holds above ${densityScore >= 2.3 ? "2.30" : densityScore < 1.0 ? "1.10" : "1.80"} and audit-backed proof coverage stays above 85%.`,
      ].filter((procedure): procedure is string => Boolean(procedure)),
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  if (scenario === "supply_crunch") {
    return {
      signal: `${zoneLabel} has entered amber-alert preservation mode; supply is collapsing faster than the current field plan can recover on its own.`,
      reasoning: `The supply crunch override prioritizes service preservation over growth. Density is ${densityScore.toFixed(2)}, ${predictedDemand} jobs are in the forecast, and the current ${currentWorkers}-worker field base cannot absorb the shortage without suspending lower-priority demand.${competitorReasoning}`,
      procedures: [
        `Suspend non-essential bookings in ${zoneLabel} and keep salaried workers focused on high-priority jobs for the next ${timeLens} window.`,
        `Activate a temporary ${Math.max(1.5, priceMultiplier).toFixed(2)}x payout shield so emergency acceptance does not collapse in ${city}.`,
        `Re-route the core team toward ${hottestSector} and re-run the shortage simulation before reopening growth lanes.`,
        competitorProcedure,
      ].filter((procedure): procedure is string => Boolean(procedure)),
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  if (scenario === "monsoon") {
    return {
      signal: `${zoneLabel} is under active monsoon deployment protocol; emergency repair density is rising faster than a normal-day workforce plan can absorb.`,
      reasoning: `The weather-aware Density Rule treats ${zoneLabel} as an emergency reliability lane first. Density is ${densityScore.toFixed(2)}, there are ${emergencyOrders} emergency jobs in the current signal stack, and pricing or staffing delays will turn directly into burn and service-quality erosion.${competitorReasoning}`,
      procedures: [
        `Shift salaried workers into Plumbing, Roofing, and Electrical lanes in ${zoneLabel} for the next ${timeLens} window.`,
        `Hold a weather multiplier near ${Math.max(1.25, priceMultiplier).toFixed(2)}x so response incentives do not collapse contribution margin in ${city}.`,
        `Pause low-priority cosmetic work and re-run the storm simulation before reopening general-service growth in ${hottestSector}.`,
        competitorProcedure,
      ].filter((procedure): procedure is string => Boolean(procedure)),
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  if (densityScore > 2.5) {
    return {
      signal: `${zoneLabel} is overheating; density ${densityScore.toFixed(2)} is outpacing the current ${currentWorkers}-worker field capacity.`,
      reasoning: `The Density Rule treats ${zoneLabel} as a salaried-core zone because D=${densityScore.toFixed(2)} is above 2.5. With ${predictedDemand} forecast jobs and ${emergencyOrders} emergency orders, reliability matters more than freelancer flexibility.${competitorReasoning}`,
      procedures: [
        `Deploy 5 salaried workers into ${zoneLabel} and route emergency demand there first until density cools below 2.3.`,
        `Hold pricing around ${priceMultiplier.toFixed(2)}x and defend fill rate before expanding acquisition in ${city}.`,
        `Run photo-proof QA checks in ${hottestSector} before the next ${timeLens} demand wave.`,
        competitorProcedure,
      ].filter((procedure): procedure is string => Boolean(procedure)),
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  if (densityScore < 1.0) {
    return {
      signal: `${zoneLabel} is under-dense; D=${densityScore.toFixed(2)} means salaried hiring here is a burn trap right now.`,
      reasoning: `The Density Rule treats ${zoneLabel} as freelancer-led because D=${densityScore.toFixed(2)} is below 1.0. Fixed payroll would expand faster than service reliability, especially with acquisition cost already at ${formatCurrency(acquisitionCost)}.${competitorReasoning}`,
      procedures: [
        `Pause salaried expansion in ${zoneLabel} and cover this zone with verified freelancers for the next ${timeLens}.`,
        `Shift referral bonuses to high-quality freelancers instead of adding fixed payroll in ${city}.`,
        `Re-open salaried hiring only if margin lift rises above ${formatCurrency(Math.max(0, marginLift))} while churn drops below ${churnRate.toFixed(1)}%.`,
        competitorProcedure,
      ].filter((procedure): procedure is string => Boolean(procedure)),
      provider: "rule_engine",
      model: "density-rule-fallback",
      saved: false,
      fallback: true,
    };
  }

  return {
    signal: `${zoneLabel} is in the transition band; D=${densityScore.toFixed(2)} supports a hybrid workforce, but the next move should be paced carefully.`,
    reasoning: `The Density Rule keeps ${zoneLabel} hybrid because D=${densityScore.toFixed(2)} sits between 1.0 and 2.5. The zone can absorb a small salaried core, but churn at ${churnRate.toFixed(1)}% means burn control still matters.${competitorReasoning}`,
    procedures: [
      `Add 2 salaried anchors in ${zoneLabel} while keeping flexible freelancer coverage for the next ${timeLens} cycle.`,
      `Keep pricing close to ${priceMultiplier.toFixed(2)}x until repeat demand rises faster than fixed labor cost.`,
      `Re-run the simulation after the next peak and promote ${zoneLabel} only if density stays above 1.8 for consecutive windows.`,
      competitorProcedure,
    ].filter((procedure): procedure is string => Boolean(procedure)),
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

  if (simulation.scenario === "monsoon") {
    return [
      `${simulation.hottestSector} is carrying the heaviest repair pressure in the active monsoon deployment window.`,
      `Storm operations are live across ${simulation.zone.city}; ${simulation.totalProjectedOrders.toLocaleString("en-IN")} projected orders are being re-ranked for mobility shock and emergency demand.`,
      ...topSignals,
    ].slice(0, 3);
  }

  if (simulation.scenario === "supply_crunch") {
    const gapPercent = Math.round(simulation.highestSupplyGap * 100);
    return [
      simulation.criticalGapSector
        ? `ALERT: Supply-Demand Gap in ${simulation.criticalGapSector} is ${gapPercent}%. Critical failure risk.`
        : `${simulation.hottestSector} is carrying the worst amber-load condition in the latest shortage run.`,
      `Service preservation mode is active across ${simulation.zone.city} with ${simulation.totalProjectedOrders.toLocaleString("en-IN")} projected orders and only ${simulation.totals.activeWorkers.toLocaleString("en-IN")} active workers in the evidence pack.`,
      ...topSignals,
    ].slice(0, 3);
  }

  return [
    `${simulation.hottestSector} emerged as the hottest sector in the latest ${simulation.totalPoints.toLocaleString("en-IN")} point run.`,
    ...topSignals,
  ].slice(0, 3);
};

const findReferencedZoneId = (text: string) => {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) {
    return null;
  }

  const referencedSector = sectorSignals.find((sector) => (
    sector.id !== "all"
    && (
      normalized.includes(sector.label.toLowerCase())
      || normalized.includes(sector.id.toLowerCase())
    )
  ));

  return referencedSector?.id || null;
};

const getExpansionMarketLabel = (cityLabel: string) => (
  /delhi/i.test(cityLabel) ? "DELHI NCR" : cityLabel.toUpperCase()
);

const buildStrategyTerminalScript = ({
  status,
  activeRouteId,
  activeLabel,
  timeLensLabel,
  densityScore,
  strategyBrief,
  logicSignals,
  competitorPulseMessage,
  pendingSignal,
}: {
  status: StrategyTerminalStatus;
  activeRouteId: string;
  activeLabel: string;
  timeLensLabel: string;
  densityScore: number;
  strategyBrief: StrategyBrief | null;
  logicSignals: string[];
  competitorPulseMessage?: string | null;
  pendingSignal?: string | null;
}) => {
  if (status === "thinking") {
    return [
      `$ rahi://strategy/${activeRouteId}`,
      `> Booting command lane for ${activeLabel}`,
      `> Syncing ${timeLensLabel} density window at D=${densityScore.toFixed(2)}`,
      ...(pendingSignal ? [`> ${pendingSignal}`] : []),
      ...(competitorPulseMessage ? [`> [INTEL] ${competitorPulseMessage}`] : []),
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
    `$ rahi://strategy/${activeRouteId}`,
    `> SIGNAL: ${strategyBrief.signal}`,
    `> WHY: ${strategyBrief.reasoning}`,
    ...(competitorPulseMessage ? [`> INTEL: ${competitorPulseMessage}`] : []),
    ...strategyBrief.procedures.map((procedure, index) => `> CMD-${index + 1}: ${procedure}`),
  ].join("\n");
};

const buildInterventionState = ({
  zoneLabel,
  densityScore,
  demandGap,
  auditCoverage,
  emergencyOrders,
  marginLift,
  priceMultiplier,
  scenario,
  highestSupplyGap,
  criticalGapSector,
}: {
  zoneLabel: string;
  densityScore: number;
  demandGap: number;
  auditCoverage: number;
  emergencyOrders: number;
  marginLift: number;
  priceMultiplier: number;
  scenario?: SimulationCompletionPayload["scenario"];
  highestSupplyGap?: number;
  criticalGapSector?: string | null;
}): InterventionState => {
  if (scenario === "supply_crunch" && (highestSupplyGap ?? 0) >= 0.4) {
    return {
      badge: "Amber alert",
      headline: `Preserve service in ${criticalGapSector || zoneLabel} before the shortage spills into a fill-rate collapse.`,
      summary: `Supply is failing faster than growth can help. The current gap is ${Math.round((highestSupplyGap ?? 0) * 100)}%, so the next move must protect essential bookings and core reliability.`,
      tone: "amber",
      primaryAction: { key: "deploy_core", label: "Deploy Amber Plan" },
      secondaryAction: { key: "adjust_payout", label: "Activate 1.50x Shield" },
    };
  }

  if (densityScore >= 2.1 || demandGap >= 9) {
    return {
      badge: "Zone overheating",
      headline: `Deploy salaried core into ${zoneLabel} before the next demand pulse widens the fill-rate gap.`,
      summary: `Demand is outrunning supply at D=${densityScore.toFixed(2)}. This zone needs faster guaranteed capacity, not more passive monitoring.`,
      tone: "amber",
      primaryAction: { key: "deploy_core", label: "Deploy Salaried Core" },
      secondaryAction: { key: "adjust_payout", label: `Adjust Payout To ${priceMultiplier.toFixed(2)}x` },
    };
  }

  if (auditCoverage < 82 || emergencyOrders >= 4) {
    return {
      badge: "Trust drift watch",
      headline: `Audit confidence is softening in ${zoneLabel}; ops should protect service proof before scaling volume.`,
      summary: `Before/after verification strength is only ${auditCoverage.toFixed(0)}%, so this zone needs trust-first intervention before more demand is pushed into it.`,
      tone: "rose",
      primaryAction: { key: "trigger_audit", label: "Trigger Audit Sweep" },
      secondaryAction: { key: "promote_anchor", label: "Promote Zone Anchor" },
    };
  }

  if (densityScore < 1.0 && marginLift <= 0) {
    return {
      badge: "Burn trap",
      headline: `${zoneLabel} should stay freelancer-led until density strengthens enough to justify fixed payroll.`,
      summary: `The zone is scattered at D=${densityScore.toFixed(2)} and margin lift is still ${formatCurrency(marginLift)}. Fixed labor here would dilute reliability gains.`,
      tone: "sky",
      primaryAction: { key: "freeze_core", label: "Freeze Core Hiring" },
      secondaryAction: { key: "adjust_payout", label: "Tune Flex Incentives" },
    };
  }

  return {
    badge: "Hybrid hold",
    headline: `${zoneLabel} is in controlled balance; keep a hybrid crew and steer with tactical pricing instead of major structural change.`,
    summary: `The zone is stable enough for measured intervention. Density, pricing, and proof quality are aligned, so this is an execution problem, not a crisis.`,
    tone: "emerald",
    primaryAction: { key: "hold_hybrid", label: "Lock Hybrid Plan" },
    secondaryAction: { key: "adjust_payout", label: "Tune Payout Lane" },
  };
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
  const [intelDockExpanded, setIntelDockExpanded] = useState(true);
  const [manualCoreWorkers, setManualCoreWorkers] = useState(4);
  const [latestSimulation, setLatestSimulation] = useState<SimulationCompletionPayload | null>(null);
  const [strategyBrief, setStrategyBrief] = useState<StrategyBrief | null>(null);
  const [strategyStatus, setStrategyStatus] = useState<StrategyTerminalStatus>("idle");
  const [strategyMessage, setStrategyMessage] = useState("Run the simulation or request a deep dive to generate the COO briefing.");
  const [strategyPendingSignal, setStrategyPendingSignal] = useState<string | null>(null);
  const [llmHealth, setLlmHealth] = useState<LlmHealthSummary | null>(null);
  const [commandGeoSelection, setCommandGeoSelection] = useState<SimulationGeoSelectionPayload>(INITIAL_COMMAND_SELECTION);
  const [marketLeapState, setMarketLeapState] = useState<MarketLeapState | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [commandViewport, setCommandViewport] = useState<CommandViewportTelemetry>({
    center: commandMapZones.find((zone) => zone.id === initialZoneId)?.center || AGRA_MAP_CENTER,
    zoom: initialZoneId === "all" ? 11 : 12,
  });
  const [logicLog, setLogicLog] = useState<LogicLogEntry[]>([
    {
      id: "logic-boot",
      timestamp: formatAuditTimestamp(),
      message: "Command center online. Launch the simulation or request a zone briefing to start the reasoning trail.",
      tag: "SYSTEM",
      tone: "info",
      source: "system",
    },
  ]);
  const [simulationPhase, setSimulationPhase] = useState<SimulationPhase>("idle");
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [lastExecutedStrategy, setLastExecutedStrategy] = useState<{
    zoneId: string;
    zoneLabel: string;
    coreWorkers: number;
    appliedAt: string;
  } | null>(null);
  const logScrollerRef = useRef<HTMLDivElement | null>(null);
  const lastTelemetryMessageRef = useRef<string | null>(null);
  const lastCompetitorPulseRef = useRef<string | null>(null);
  const lastMarketLeapRef = useRef<{ cityId: string; lat: number; lng: number } | null>(null);

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

  const loadCloudEngineHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API}/health`, { cache: "no-store" });
      const payload = await response.json();

      if (response.ok && payload?.llm) {
        setLlmHealth(payload.llm as LlmHealthSummary);
      }
    } catch {
      setLlmHealth((current) => current ?? {
        mode: "fallback",
        summary: "Cloud Engine: Fallback Mode",
        primaryProvider: null,
        providers: [],
      });
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
    void loadCloudEngineHealth();

    const intervalId = window.setInterval(() => {
      void loadCloudEngineHealth();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadCloudEngineHealth]);

  useEffect(() => {
    const normalizedZoneId = findSector(routeZoneId).id;
    setCommandGeoSelection(INITIAL_COMMAND_SELECTION);
    setMarketLeapState(null);
    setSelectedCoordinates(null);
    setStrategyPendingSignal(null);
    lastMarketLeapRef.current = null;
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

  const competitorPulse = useMemo<CompetitorPulse>(() => (
    competitorPulseFeed.find((pulse) => pulse.zoneId === activeSector.id) || {
      id: `intel-${activeSector.id}`,
      competitor: "UrbanX",
      zoneId: activeSector.id,
      zoneLabel: activeSector.label,
      discountPercent: 12,
      response: "Protect margin with loyalty nudges and lead with RAHI Verified Pro proof instead of matching broad discounts.",
    }
  ), [activeSector.id, activeSector.label]);

  const competitorPulseMessage = useMemo(() => (
    `Competitor '${competitorPulse.competitor}' just launched a ${competitorPulse.discountPercent}% discount in ${competitorPulse.zoneLabel}. ${competitorPulse.response}`
  ), [competitorPulse]);

  const marketLeapSnapshot = useMemo(
    () => (marketLeapState ? buildExpansionSignalSnapshot(marketLeapState.geoConfig) : null),
    [marketLeapState],
  );
  const isPinnedCommandMode = Boolean(marketLeapState);
  const isGlobalLeap = Boolean(
    marketLeapState
    && (
      !marketLeapState.geoConfig.hasHistoricalData
      || marketLeapState.geoConfig.cityId !== DEFAULT_SIMULATION_CITY_ID
      || calculateDistanceKm(
        marketLeapState.geoConfig.center,
        { lat: AGRA_MAP_CENTER[0], lng: AGRA_MAP_CENTER[1] },
      ) > 55
    ),
  );

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
  const globalPreviewSignals = useMemo(() => {
    if (!isPinnedCommandMode || !marketLeapState) {
      return [] as Array<SimulationPreviewPoint & { city: string }>;
    }

    return generateSimulationBatch({
      batchIndex: 0,
      batchSize: 60,
      geoConfig: marketLeapState.geoConfig,
      scenario: "baseline",
    }).map((point, index) => ({
      id: `global-preview-${index}`,
      zoneId: marketLeapState.geoConfig.cityId,
      label: point.areaSector,
      city: marketLeapState.geoConfig.cityLabel,
      position: [point.lat, point.lng] as [number, number],
      serviceType: point.serviceType,
      estimatedValue: point.estimatedValue,
      isEmergency: point.isEmergency,
    }));
  }, [isPinnedCommandMode, marketLeapState]);

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
  const criticalSimulationSector = useMemo(
    () => latestSimulation?.sectors.find((sector) => sector.sector === latestSimulation.criticalGapSector)
      || latestSimulation?.sectors[0]
      || null,
    [latestSimulation],
  );
  const aiRecommendedCore = useMemo(
    () => Math.max(
      1,
      currentCoreWorkers
      + (
        latestSimulation?.scenario === "supply_crunch"
          ? Math.max(
            6,
            Math.round((criticalSimulationSector?.recommendedShift || 0) * 0.8),
            Math.round(currentCoreWorkers * 0.35),
          )
          : analysis.density_score >= 1.8
            ? 4
            : analysis.density_score >= 1.2
              ? 2
              : 0
      ),
    ),
    [analysis.density_score, criticalSimulationSector?.recommendedShift, currentCoreWorkers, latestSimulation?.scenario],
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
    options?: Partial<Pick<LogicLogEntry, "tone" | "source" | "tag">>,
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
          tag: options?.tag || (options?.source === "simulation" ? "RF_MODEL" : options?.source === "strategy" ? "DECISION" : "SYSTEM"),
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

  const liveDemandGap = analysis.predicted_demand - analysis.current_orders;
  const projectedMarginLift = latestSimulation?.marginLift ?? (aiScenario.projectedProfit - currentScenario.projectedProfit);
  const interventionState = useMemo(() => (
    buildInterventionState({
      zoneLabel: activeSector.label,
      densityScore: analysis.density_score,
      demandGap: liveDemandGap,
      auditCoverage: auditSignals.beforeAfterCoverage,
      emergencyOrders: analysis.emergency_orders,
      marginLift: projectedMarginLift,
      priceMultiplier,
      scenario: latestSimulation?.scenario,
      highestSupplyGap: latestSimulation?.highestSupplyGap,
      criticalGapSector: latestSimulation?.criticalGapSector,
    })
  ), [
    activeSector.label,
    analysis.density_score,
    analysis.emergency_orders,
    auditSignals.beforeAfterCoverage,
    liveDemandGap,
    latestSimulation?.criticalGapSector,
    latestSimulation?.highestSupplyGap,
    latestSimulation?.scenario,
    priceMultiplier,
    projectedMarginLift,
  ]);
  const displayInterventionState = useMemo<InterventionState>(() => {
    if (!isGlobalLeap || !marketLeapSnapshot) {
      return interventionState;
    }

    return {
      badge: "Market entry armed",
      headline: `${marketLeapSnapshot.city} is now the active expansion corridor; keep the ribbon green while the CEO agent drafts the launch playbook.`,
      summary: `The command surface has left Agra operating mode and switched into a burn-first expansion read. ${marketLeapSnapshot.zoneLabel} is being evaluated inside a ${marketLeapSnapshot.radiusKm} km launch ring so runway discipline lands before aggressive hiring.`,
      tone: "emerald",
      primaryAction: { key: "freeze_core", label: "Protect Burn First" },
      secondaryAction: { key: "adjust_payout", label: "Stage Growth Reserve" },
    };
  }, [interventionState, isGlobalLeap, marketLeapSnapshot]);
  const isSupplyCrunchAlert = latestSimulation?.scenario === "supply_crunch" && (latestSimulation.highestSupplyGap ?? 0) >= 0.4;

  const auditPulseSignals = useMemo(
    () => visiblePreviewSignals.filter((_, index) => index % 7 === 0).slice(0, 8),
    [visiblePreviewSignals],
  );

  const highlightedZoneId = useMemo(() => {
    const referencePool = [
      lastExecutedStrategy?.zoneLabel || "",
      latestSimulation?.criticalGapSector || "",
      latestSimulation?.hottestSector || "",
      strategyBrief?.signal || "",
      strategyBrief?.reasoning || "",
      ...(strategyBrief?.procedures || []),
      ...logicLog.slice(-8).map((entry) => entry.message),
    ];

    for (const candidate of referencePool) {
      const referencedZoneId = findReferencedZoneId(candidate);
      if (referencedZoneId) {
        return referencedZoneId;
      }
    }

    return activeSector.id;
  }, [activeSector.id, lastExecutedStrategy?.zoneLabel, latestSimulation?.criticalGapSector, latestSimulation?.hottestSector, logicLog, strategyBrief]);

  const highlightedMapZone = useMemo(() => (
    commandMapZones.find((zone) => zone.id === highlightedZoneId) || activeMapZone
  ), [activeMapZone, highlightedZoneId]);

  const tacticalState = useMemo(() => {
    if (simulationRunning || strategyStatus === "thinking") {
      return "analyzing" as const;
    }

    if (
      (latestSimulation?.scenario === "supply_crunch" && (latestSimulation.highestSupplyGap ?? 0) >= 0.4)
      || analysis.density_score >= 1.8
      || (latestSimulation?.hottestSector && highlightedZoneId !== activeSector.id)
    ) {
      return "surge" as const;
    }

    return "steady" as const;
  }, [activeSector.id, analysis.density_score, highlightedZoneId, latestSimulation?.highestSupplyGap, latestSimulation?.hottestSector, latestSimulation?.scenario, simulationRunning, strategyStatus]);

  const displayRouteId = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.routeId : highlightedZoneId;
  const displayRouteLabel = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.zoneLabel : highlightedMapZone.label;
  const displayRouteCity = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.city : highlightedMapZone.city;
  const displayDensityScore = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.densityScore : analysis.density_score;
  const displayPredictedDemand = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.predictedDemand : analysis.predicted_demand;
  const displayDemandGap = isPinnedCommandMode && marketLeapSnapshot
    ? marketLeapSnapshot.predictedDemand - Math.round(marketLeapSnapshot.predictedDemand * 0.74)
    : liveDemandGap;
  const displayPriceMultiplier = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.priceMultiplier : priceMultiplier;
  const displayAuditCoverage = isPinnedCommandMode && marketLeapSnapshot ? marketLeapSnapshot.auditCoverage : auditSignals.beforeAfterCoverage;
  const commandMapCenter = isPinnedCommandMode && marketLeapSnapshot
    ? marketLeapSnapshot.center
    : selectedSectorId === "all"
      ? AGRA_MAP_CENTER
      : activeMapZone.center;
  const commandMapZoom = isPinnedCommandMode ? 10 : selectedSectorId === "all" ? 11 : 12;
  const commandWorkerCountsByZone = useMemo(() => {
    const previewPool = isPinnedCommandMode ? globalPreviewSignals : visiblePreviewSignals;

    const aggregatedPreviewCounts = previewPool.reduce<Record<string, number>>((accumulator, signal) => {
      accumulator[signal.zoneId] = (accumulator[signal.zoneId] || 0) + 1;
      return accumulator;
    }, {});

    return sectorSignals
      .filter((sector) => sector.id !== "all")
      .reduce<Record<string, number>>((accumulator, sector) => {
        accumulator[sector.id] = sector.id === analysis.area_id
          ? analysis.current_workers
          : aggregatedPreviewCounts[sector.id] || sector.workers;
        return accumulator;
      }, {});
  }, [analysis.area_id, analysis.current_workers, globalPreviewSignals, isPinnedCommandMode, visiblePreviewSignals]);
  const zoneLabelZoom = commandViewport.zoom;
  const visibleCommandZoneLabels = useMemo(() => {
    if (isPinnedCommandMode) {
      return [] as CommandMapZone[];
    }

    return commandMapZones.filter((zone, index) => {
      if (zone.id === activeSector.id || zone.id === highlightedZoneId) return true;

      const density = zoneDensityMap[zone.id] ?? 0;
      if (density >= 1.85) return true;
      if (zoneLabelZoom >= 12.25) return true;
      if (zoneLabelZoom >= 11.55) return index % 2 === 0;

      return false;
    });
  }, [activeSector.id, highlightedZoneId, isPinnedCommandMode, zoneDensityMap, zoneLabelZoom]);
  const commandZoneLabelIcons = useMemo(() => {
    if (isPinnedCommandMode) {
      return {} as Record<string, L.DivIcon>;
    }

    return Object.fromEntries(
      visibleCommandZoneLabels.map((zone) => {
        const density = zoneDensityMap[zone.id] ?? 0;
        const workerCount = commandWorkerCountsByZone[zone.id] ?? 0;
        const isPrimary = zone.id === activeSector.id || zone.id === highlightedZoneId;
        const badgeTone = density >= 1.85 ? "critical" : density >= 1.2 ? "surge" : "healthy";

        return [zone.id, L.divIcon({
          className: "rahi-zone-label-wrapper",
          html: `
            <div class="rahi-zone-label ${isPrimary ? "rahi-zone-label--primary" : ""}">
              <span class="rahi-zone-label__name">${zone.label}</span>
              <span class="rahi-zone-badge rahi-zone-badge--${badgeTone}">${workerCount} workers</span>
            </div>
          `,
          iconSize: [168, 42],
          iconAnchor: [84, 21],
        })];
      }),
    ) as Record<string, L.DivIcon>;
  }, [activeSector.id, commandWorkerCountsByZone, highlightedZoneId, isPinnedCommandMode, visibleCommandZoneLabels, zoneDensityMap]);
  const commandViewportAltitude = useMemo(
    () => formatAltitude(estimateObservationAltitude(commandViewport.center[0], commandViewport.zoom)),
    [commandViewport.center, commandViewport.zoom],
  );

  useEffect(() => {
    setCommandViewport({
      center: commandMapCenter,
      zoom: commandMapZoom,
    });
  }, [commandMapCenter, commandMapZoom]);

  const terminalScript = useMemo(() => (
    buildStrategyTerminalScript({
      status: strategyStatus,
      activeRouteId: displayRouteId,
      activeLabel: displayRouteLabel,
      timeLensLabel: timeLensMeta[timeLens].label,
      densityScore: displayDensityScore,
      strategyBrief,
      logicSignals: simulationLogicSignals,
      competitorPulseMessage,
      pendingSignal: strategyPendingSignal,
    })
  ), [
    competitorPulseMessage,
    displayDensityScore,
    displayRouteId,
    displayRouteLabel,
    simulationLogicSignals,
    strategyPendingSignal,
    strategyBrief,
    strategyStatus,
    timeLens,
  ]);

  const canExecuteAiStrategy = Boolean(strategyBrief && latestSimulation);

  const applyCommandGeoSelection = useCallback((payload: SimulationGeoSelectionPayload) => {
    setCommandGeoSelection(payload);
    setSelectedCoordinates(payload.geoConfig.center);

    const distanceFromAgra = calculateDistanceKm(
      payload.geoConfig.center,
      { lat: AGRA_MAP_CENTER[0], lng: AGRA_MAP_CENTER[1] },
    );
    const shouldUseCommandPinMode = payload.source !== "bootstrap" && (
      !payload.geoConfig.isExistingMarket
      || payload.source === "search"
      || payload.source === "map_pin"
      || payload.geoConfig.radiusKm !== INITIAL_COMMAND_GEO_CONFIG.radiusKm
      || distanceFromAgra > 2
    );

    if (
      payload.source !== "bootstrap"
      && payload.cityChanged
    ) {
      appendLogicEntry(
        `[SYSTEM] RE-CENTERING ENGINE: ${payload.geoConfig.cityLabel.toUpperCase()} DETECTED. LOAD BALANCING SIMULATION...`,
        { tone: "warning", source: "system", tag: "STRICT_AUDIT" },
      );
    }

    if (!payload.geoConfig.hasHistoricalData) {
      setLatestSimulation(null);
      setStrategyBrief(null);
      setStrategyStatus("idle");
      setStrategyMessage("Historical pilot data is unavailable here. The strategy lane is waiting for synthetic launch evidence or a market-entry brief.");
    }

    if (!shouldUseCommandPinMode) {
      setMarketLeapState(null);
      setStrategyPendingSignal(null);
      lastMarketLeapRef.current = null;
      return;
    }

    if (payload.source === "city_select" || payload.source === "map_pin" || payload.source === "search") {
      const resolvedCity = getGlobalSimulationCity(payload.geoConfig.cityId)?.label || payload.geoConfig.cityLabel;
      setStrategyPendingSignal(
        payload.geoConfig.hasHistoricalData
          ? `[DETECTED] COMMAND PIN ARMED: ${resolvedCity.toUpperCase()}. RE-SCOPING PILOT DENSITY...`
          : `[DETECTED] ENTERING NEW MARKET: ${getExpansionMarketLabel(resolvedCity)}. CALIBRATING DENSITY PARAMETERS...`,
      );
    }

    setMarketLeapState({
      geoConfig: payload.geoConfig,
      selectedAddress: payload.selectedAddress,
      source: payload.source,
      scenario: payload.scenario,
    });
  }, [appendLogicEntry]);

  const handleHudMarketSelect = useCallback((result: GeocodedMarketResult) => {
    const scenario = latestSimulation?.scenario ?? commandGeoSelection.scenario ?? "baseline";
    applyCommandGeoSelection({
      geoConfig: result.geoConfig,
      selectedAddress: result.label,
      scenario,
      source: "search",
      cityChanged: result.geoConfig.cityId !== commandGeoSelection.geoConfig.cityId,
    });
  }, [applyCommandGeoSelection, commandGeoSelection.geoConfig.cityId, commandGeoSelection.scenario, latestSimulation?.scenario]);

  const handleCommandRadiusChange = useCallback((value: number[]) => {
    const nextRadius = value[0];
    if (!nextRadius) return;

    const nextGeoConfig = buildDynamicSimulationGeoConfig({
      center: commandGeoSelection.geoConfig.center,
      radiusKm: nextRadius,
      address: {
        cityName: commandGeoSelection.geoConfig.cityLabel,
        stateName: commandGeoSelection.geoConfig.stateName,
        stateCode: commandGeoSelection.geoConfig.stateCode,
        country: commandGeoSelection.geoConfig.country,
        displayName: commandGeoSelection.selectedAddress,
      },
      fallbackCityId: commandGeoSelection.geoConfig.cityId,
    });

    applyCommandGeoSelection({
      geoConfig: nextGeoConfig,
      selectedAddress: commandGeoSelection.selectedAddress,
      scenario: commandGeoSelection.scenario,
      source: marketLeapState ? "map_pin" : "recenter",
      cityChanged: false,
    });
  }, [applyCommandGeoSelection, commandGeoSelection, marketLeapState]);

  useEffect(() => {
    if (!logScrollerRef.current) return;
    logScrollerRef.current.scrollTop = logScrollerRef.current.scrollHeight;
  }, [logicLog]);

  useEffect(() => {
    const competitorKey = `${activeSector.id}:${competitorPulse.id}`;
    if (lastCompetitorPulseRef.current === competitorKey) {
      return;
    }

    appendLogicEntry(competitorPulseMessage, {
      tone: "warning",
      source: "system",
      tag: "INTEL",
    });
    lastCompetitorPulseRef.current = competitorKey;
  }, [activeSector.id, appendLogicEntry, competitorPulse.id, competitorPulseMessage]);

  const handleSimulationGeoConfigChange = useCallback((payload: SimulationGeoSelectionPayload) => {
    applyCommandGeoSelection(payload);
  }, [applyCommandGeoSelection]);

  const requestStrategyBrief = useCallback(async (
    options?: {
      simulation?: SimulationCompletionPayload | null;
      deepDive?: boolean;
      silent?: boolean;
      purpose?: "zone_brief" | "expansion_brief";
      geoConfig?: SimulationGeoConfig | null;
    },
  ) => {
    const simulation = options?.simulation ?? latestSimulation;
    const deepDive = Boolean(options?.deepDive);
    const purpose = options?.purpose ?? "zone_brief";
    const targetGeoConfig = options?.geoConfig ?? marketLeapState?.geoConfig ?? null;
    const token = localStorage.getItem("adminToken");
    const timeLensLabel = timeLensMeta[timeLens].label;
    const expansionSnapshot = purpose === "expansion_brief" && targetGeoConfig
      ? buildExpansionSignalSnapshot(targetGeoConfig)
      : null;
    const targetRouteId = expansionSnapshot ? expansionSnapshot.routeId : activeSector.id;
    const targetZoneLabel = expansionSnapshot ? expansionSnapshot.zoneLabel : activeSector.label;
    const targetCity = expansionSnapshot ? expansionSnapshot.city : activeSector.city;
    const targetDensityScore = expansionSnapshot ? expansionSnapshot.densityScore : analysis.density_score;
    const targetPredictedDemand = expansionSnapshot ? expansionSnapshot.predictedDemand : analysis.predicted_demand;
    const targetCurrentOrders = expansionSnapshot
      ? Math.max(0, expansionSnapshot.predictedDemand - Math.round(expansionSnapshot.predictedDemand * 0.26))
      : analysis.current_orders;
    const targetCurrentWorkers = expansionSnapshot ? expansionSnapshot.currentWorkers : analysis.current_workers;
    const targetEmergencyOrders = expansionSnapshot ? expansionSnapshot.emergencyOrders : analysis.emergency_orders;
    const targetPriceMultiplier = expansionSnapshot ? expansionSnapshot.priceMultiplier : priceMultiplier;
    const targetRadiusKm = expansionSnapshot ? expansionSnapshot.radiusKm : simulation?.zone.radiusKm ?? 4;
    const targetAcquisitionCost = expansionSnapshot ? expansionSnapshot.acquisitionCost : activeSector.spend;
    const isDelhiExpansion = Boolean(expansionSnapshot && /delhi/i.test(targetCity));
    const competitorSignalForRequest = expansionSnapshot
      ? `[INTEL] ${isDelhiExpansion ? "Urban Company" : "Local incumbent clusters"} are applying ${isDelhiExpansion ? 18 : 10}% trust and discount pressure in ${isDelhiExpansion ? "Delhi NCR" : targetZoneLabel}. ${isDelhiExpansion
        ? "Lead with Cloudinary-secured proof-of-work, Verified Pro audits, and a shadow launch before broad salary commitments."
        : "Lead with Verified Pro trust, secure-media proof, and disciplined pricing before broad launch discounting."}`
      : competitorPulseMessage;
    const competitorContextForRequest = competitorSignalForRequest
      ? expansionSnapshot
        ? {
          competitor: isDelhiExpansion ? "Urban Company" : "Local incumbent clusters",
          zoneLabel: isDelhiExpansion ? "Delhi NCR" : targetZoneLabel,
          discountPercent: isDelhiExpansion ? 18 : 10,
          response: isDelhiExpansion
            ? "Use a shadow-launch trust posture first: Cloudinary proof-of-work, Verified Pro audits, and selective freelancer coverage before scaling salaried core."
            : "Use Verified Pro proof and selective freelancer-first coverage before widening fixed labor.",
        }
        : {
          competitor: competitorPulse.competitor,
          zoneLabel: competitorPulse.zoneLabel,
          discountPercent: competitorPulse.discountPercent,
          response: competitorPulse.response,
        }
      : null;
    const targetMarginLift = expansionSnapshot
      ? expansionSnapshot.marginLift
      : (simulation?.marginLift ?? (aiScenario.projectedProfit - currentScenario.projectedProfit));
    const targetAuditSignals = expansionSnapshot
      ? {
        photoVerificationSuccessRate: expansionSnapshot.auditCoverage,
        beforeAfterCoverage: expansionSnapshot.auditCoverage,
        cloudinaryVerifiedUploads: Math.min(99, expansionSnapshot.auditCoverage + 3),
      }
      : auditSignals;
    const logicSignals = buildSimulationLogicSignals(simulation, targetZoneLabel);
    const pendingSignal = expansionSnapshot
      ? `[DETECTED] ENTERING NEW MARKET: ${getExpansionMarketLabel(targetCity)}. CALIBRATING DENSITY PARAMETERS...`
      : null;
    const combinedLogicSignals = [
      ...(pendingSignal ? [pendingSignal] : []),
      ...(competitorSignalForRequest ? [competitorSignalForRequest] : []),
      ...(purpose === "expansion_brief"
        ? [
          `[MARKET_ENTRY] ${targetCity} launch corridor locked at ${targetRadiusKm} km with burn-first scaling bias.`,
          `[SIGNAL] NEW GEOGRAPHY DETECTED: COORDINATES [${targetGeoConfig?.center.lat.toFixed(3)}, ${targetGeoConfig?.center.lng.toFixed(3)}]. ANALYZING ${targetCity.toUpperCase()} MARKET ENTRY...`,
        ]
        : []),
      ...logicSignals,
    ].filter((signal): signal is string => Boolean(signal));
    const forecastPayload = expansionSnapshot
      ? [
        { label: "Launch 0h", actual: Math.round(targetPredictedDemand * 0.56), predicted: Math.round(targetPredictedDemand * 0.72), gap: Math.round(targetPredictedDemand * 0.16) },
        { label: "Week 1", actual: Math.round(targetPredictedDemand * 0.68), predicted: Math.round(targetPredictedDemand * 0.86), gap: Math.round(targetPredictedDemand * 0.18) },
        { label: "Week 2", actual: Math.round(targetPredictedDemand * 0.74), predicted: Math.round(targetPredictedDemand * 0.94), gap: Math.round(targetPredictedDemand * 0.2) },
        { label: "Week 4", actual: Math.round(targetPredictedDemand * 0.82), predicted: targetPredictedDemand, gap: Math.round(targetPredictedDemand * 0.18) },
      ]
      : demandSeries.map((point) => ({
        label: point.label,
        actual: point.actual,
        predicted: point.predicted,
        gap: point.gap,
      }));
    const attachSimulationSummary = expansionSnapshot
      ? (simulation && simulation.zone.city.toLowerCase() === targetCity.toLowerCase())
      : Boolean(simulation);

    const payload = {
      purpose,
      routePath: `/admin-portal-2026/intelligence/${targetRouteId}`,
      zoneId: targetRouteId,
      zoneLabel: targetZoneLabel,
      city: targetCity,
      cityName: targetGeoConfig?.cityLabel || (expansionSnapshot ? expansionSnapshot.city : activeSector.city),
      stateName: targetGeoConfig?.stateName || "",
      stateCode: targetGeoConfig?.stateCode || "",
      marketContext: targetGeoConfig?.marketContext || (expansionSnapshot
        ? `${targetZoneLabel} is being evaluated through synthetic launch modeling because historical orders are not yet available.`
        : `${targetZoneLabel} is attached to the live pilot density stack.`),
      cityTier: targetGeoConfig?.cityTier || (isGlobalLeap ? "tier_2" : "pilot"),
      isExistingMarket: targetGeoConfig?.isExistingMarket ?? !expansionSnapshot,
      hasHistoricalData: targetGeoConfig?.hasHistoricalData ?? !expansionSnapshot,
      scenarioType: purpose === "expansion_brief" ? "baseline" : (simulation?.scenario ?? "baseline"),
      scenario: purpose === "expansion_brief"
        ? "baseline"
        : simulation?.scenario === "monsoon"
          ? "monsoon"
          : simulation?.scenario === "supply_crunch"
            ? "supply_crunch"
            : simulation?.scenario === "price_war"
              ? "price_war"
              : "baseline",
      weatherSignal: purpose === "expansion_brief"
        ? "New city market-entry mode. No crisis override is active until the admin triggers a stress scenario manually."
        : simulation?.scenario === "monsoon"
        ? "Active monsoon deployment protocol. Repair demand is elevated, worker mobility is constrained, and burn pressure is above baseline."
        : simulation?.scenario === "supply_crunch"
          ? "Active supply crunch protocol. Worker availability is halved and the command lane is preserving essential service."
          : simulation?.scenario === "price_war"
            ? "Active market competition stress. CAC is elevated and the command lane is defending margin ahead of discount matching."
            : "Normal weather operating window.",
      radiusKm: targetRadiusKm,
      timeLens: timeLensLabel,
      densityScore: targetDensityScore,
      predictedDemand: targetPredictedDemand,
      currentOrders: targetCurrentOrders,
      currentWorkers: targetCurrentWorkers,
      emergencyOrders: targetEmergencyOrders,
      allocationStrategy: expansionSnapshot
        ? targetDensityScore >= 2.3
          ? "salaried_core"
          : targetDensityScore < 1.0
            ? "freelancer_pool"
            : "hybrid"
        : analysis.allocation_strategy,
      priceMultiplier: targetPriceMultiplier,
      pricingSignal: expansionSnapshot
        ? `launch lane at ${targetPriceMultiplier.toFixed(2)}x readiness`
        : pricingSignal,
      serviceWarning: expansionSnapshot ? null : analysis.service_warning || null,
      competitorPressure: Boolean(competitorContextForRequest),
      competitorSignals: competitorSignalForRequest ? [competitorSignalForRequest] : [],
      competitorContext: competitorContextForRequest,
      auditData: targetAuditSignals,
      logicSignals: combinedLogicSignals,
      financials: {
        acquisitionCost: targetAcquisitionCost,
        churnRate: investorAnalytics.summary.churnRate,
        projectedRevenue: expansionSnapshot
          ? Math.round(targetPredictedDemand * 820 * targetPriceMultiplier)
          : manualScenario.projectedProfit + activeSector.spend + (manualScenario.totalWorkers * 430),
        projectedProfit: expansionSnapshot ? targetMarginLift : manualScenario.projectedProfit,
        platformCommission: investorAnalytics.summary.platformCommission,
        marginLift: targetMarginLift,
      },
      forecast: forecastPayload,
      simulationSummary: attachSimulationSummary && simulation
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
            supplyGapRatio: sector.supplyGapRatio,
            recommendedShift: sector.recommendedShift,
            activeWorkers: sector.activeWorkers,
          })),
        }
        : undefined,
      deepDive,
      providerPreference: purpose === "expansion_brief" || deepDive || simulation?.scenario === "supply_crunch" || simulation?.scenario === "price_war" ? "gemini" : "groq",
    };

    setStrategyPendingSignal(pendingSignal);
    setStrategyStatus("thinking");
    setStrategyMessage(
      purpose === "expansion_brief" && pendingSignal
        ? pendingSignal
        : deepDive
          ? `Deep strategy scan running for ${targetZoneLabel}. Gemini is drafting the CEO briefing.`
          : simulation?.scenario === "supply_crunch"
            ? `Amber-alert strategy scan running for ${targetZoneLabel}. Gemini is drafting the preservation plan.`
            : simulation?.scenario === "price_war"
              ? `Trust-defense scan running for ${targetZoneLabel}. Gemini is drafting the competitor-response playbook.`
            : `Fast zone analysis running for ${targetZoneLabel}. ${purpose === "expansion_brief" ? "Gemini" : "Groq"} is reading the density stack.`,
    );
    appendLogicEntry(
      purpose === "expansion_brief" && targetGeoConfig
        ? `Global leap armed for ${targetCity} at ${targetGeoConfig.center.lat.toFixed(4)}, ${targetGeoConfig.center.lng.toFixed(4)}. Querying the CEO agent for a burn-first expansion playbook.`
        : deepDive
          ? `Churn risk detected in ${targetZoneLabel}. Querying Gemini for an investor-grade retention and staffing strategy.`
          : simulation?.scenario === "supply_crunch"
            ? `Supply crunch detected in ${targetZoneLabel}. Querying Gemini for a service-preservation intervention plan.`
            : simulation?.scenario === "price_war"
              ? `Competitor pressure detected in ${targetZoneLabel}. Querying Gemini for a trust-over-price defense plan.`
            : `Scanning ${targetZoneLabel} for demand-supply delta before the next ${timeLensLabel} workforce shift while competitor pressure stays live.`,
      {
        tone: purpose === "expansion_brief" || deepDive || simulation?.scenario === "supply_crunch" || simulation?.scenario === "price_war" ? "warning" : "info",
        source: "strategy",
        tag: purpose === "expansion_brief" ? "GLOBAL_LEAP" : deepDive || simulation?.scenario === "supply_crunch" || simulation?.scenario === "price_war" ? "LLM_GEMINI" : "LLM_GROQ",
      },
    );
    logicSignals.slice(0, purpose === "expansion_brief" ? 1 : 2).forEach((signal) => {
      appendLogicEntry(signal, { tone: "info", source: "simulation", tag: "RF_MODEL" });
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
      setStrategyPendingSignal(null);
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
        { tone: result.fallback ? "warning" : "success", source: "strategy", tag: "DECISION" },
      );
      if (result.auditLog) {
        appendLogicEntry(result.auditLog, {
          tone: "warning",
          source: "strategy",
          tag: "STRATEGY",
        });
      }

      if (!options?.silent) {
        toast.success(
          purpose === "expansion_brief"
            ? `${targetCity} expansion playbook is ready.`
            : deepDive
              ? "Deep strategy briefing is ready."
              : "Strategy briefing updated.",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Strategy briefing failed";
      const fallbackBrief = buildStrategyFallback({
        zoneLabel: targetZoneLabel,
        city: targetCity,
        densityScore: targetDensityScore,
        predictedDemand: targetPredictedDemand,
        currentWorkers: targetCurrentWorkers,
        emergencyOrders: targetEmergencyOrders,
        priceMultiplier: targetPriceMultiplier,
        timeLens,
        hottestSector: simulation?.hottestSector || targetZoneLabel,
        acquisitionCost: targetAcquisitionCost,
        churnRate: investorAnalytics.summary.churnRate,
        marginLift: targetMarginLift,
        radiusKm: targetRadiusKm,
        purpose,
        scenario: purpose === "expansion_brief" ? "baseline" : (simulation?.scenario ?? "baseline"),
        competitorSignal: competitorSignalForRequest,
      });

      setStrategyBrief(fallbackBrief);
      setStrategyPendingSignal(null);
      setStrategyStatus("error");
      setStrategyMessage(`Live strategy provider was unavailable. Showing fallback COO guidance. ${message}`);
      appendLogicEntry(
        `Live strategy provider unavailable. Falling back to the local density rule engine for ${targetZoneLabel}.`,
        { tone: "critical", source: "strategy", tag: "SYSTEM" },
      );
      if (competitorSignalForRequest) {
        appendLogicEntry(
          `[STRATEGY] Defending margin via Quality-Audit differentiation in ${competitorPulse.zoneLabel}; emphasize Verified Pro proof-of-work, secure-media audit coverage, and loyalty retention instead of matching blanket competitor discounts.`,
          { tone: "warning", source: "strategy", tag: "STRATEGY" },
        );
      }

      if (!options?.silent) {
        toast.error(
          purpose === "expansion_brief"
            ? `Live strategy provider unavailable. Showing fallback ${targetCity} expansion playbook.`
            : "Live strategy provider unavailable. Showing fallback briefing.",
        );
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
    marketLeapState,
    manualScenario.projectedProfit,
    manualScenario.totalWorkers,
    competitorPulse.competitor,
    competitorPulse.discountPercent,
    competitorPulse.response,
    competitorPulse.zoneLabel,
    competitorPulseMessage,
    appendLogicEntry,
    priceMultiplier,
    pricingSignal,
    timeLens,
  ]);

  useEffect(() => {
    if (!marketLeapState || !marketLeapSnapshot || !selectedCoordinates || !isGlobalLeap) {
      return;
    }

    const previousLeap = lastMarketLeapRef.current;
    const movedFarEnough = !previousLeap
      || previousLeap.cityId !== marketLeapState.geoConfig.cityId
      || calculateDistanceKm(
        { lat: previousLeap.lat, lng: previousLeap.lng },
        selectedCoordinates,
      ) > 120;

    if (!movedFarEnough) {
      return;
    }

    lastMarketLeapRef.current = {
      cityId: marketLeapState.geoConfig.cityId,
      lat: selectedCoordinates.lat,
      lng: selectedCoordinates.lng,
    };

    appendLogicEntry(
      `[GLOBAL_LEAP] ${marketLeapState.geoConfig.cityLabel} command pin armed at ${selectedCoordinates.lat.toFixed(4)}, ${selectedCoordinates.lng.toFixed(4)}. Running zero-click expansion brief.`,
      { tone: "warning", source: "system", tag: "STRICT_AUDIT" },
    );
    setActiveMode("monitor");
    void requestStrategyBrief({
      deepDive: false,
      geoConfig: marketLeapState.geoConfig,
      purpose: "expansion_brief",
      silent: true,
    });
  }, [appendLogicEntry, isGlobalLeap, marketLeapSnapshot, marketLeapState, requestStrategyBrief, selectedCoordinates]);

  const handleSimulationComplete = useCallback((summary: SimulationCompletionPayload) => {
    setLatestSimulation(summary);
    buildSimulationLogicSignals(summary, activeSector.label).forEach((signal, index) => {
      const isAlertSignal = signal.startsWith("ALERT:");
      appendLogicEntry(
        index === 0 ? `Random Forest summary ready. ${signal}` : signal,
        {
          tone: isAlertSignal ? "critical" : index === 0 ? "success" : "info",
          source: "simulation",
          tag: "RF_MODEL",
        },
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
    const isAlertMessage = latestMessage.startsWith("ALERT:");
    const logTag = telemetry.phase === "generating"
      ? "SYNC"
      : telemetry.phase === "inferencing"
        ? "RF_MODEL"
        : telemetry.phase === "complete"
          ? "DECISION"
          : telemetry.phase === "error"
            ? "SYSTEM"
            : "SYNC";

    appendLogicEntry(latestMessage, {
      tone: isAlertMessage
        ? "critical"
        : telemetry.phase === "error"
        ? "critical"
        : telemetry.phase === "complete"
          ? "success"
          : telemetry.phase === "inferencing"
            ? "warning"
            : "info",
      source: "simulation",
      tag: logTag,
    });
  }, [appendLogicEntry]);

  useEffect(() => {
    if (!latestSimulation) {
      return;
    }

    void requestStrategyBrief({
      simulation: latestSimulation,
      deepDive: false,
      geoConfig: marketLeapState?.geoConfig,
      purpose: isGlobalLeap && marketLeapState ? "expansion_brief" : "zone_brief",
      silent: true,
    });
  }, [activeSector.id, isGlobalLeap, latestSimulation, marketLeapState, requestStrategyBrief, timeLens]);

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
    setCommandGeoSelection(INITIAL_COMMAND_SELECTION);
    setMarketLeapState(null);
    setSelectedCoordinates(null);
    setStrategyPendingSignal(null);
    lastMarketLeapRef.current = null;
    setAreaId(zoneId);
    setSelectedSectorId(zoneId);
    onZoneChange?.(zoneId);
    void runAnalysis({ silent: false, nextAreaId: zoneId });
  };

  const handleExecuteAiStrategy = useCallback(() => {
    if (!strategyBrief) {
      toast.error("Run the strategy briefing before executing a simulated deployment.");
      return;
    }

    const targetZoneId = highlightedZoneId || activeSector.id;
    const targetZone = sectorSignals.find((sector) => sector.id === targetZoneId) || activeSector;
    const emergencyTarget = latestSimulation?.scenario === "supply_crunch"
      ? Math.max(
        aiRecommendedCore,
        currentCoreWorkers + Math.max(4, Math.round((criticalSimulationSector?.recommendedShift || 0) * 0.8)),
      )
      : aiRecommendedCore;

    setManualCoreWorkers(emergencyTarget);
    setActiveMode("monitor");
    setLastExecutedStrategy({
      zoneId: targetZone.id,
      zoneLabel: targetZone.label,
      coreWorkers: emergencyTarget,
      appliedAt: formatAuditTimestamp(),
    });

    if (targetZone.id !== activeSector.id) {
      handleZoneSelection(targetZone.id);
    }

    appendLogicEntry(
      latestSimulation?.scenario === "supply_crunch"
        ? `Recommendation executed. Amber plan shifted the simulated salaried core to ${emergencyTarget} workers in ${targetZone.label}.`
        : `Recommendation executed. Shifted the simulated salaried core to ${emergencyTarget} workers in ${targetZone.label}.`,
      { tone: "success", source: "strategy", tag: "DECISION" },
    );
    toast.success(
      latestSimulation?.scenario === "supply_crunch"
        ? `Amber preservation plan applied for ${targetZone.label}.`
        : `AI workforce deployment applied for ${targetZone.label}.`,
    );
  }, [activeSector, aiRecommendedCore, appendLogicEntry, criticalSimulationSector?.recommendedShift, currentCoreWorkers, handleZoneSelection, highlightedZoneId, latestSimulation?.scenario, strategyBrief]);

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

  const jumpToStrategyTerminal = () => {
    document.getElementById("strategy-terminal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleInterventionAction = (action: InterventionActionKey) => {
    switch (action) {
      case "deploy_core":
        setManualCoreWorkers(Math.max(aiRecommendedCore, currentCoreWorkers + 3));
        setActiveMode("monitor");
        appendLogicEntry(`Ops command issued: deploy salaried core into ${activeSector.label}.`, {
          tone: "success",
          source: "ops",
          tag: "deploy",
        });
        toast.success(`Salaried core deployment staged for ${activeSector.label}.`);
        return;
      case "adjust_payout":
        setActiveMode("revenue");
        appendLogicEntry(`Pricing desk opened for ${activeSector.label} at ${priceMultiplier.toFixed(2)}x guidance.`, {
          tone: "warning",
          source: "ops",
          tag: "pricing",
        });
        toast.success(`Payout tuning lane opened for ${activeSector.label}.`);
        return;
      case "freeze_core":
        setManualCoreWorkers(Math.max(1, currentCoreWorkers - 1));
        setActiveMode("revenue");
        appendLogicEntry(`Core hiring freeze drafted for ${activeSector.label}; keeping the zone freelancer-led.`, {
          tone: "warning",
          source: "ops",
          tag: "burn",
        });
        toast.success(`Core hiring freeze staged for ${activeSector.label}.`);
        return;
      case "promote_anchor":
        setActiveMode("quality");
        appendLogicEntry(`Zone anchor promotion queued for ${selectedWorker?.name || "top-rated worker"} in ${activeSector.label}.`, {
          tone: "success",
          source: "ops",
          tag: "quality",
        });
        toast.success(`Anchor promotion queued for ${activeSector.label}.`);
        return;
      case "trigger_audit":
        setActiveMode("quality");
        appendLogicEntry(`Audit sweep triggered for ${activeSector.label} to verify proof coverage before the next shift.`, {
          tone: "critical",
          source: "ops",
          tag: "audit",
        });
        toast.success(`Audit sweep triggered for ${activeSector.label}.`);
        return;
      default:
        setActiveMode("monitor");
        appendLogicEntry(`Hybrid plan locked for ${activeSector.label}; no structural staffing move required right now.`, {
          tone: "info",
          source: "ops",
          tag: "plan",
        });
        toast.success(`Hybrid plan locked for ${activeSector.label}.`);
    }
  };

  return (
    <div className="relative grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden bg-[#020617] text-slate-100">
      <CommandCenterMotionStyles />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.16),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.35),rgba(2,6,23,0.92))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(15,23,42,0.66),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(0deg,rgba(2,6,23,0.92),transparent)]" />

      <section className="relative z-10 mx-4 mt-4 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(135deg,_#07111f_0%,_#0f172a_48%,_#10243d_100%)] p-6 text-white shadow-2xl shadow-slate-950/10 md:p-8 xl:mx-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {llmHealth?.mode === "fallback" && (
          <div className="pointer-events-none absolute right-6 top-6 z-20 rounded-full border border-amber-300/35 bg-amber-400/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100 shadow-[0_18px_45px_-24px_rgba(251,191,36,0.45)] backdrop-blur">
            {llmHealth.summary}
          </div>
        )}

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
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
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

      <section
        className={cn(
          "relative z-10 mx-4 overflow-hidden rounded-[1.8rem] border p-5 shadow-[0_28px_80px_-48px_rgba(2,6,23,1)] backdrop-blur-2xl xl:mx-5 xl:p-6",
          displayInterventionState.tone === "amber" && "border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_32%),linear-gradient(135deg,rgba(8,15,29,0.94)_0%,rgba(17,24,39,0.96)_48%,rgba(41,24,7,0.98)_100%)]",
          displayInterventionState.tone === "rose" && "border-rose-300/18 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.18),transparent_32%),linear-gradient(135deg,rgba(8,15,29,0.94)_0%,rgba(17,24,39,0.96)_48%,rgba(48,12,24,0.98)_100%)]",
          displayInterventionState.tone === "sky" && "border-sky-300/18 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),linear-gradient(135deg,rgba(8,15,29,0.94)_0%,rgba(17,24,39,0.96)_48%,rgba(5,32,48,0.98)_100%)]",
          displayInterventionState.tone === "emerald" && "border-emerald-300/18 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),linear-gradient(135deg,rgba(8,15,29,0.94)_0%,rgba(17,24,39,0.96)_48%,rgba(6,39,31,0.98)_100%)]",
        )}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]",
                  displayInterventionState.tone === "amber" && "border-amber-300/24 bg-amber-300/12 text-amber-100",
                  displayInterventionState.tone === "rose" && "border-rose-300/24 bg-rose-300/12 text-rose-100",
                  displayInterventionState.tone === "sky" && "border-sky-300/24 bg-sky-300/12 text-sky-100",
                  displayInterventionState.tone === "emerald" && "border-emerald-300/24 bg-emerald-300/12 text-emerald-100",
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    displayInterventionState.tone === "amber" && "bg-amber-400",
                    displayInterventionState.tone === "rose" && "bg-rose-400",
                    displayInterventionState.tone === "sky" && "bg-sky-400",
                    displayInterventionState.tone === "emerald" && "bg-emerald-400",
                  )}
                />
                {displayInterventionState.badge}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                Decision-first analytics
              </span>
            </div>

            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Immediate operating recommendation for {displayRouteLabel}
            </p>
            <h3 className="mt-3 max-w-4xl text-2xl font-black leading-tight text-white md:text-[2rem]">
              {displayInterventionState.headline}
            </h3>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-300 md:text-base">
              {displayInterventionState.summary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Map", "Model", "Strategy", "Intervention"].map((step, index) => (
                <span
                  key={step}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-slate-950">
                    {index + 1}
                  </span>
                  {step}
                </span>
              ))}
            </div>

            <div className={cn(
              "mt-5 max-w-3xl rounded-[1.4rem] border bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
              isGlobalLeap
                ? "border-emerald-300/18 shadow-emerald-900/20"
                : "border-amber-300/18 shadow-amber-900/20",
            )}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-[0.22em]",
                    isGlobalLeap ? "text-emerald-200" : "text-amber-200",
                  )}>
                    {isGlobalLeap ? "Market Entry Signal" : "Competitor Pulse"}
                  </p>
                  <h4 className="mt-2 text-base font-black text-white md:text-lg">
                    {isPinnedCommandMode && marketLeapSnapshot
                      ? `${marketLeapSnapshot.city} ${isGlobalLeap ? "launch ring" : "command radius"} is active at ${marketLeapSnapshot.radiusKm} km around the command pin.`
                      : `${competitorPulse.competitor} launched ${competitorPulse.discountPercent}% discount in ${competitorPulse.zoneLabel}`}
                  </h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                    {isPinnedCommandMode && marketLeapState
                      ? `${marketLeapState.selectedAddress}. Burn protection is the lead move; competitor positioning stays in reserve until the launch corridor proves contribution discipline.`
                      : competitorPulse.response}
                  </p>
                </div>
                <div className={cn(
                  "inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em]",
                  isPinnedCommandMode
                    ? "border-emerald-300/18 bg-emerald-300/12 text-emerald-100"
                    : "border-indigo-300/18 bg-indigo-300/12 text-indigo-100",
                )}>
                  {isPinnedCommandMode ? <MapPin className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {isPinnedCommandMode ? (isGlobalLeap ? "Global Leap Ready" : "Command Radius Live") : "Verified Pro Counter"}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RibbonMetric label="Density" value={displayDensityScore.toFixed(2)} hint="Live pressure" />
              <RibbonMetric label="Gap" value={`${displayDemandGap > 0 ? "+" : ""}${displayDemandGap}`} hint="Jobs vs. current flow" />
              <RibbonMetric label="Audit" value={`${displayAuditCoverage.toFixed(0)}%`} hint="Proof coverage" />
              <RibbonMetric label="Lift" value={formatCurrency(isGlobalLeap && marketLeapSnapshot ? marketLeapSnapshot.marginLift : projectedMarginLift)} hint="Projected margin delta" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleInterventionAction(displayInterventionState.primaryAction.key)}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                {displayInterventionState.primaryAction.label}
              </button>
              <button
                type="button"
                onClick={() => handleInterventionAction(displayInterventionState.secondaryAction.key)}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:-translate-y-0.5 hover:bg-white/[0.12]"
              >
                {displayInterventionState.secondaryAction.label}
              </button>
              <button
                type="button"
                onClick={jumpToStrategyTerminal}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-emerald-100 transition hover:-translate-y-0.5 hover:bg-white/[0.12]"
              >
                Open Strategy Lane
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 grid min-h-0 gap-4 overflow-hidden px-4 pb-4 pt-4 xl:grid-cols-[minmax(0,1fr)_25rem] xl:px-5">
        <div className="h-full overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/78 shadow-[0_32px_90px_-44px_rgba(2,6,23,1)] backdrop-blur-2xl">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Geospatial command map</p>
                <h3 className="mt-2 text-2xl font-black text-white">
                  {isGlobalLeap
                    ? "Launch corridor map with zero-click market-entry intelligence"
                    : isPinnedCommandMode
                      ? "Command-pin map with radius-driven market intelligence"
                    : "Sector shape map with route-aware density context"}
                </h3>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  {isGlobalLeap && marketLeapState
                    ? `The command surface has left Agra operating mode. ${marketLeapState.selectedAddress} is now the live launch pin, and the strategy lane is drafting a burn-first market-entry playbook automatically.`
                    : isPinnedCommandMode && marketLeapState
                      ? `${marketLeapState.selectedAddress} is now the active command radius. The map, simulation engine, and strategy terminal are reading the same pinned coordinates in real time.`
                    : "Click any Agra zone to switch the route, fetch zone-specific density, and open the exact control surface for that geography."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Dynamic route</p>
                <p className="mt-2 text-sm font-black text-white" style={{ fontFamily: monoMetricFont }}>/admin-portal-2026/intelligence/{displayRouteId}</p>
              </div>
            </div>
          </div>

          <div className="grid min-h-[34rem] xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="relative min-h-[34rem] border-b border-white/10 xl:min-h-0 xl:border-b-0 xl:border-r xl:border-white/10">
              <MapContainer
                center={commandMapCenter}
                zoom={commandMapZoom}
                scrollWheelZoom
                preferCanvas
                className="rahi-command-map h-full w-full"
              >
                <CommandMapView
                  center={commandMapCenter}
                  zoom={commandMapZoom}
                  onViewportChange={setCommandViewport}
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                  attribution="Labels &copy; CARTO"
                  opacity={0.96}
                />

                {!isPinnedCommandMode && commandMapZones.map((zone) => {
                  const density = zoneDensityMap[zone.id] ?? 0;
                  const tone = getDensityTone(density);
                  const active = zone.id === activeSector.id;
                  const highlighted = zone.id === highlightedZoneId;

                  return (
                    <Polygon
                      key={zone.id}
                      positions={zone.polygon}
                      pathOptions={{
                        color: highlighted ? "#818cf8" : active ? "#818cf8" : tone.stroke,
                        weight: highlighted ? 4 : active ? 3 : 2,
                        fillColor: tone.fill,
                        fillOpacity: highlighted ? 0.5 : active ? 0.46 : 0.18,
                      }}
                      eventHandlers={{ click: () => handleZoneSelection(zone.id) }}
                    >
                      <LeafletTooltip sticky className="rahi-map-tooltip">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-white">{zone.label}</p>
                          <p className="text-xs font-bold text-slate-300">{tone.label}</p>
                          <p className="text-xs font-bold text-slate-200" style={{ fontFamily: monoMetricFont }}>Density {density.toFixed(2)}</p>
                        </div>
                      </LeafletTooltip>
                    </Polygon>
                  );
                })}

                {!isPinnedCommandMode && visibleCommandZoneLabels.map((zone) => (
                  <Marker
                    key={`zone-label-${zone.id}`}
                    position={zone.center}
                    icon={commandZoneLabelIcons[zone.id]}
                    interactive={false}
                    keyboard={false}
                  />
                ))}

                {isPinnedCommandMode && marketLeapSnapshot && (
                  <>
                    <Circle
                      center={marketLeapSnapshot.center}
                      radius={marketLeapSnapshot.radiusKm * 1000}
                      pathOptions={{
                        color: "#22c55e",
                        fillColor: "#22c55e",
                        fillOpacity: 0.08,
                        opacity: 0.78,
                        weight: 2,
                      }}
                    />
                    <Circle
                      center={marketLeapSnapshot.center}
                      radius={Math.max(700, marketLeapSnapshot.radiusKm * 420)}
                      pathOptions={{
                        color: "#6366f1",
                        fillColor: "#6366f1",
                        fillOpacity: 0.04,
                        opacity: 0.42,
                        weight: 1,
                      }}
                    />
                  </>
                )}

                {(isPinnedCommandMode ? globalPreviewSignals : visiblePreviewSignals).map((signal) => (
                  <CircleMarker
                    key={signal.id}
                    center={signal.position}
                    radius={isGlobalLeap ? (signal.isEmergency ? 8 : 5) : (signal.isEmergency ? 7 : 4)}
                    pathOptions={{
                      color: signal.isEmergency ? "#b91c1c" : "#4338ca",
                      fillColor: signal.isEmergency ? "#f97316" : "#6366f1",
                      fillOpacity: signal.isEmergency ? 0.88 : isPinnedCommandMode ? 0.72 : 0.62,
                      weight: signal.isEmergency ? 2 : 1,
                    }}
                  >
                    <LeafletTooltip className="rahi-map-tooltip">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-white">{signal.label}</p>
                        <p className="text-xs font-bold text-slate-300">{signal.serviceType}</p>
                        <p className="text-xs font-bold text-slate-200" style={{ fontFamily: monoMetricFont }}>{formatCurrency(signal.estimatedValue)}</p>
                        {(signal as { city?: string }).city ? (
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">{(signal as { city?: string }).city}</p>
                        ) : null}
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                ))}

                {!isGlobalLeap && auditPulseSignals.map((signal) => (
                  <Circle
                    key={`audit-pulse-${signal.id}`}
                    center={signal.position}
                    radius={185}
                    pathOptions={{
                      color: isSupplyCrunchAlert ? "#f59e0b" : "#34d399",
                      fillColor: isSupplyCrunchAlert ? "#f59e0b" : "#34d399",
                      fillOpacity: 0.03,
                      opacity: 0.7,
                      weight: 1,
                    }}
                  />
                ))}

                {isPinnedCommandMode && marketLeapSnapshot ? (
                  <CircleMarker
                    center={marketLeapSnapshot.center}
                    radius={18}
                    pathOptions={{
                      className: "rahi-map-focus-ring",
                      color: "#22c55e",
                      weight: 2,
                      fillColor: "#22c55e",
                      fillOpacity: 0.16,
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -10]}>
                      Expansion focus - {marketLeapSnapshot.zoneLabel}
                    </LeafletTooltip>
                  </CircleMarker>
                ) : highlightedMapZone && (
                  <CircleMarker
                    center={highlightedMapZone.center}
                    radius={18}
                    pathOptions={{
                      className: isSupplyCrunchAlert ? "rahi-map-focus-ring-amber" : "rahi-map-focus-ring",
                      color: isSupplyCrunchAlert ? "#f59e0b" : "#4f46e5",
                      weight: 2,
                      fillColor: isSupplyCrunchAlert ? "#f59e0b" : "#4f46e5",
                      fillOpacity: 0.08,
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -10]}>
                      Terminal focus - {highlightedMapZone.label}
                    </LeafletTooltip>
                  </CircleMarker>
                )}
              </MapContainer>

              <div className="absolute left-4 top-4 z-[700] w-[min(24rem,calc(100%-2rem))]">
                <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/88 p-3 shadow-[0_28px_70px_-34px_rgba(2,6,23,1)] backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">HUD Search</p>
                  <MarketCommandSearch
                    className="mt-2"
                    initialValue={commandGeoSelection.selectedAddress}
                    radiusKm={commandGeoSelection.geoConfig.radiusKm}
                    onSelect={handleHudMarketSelect}
                    placeholder="Search Chandigarh Sector 17, New Delhi..."
                    variant="dark"
                  />
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Active Analysis Radius</p>
                        <p className="mt-1 text-sm font-black text-white" style={{ fontFamily: monoMetricFont }}>{commandGeoSelection.geoConfig.radiusKm.toFixed(0)} km</p>
                      </div>
                      <span className="rounded-full border border-indigo-300/20 bg-indigo-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-100">
                        {commandGeoSelection.geoConfig.cityTier.replace("_", "-")}
                      </span>
                    </div>
                    <Slider
                      min={1}
                      max={50}
                      step={1}
                      value={[commandGeoSelection.geoConfig.radiusKm]}
                      onValueChange={handleCommandRadiusChange}
                      className="mt-3 [&_[role=slider]]:border-indigo-600 [&_[role=slider]]:bg-white [&_[data-orientation=horizontal]]:h-2.5 [&_[data-orientation=horizontal]_.bg-primary]:bg-indigo-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute left-4 top-[12.8rem] rounded-2xl border border-white/10 bg-slate-950/88 px-4 py-3 shadow-[0_18px_40px_-26px_rgba(2,6,23,1)] backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Legend</p>
                <div className="mt-3 space-y-2 text-xs font-bold text-slate-300">
                  {[
                    { label: "Critical density", color: "bg-rose-500" },
                    { label: "High density", color: "bg-orange-500" },
                    { label: "Balanced density", color: "bg-indigo-500" },
                    { label: "Freelancer-led", color: "bg-sky-500" },
                    { label: isPinnedCommandMode ? "Command ring + proofs" : "Verified audits", color: "bg-emerald-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", item.color)} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-slate-950/88 px-4 py-3 shadow-[0_18px_40px_-26px_rgba(2,6,23,1)] backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {isPinnedCommandMode ? "Command signal sample" : "Synthetic load sample"}
                </p>
                <p className="mt-2 text-sm font-black text-white" style={{ fontFamily: monoMetricFont }}>
                  {(isPinnedCommandMode ? globalPreviewSignals.length : visiblePreviewSignals.length)} preview points from the 400k simulation engine
                </p>
              </div>

              <div className="pointer-events-none absolute bottom-4 right-4 rounded-2xl border border-indigo-300/20 bg-slate-950/88 px-4 py-3 shadow-[0_18px_40px_-26px_rgba(2,6,23,1)] backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">Telemetry HUD</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300" style={{ fontFamily: monoMetricFont }}>
                  <span>LAT {commandViewport.center[0].toFixed(4)}</span>
                  <span>LNG {commandViewport.center[1].toFixed(4)}</span>
                  <span>ALT {commandViewportAltitude}</span>
                  <span>Z {commandViewport.zoom.toFixed(2)}</span>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Focus: <span className="font-black text-white">{displayRouteLabel}</span>
                </p>
              </div>

              {(simulationRunning || strategyStatus === "thinking") && (
                <>
                  <div className={cn(
                    "pointer-events-none absolute inset-0",
                    isSupplyCrunchAlert
                      ? "bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.16),_transparent_55%)]"
                      : "bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.12),_transparent_55%)]",
                  )} />
                  <div className={cn(
                    "rahi-scanline pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent to-transparent",
                    isSupplyCrunchAlert ? "via-amber-400/30" : "via-indigo-400/25",
                  )} />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className={cn(
                      "rahi-command-pin relative h-4 w-4 rounded-full",
                      isSupplyCrunchAlert
                        ? "bg-amber-500 shadow-[0_0_0_8px_rgba(245,158,11,0.18)]"
                        : "bg-indigo-600 shadow-[0_0_0_8px_rgba(79,70,229,0.18)]",
                    )}>
                      <span className="absolute inset-0 rounded-full border border-white/90" />
                    </div>
                  </div>
                  <div className={cn(
                    "pointer-events-none absolute right-4 top-4 rounded-2xl bg-slate-950/85 px-4 py-3 text-white shadow-xl backdrop-blur",
                    isSupplyCrunchAlert ? "border border-amber-300/40 shadow-amber-950/20" : "border border-indigo-300/40 shadow-indigo-950/20",
                  )}>
                    <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", isSupplyCrunchAlert ? "text-amber-200" : "text-indigo-200")}>AI overlay</p>
                    <p className="mt-2 text-sm font-black">
                      {isGlobalLeap
                        ? simulationRunning
                          ? "Random Forest is simulating the new-city launch ring in live batches."
                          : "Strategy engine is drafting the expansion brief before the operator touches a control."
                        : simulationRunning
                          ? "Random Forest is scanning the heatmap in live batches."
                          : "Strategy engine is tracing the current zone before briefing the CEO."}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="border-l border-white/10 bg-[linear-gradient(180deg,_rgba(15,23,42,0.88),_rgba(2,6,23,0.96))] p-4">
              <div className="rahi-glass-panel h-full rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-4 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">LOGISTICS_CORE_AUDIT [STRICT_PERSISTENCE]</p>
                    <h4 className="mt-2 text-lg font-black text-white">System thoughts and model checkpoints</h4>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                    simulationRunning || strategyStatus === "thinking"
                      ? "border border-indigo-300/18 bg-indigo-300/10 text-indigo-100"
                      : "border border-white/10 bg-white/[0.05] text-slate-300",
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
                        entry.tone === "success" && "border-emerald-300/18 bg-emerald-300/10",
                        entry.tone === "warning" && "border-amber-300/18 bg-amber-300/10",
                        entry.tone === "critical" && "border-rose-300/18 bg-rose-300/10",
                        entry.tone === "info" && "border-white/10 bg-white/[0.05]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          [{entry.tag}] {entry.timestamp}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {entry.source}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-6 text-slate-200/90">{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mission-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <StrategyTerminal
            activeZoneId={displayRouteId}
            activeZoneLabel={displayRouteLabel}
            activeCity={displayRouteCity}
            predictedDemand={displayPredictedDemand}
            liveDensityScore={displayDensityScore}
            liveDemandGap={displayDemandGap}
            auditCoverage={displayAuditCoverage}
            payoutMultiplier={displayPriceMultiplier}
            timeLensLabel={timeLensMeta[timeLens].label}
            simulationAttached={Boolean(latestSimulation)}
            simulationPoints={latestSimulation?.totalPoints}
            strategyStatus={strategyStatus}
            strategyMessage={strategyMessage}
            strategyBrief={strategyBrief}
            strategyScript={terminalScript}
            providerLabel={strategyBrief ? String(strategyBrief.provider || "rule_engine").toUpperCase() : "WAITING"}
            tacticalState={tacticalState}
            lastExecutedLabel={lastExecutedStrategy ? `${lastExecutedStrategy.zoneLabel} at ${lastExecutedStrategy.appliedAt}` : null}
            primaryInterventionLabel={displayInterventionState.primaryAction.label}
            secondaryInterventionLabel={displayInterventionState.secondaryAction.label}
            onRunBriefing={() => void requestStrategyBrief({ deepDive: false, purpose: isGlobalLeap ? "expansion_brief" : "zone_brief" })}
            onRequestDeepDive={() => void requestStrategyBrief({ deepDive: true, purpose: isGlobalLeap ? "expansion_brief" : "zone_brief" })}
            onOpenSimulationLab={jumpToSimulationLab}
            onPrimaryIntervention={() => handleInterventionAction(displayInterventionState.primaryAction.key)}
            onSecondaryIntervention={() => handleInterventionAction(displayInterventionState.secondaryAction.key)}
            onExecuteStrategy={handleExecuteAiStrategy}
            canExecuteStrategy={canExecuteAiStrategy}
          />

          <div className="rahi-ops-panel p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Scenario console</p>
                <h3 className="mt-2 text-2xl font-black text-white">Workforce slider and AI comparison</h3>
              </div>
              <div className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                {strategyLabel[analysis.allocation_strategy]}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected zone</p>
                  <p className="mt-2 text-lg font-black text-white">{activeSector.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Live density</p>
                  <p className="mt-2 text-lg font-black text-white" style={{ fontFamily: monoMetricFont }}>{analysis.density_score.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-200">
                  <span>Salaried core override</span>
                  <span style={{ fontFamily: monoMetricFont }}>{manualCoreWorkers} workers</span>
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

          <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/88 p-6 text-white shadow-[0_28px_60px_-36px_rgba(2,6,23,1)] backdrop-blur-xl">
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

      <section className="relative z-10 border-t border-white/10 bg-slate-950/88 px-4 py-3 backdrop-blur-2xl xl:px-5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Bottom-docked intelligence terminal</p>
            <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
              Forecast lab, investor analytics, and simulation evidence
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIntelDockExpanded((current) => !current)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/[0.12]"
            >
              {intelDockExpanded ? "Compact analytics dock" : "Expand analytics dock"}
            </button>
            <button
              type="button"
              onClick={jumpToSimulationLab}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-300/16"
            >
              Open simulation lab
            </button>
          </div>
        </div>

        <div className={cn(
          "overflow-hidden transition-[max-height,margin] duration-300 ease-out",
          intelDockExpanded ? "mt-4 max-h-[35vh]" : "max-h-0",
        )}>
          <div className="mission-scrollbar h-full overflow-y-auto pr-1">
            <div className="space-y-4 pb-1">
        <section className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <div className="rahi-ops-panel p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Run allocation forecast</p>
              <h3 className="mt-2 text-2xl font-black text-white">Analyze a live command radius</h3>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <MarketCommandSearch
                className="sm:w-80"
                initialValue={commandGeoSelection.selectedAddress}
                radiusKm={commandGeoSelection.geoConfig.radiusKm}
                onSelect={handleHudMarketSelect}
                placeholder="Search a city or local market"
                variant="dark"
              />
              <button
                onClick={() => {
                  setCommandGeoSelection(INITIAL_COMMAND_SELECTION);
                  setMarketLeapState(null);
                  setSelectedCoordinates(null);
                  setStrategyPendingSignal(null);
                  lastMarketLeapRef.current = null;
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                <MapPin className="h-4 w-4" />
                Restore Agra Pilot
              </button>
              <button
                onClick={() => void runAnalysis({ nextAreaId: areaId })}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh pilot density
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Command market</p>
              <p className="mt-2 text-lg font-black text-white">{commandGeoSelection.geoConfig.cityLabel}{commandGeoSelection.geoConfig.stateCode ? `, ${commandGeoSelection.geoConfig.stateCode}` : ""}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{commandGeoSelection.selectedAddress}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">{commandGeoSelection.geoConfig.marketContext}</p>
            </div>
            <div className="rounded-[1.4rem] border border-indigo-300/18 bg-indigo-300/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100">Active Analysis Radius</p>
                  <p className="mt-2 text-lg font-black text-white" style={{ fontFamily: monoMetricFont }}>{commandGeoSelection.geoConfig.radiusKm.toFixed(0)} km</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-100">
                  1-50 km
                </span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[commandGeoSelection.geoConfig.radiusKm]}
                onValueChange={handleCommandRadiusChange}
                className="mt-4 [&_[role=slider]]:border-indigo-600 [&_[role=slider]]:bg-white [&_[data-orientation=horizontal]]:h-2.5 [&_[data-orientation=horizontal]_.bg-primary]:bg-indigo-600"
              />
            </div>
          </div>

          {notice && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/18 bg-amber-300/10 px-4 py-3 text-sm font-bold leading-6 text-amber-100">
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

          <div className="mt-4 rounded-2xl border border-emerald-300/18 bg-emerald-300/10 px-4 py-3 text-sm font-bold leading-6 text-emerald-100">
            Dynamic pricing signal: {pricingSignal}. Formula: clamp(0.85, 1.50, 1 + 0.25 x (density - 1.2)).
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Zone snapshot</p>
                <h4 className="mt-2 text-xl font-black text-white">{activeSector.label}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-400">{activeSector.city}</p>
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
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/62 px-4 py-3 text-sm font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <ChevronRight className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rahi-ops-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Recommended workforce mix</p>
              <h3 className="mt-2 text-2xl font-black text-white">{strategyLabel[analysis.allocation_strategy]}</h3>
            </div>
            <span className={cn("rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider", strategyTone[analysis.allocation_strategy])}>
              {analysis.source === "random_forest_service" ? "Random Forest" : analysis.source === "demo_density_engine" ? "Demo Model" : "Fallback"}
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">{analysis.reasoning}</p>

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

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/82 p-5 text-white shadow-[0_22px_55px_-34px_rgba(2,6,23,1)]">
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
        <div className="rahi-ops-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Zone portfolio</p>
              <h3 className="mt-2 text-2xl font-black text-white">Density decides the workforce model</h3>
            </div>
            <ListFilter className="hidden h-6 w-6 text-slate-500 sm:block" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_1fr] bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400">
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
                    "grid w-full grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_1fr] items-center gap-2 border-t border-white/10 px-4 py-4 text-left text-sm transition hover:bg-white/[0.04]",
                    selected && "bg-emerald-300/10",
                  )}
                >
                  <span>
                    <span className="block font-black text-white">{sector.label}</span>
                    <span className="text-xs font-bold text-slate-500">{sector.city}</span>
                  </span>
                  <span className="font-black text-slate-200" style={{ fontFamily: monoMetricFont }}>{sector.predicted}</span>
                  <span className="font-black text-slate-200" style={{ fontFamily: monoMetricFont }}>{sector.workers}</span>
                  <span className="font-black text-emerald-300" style={{ fontFamily: monoMetricFont }}>{density.toFixed(2)}</span>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-300">
                    {strategyLabel[strategy.allocation_strategy]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected zone drill-down</p>
                <h4 className="mt-2 text-xl font-black text-white">{activeSector.label}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-400">
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

        <div className="rahi-ops-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">12-week demand forecast</p>
              <h3 className="mt-2 text-2xl font-black text-white">Growth pressure curve</h3>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>

          <div className="mt-8 flex h-64 items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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
                  <span className={cn("text-[10px] font-black", isActive ? "text-white" : "text-slate-500")}>
                    W{index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/82 p-5 text-white shadow-[0_22px_55px_-34px_rgba(2,6,23,1)]">
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
        <div className="rahi-ops-panel p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Investor-grade business brain</p>
              <h3 className="mt-2 text-2xl font-black text-white">Predicted demand vs. actual orders</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChartView("comparison")}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                  chartView === "comparison"
                    ? "border-indigo-300/20 bg-indigo-300/10 text-indigo-100"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]",
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
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]",
                )}
              >
                Gap pressure
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {demandSeries.map((point, index) => (
                <button
                  key={point.label}
                  type="button"
                  onClick={() => setSelectedWeek(index)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition",
                    selectedWeek === index
                      ? "border-emerald-300/20 bg-emerald-300/12 text-white"
                      : "border-white/10 bg-slate-950/62 text-slate-400 hover:border-white/20 hover:text-white",
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 700, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fontWeight: 700, fill: "#94a3b8" }} />
                    <RechartsTooltip content={<DemandTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#f8fafc"
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 700, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fontWeight: 700, fill: "#94a3b8" }} />
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
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected checkpoint</p>
                  <h4 className="mt-2 text-xl font-black text-white">{selectedWeekDetail.label}</h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{selectedWeekDetail.cue}</p>
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
          <div className="rahi-ops-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Revenue split</p>
                <h3 className="mt-2 text-2xl font-black text-white">Worker earnings vs. platform commission</h3>
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
              Gross booking value tracked here: {formatCurrency(investorAnalytics.summary.revenue)}.
            </div>
          </div>

          <div className="rahi-ops-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Top worker quality scores</p>
                <h3 className="mt-2 text-2xl font-black text-white">Service quality roster</h3>
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
                        ? "border-emerald-300/18 bg-emerald-300/10"
                        : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.08]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{worker.name}</p>
                        <p className="text-xs font-bold text-slate-400">{worker.service} - {worker.completedJobs} jobs - {worker.rating}/5</p>
                      </div>
                      <span className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1 text-sm font-black text-emerald-100">
                        {worker.qualityScore}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedWorker && (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/82 p-5 text-white shadow-[0_22px_55px_-34px_rgba(2,6,23,1)]">
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

          <div className="rounded-[1.6rem] border border-amber-300/20 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] p-6 shadow-[0_22px_55px_-32px_rgba(2,6,23,1)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200/70">Rejected job escalation queue</p>
                <h3 className="mt-2 text-2xl font-black text-white">Queue requiring admin intervention</h3>
              </div>
              <TriangleAlert className="h-6 w-6 text-amber-600" />
            </div>

            <div className="mt-4 space-y-3">
              {liveEscalations.length === 0 ? (
                <div className="rounded-2xl border border-emerald-300/18 bg-emerald-300/10 px-4 py-4 text-sm font-bold text-emerald-100">
                  The live escalation queue is clear.
                </div>
              ) : (
                liveEscalations.slice(0, 3).map((item) => (
                  <div key={item.bookingId} className="rounded-2xl border border-amber-300/18 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{item.serviceName}</p>
                        <p className="mt-1 text-xs font-bold text-amber-200">{item.areaId} - {item.reason}</p>
                      </div>
                      <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">
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
          onGeoConfigChange={handleSimulationGeoConfigChange}
          externalGeoSelection={commandGeoSelection}
        />
      </section>
            </div>
          </div>
        </div>
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

      @keyframes rahi-map-focus {
        0% { stroke-opacity: 0.95; fill-opacity: 0.08; transform: scale(0.94); }
        70% { stroke-opacity: 0; fill-opacity: 0; transform: scale(1.18); }
        100% { stroke-opacity: 0; fill-opacity: 0; transform: scale(1.18); }
      }

      .rahi-scanline {
        animation: rahi-scanline 2.8s linear infinite;
      }

      .rahi-command-pin {
        animation: rahi-command-pin 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }

      .rahi-map-focus-ring {
        transform-origin: center;
        animation: rahi-map-focus 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }

      .rahi-map-focus-ring-amber {
        transform-origin: center;
        animation: rahi-map-focus 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }

      .rahi-terminal-shell {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 50px rgba(15,23,42,0.2);
      }

      .rahi-glass-panel {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
      }

      .rahi-ops-panel {
        border: 1px solid rgba(148, 163, 184, 0.12);
        background:
          radial-gradient(circle at top left, rgba(99, 102, 241, 0.09), transparent 28%),
          linear-gradient(180deg, rgba(15, 23, 42, 0.86), rgba(2, 6, 23, 0.92));
        box-shadow: 0 24px 60px -38px rgba(2, 6, 23, 1);
        backdrop-filter: blur(20px);
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

      .rahi-command-map {
        background: #020617;
      }

      .rahi-command-map .leaflet-tile {
        filter: saturate(0.76) contrast(1.08) brightness(0.86);
      }

      .rahi-command-map .leaflet-control-zoom a {
        border-color: rgba(148, 163, 184, 0.2);
        background: rgba(2, 6, 23, 0.88);
        color: #e2e8f0;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      }

      .rahi-command-map .leaflet-control-zoom a:hover {
        background: rgba(15, 23, 42, 0.96);
      }

      .rahi-map-tooltip {
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 16px;
        background: rgba(2, 6, 23, 0.9);
        color: #f8fafc;
        box-shadow: 0 18px 48px -30px rgba(2, 6, 23, 1);
        backdrop-filter: blur(16px);
      }

      .rahi-map-tooltip::before {
        border-top-color: rgba(2, 6, 23, 0.9) !important;
      }

      .rahi-zone-label-wrapper {
        background: transparent;
        border: 0;
      }

      .rahi-zone-label {
        display: inline-flex;
        align-items: center;
        gap: 0.42rem;
        padding: 0.38rem 0.72rem;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.82);
        background: rgba(248, 250, 252, 0.9);
        box-shadow: 0 12px 28px -18px rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(12px);
        white-space: nowrap;
      }

      .rahi-zone-label--primary {
        border-color: rgba(129, 140, 248, 0.88);
        box-shadow: 0 16px 36px -20px rgba(79, 70, 229, 0.42);
      }

      .rahi-zone-label__name {
        color: #0f172a;
        font: 700 11px/1 ${mapLabelFont};
        letter-spacing: 0.12em;
        text-transform: uppercase;
        text-shadow:
          0 0 1px rgba(255,255,255,0.96),
          0 1px 0 rgba(255,255,255,0.8);
      }

      .rahi-zone-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 22px;
        padding: 0 0.6rem;
        border-radius: 999px;
        font: 700 10px/1 ${mapLabelFont};
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .rahi-zone-badge--healthy {
        background: rgba(16, 185, 129, 0.16);
        color: #047857;
      }

      .rahi-zone-badge--surge {
        background: rgba(245, 158, 11, 0.18);
        color: #b45309;
      }

      .rahi-zone-badge--critical {
        background: rgba(244, 63, 94, 0.16);
        color: #be123c;
      }

      @media (prefers-reduced-motion: reduce) {
        .rahi-scanline,
        .rahi-command-pin,
        .rahi-map-focus-ring,
        .rahi-map-focus-ring-amber,
        .rahi-terminal-caret {
          animation: none !important;
        }
      }
    `}</style>
  );
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

function RibbonMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-white" style={{ fontFamily: monoMetricFont }}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-300">{hint}</p>
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
      "rounded-2xl border p-4 backdrop-blur-xl",
      light ? "border-white/10 bg-slate-950/72" : "border-white/10 bg-white/[0.04]",
    )}>
      <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", light ? "text-slate-500" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-2 text-sm font-black", light ? "text-white" : "text-white")} style={{ fontFamily: monoMetricFont }}>{value}</p>
      <p className={cn("mt-2 text-xs font-semibold", light ? "text-slate-300" : "text-slate-300")}>{hint}</p>
    </div>
  );
}

function RiskCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_18px_45px_-30px_rgba(2,6,23,1)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900/82">
      <Icon className="mb-4 h-5 w-5 text-slate-400" />
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function AllocationBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-200">
        <span>{label}</span>
        <span style={{ fontFamily: monoMetricFont }}>{value}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/72 p-4 backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-black text-white" style={{ fontFamily: monoMetricFont }}>{value}</p>
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
    slate: "border-white/10 bg-slate-950/74 text-white",
    indigo: "border-indigo-300/20 bg-indigo-500/10 text-white",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-white",
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
    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className="text-sm font-black text-current" style={{ fontFamily: monoMetricFont }}>{value}</span>
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
          : "border-white/10 bg-slate-950/72 text-slate-100 hover:border-white/20 hover:bg-slate-900/82 hover:text-white",
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
          : "border-white/10 bg-slate-950/72 text-white hover:border-white/20 hover:bg-slate-900/82",
      )}
    >
      <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", active ? "text-slate-400" : "text-slate-400")}>{label}</p>
      <p className="mt-2 text-lg font-black" style={{ fontFamily: monoMetricFont }}>{value}</p>
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
      <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-200">
        <span>{label}</span>
        <span style={{ fontFamily: monoMetricFont }}>{formatCurrency(value)}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all duration-700", tone)} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function LensCard({ title, body, icon: Icon }: { title: string; body: string; icon: typeof MapPin }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_22px_55px_-36px_rgba(2,6,23,1)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-slate-900/84">
      <Icon className="mb-5 h-6 w-6 text-emerald-300" />
      <h4 className="text-lg font-black text-white">{title}</h4>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{body}</p>
    </div>
  );
}

function CommandMapView({
  center,
  zoom,
  onViewportChange,
}: {
  center: [number, number];
  zoom: number;
  onViewportChange?: (telemetry: CommandViewportTelemetry) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const prefersReducedMotion = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      map.setView(center, zoom, { animate: false });
      return;
    }

    map.flyTo(center, zoom, {
      animate: true,
      duration: 1.45,
      easeLinearity: 0.28,
    });
  }, [center, map, zoom]);

  useMapEvents({
    moveend(event) {
      const liveCenter = event.target.getCenter();
      onViewportChange?.({
        center: [liveCenter.lat, liveCenter.lng],
        zoom: event.target.getZoom(),
      });
    },
    zoomend(event) {
      const liveCenter = event.target.getCenter();
      onViewportChange?.({
        center: [liveCenter.lat, liveCenter.lng],
        zoom: event.target.getZoom(),
      });
    },
  });

  return null;
}

function DemandTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 shadow-[0_22px_45px_-28px_rgba(2,6,23,1)] backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-3 space-y-1 text-sm font-bold">
        <p className="text-white">Actual: {payload[0]?.value}</p>
        <p className="text-indigo-300">Predicted: {payload[1]?.value}</p>
      </div>
    </div>
  );
}

function GapTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 shadow-[0_22px_45px_-28px_rgba(2,6,23,1)] backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-3 text-sm font-bold text-emerald-300">
        Gap pressure: {payload[0]?.value > 0 ? "+" : ""}{payload[0]?.value}
      </div>
    </div>
  );
}
