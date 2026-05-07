import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Crosshair,
  Download,
  FileText,
  Globe2,
  HandCoins,
  Layers3,
  Loader2,
  LocateFixed,
  MapPinned,
  MessageSquareText,
  Radar,
  SendHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { MarketCommandSearch } from "@/components/maps/MarketCommandSearch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  buildSimulationGeoConfig,
  DEFAULT_SIMULATION_CITY_ID,
  GLOBAL_SIMULATION_CITIES,
  SIMULATION_SCENARIOS,
  SIMULATION_BATCH_COUNT,
  SIMULATION_BATCH_SIZE,
  SIMULATION_TOTAL_POINTS,
  type SimulationGeoConfig,
  type SimulationScenario,
  generateSimulationBatch,
} from "@/utils/simulationData";
import { reverseGeocodeMarket, type GeocodedMarketResult } from "@/utils/geocoding";
import { downloadSimulationReport } from "@/utils/simulationReport";

export type SimulationPhase = "idle" | "generating" | "inferencing" | "visualizing" | "complete" | "error";
type DensityCluster = "low_density" | "balanced_density" | "high_density" | "surge_density";
type StrategyBucket = "high" | "medium" | "low";

interface SimulationSectorSummary {
  area_sector: string;
  batch_orders: number;
  projected_orders: number;
  active_workers: number;
  density_score: number;
  density_cluster: DensityCluster;
  salaried_ratio: number;
  freelancer_ratio: number;
  recommended_shift: number;
  confidence_score: number;
  traditional_cost: number;
  optimized_cost: number;
  projected_revenue: number;
  acquisition_cost: number;
  estimated_ltv: number;
  contribution_margin: number;
  daily_burn: number;
  burn_risk: number;
  churn_risk: number;
  supply_gap_ratio: number;
  centroid_lat: number;
  centroid_lng: number;
}

interface SimulationBatchResponse {
  batch_id: number;
  total_batches: number;
  points_received: number;
  processing_ms: number;
  cluster_distribution: Record<string, number>;
  sector_summaries: SimulationSectorSummary[];
  model_version: string;
  scenario: SimulationScenario;
}

interface AggregatedSector {
  areaSector: string;
  totalOrders: number;
  projectedOrders: number;
  activeWorkers: number;
  densityScore: number;
  densityCluster: DensityCluster;
  salariedRatio: number;
  freelancerRatio: number;
  recommendedShift: number;
  confidenceScore: number;
  traditionalCost: number;
  optimizedCost: number;
  projectedRevenue: number;
  acquisitionCost: number;
  estimatedLtv: number;
  contributionMargin: number;
  dailyBurn: number;
  burnRisk: number;
  churnRisk: number;
  supplyGapRatio: number;
  centroidLat: number;
  centroidLng: number;
  sampleCount: number;
}

interface ZoneEconomicsRow {
  sector: string;
  acquisitionCost: number;
  estimatedLtv: number;
  contributionMargin: number;
  dailyBurn: number;
  projectedOrders: number;
  salariedRatio: number;
  burnRisk: number;
  churnRisk: number;
  cacToLtvRatio: number;
}

interface BatchLogPoint {
  batch: string;
  processedPoints: number;
  processingMs: number;
  hotSectors: number;
}

interface PreviewPoint {
  id: string;
  position: [number, number];
  serviceType: string;
  isEmergency: boolean;
}

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface StrategySummary {
  scenario: {
    id: SimulationScenario;
    label: string;
  };
  zone: {
    city: string;
    country: string;
    radiusKm: number;
    center: {
      lat: number;
      lng: number;
    };
  };
  totals: {
    sectors: number;
    projectedOrders: number;
    activeWorkers: number;
  };
  densityBuckets: Record<StrategyBucket, {
    sectors: number;
    projectedOrders: number;
    activeWorkers: number;
  }>;
  topSignals: Array<{
    sector: string;
    densityScore: number;
    projectedOrders: number;
    activeWorkers: number;
  }>;
}

interface StrategyAgentResponse {
  signal: string;
  reasoning: string;
  procedures: string[];
  provider?: string;
  model?: string;
  saved?: boolean;
  fallback?: boolean;
}

export interface SimulationCompletionPayload {
  generatedAt: string;
  scenario: SimulationScenario;
  scenarioLabel: string;
  modelVersion: string;
  totalPoints: number;
  totalProjectedOrders: number;
  totalTraditionalCost: number;
  totalOptimizedCost: number;
  marginLift: number;
  averageSalariedRatio: number;
  hottestSector: string;
  criticalGapSector: string | null;
  highestSupplyGap: number;
  zone: StrategySummary["zone"];
  totals: StrategySummary["totals"];
  densityBuckets: StrategySummary["densityBuckets"];
  topSignals: StrategySummary["topSignals"];
  sectors: Array<{
    sector: string;
    densityScore: number;
    salariedRatio: number;
    projectedOrders: number;
    recommendedShift: number;
    acquisitionCost: number;
    estimatedLtv: number;
    contributionMargin: number;
    dailyBurn: number;
    burnRisk: number;
    churnRisk: number;
    supplyGapRatio: number;
    activeWorkers: number;
  }>;
}

export interface SimulationTelemetryPayload {
  phase: SimulationPhase;
  isRunning: boolean;
  statusFeed: string[];
}

export interface SimulationGeoSelectionPayload {
  geoConfig: SimulationGeoConfig;
  selectedAddress: string;
  scenario: SimulationScenario;
  source: "bootstrap" | "city_select" | "map_pin" | "recenter" | "search";
  cityChanged: boolean;
}

interface SimulationEngineProps {
  onSimulationComplete?: (payload: SimulationCompletionPayload) => void;
  onTelemetryChange?: (payload: SimulationTelemetryPayload) => void;
  onGeoConfigChange?: (payload: SimulationGeoSelectionPayload) => void;
  externalGeoSelection?: SimulationGeoSelectionPayload | null;
}

const DEFAULT_RADIUS_KM = 12;

const clusterLabel: Record<DensityCluster, string> = {
  low_density: "Low Density",
  balanced_density: "Balanced Density",
  high_density: "High Density",
  surge_density: "Surge Density",
};

const clusterColor: Record<DensityCluster, string> = {
  low_density: "#38bdf8",
  balanced_density: "#6366f1",
  high_density: "#8b5cf6",
  surge_density: "#f97316",
};

const formatCurrency = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;
const formatRadius = (value: number) => `${value.toFixed(0)} km`;
const formatCoordinates = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const SIMULATION_SCENARIO_STORAGE_KEY = "rahi-simulation-scenario";

const scenarioMeta: Record<SimulationScenario, {
  label: string;
  badge: string;
  summary: string;
  ribbon: string;
  iconTone: string;
}> = {
  baseline: {
    label: "Baseline Command",
    badge: "NORMAL OPERATIONS",
    summary: "Standard demand curve, normal worker mobility, and the default density-optimization engine.",
    ribbon: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconTone: "text-emerald-600",
  },
  monsoon: {
    label: "Monsoon Stress Test",
    badge: "ACTIVE EMERGENCY DEPLOYMENT",
    summary: "Repair demand spikes, field mobility drops, and burn pressure rises while the AI re-optimizes in real time.",
    ribbon: "border-amber-300 bg-[linear-gradient(135deg,_rgba(251,191,36,0.18),_rgba(249,115,22,0.16))] text-amber-900",
    iconTone: "text-amber-600",
  },
  supply_crunch: {
    label: "Supply Shortage Drill",
    badge: "50% SUPPLY SHORTAGE",
    summary: "Worker availability collapses by 50% while high-priority demand doubles, forcing the engine into service-preservation mode.",
    ribbon: "border-rose-300 bg-[linear-gradient(135deg,_rgba(251,113,133,0.16),_rgba(190,24,93,0.14))] text-rose-950",
    iconTone: "text-rose-600",
  },
  price_war: {
    label: "Market Competition Stress",
    badge: "COMPETITION STRESS",
    summary: "A competitor discount war drives CAC upward, lifts churn, and forces the engine to defend the profitability floor sector by sector.",
    ribbon: "border-amber-300 bg-[linear-gradient(135deg,_rgba(253,230,138,0.24),_rgba(251,146,60,0.18))] text-amber-950",
    iconTone: "text-amber-700",
  },
};

const FIVE_DAY_MONSOON_RUNWAY_QUESTION = "Based on the current supply crunch and daily burn, what is our financial runway if this Monsoon lasts 5 more days?";

const getGeoConfigKey = (config: SimulationGeoConfig) => (
  `${config.cityId}:${config.center.lat.toFixed(4)}:${config.center.lng.toFixed(4)}:${config.radiusKm.toFixed(1)}`
);

const validSimulationScenarios: SimulationScenario[] = SIMULATION_SCENARIOS.map((scenario) => scenario.id);

const getStoredScenario = (value: string | null): SimulationScenario => (
  validSimulationScenarios.find((scenario) => scenario === value) || "baseline"
);

const getScenarioWeatherSignal = (scenario: SimulationScenario) => {
  switch (scenario) {
    case "monsoon":
      return "Monsoon scenario active: repair demand is upweighted, worker mobility is reduced, and cash burn is elevated.";
    case "supply_crunch":
      return "Supply shortage scenario active: worker availability is down 50% while priority demand is surging across the zone.";
    case "price_war":
      return "Market competition stress is active: CAC is elevated, churn pressure is rising, and margin defense is the command priority.";
    default:
      return "Normal operating window with standard workforce mobility, demand shape, and acquisition pressure.";
  }
};

const getScenarioLogicSignals = ({
  scenario,
  hottestSector,
  totalDailyBurn,
  marginLift,
}: {
  scenario: SimulationScenario;
  hottestSector?: string;
  totalDailyBurn: number;
  marginLift: number;
}) => {
  switch (scenario) {
    case "monsoon":
      return [
        "Monsoon stress test active: worker availability has been cut to simulate transport delays and route friction.",
        "Repair-heavy categories like Plumbing, Roofing, and Electrical are receiving higher traffic weight in the current run.",
        `Projected 48-hour burn runway at current pace is ${formatCurrency(totalDailyBurn * 2)}.`,
      ];
    case "price_war":
      return [
        "Market competition stress is active: customer acquisition cost and churn assumptions are both running above the baseline city model.",
        `The profitability floor is being defended first in ${hottestSector || "the hottest sector"} while broad discount matching is kept off by default.`,
        `The intervention target is to preserve ${formatCurrency(marginLift)} of margin while the command zone absorbs contested-market pressure.`,
      ];
    case "supply_crunch":
      return [
        "Supply shortage drill active: active workers are halved so the engine can expose the first zone that breaks under pressure.",
        `Critical service preservation is being routed toward ${hottestSector || "the highest-pressure sector"} while low-priority lanes are deprioritized.`,
        `The intervention target is to recover ${formatCurrency(marginLift)} of margin without letting the supply gap widen further.`,
      ];
    default:
      return [
        "Baseline simulation active: standard workforce mobility and cost assumptions are in effect.",
        `Hottest sector right now is ${hottestSector || "not yet available"} inside the active command ring.`,
        `Current radius mix implies a ${formatCurrency(marginLift)} margin lift versus the flat staffing model.`,
      ];
  }
};

const getScenarioRequestDescriptor = (scenario: SimulationScenario) => {
  switch (scenario) {
    case "monsoon":
      return "storm-adjusted";
    case "price_war":
      return "competition-adjusted";
    case "supply_crunch":
      return "shortage-adjusted";
    default:
      return "synthetic";
  }
};

const getScenarioInferenceSuffix = (scenario: SimulationScenario) => {
  switch (scenario) {
    case "monsoon":
      return "under weather stress";
    case "price_war":
      return "under competition stress";
    case "supply_crunch":
      return "under supply preservation pressure";
    default:
      return "in the active zone";
  }
};

const getScenarioVisualizationMessage = (scenario: SimulationScenario) => {
  switch (scenario) {
    case "monsoon":
      return "Inference complete. Rendering the storm command map, emergency staffing shifts, and burn-response plan.";
    case "price_war":
      return "Inference complete. Rendering the profitability-floor map, CAC pressure signals, and retention-first response plan.";
    case "supply_crunch":
      return "Inference complete. Rendering the supply-gap heatmap, redeployment orders, and service-preservation ladder.";
    default:
      return "Inference complete. Rendering the geo heatmap and workforce recommendations.";
  }
};

const getScenarioCompletionToast = (scenario: SimulationScenario) => {
  switch (scenario) {
    case "monsoon":
      return "RAHI monsoon stress test finished successfully.";
    case "price_war":
      return "RAHI market competition stress test finished successfully.";
    case "supply_crunch":
      return "RAHI supply shortage drill finished successfully.";
    default:
      return "RAHI global intelligence simulation finished successfully.";
  }
};

const getScenarioLaunchLabel = (scenario: SimulationScenario) => {
  switch (scenario) {
    case "monsoon":
      return "Launch Monsoon Stress Test";
    case "price_war":
      return "Launch Competition Stress Test";
    case "supply_crunch":
      return "Launch 50% Supply Shortage";
    default:
      return "Launch 400k Simulation";
  }
};

const getScenarioPhaseCopy = (scenario: SimulationScenario): Record<SimulationPhase, string> => {
  switch (scenario) {
    case "monsoon":
      return {
        idle: "Select a city, pin the zone, and trigger the monsoon scenario to simulate repair surges and mobility shock.",
        generating: "Generating storm-adjusted booking traffic with faker.js around the selected map center.",
        inferencing: "Streaming each batch into the Random Forest engine with monsoon supply-friction assumptions.",
        visualizing: "Packaging emergency staffing shifts, amber alerts, and burn-pressure signals for the command map.",
        complete: "Monsoon simulation complete. The command map, economics, and storm playbook are ready for review.",
        error: "Simulation paused because a batch failed. Fix the service and launch again.",
      };
    case "price_war":
      return {
        idle: "Select a city, pin the zone, and trigger market competition stress to see where CAC pressure breaks margin first.",
        generating: "Generating competition-adjusted booking traffic with elevated CAC and churn assumptions across the active zone.",
        inferencing: "Streaming each batch into the Random Forest engine with profitability-floor and retention guardrails enabled.",
        visualizing: "Packaging margin-defense hotspots, retention pivots, and contested-market warnings for the command map.",
        complete: "Competition stress complete. The profitability map, retention plan, and margin-defense logic are ready for review.",
        error: "Simulation paused because a batch failed. Fix the service and launch again.",
      };
    case "supply_crunch":
      return {
        idle: "Select a city, pin the zone, and trigger the 50% supply shortage to see which sector breaks first.",
        generating: "Generating shortage-adjusted booking traffic with workforce availability compressed by half.",
        inferencing: "Streaming each batch into the Random Forest engine with service-preservation assumptions.",
        visualizing: "Packaging shortage heatmaps, redeployment orders, and supply-gap warnings for the command map.",
        complete: "Supply shortage drill complete. The gap map, redeployment plan, and preservation logic are ready for review.",
        error: "Simulation paused because a batch failed. Fix the service and launch again.",
      };
    default:
      return {
        idle: "Select a city, drop a command pin, and define the radius ring for the next 400k simulation.",
        generating: "Generating synthetic booking traffic with faker.js around the selected map center.",
        inferencing: "Streaming each batch into the Random Forest density engine.",
        visualizing: "Packaging density buckets, workforce shifts, and geo signals for the command map.",
        complete: "Simulation complete. The map and economics panels are ready for export.",
        error: "Simulation paused because a batch failed. Fix the service and launch again.",
      };
  }
};

const phaseStatus = (phase: SimulationPhase, target: Exclude<SimulationPhase, "idle" | "error" | "complete">) => {
  const order = ["generating", "inferencing", "visualizing"];
  const currentIndex = order.indexOf(phase as string);
  const targetIndex = order.indexOf(target);

  if (phase === "complete") return "complete";
  if (phase === "error") return targetIndex <= currentIndex ? "complete" : "idle";
  if (targetIndex < currentIndex) return "complete";
  if (target === phase) return "active";
  return "idle";
};

const mergeSummaries = (
  previous: Record<string, AggregatedSector>,
  summaries: SimulationSectorSummary[],
) => {
  const next = { ...previous };

  for (const summary of summaries) {
    const current = next[summary.area_sector];

    if (!current) {
      next[summary.area_sector] = {
        areaSector: summary.area_sector,
        totalOrders: summary.batch_orders,
        projectedOrders: summary.projected_orders,
        activeWorkers: summary.active_workers,
        densityScore: summary.density_score,
        densityCluster: summary.density_cluster,
        salariedRatio: summary.salaried_ratio * 100,
        freelancerRatio: summary.freelancer_ratio * 100,
        recommendedShift: summary.recommended_shift,
        confidenceScore: summary.confidence_score,
        traditionalCost: summary.traditional_cost,
        optimizedCost: summary.optimized_cost,
        projectedRevenue: summary.projected_revenue,
        acquisitionCost: summary.acquisition_cost,
        estimatedLtv: summary.estimated_ltv,
        contributionMargin: summary.contribution_margin,
        dailyBurn: summary.daily_burn,
        burnRisk: summary.burn_risk,
        churnRisk: summary.churn_risk,
        supplyGapRatio: summary.supply_gap_ratio,
        centroidLat: summary.centroid_lat,
        centroidLng: summary.centroid_lng,
        sampleCount: 1,
      };
      continue;
    }

    const sampleCount = current.sampleCount + 1;
    const pickCluster = summary.density_score >= current.densityScore ? summary.density_cluster : current.densityCluster;

    next[summary.area_sector] = {
      areaSector: summary.area_sector,
      totalOrders: current.totalOrders + summary.batch_orders,
      projectedOrders: current.projectedOrders + summary.projected_orders,
      activeWorkers: Math.max(current.activeWorkers, summary.active_workers),
      densityScore: Number((((current.densityScore * current.sampleCount) + summary.density_score) / sampleCount).toFixed(2)),
      densityCluster: pickCluster,
      salariedRatio: (((current.salariedRatio * current.sampleCount) + (summary.salaried_ratio * 100)) / sampleCount),
      freelancerRatio: (((current.freelancerRatio * current.sampleCount) + (summary.freelancer_ratio * 100)) / sampleCount),
      recommendedShift: Math.max(current.recommendedShift, summary.recommended_shift),
      confidenceScore: (((current.confidenceScore * current.sampleCount) + summary.confidence_score) / sampleCount),
      traditionalCost: current.traditionalCost + summary.traditional_cost,
      optimizedCost: current.optimizedCost + summary.optimized_cost,
      projectedRevenue: current.projectedRevenue + summary.projected_revenue,
      acquisitionCost: (((current.acquisitionCost * current.sampleCount) + summary.acquisition_cost) / sampleCount),
      estimatedLtv: (((current.estimatedLtv * current.sampleCount) + summary.estimated_ltv) / sampleCount),
      contributionMargin: current.contributionMargin + summary.contribution_margin,
      dailyBurn: current.dailyBurn + summary.daily_burn,
      burnRisk: (((current.burnRisk * current.sampleCount) + summary.burn_risk) / sampleCount),
      churnRisk: (((current.churnRisk * current.sampleCount) + summary.churn_risk) / sampleCount),
      supplyGapRatio: (((current.supplyGapRatio * current.sampleCount) + summary.supply_gap_ratio) / sampleCount),
      centroidLat: summary.centroid_lat,
      centroidLng: summary.centroid_lng,
      sampleCount,
    };
  }

  return next;
};

const getDensityBucket = (densityScore: number): StrategyBucket => {
  if (densityScore >= 1.95) return "high";
  if (densityScore >= 1.15) return "medium";
  return "low";
};

const getMapMarkerRadius = (sector: AggregatedSector) => (
  Math.max(9, Math.min(28, 10 + (sector.projectedOrders / 120) + (sector.densityScore * 2.4)))
);

const getPreviewMarkerColor = (isEmergency: boolean) => (
  isEmergency ? "#f97316" : "#4f46e5"
);

const getRadiusBounds = (center: { lat: number; lng: number }, radiusKm: number) => {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / Math.max(18, 111 * Math.cos((center.lat * Math.PI) / 180));
  return [
    [center.lat - latDelta, center.lng - lngDelta],
    [center.lat + latDelta, center.lng + lngDelta],
  ] as [[number, number], [number, number]];
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateGeoDistanceKm = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);

  const a = (Math.sin(deltaLat / 2) ** 2)
    + (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(deltaLng / 2) ** 2));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const getExpansionMarketLabel = (cityLabel: string) => (
  cityLabel.toLowerCase().includes("delhi") ? "DELHI NCR" : cityLabel.toUpperCase()
);

const initialGeoConfig = buildSimulationGeoConfig({
  cityId: DEFAULT_SIMULATION_CITY_ID,
  radiusKm: DEFAULT_RADIUS_KM,
});

export function SimulationEngine({
  onSimulationComplete,
  onTelemetryChange,
  onGeoConfigChange,
  externalGeoSelection,
}: SimulationEngineProps) {
  const [phase, setPhase] = useState<SimulationPhase>("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [processedPoints, setProcessedPoints] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [sectorMap, setSectorMap] = useState<Record<string, AggregatedSector>>({});
  const [batchTimeline, setBatchTimeline] = useState<BatchLogPoint[]>([]);
  const [statusFeed, setStatusFeed] = useState<string[]>([]);
  const [modelVersion, setModelVersion] = useState("simulation-rf-v2");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [selectedCityId, setSelectedCityId] = useState(initialGeoConfig.cityId);
  const [analysisCenter, setAnalysisCenter] = useState(initialGeoConfig.center);
  const [radiusKm, setRadiusKm] = useState(initialGeoConfig.radiusKm);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>(() => {
    if (typeof window === "undefined") return "baseline";
    return getStoredScenario(window.localStorage.getItem(SIMULATION_SCENARIO_STORAGE_KEY));
  });
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(initialGeoConfig.marketLabel);
  const [lastRunConfig, setLastRunConfig] = useState<SimulationGeoConfig | null>(null);
  const [lastRunScenario, setLastRunScenario] = useState<SimulationScenario | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<false | "financial_audit" | "investor_summary" | "deep_dive">(false);
  const [strategyResponse, setStrategyResponse] = useState<StrategyAgentResponse | null>(null);
  const [investorSummary, setInvestorSummary] = useState<StrategyAgentResponse | null>(null);
  const [ceoQuestion, setCeoQuestion] = useState("Why are we losing money in the weakest zone?");
  const [pendingExpansionAutoLaunch, setPendingExpansionAutoLaunch] = useState<null | {
    key: string;
    marketLabel: string;
    distanceKm: number;
  }>(null);
  const lastReportedRunRef = useRef<string | null>(null);
  const lastGeoChangeSourceRef = useRef<SimulationGeoSelectionPayload["source"]>("bootstrap");
  const previousGeoConfigRef = useRef<SimulationGeoConfig>(initialGeoConfig);
  const lastAutoExpansionKeyRef = useRef<string | null>(null);
  const lastExternalSyncKeyRef = useRef<string | null>(null);
  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);

  const draftGeoConfig = useMemo(() => (
    buildSimulationGeoConfig({
      cityId: selectedCityId,
      center: analysisCenter,
      radiusKm,
    })
  ), [analysisCenter, radiusKm, selectedCityId]);

  const selectedCity = useMemo(() => (
    GLOBAL_SIMULATION_CITIES.find((city) => city.id === selectedCityId)
    || {
      id: draftGeoConfig.cityId,
      label: draftGeoConfig.cityLabel,
      country: draftGeoConfig.country,
      stateName: draftGeoConfig.stateName,
      stateCode: draftGeoConfig.stateCode,
      lat: draftGeoConfig.center.lat,
      lng: draftGeoConfig.center.lng,
      demandScale: draftGeoConfig.demandScale,
      workerScale: draftGeoConfig.workerScale,
      emergencyScale: draftGeoConfig.emergencyScale,
      marketingScale: draftGeoConfig.marketingScale,
      historicalTraffic: draftGeoConfig.historicalTraffic,
      serviceMix: draftGeoConfig.serviceMix,
    }
  ), [draftGeoConfig, selectedCityId]);
  const isPresetCity = useMemo(
    () => GLOBAL_SIMULATION_CITIES.some((city) => city.id === selectedCityId),
    [selectedCityId],
  );

  useEffect(() => {
    if (!externalGeoSelection) {
      return;
    }

    const syncKey = [
      getGeoConfigKey(externalGeoSelection.geoConfig),
      externalGeoSelection.selectedAddress,
      externalGeoSelection.source,
    ].join(":");
    if (lastExternalSyncKeyRef.current === syncKey) {
      return;
    }

    lastExternalSyncKeyRef.current = syncKey;
    lastGeoChangeSourceRef.current = externalGeoSelection.source;
    previousGeoConfigRef.current = externalGeoSelection.geoConfig;
    setSelectedCityId(externalGeoSelection.geoConfig.cityId);
    setAnalysisCenter(externalGeoSelection.geoConfig.center);
    setRadiusKm(externalGeoSelection.geoConfig.radiusKm);
    setSelectedAddress(externalGeoSelection.selectedAddress);
  }, [externalGeoSelection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIMULATION_SCENARIO_STORAGE_KEY, selectedScenario);
  }, [selectedScenario]);

  useEffect(() => {
    const previous = previousGeoConfigRef.current;
    const cityChanged = previous.cityId !== draftGeoConfig.cityId;
    const geoChanged = getGeoConfigKey(previous) !== getGeoConfigKey(draftGeoConfig);
    const movedDistanceKm = calculateGeoDistanceKm(previous.center, draftGeoConfig.center);

    if (!geoChanged && !cityChanged) {
      return;
    }

    if (
      (cityChanged || movedDistanceKm > 50)
      && lastGeoChangeSourceRef.current !== "bootstrap"
      && (
        lastGeoChangeSourceRef.current === "city_select"
        || lastGeoChangeSourceRef.current === "map_pin"
        || lastGeoChangeSourceRef.current === "search"
      )
    ) {
      setPendingExpansionAutoLaunch({
        key: getGeoConfigKey(draftGeoConfig),
        marketLabel: getExpansionMarketLabel(draftGeoConfig.cityLabel),
        distanceKm: movedDistanceKm,
      });
    }

    onGeoConfigChange?.({
      geoConfig: draftGeoConfig,
      selectedAddress,
      scenario: selectedScenario,
      source: lastGeoChangeSourceRef.current,
      cityChanged,
    });

    previousGeoConfigRef.current = draftGeoConfig;
  }, [draftGeoConfig, onGeoConfigChange, selectedAddress, selectedScenario]);

  const previewSignals = useMemo<PreviewPoint[]>(() => (
    generateSimulationBatch({
      batchIndex: 0,
      batchSize: 320,
      geoConfig: draftGeoConfig,
      scenario: selectedScenario,
    }).map((point, index) => ({
      id: `preview-${index}`,
      position: [point.lat, point.lng] as [number, number],
      serviceType: point.serviceType,
      isEmergency: point.isEmergency,
    }))
  ), [draftGeoConfig, selectedScenario]);

  const aggregatedSectors = useMemo(() => (
    Object.values(sectorMap)
      .map((sector) => ({
        ...sector,
        marginLift: sector.traditionalCost - sector.optimizedCost,
      }))
      .sort((left, right) => right.densityScore - left.densityScore)
  ), [sectorMap]);

  const hasPendingZoneChanges = Boolean(
    lastRunConfig
      && !isRunning
      && (
        getGeoConfigKey(lastRunConfig) !== getGeoConfigKey(draftGeoConfig)
        || lastRunScenario !== selectedScenario
      ),
  );

  const effectivePhase = hasPendingZoneChanges ? "idle" : phase;
  const effectiveProcessedPoints = hasPendingZoneChanges ? 0 : processedPoints;
  const effectiveCompletedBatches = hasPendingZoneChanges ? 0 : completedBatches;
  const effectiveBatchTimeline = hasPendingZoneChanges ? [] : batchTimeline;
  const effectiveAggregatedSectors = hasPendingZoneChanges ? [] : aggregatedSectors;
  const effectiveStatusFeed = hasPendingZoneChanges
    ? [
      `Scenario parameters changed. Launch the ${scenarioMeta[selectedScenario].label.toLowerCase()} again to regenerate the heatmap, logic trail, and response plan.`,
    ]
    : statusFeed;

  const totalTraditionalCost = useMemo(
    () => effectiveAggregatedSectors.reduce((sum, sector) => sum + sector.traditionalCost, 0),
    [effectiveAggregatedSectors],
  );
  const totalOptimizedCost = useMemo(
    () => effectiveAggregatedSectors.reduce((sum, sector) => sum + sector.optimizedCost, 0),
    [effectiveAggregatedSectors],
  );
  const totalCostSavings = useMemo(
    () => Math.max(0, totalTraditionalCost - totalOptimizedCost),
    [totalOptimizedCost, totalTraditionalCost],
  );
  const costSavingsRate = useMemo(
    () => (totalTraditionalCost > 0 ? totalCostSavings / totalTraditionalCost : 0),
    [totalCostSavings, totalTraditionalCost],
  );
  const totalProjectedOrders = useMemo(
    () => effectiveAggregatedSectors.reduce((sum, sector) => sum + sector.projectedOrders, 0),
    [effectiveAggregatedSectors],
  );
  const totalProjectedRevenue = useMemo(
    () => effectiveAggregatedSectors.reduce((sum, sector) => sum + sector.projectedRevenue, 0),
    [effectiveAggregatedSectors],
  );
  const totalActiveWorkers = useMemo(
    () => effectiveAggregatedSectors.reduce((sum, sector) => sum + sector.activeWorkers, 0),
    [effectiveAggregatedSectors],
  );
  const hottestSector = effectiveAggregatedSectors[0];
  const criticalSupplyGapSector = useMemo(
    () => [...effectiveAggregatedSectors].sort((left, right) => right.supplyGapRatio - left.supplyGapRatio)[0] || null,
    [effectiveAggregatedSectors],
  );
  const highestSupplyGap = criticalSupplyGapSector?.supplyGapRatio ?? 0;
  const averageSalariedRatio = useMemo(() => {
    if (effectiveAggregatedSectors.length === 0) return 0;
    const totalWeightedRatio = effectiveAggregatedSectors.reduce(
      (sum, sector) => sum + (sector.salariedRatio * sector.projectedOrders),
      0,
    );
    return totalWeightedRatio / Math.max(1, totalProjectedOrders);
  }, [effectiveAggregatedSectors, totalProjectedOrders]);

  const progressValue = Math.round((effectiveProcessedPoints / SIMULATION_TOTAL_POINTS) * 100);
  const elapsedSeconds = startedAt && !hasPendingZoneChanges
    ? ((finishedAt ?? performance.now()) - startedAt) / 1000
    : 0;
  const throughput = elapsedSeconds > 0 ? Math.round(effectiveProcessedPoints / elapsedSeconds) : 0;

  const economicsData = useMemo(() => (
    effectiveAggregatedSectors
      .slice(0, 8)
      .map((sector) => ({
        sector: sector.areaSector.replace(draftGeoConfig.cityLabel, "").trim() || sector.areaSector,
        traditionalCost: Math.round(sector.traditionalCost),
        optimizedCost: Math.round(sector.optimizedCost),
        marginLift: Math.round(sector.marginLift),
      }))
  ), [draftGeoConfig.cityLabel, effectiveAggregatedSectors]);

  const recommendationRows = useMemo(() => (
    effectiveAggregatedSectors.map((sector) => ({
      ...sector,
      burnDelta: sector.traditionalCost - sector.optimizedCost,
    }))
  ), [effectiveAggregatedSectors]);

  const strategySummary = useMemo<StrategySummary>(() => {
    const buckets: StrategySummary["densityBuckets"] = {
      high: { sectors: 0, projectedOrders: 0, activeWorkers: 0 },
      medium: { sectors: 0, projectedOrders: 0, activeWorkers: 0 },
      low: { sectors: 0, projectedOrders: 0, activeWorkers: 0 },
    };

    effectiveAggregatedSectors.forEach((sector) => {
      const bucket = getDensityBucket(sector.densityScore);
      buckets[bucket].sectors += 1;
      buckets[bucket].projectedOrders += sector.projectedOrders;
      buckets[bucket].activeWorkers += sector.activeWorkers;
    });

    return {
      scenario: {
        id: selectedScenario,
        label: scenarioMeta[selectedScenario].label,
      },
      zone: {
        city: draftGeoConfig.cityLabel,
        country: draftGeoConfig.country,
        radiusKm: draftGeoConfig.radiusKm,
        center: draftGeoConfig.center,
      },
      totals: {
        sectors: effectiveAggregatedSectors.length,
        projectedOrders: totalProjectedOrders,
        activeWorkers: totalActiveWorkers,
      },
      densityBuckets: buckets,
      topSignals: effectiveAggregatedSectors.slice(0, 5).map((sector) => ({
        sector: sector.areaSector,
        densityScore: Number(sector.densityScore.toFixed(2)),
        projectedOrders: sector.projectedOrders,
        activeWorkers: sector.activeWorkers,
      })),
    };
  }, [draftGeoConfig, effectiveAggregatedSectors, selectedScenario, totalActiveWorkers, totalProjectedOrders]);

  const zoneEconomics = useMemo<ZoneEconomicsRow[]>(() => (
    effectiveAggregatedSectors
      .map((sector) => ({
        sector: sector.areaSector,
        acquisitionCost: Number(sector.acquisitionCost.toFixed(2)),
        estimatedLtv: Number(sector.estimatedLtv.toFixed(2)),
        contributionMargin: Number(sector.contributionMargin.toFixed(2)),
        dailyBurn: Number(sector.dailyBurn.toFixed(2)),
        projectedOrders: sector.projectedOrders,
        salariedRatio: Number(sector.salariedRatio.toFixed(2)),
        burnRisk: Number(sector.burnRisk.toFixed(3)),
        churnRisk: Number(sector.churnRisk.toFixed(3)),
        cacToLtvRatio: Number((sector.estimatedLtv / Math.max(1, sector.acquisitionCost)).toFixed(2)),
      }))
      .sort((left, right) => right.dailyBurn - left.dailyBurn || left.cacToLtvRatio - right.cacToLtvRatio)
  ), [effectiveAggregatedSectors]);

  const financialOverview = useMemo(() => {
    if (zoneEconomics.length === 0) {
      return {
        averageCac: 0,
        averageLtv: 0,
        totalContributionMargin: 0,
        totalDailyBurn: 0,
        cashPositiveZones: 0,
        burnZones: 0,
        bestZone: null as ZoneEconomicsRow | null,
        weakestZone: null as ZoneEconomicsRow | null,
      };
    }

    return {
      averageCac: zoneEconomics.reduce((sum, zone) => sum + zone.acquisitionCost, 0) / zoneEconomics.length,
      averageLtv: zoneEconomics.reduce((sum, zone) => sum + zone.estimatedLtv, 0) / zoneEconomics.length,
      totalContributionMargin: zoneEconomics.reduce((sum, zone) => sum + zone.contributionMargin, 0),
      totalDailyBurn: zoneEconomics.reduce((sum, zone) => sum + zone.dailyBurn, 0),
      cashPositiveZones: zoneEconomics.filter((zone) => zone.contributionMargin > 0).length,
      burnZones: zoneEconomics.filter((zone) => zone.dailyBurn > 0).length,
      bestZone: [...zoneEconomics].sort((left, right) => right.contributionMargin - left.contributionMargin)[0] || null,
      weakestZone: zoneEconomics[0] || null,
    };
  }, [zoneEconomics]);

  const inferredAllocationStrategy = useMemo(() => {
    if (averageSalariedRatio >= 65) return "salaried_core";
    if (averageSalariedRatio >= 35) return "hybrid";
    return "freelancer_pool";
  }, [averageSalariedRatio]);

  const completionPayload = useMemo<SimulationCompletionPayload>(() => ({
    generatedAt: new Date().toISOString(),
    scenario: selectedScenario,
    scenarioLabel: scenarioMeta[selectedScenario].label,
    modelVersion,
    totalPoints: effectiveProcessedPoints || SIMULATION_TOTAL_POINTS,
    totalProjectedOrders,
    totalTraditionalCost,
    totalOptimizedCost,
    marginLift: totalTraditionalCost - totalOptimizedCost,
    averageSalariedRatio: Number(averageSalariedRatio.toFixed(2)),
    hottestSector: hottestSector?.areaSector || "NA",
    criticalGapSector: criticalSupplyGapSector?.areaSector || null,
    highestSupplyGap: Number(highestSupplyGap.toFixed(3)),
    zone: strategySummary.zone,
    totals: strategySummary.totals,
    densityBuckets: strategySummary.densityBuckets,
    topSignals: strategySummary.topSignals,
    sectors: effectiveAggregatedSectors.map((sector) => ({
      sector: sector.areaSector,
      densityScore: Number(sector.densityScore.toFixed(2)),
      salariedRatio: Number(sector.salariedRatio.toFixed(2)),
      projectedOrders: sector.projectedOrders,
      recommendedShift: sector.recommendedShift,
      acquisitionCost: Number(sector.acquisitionCost.toFixed(2)),
      estimatedLtv: Number(sector.estimatedLtv.toFixed(2)),
      contributionMargin: Number(sector.contributionMargin.toFixed(2)),
      dailyBurn: Number(sector.dailyBurn.toFixed(2)),
      burnRisk: Number(sector.burnRisk.toFixed(2)),
      churnRisk: Number(sector.churnRisk.toFixed(2)),
      supplyGapRatio: Number(sector.supplyGapRatio.toFixed(3)),
      activeWorkers: sector.activeWorkers,
    })),
  }), [
    averageSalariedRatio,
    criticalSupplyGapSector?.areaSector,
    effectiveAggregatedSectors,
    effectiveProcessedPoints,
    highestSupplyGap,
    hottestSector?.areaSector,
    modelVersion,
    selectedScenario,
    strategySummary,
    totalOptimizedCost,
    totalProjectedOrders,
    totalTraditionalCost,
  ]);

  useEffect(() => {
    if (phase !== "complete" || !finishedAt || completionPayload.sectors.length === 0) {
      return;
    }

    const reportKey = `${startedAt ?? "na"}:${finishedAt}:${completionPayload.modelVersion}:${completionPayload.totalProjectedOrders}`;
    if (lastReportedRunRef.current === reportKey) {
      return;
    }

    lastReportedRunRef.current = reportKey;
    onSimulationComplete?.(completionPayload);
  }, [
    completionPayload,
    finishedAt,
    onSimulationComplete,
    phase,
    startedAt,
  ]);

  useEffect(() => {
    onTelemetryChange?.({
      phase: effectivePhase,
      isRunning,
      statusFeed: effectiveStatusFeed,
    });
  }, [effectivePhase, effectiveStatusFeed, isRunning, onTelemetryChange]);

  const appendFeed = useCallback((message: string) => {
    startTransition(() => {
      setStatusFeed((previous) => [message, ...previous].slice(0, 10));
    });
  }, []);

  const applyResolvedMarket = useCallback((
    result: Pick<GeocodedMarketResult, "lat" | "lng" | "label" | "geoConfig">,
    source: SimulationGeoSelectionPayload["source"],
  ) => {
    const previousCityLabel = previousGeoConfigRef.current.cityLabel;
    const nextCityLabel = result.geoConfig.cityLabel;

    lastGeoChangeSourceRef.current = source;
    setSelectedCityId(result.geoConfig.cityId);
    setAnalysisCenter({
      lat: Number(result.lat.toFixed(6)),
      lng: Number(result.lng.toFixed(6)),
    });
    setRadiusKm(result.geoConfig.radiusKm);
    setSelectedAddress(result.label);

    if (
      previousCityLabel !== nextCityLabel
      && source !== "bootstrap"
    ) {
      appendFeed(`[SYSTEM] RE-CENTERING ENGINE: ${nextCityLabel.toUpperCase()} DETECTED. LOAD BALANCING SIMULATION...`);
    }
  }, [appendFeed]);

  const handleCityChange = useCallback((cityId: string) => {
    const city = GLOBAL_SIMULATION_CITIES.find((entry) => entry.id === cityId);
    if (!city) return;

    lastGeoChangeSourceRef.current = "city_select";
    setSelectedCityId(city.id);
    setAnalysisCenter({ lat: city.lat, lng: city.lng });
    setSelectedAddress(city.stateCode
      ? `${city.label}, ${city.stateCode}, ${city.country}`
      : `${city.label}, ${city.country}`);
  }, []);

  const handleRadiusChange = useCallback((value: number[]) => {
    const nextRadius = value[0];
    if (!nextRadius) return;
    setRadiusKm(nextRadius);
  }, []);

  const handleMapCenterSelect = useCallback((location: SelectedLocation) => {
    lastGeoChangeSourceRef.current = "map_pin";
    setAnalysisCenter({
      lat: Number(location.lat.toFixed(6)),
      lng: Number(location.lng.toFixed(6)),
    });
    setSelectedAddress(location.address || `Command pin ${formatCoordinates(location.lat, location.lng)}`);
  }, []);

  const handleSearchSelect = useCallback((result: GeocodedMarketResult) => {
    applyResolvedMarket(result, "search");
  }, [applyResolvedMarket]);

  const handleViewportSettled = useCallback(async (center: { lat: number; lng: number }) => {
    reverseGeocodeAbortRef.current?.abort();
    const controller = new AbortController();
    reverseGeocodeAbortRef.current = controller;

    try {
      const result = await reverseGeocodeMarket(center.lat, center.lng, {
        radiusKm,
        signal: controller.signal,
      });
      applyResolvedMarket(result, "map_pin");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }

      lastGeoChangeSourceRef.current = "map_pin";
      setAnalysisCenter({
        lat: Number(center.lat.toFixed(6)),
        lng: Number(center.lng.toFixed(6)),
      });
      setSelectedAddress(`Command pin ${formatCoordinates(center.lat, center.lng)}`);
    }
  }, [applyResolvedMarket, radiusKm]);

  const handleRecenterToCity = useCallback(() => {
    lastGeoChangeSourceRef.current = "recenter";
    setAnalysisCenter({ lat: selectedCity.lat, lng: selectedCity.lng });
    setSelectedAddress(selectedCity.stateCode
      ? `${selectedCity.label}, ${selectedCity.stateCode}, ${selectedCity.country}`
      : `${selectedCity.label}, ${selectedCity.country}`);
  }, [selectedCity]);

  const handleExport = useCallback(() => {
    if (effectiveAggregatedSectors.length === 0) {
      toast.error("Run the simulation first so there is something meaningful to export.");
      return;
    }

    downloadSimulationReport({
      generatedAt: new Date().toLocaleString("en-IN"),
      totalPoints: effectiveProcessedPoints || SIMULATION_TOTAL_POINTS,
      totalSectors: effectiveAggregatedSectors.length,
      totalProjectedOrders,
      totalTraditionalCost,
      totalOptimizedCost,
      marginLift: totalTraditionalCost - totalOptimizedCost,
      averageSalariedRatio,
      hottestSector: hottestSector?.areaSector || "NA",
      zoneLabel: `${draftGeoConfig.cityLabel}, ${draftGeoConfig.country} - ${scenarioMeta[selectedScenario].label}`,
      radiusKm: draftGeoConfig.radiusKm,
      centerCoordinates: formatCoordinates(draftGeoConfig.center.lat, draftGeoConfig.center.lng),
      sectors: effectiveAggregatedSectors.map((sector) => ({
        sector: sector.areaSector,
        densityCluster: clusterLabel[sector.densityCluster],
        densityScore: sector.densityScore,
        salariedRatio: sector.salariedRatio,
        traditionalCost: sector.traditionalCost,
        optimizedCost: sector.optimizedCost,
        projectedRevenue: sector.projectedRevenue,
      })),
    });

    toast.success("Simulation report exported as PDF.");
  }, [
    averageSalariedRatio,
    draftGeoConfig.center.lat,
    draftGeoConfig.center.lng,
    draftGeoConfig.cityLabel,
    draftGeoConfig.country,
    draftGeoConfig.radiusKm,
    effectiveAggregatedSectors,
    effectiveProcessedPoints,
    hottestSector?.areaSector,
    selectedScenario,
    totalOptimizedCost,
    totalProjectedOrders,
    totalTraditionalCost,
  ]);

  const buildStrategyRequestPayload = useCallback((analysisMode: "financial_audit" | "investor_summary", userQuestion = "") => {
    const churnRate = zoneEconomics.length === 0
      ? 0
      : zoneEconomics.reduce((sum, zone) => sum + zone.churnRisk, 0) / zoneEconomics.length;
    const priceMultiplier = Number(Math.min(1.5, Math.max(0.85, 1 + (0.25 * (((hottestSector?.densityScore ?? 1.2) - 1.2))))).toFixed(2));
    const marginLift = Number((totalTraditionalCost - totalOptimizedCost).toFixed(2));
    const isDelhiExpansion = draftGeoConfig.cityLabel.toLowerCase().includes("delhi");
    const competitorPressure = selectedScenario === "price_war" || isDelhiExpansion;
    const competitorName = isDelhiExpansion ? "Urban Company" : "UrbanX";
    const competitorZoneLabel = isDelhiExpansion ? "Delhi NCR" : `${draftGeoConfig.cityLabel} command zone`;
    const competitorDiscountPercent = selectedScenario === "price_war" ? 20 : 14;
    const competitorResponse = isDelhiExpansion
      ? "Lead with Cloudinary-secured proof-of-work and Verified Pro trust before matching any broad market discount."
      : "Protect margin with Verified Pro proof, loyalty retention, and selective pricing instead of blanket discounts.";
    const competitorSignal = competitorPressure
      ? `[INTEL] ${competitorName} is applying ${competitorDiscountPercent}% discount pressure in ${competitorZoneLabel}. ${competitorResponse}`
      : null;

    return {
      analysisMode,
      routePath: "/admin-portal-2026/intelligence",
      zoneId: draftGeoConfig.cityId,
      zoneLabel: `${draftGeoConfig.cityLabel} ${formatRadius(draftGeoConfig.radiusKm)} command zone`,
      city: `${draftGeoConfig.cityLabel}, ${draftGeoConfig.country}`,
      cityName: draftGeoConfig.cityLabel,
      stateName: draftGeoConfig.stateName,
      stateCode: draftGeoConfig.stateCode,
      marketContext: draftGeoConfig.marketContext,
      cityTier: draftGeoConfig.cityTier,
      isExistingMarket: draftGeoConfig.isExistingMarket,
      hasHistoricalData: draftGeoConfig.hasHistoricalData,
      scenarioType: selectedScenario,
      scenario: selectedScenario,
      weatherSignal: getScenarioWeatherSignal(selectedScenario),
      radiusKm: draftGeoConfig.radiusKm,
      userQuestion,
      densityScore: hottestSector?.densityScore ?? 0,
      predictedDemand: totalProjectedOrders,
      currentOrders: Math.round(totalProjectedOrders * 0.82),
      currentWorkers: totalActiveWorkers,
      emergencyOrders: Math.round(totalProjectedOrders * 0.08),
      allocationStrategy: inferredAllocationStrategy,
      priceMultiplier,
      pricingSignal: financialOverview.totalDailyBurn > 0 ? "protect margin with targeted pricing" : "pricing stable",
      competitorPressure,
      competitorSignals: competitorSignal ? [competitorSignal] : [],
      competitorContext: competitorPressure ? {
        competitor: competitorName,
        zoneLabel: competitorZoneLabel,
        discountPercent: competitorDiscountPercent,
        response: competitorResponse,
      } : null,
      logicSignals: [
        ...(competitorSignal ? [competitorSignal] : []),
        ...getScenarioLogicSignals({
        scenario: selectedScenario,
        hottestSector: completionPayload.criticalGapSector || hottestSector?.areaSector,
        totalDailyBurn: financialOverview.totalDailyBurn,
        marginLift,
      }),
      ],
      financials: {
        acquisitionCost: Number(financialOverview.averageCac.toFixed(2)),
        churnRate: Number(churnRate.toFixed(3)),
        projectedRevenue: Number(totalProjectedRevenue.toFixed(2)),
        projectedProfit: Number((totalProjectedRevenue - totalOptimizedCost).toFixed(2)),
        platformCommission: Number((totalProjectedRevenue * 0.12).toFixed(2)),
        marginLift,
      },
      zoneEconomics: zoneEconomics.map((zone) => ({
        sector: zone.sector,
        acquisitionCost: zone.acquisitionCost,
        estimatedLtv: zone.estimatedLtv,
        contributionMargin: zone.contributionMargin,
        dailyBurn: zone.dailyBurn,
        projectedOrders: zone.projectedOrders,
        salariedRatio: zone.salariedRatio,
        burnRisk: zone.burnRisk,
        churnRisk: zone.churnRisk,
      })),
      simulationSummary: {
        totalPoints: effectiveProcessedPoints || SIMULATION_TOTAL_POINTS,
        totalProjectedOrders,
        totalTraditionalCost,
        totalOptimizedCost,
        marginLift: totalTraditionalCost - totalOptimizedCost,
        averageSalariedRatio,
        hottestSector: hottestSector?.areaSector || "NA",
        modelVersion,
        sectors: completionPayload.sectors.map((sector) => ({
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
      },
      auditData: {
        photoVerificationSuccessRate: 0,
        beforeAfterCoverage: 0,
        cloudinaryVerifiedUploads: 0,
      },
      deepDive: Boolean(userQuestion),
      providerPreference: userQuestion || selectedScenario !== "baseline" || isDelhiExpansion ? "gemini" : "groq",
    };
  }, [
    averageSalariedRatio,
    completionPayload.criticalGapSector,
    completionPayload.highestSupplyGap,
    completionPayload.sectors,
    draftGeoConfig.cityId,
    draftGeoConfig.cityLabel,
    draftGeoConfig.country,
    draftGeoConfig.radiusKm,
    effectiveProcessedPoints,
    financialOverview.averageCac,
    financialOverview.totalDailyBurn,
    hottestSector?.areaSector,
    hottestSector?.densityScore,
    inferredAllocationStrategy,
    modelVersion,
    selectedScenario,
    totalActiveWorkers,
    totalOptimizedCost,
    totalProjectedOrders,
    totalProjectedRevenue,
    totalTraditionalCost,
    zoneEconomics,
  ]);

  const requestStrategy = useCallback(async ({
    analysisMode,
    question = "",
    loadingState,
  }: {
    analysisMode: "financial_audit" | "investor_summary";
    question?: string;
    loadingState: "financial_audit" | "investor_summary" | "deep_dive";
  }) => {
    if (effectiveAggregatedSectors.length === 0) {
      toast.error("Run the simulation first so the CEO agent has real economics to analyze.");
      return;
    }

    const token = localStorage.getItem("adminToken");
    if (!token) {
      toast.error("Admin authentication is required before running the strategy agent.");
      return;
    }

    setStrategyLoading(loadingState);

    try {
      const response = await fetch(`${API}/admin/analyze-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildStrategyRequestPayload(analysisMode, question)),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || payload.detail || "Strategy request failed");
      }

      if (analysisMode === "investor_summary") {
        setInvestorSummary(payload);
        toast.success("Investor summary generated.");
      } else {
        setStrategyResponse(payload);
        toast.success(question ? "CEO deep-dive ready." : "Financial burn audit generated.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Strategy analysis failed";
      toast.error(message);
    } finally {
      setStrategyLoading(false);
    }
  }, [buildStrategyRequestPayload, effectiveAggregatedSectors.length]);

  const handleQuickMonsoonRunway = useCallback(() => {
    setCeoQuestion(FIVE_DAY_MONSOON_RUNWAY_QUESTION);
    void requestStrategy({
      analysisMode: "financial_audit",
      question: FIVE_DAY_MONSOON_RUNWAY_QUESTION,
      loadingState: "deep_dive",
    });
  }, [requestStrategy]);

  const launchSimulation = useCallback(async () => {
    if (isRunning) return;

    const token = localStorage.getItem("adminToken");
    if (!token) {
      toast.error("Admin authentication is required before launching the simulation.");
      return;
    }

    const runConfig = draftGeoConfig;

    setIsRunning(true);
    setLastRunConfig(runConfig);
    setLastRunScenario(selectedScenario);
    setPhase("generating");
    setProcessedPoints(0);
    setCompletedBatches(0);
    setSectorMap({});
    setBatchTimeline([]);
    setStatusFeed([]);
    setStrategyResponse(null);
    setInvestorSummary(null);
    setStartedAt(performance.now());
    setFinishedAt(null);
    lastReportedRunRef.current = null;
    appendFeed(
      `${scenarioMeta[selectedScenario].label} booted for ${runConfig.cityLabel}, ${runConfig.country}. Locked radius at ${formatRadius(runConfig.radiusKm)} around ${formatCoordinates(runConfig.center.lat, runConfig.center.lng)}.`,
    );

    try {
      for (let batchIndex = 0; batchIndex < SIMULATION_BATCH_COUNT; batchIndex += 1) {
        setPhase("generating");
        const bookings = generateSimulationBatch({
          batchIndex,
          geoConfig: runConfig,
          scenario: selectedScenario,
        });
        appendFeed(
          `Batch ${batchIndex + 1}/${SIMULATION_BATCH_COUNT}: generated ${bookings.length.toLocaleString("en-IN")} ${getScenarioRequestDescriptor(selectedScenario)} requests inside the active radius ring.`,
        );
        await new Promise((resolve) => window.setTimeout(resolve, 0));

        setPhase("inferencing");
        const response = await fetch(`${API}/analytics/simulation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            batch_id: batchIndex + 1,
            total_batches: SIMULATION_BATCH_COUNT,
            total_points: SIMULATION_TOTAL_POINTS,
            scenario: selectedScenario,
            bookings,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || payload.detail || "Simulation inference failed");
        }

        const batchPayload = payload as SimulationBatchResponse;
        setModelVersion(batchPayload.model_version);
        startTransition(() => {
          setCompletedBatches(batchPayload.batch_id);
          setProcessedPoints(batchPayload.batch_id * SIMULATION_BATCH_SIZE);
          setSectorMap((previous) => mergeSummaries(previous, batchPayload.sector_summaries));
          setBatchTimeline((previous) => [
            ...previous,
            {
              batch: `B${batchPayload.batch_id}`,
              processedPoints: batchPayload.batch_id * SIMULATION_BATCH_SIZE,
              processingMs: batchPayload.processing_ms,
              hotSectors: (batchPayload.cluster_distribution.high_density || 0) + (batchPayload.cluster_distribution.surge_density || 0),
            },
          ].slice(-12));
        });

        appendFeed(
          `Batch ${batchPayload.batch_id}: Random Forest closed in ${Math.round(batchPayload.processing_ms)} ms with ${batchPayload.cluster_distribution.surge_density || 0} surge sectors ${getScenarioInferenceSuffix(selectedScenario)}.`,
        );
        if (selectedScenario === "monsoon") {
          const stormSector = [...batchPayload.sector_summaries]
            .sort((left, right) => (right.burn_risk - left.burn_risk) || (right.projected_orders - left.projected_orders))[0];

          if (stormSector && stormSector.burn_risk >= 0.48) {
            appendFeed(
              `STORM ALERT: ${stormSector.area_sector} is absorbing the heaviest repair load with burn risk at ${Math.round(stormSector.burn_risk * 100)}%.`,
            );
          }
        } else if (selectedScenario === "price_war") {
          const weakMarginSector = [...batchPayload.sector_summaries]
            .sort((left, right) => (left.contribution_margin - right.contribution_margin) || (right.acquisition_cost - left.acquisition_cost))[0];

          if (weakMarginSector && weakMarginSector.acquisition_cost >= 250) {
            appendFeed(
              `COMPETITION ALERT: ${weakMarginSector.area_sector} is under the highest CAC pressure at ${formatCurrency(weakMarginSector.acquisition_cost)} with margin compression live.`,
            );
          }
        } else if (selectedScenario === "supply_crunch") {
          const criticalSector = [...batchPayload.sector_summaries]
            .sort((left, right) => right.supply_gap_ratio - left.supply_gap_ratio)[0];

          if (criticalSector && criticalSector.supply_gap_ratio >= 0.4) {
            appendFeed(
              `ALERT: Supply-Demand Gap in ${criticalSector.area_sector} is ${Math.round(criticalSector.supply_gap_ratio * 100)}%. Critical failure risk.`,
            );
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 16));
      }

      setPhase("visualizing");
      appendFeed(getScenarioVisualizationMessage(selectedScenario));
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setPhase("complete");
      setFinishedAt(performance.now());
      toast.success(getScenarioCompletionToast(selectedScenario));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Simulation failed";
      setPhase("error");
      appendFeed(`Simulation interrupted: ${message}`);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }, [appendFeed, draftGeoConfig, isRunning, selectedScenario]);

  useEffect(() => {
    if (!pendingExpansionAutoLaunch || isRunning) {
      return;
    }

    if (lastAutoExpansionKeyRef.current === pendingExpansionAutoLaunch.key) {
      return;
    }

    lastAutoExpansionKeyRef.current = pendingExpansionAutoLaunch.key;
    appendFeed(
      `[DETECTED] ENTERING NEW MARKET: ${pendingExpansionAutoLaunch.marketLabel}. CALIBRATING DENSITY PARAMETERS...`,
    );
    toast.success(
      `New market detected: ${pendingExpansionAutoLaunch.marketLabel}. Auto-launching expansion analysis.`,
      { description: `${Math.round(pendingExpansionAutoLaunch.distanceKm)} km from the previous center.` },
    );
    setPendingExpansionAutoLaunch(null);
    void launchSimulation();
  }, [appendFeed, isRunning, launchSimulation, pendingExpansionAutoLaunch]);

  const phaseCopy = useMemo(
    () => getScenarioPhaseCopy(selectedScenario),
    [selectedScenario],
  );

  return (
    <section className="rounded-[2rem] border border-indigo-200 bg-[linear-gradient(135deg,_rgba(79,70,229,0.06),_rgba(15,23,42,0.02)_44%,_rgba(14,165,233,0.05))] p-6 shadow-sm md:p-7">
      <style>{`
        @keyframes rahi-storm-sweep {
          0% { transform: translateX(-140%); opacity: 0; }
          18% { opacity: 0.42; }
          50% { opacity: 0.22; }
          100% { transform: translateX(300%); opacity: 0; }
        }
      `}</style>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700">
            <Sparkles className={cn("h-4 w-4", scenarioMeta[selectedScenario].iconTone)} />
            {scenarioMeta[selectedScenario].label}
          </div>
          <h3 className="mt-4 text-3xl font-black text-slate-950">
            Launch a 400k geo-relative workforce simulation and pressure-test the command zone before reality does.
          </h3>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            The admin can choose a city, move the command center anywhere in the world, set a radius ring from 1 to 50 km,
            and stream synthetic traffic into the Python Random Forest service without losing dashboard responsiveness.
          </p>
          <div className={cn("mt-4 inline-flex max-w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold", scenarioMeta[selectedScenario].ribbon)}>
            <Radar className={cn("h-4 w-4", selectedScenario !== "baseline" && "animate-pulse")} />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]">{scenarioMeta[selectedScenario].badge}</p>
              <p className="mt-1 max-w-2xl text-sm font-semibold">{scenarioMeta[selectedScenario].summary}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row xl:flex-col">
          <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] border border-slate-200 bg-white p-2 sm:grid-cols-4">
            {(["baseline", "monsoon", "supply_crunch", "price_war"] as const).map((scenario) => (
              <button
                key={scenario}
                type="button"
                onClick={() => setSelectedScenario(scenario)}
                disabled={isRunning}
                className={cn(
                  "rounded-[1rem] px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] transition",
                  selectedScenario === scenario
                    ? scenario === "monsoon"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : scenario === "supply_crunch"
                        ? "bg-[linear-gradient(135deg,_#fb7185,_#be123c)] text-white shadow-sm"
                      : "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100",
                  isRunning && "cursor-not-allowed opacity-70",
                )}
              >
                <span className="block">
                  {scenario === "baseline"
                    ? "Baseline"
                    : scenario === "monsoon"
                      ? "Monsoon"
                        : "Shortage"}
                </span>
                <span className="mt-1 block text-[10px] font-bold normal-case tracking-normal opacity-80">
                  {scenario === "baseline"
                    ? "Normal ops"
                    : scenario === "monsoon"
                      ? "Weather shock"
                        : "Supply -50%"}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void launchSimulation()}
            disabled={isRunning}
            className={cn(
              "inline-flex min-w-[240px] items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.18em] transition",
              isRunning
                ? "cursor-not-allowed bg-slate-300 text-slate-600"
                : selectedScenario === "monsoon"
                  ? "bg-[linear-gradient(135deg,_#f59e0b,_#ea580c)] text-slate-950 shadow-lg shadow-amber-200 hover:-translate-y-0.5 hover:brightness-105"
                  : selectedScenario === "supply_crunch"
                    ? "bg-[linear-gradient(135deg,_#fb7185,_#be123c)] text-white shadow-lg shadow-rose-200 hover:-translate-y-0.5 hover:brightness-105"
                  : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 hover:bg-indigo-500",
            )}
          >
            {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />}
            {isRunning ? "Simulation Running" : getScenarioLaunchLabel(selectedScenario)}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={effectiveAggregatedSectors.length === 0}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black uppercase tracking-[0.18em] transition",
              effectiveAggregatedSectors.length === 0
                ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
                : "border-indigo-200 bg-white text-indigo-700 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50",
            )}
          >
            <Download className="h-4 w-4" />
            Export Simulation Report
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Geo Contract</p>
              <h4 className="mt-2 text-2xl font-black text-slate-950">City, pin, and radius drive every synthetic request</h4>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                This simulation is no longer Agra-locked. The 400k generator now reacts to the exact global coordinates and radius you choose.
              </p>
            </div>
            <Globe2 className="h-6 w-6 text-indigo-500" />
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Global command search</label>
              <MarketCommandSearch
                initialValue={selectedAddress}
                radiusKm={radiusKm}
                onSelect={handleSearchSelect}
                placeholder="Search Chandigarh Sector 17, Chennai, Bengaluru..."
              />
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Search any city, market, or sector. The command pin and synthetic 400k engine will re-center around the selected result.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Preset city shortcuts</label>
              <Select value={isPresetCity ? selectedCityId : undefined} onValueChange={handleCityChange} disabled={isRunning}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white text-sm font-bold">
                  <SelectValue placeholder={isPresetCity ? "Choose a city" : `${draftGeoConfig.cityLabel}, ${draftGeoConfig.country} (custom pin)`} />
                </SelectTrigger>
                <SelectContent>
                  {GLOBAL_SIMULATION_CITIES.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.label}{city.stateCode ? `, ${city.stateCode}` : ""}, {city.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={cn(
              "rounded-[1.4rem] border px-4 py-4",
              selectedScenario === "monsoon"
                ? "border-amber-200 bg-[linear-gradient(135deg,_rgba(251,191,36,0.14),_rgba(249,115,22,0.08))]"
                : selectedScenario === "supply_crunch"
                  ? "border-rose-300 bg-[linear-gradient(135deg,_rgba(251,113,133,0.14),_rgba(190,24,93,0.08))]"
                  : selectedScenario === "price_war"
                    ? "border-amber-300 bg-[linear-gradient(135deg,_rgba(253,230,138,0.22),_rgba(245,158,11,0.12))]"
                : "border-emerald-200 bg-emerald-50",
            )}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scenario injector</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{scenarioMeta[selectedScenario].label}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {selectedScenario === "monsoon"
                      ? "Repair traffic is doubled, field supply is reduced by 40%, and burn pressure is increased so the platform can rehearse a storm response."
                      : selectedScenario === "supply_crunch"
                        ? "Active worker availability is cut by 50%, high-priority demand is doubled, and the engine is forced into amber-alert preservation mode."
                        : selectedScenario === "price_war"
                          ? "CAC pressure rises, churn assumptions are elevated, and the engine must defend trust-over-price positioning in the new city."
                      : "The engine runs with standard mobility, service demand, and acquisition assumptions for a clean profitability baseline."}
                  </p>
                </div>
                <div className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                  selectedScenario === "monsoon"
                    ? "bg-amber-200 text-amber-950"
                    : selectedScenario === "supply_crunch"
                      ? "bg-rose-200 text-rose-950"
                      : selectedScenario === "price_war"
                        ? "bg-amber-200 text-amber-950"
                    : "bg-emerald-200 text-emerald-900",
                )}>
                  {selectedScenario === "monsoon"
                    ? "Mobility: -40%"
                    : selectedScenario === "supply_crunch"
                      ? "Supply: -50%"
                      : selectedScenario === "price_war"
                        ? "CAC: +20%"
                      : "Supply normal"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Radius ring</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{formatRadius(radiusKm)}</p>
                </div>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                  1 km - 50 km
                </span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[radiusKm]}
                onValueChange={handleRadiusChange}
                disabled={isRunning}
                className="[&_[role=slider]]:border-indigo-600 [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&_[role=slider]]:shadow-indigo-100 [&_[data-orientation=horizontal]]:h-3 [&_[data-orientation=horizontal]_.bg-primary]:bg-indigo-600"
              />
              <p className="text-xs font-semibold text-slate-500">
                The translucent indigo ring on the map shows the exact analysis zone the Random Forest will stress-test.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsLocationPickerOpen(true)}
                disabled={isRunning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MapPinned className="h-4 w-4" />
                Open Command Pin Picker
              </button>
              <button
                type="button"
                onClick={handleRecenterToCity}
                disabled={isRunning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LocateFixed className="h-4 w-4" />
                Reset To City Center
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Pinned center" value={formatCoordinates(draftGeoConfig.center.lat, draftGeoConfig.center.lng)} />
              <MiniMetric label="Zone diameter" value={formatRadius(radiusKm * 2)} />
              <MiniMetric label="Preview points" value={`${previewSignals.length}`} />
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <Crosshair className="mt-0.5 h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-sm font-black text-slate-950">{selectedAddress}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Drop the pin anywhere on the map, drag the map under the center pin, or use the global geocoder. The generator will rebuild its density cloud around this center.
                  </p>
                </div>
              </div>
            </div>

            {hasPendingZoneChanges && (
              <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                The command pin or radius changed. Launch the simulation again to refresh the heatmap and workforce recommendations for this new zone.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Command map</p>
              <h4 className="mt-2 text-2xl font-black text-slate-950">{draftGeoConfig.cityLabel} analysis ring</h4>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Canvas rendering is active, so the map stays smooth while previewing dense signals and rendering sector heat circles after the 400k run.
              </p>
            </div>
            <Layers3 className="h-6 w-6 text-indigo-500" />
          </div>

          <div className="relative mt-5 h-[420px] overflow-hidden rounded-[1.5rem] border border-slate-200">
            <MapContainer
              center={[draftGeoConfig.center.lat, draftGeoConfig.center.lng]}
              zoom={11}
              preferCanvas
              scrollWheelZoom
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CARTO"
              />
              <SimulationMapViewport center={draftGeoConfig.center} radiusKm={draftGeoConfig.radiusKm} />
              <SimulationMapEvents
                onSelect={(lat, lng) => handleMapCenterSelect({
                  lat,
                  lng,
                  address: `Pinned point ${formatCoordinates(lat, lng)}`,
                })}
                onViewportSettled={handleViewportSettled}
              />
              <Circle
                center={[draftGeoConfig.center.lat, draftGeoConfig.center.lng]}
                radius={draftGeoConfig.radiusKm * 1000}
                pathOptions={{
                  color: "#4f46e5",
                  weight: 2,
                  fillColor: "#4f46e5",
                  fillOpacity: 0.08,
                }}
              />
              <CircleMarker
                center={[draftGeoConfig.center.lat, draftGeoConfig.center.lng]}
                radius={9}
                pathOptions={{
                  color: "#312e81",
                  weight: 2,
                  fillColor: "#4f46e5",
                  fillOpacity: 1,
                }}
              >
                <LeafletTooltip direction="top" offset={[0, -10]}>
                  Command pin - {draftGeoConfig.cityLabel}
                </LeafletTooltip>
              </CircleMarker>

              {effectiveAggregatedSectors.length > 0 ? (
                effectiveAggregatedSectors.map((sector) => (
                  <CircleMarker
                    key={sector.areaSector}
                    center={[sector.centroidLat, sector.centroidLng]}
                    radius={getMapMarkerRadius(sector)}
                    pathOptions={{
                      color: clusterColor[sector.densityCluster],
                      weight: 1.5,
                      fillColor: clusterColor[sector.densityCluster],
                      fillOpacity: 0.55,
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -6]}>
                      <div className="space-y-1">
                        <p className="font-black text-slate-950">{sector.areaSector}</p>
                        <p>Density: {sector.densityScore.toFixed(2)}</p>
                        <p>Projected orders: {sector.projectedOrders.toLocaleString("en-IN")}</p>
                        <p>Workers: {sector.activeWorkers}</p>
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                ))
              ) : (
                previewSignals.map((point) => (
                  <CircleMarker
                    key={point.id}
                    center={point.position}
                    radius={4}
                    pathOptions={{
                      color: getPreviewMarkerColor(point.isEmergency),
                      weight: 0.5,
                      fillColor: getPreviewMarkerColor(point.isEmergency),
                      fillOpacity: point.isEmergency ? 0.8 : 0.35,
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -4]}>
                      {point.serviceType}{point.isEmergency ? " - emergency" : " - preview"}
                    </LeafletTooltip>
                  </CircleMarker>
                ))
              )}
            </MapContainer>

            <div className="pointer-events-none absolute left-4 top-4 z-[700] w-[min(26rem,calc(100%-2rem))]">
              <div className="pointer-events-auto rounded-[1.35rem] border border-white/85 bg-white/96 p-3 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.45)] backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">HUD Search</p>
                <MarketCommandSearch
                  className="mt-2"
                  initialValue={selectedAddress}
                  radiusKm={radiusKm}
                  onSelect={handleSearchSelect}
                  placeholder="Fly to New Delhi, Chandigarh, Chennai..."
                />
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Search a market or drag the map. The fixed center pin becomes the active simulation coordinate.
                </p>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[650] -translate-x-1/2 -translate-y-1/2">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <span className="absolute h-10 w-10 rounded-full border border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_0_8px_rgba(79,70,229,0.08)]" />
                <span className="absolute h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                <span className="absolute h-px w-12 bg-indigo-500/40" />
                <span className="absolute h-12 w-px bg-indigo-500/40" />
              </div>
            </div>

            {selectedScenario !== "baseline" && (
              <>
                <div className="pointer-events-none absolute inset-x-5 top-5 z-[500] flex items-center justify-between rounded-2xl border border-amber-300/70 bg-slate-950/78 px-4 py-3 text-amber-100 shadow-lg shadow-amber-950/15 backdrop-blur">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
                      {selectedScenario === "monsoon"
                        ? "Monsoon emergency deployment"
                        : "Supply shortage amber alert"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {selectedScenario === "monsoon"
                        ? "Repair lanes are being re-ranked while worker mobility is under simulated weather stress."
                        : "Critical sectors are being re-ranked while the engine searches for the largest supply-demand gap."}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 animate-pulse">
                    amber alert
                  </span>
                </div>
                <div
                  className="pointer-events-none absolute inset-0 z-[450] opacity-75"
                  style={{
                    backgroundImage: [
                      "repeating-linear-gradient(115deg, rgba(15,23,42,0) 0px, rgba(15,23,42,0) 14px, rgba(255,255,255,0.08) 15px, rgba(255,255,255,0.02) 17px)",
                      "radial-gradient(circle at 20% 15%, rgba(251,191,36,0.16), transparent 28%)",
                      "radial-gradient(circle at 80% 35%, rgba(249,115,22,0.16), transparent 30%)",
                    ].join(", "),
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 left-[-30%] z-[460] w-[32%] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  style={{ animation: "rahi-storm-sweep 3.4s linear infinite" }}
                />
              </>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MapLegendSwatch color="#4f46e5" label="Command radius" note="Current analysis zone" />
            <MapLegendSwatch
              color={selectedScenario === "baseline" ? "#8b5cf6" : "#f59e0b"}
              label={selectedScenario === "monsoon" ? "Storm response" : selectedScenario === "supply_crunch" ? "Amber shortage" : "High / surge"}
              note={selectedScenario === "monsoon" ? "Emergency deployment lanes" : selectedScenario === "supply_crunch" ? "Critical preservation lanes" : "Worker pressure"}
            />
            <MapLegendSwatch
              color={selectedScenario === "baseline" ? "#38bdf8" : "#f97316"}
              label={selectedScenario === "monsoon" ? "Rain cloud" : selectedScenario === "supply_crunch" ? "Crunch cloud" : "Preview cloud"}
              note={selectedScenario === "monsoon" ? "Weather-stress overlay" : selectedScenario === "supply_crunch" ? "Shortage stress overlay" : "Pre-run sample points"}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Simulation progress</p>
            <p className="mt-2 text-lg font-black text-slate-950">{phaseCopy[effectivePhase]}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {effectiveProcessedPoints.toLocaleString("en-IN")} / {SIMULATION_TOTAL_POINTS.toLocaleString("en-IN")} requests processed - {throughput.toLocaleString("en-IN")} requests/sec
            </p>
          </div>
          <div className="grid gap-2 text-right text-sm font-black text-slate-600">
            <span>Model: {modelVersion}</span>
            <span>Batches closed: {effectiveCompletedBatches}/{SIMULATION_BATCH_COUNT}</span>
            <span>Elapsed: {elapsedSeconds.toFixed(1)}s</span>
          </div>
        </div>

        <Progress value={progressValue} className="mt-5 h-4 bg-slate-100 [&>div]:bg-indigo-600" />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { key: "generating", label: "1. Geo generation", icon: Sparkles },
            { key: "inferencing", label: "2. AI inference", icon: BrainCircuit },
            { key: "visualizing", label: "3. Map rendering", icon: Radar },
          ].map((item) => {
            const status = phaseStatus(effectivePhase, item.key as "generating" | "inferencing" | "visualizing");
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className={cn(
                  "rounded-2xl border px-4 py-4 transition",
                  status === "active" && "border-indigo-300 bg-indigo-50",
                  status === "complete" && "border-emerald-300 bg-emerald-50",
                  status === "idle" && "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-5 w-5", status === "complete" ? "text-emerald-600" : status === "active" ? "text-indigo-600" : "text-slate-400")} />
                    <p className="text-sm font-black text-slate-900">{item.label}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                    status === "complete" && "bg-emerald-100 text-emerald-700",
                    status === "active" && "bg-indigo-100 text-indigo-700",
                    status === "idle" && "bg-slate-200 text-slate-500",
                  )}>
                    {status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <SimulationMetricCard label="Projected orders" value={totalProjectedOrders.toLocaleString("en-IN")} hint="Random Forest demand output" icon={Target} tone="indigo" />
        <SimulationMetricCard label="Traditional burn" value={formatCurrency(totalTraditionalCost)} hint="Salary-heavy model cost" icon={TrendingDown} tone="rose" />
        <SimulationMetricCard label="Optimized cost" value={formatCurrency(totalOptimizedCost)} hint="Density-balanced ops cost" icon={TrendingUp} tone="emerald" />
        <SimulationMetricCard label="Margin lift" value={formatCurrency(totalTraditionalCost - totalOptimizedCost)} hint="Savings unlocked by RAHI logic" icon={Zap} tone="sky" />
      </div>

      <Tabs defaultValue="heatmap" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl bg-slate-950 p-1 text-white">
          <TabsTrigger value="heatmap" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Density Heatmap</TabsTrigger>
          <TabsTrigger value="financial" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Financial Clarity</TabsTrigger>
          <TabsTrigger value="economics" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Economics</TabsTrigger>
          <TabsTrigger value="stress" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Stress Test</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Top recommendations</p>
                <h4 className="mt-2 text-2xl font-black text-slate-950">Workforce shifts the model wants in this radius</h4>
              </div>
              <Radar className="h-6 w-6 text-indigo-500" />
            </div>

            <div className="mt-5 space-y-3">
              {recommendationRows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                  Previewing the command ring only. Launch the simulation to get zone-level workforce recommendations.
                </div>
              ) : recommendationRows.slice(0, 5).map((sector) => (
                <div key={sector.areaSector} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{sector.areaSector}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{clusterLabel[sector.densityCluster]} - Density {sector.densityScore.toFixed(2)}</p>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-700">
                      {Math.round(sector.salariedRatio)}% salaried
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Projected orders" value={sector.projectedOrders.toLocaleString("en-IN")} />
                    <MiniMetric label="Workers to shift" value={`${sector.recommendedShift}`} />
                    <MiniMetric label="Confidence" value={`${Math.round(sector.confidenceScore * 100)}%`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">LLM-ready density buckets</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">Geo summary prepared for strategy analysis</h4>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <DensityBucketCard tone="rose" label="High" bucket={strategySummary.densityBuckets.high} />
              <DensityBucketCard tone="indigo" label="Medium" bucket={strategySummary.densityBuckets.medium} />
              <DensityBucketCard tone="sky" label="Low" bucket={strategySummary.densityBuckets.low} />
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Future /api/admin/analyze-strategy payload</p>
                  <p className="mt-2 text-sm font-bold text-slate-200">This object is already grouped for the Gemini and Groq strategy layer.</p>
                </div>
                <BrainCircuit className="h-5 w-5 text-emerald-300" />
              </div>
              <pre className="mt-4 max-h-[300px] overflow-auto rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[11px] font-semibold text-slate-200">
{JSON.stringify(strategySummary, null, 2)}
              </pre>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-emerald-200 bg-[linear-gradient(135deg,_rgba(16,185,129,0.12),_rgba(15,23,42,0.03))] p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Unit Economic Survival</p>
                  <h4 className="mt-2 text-2xl font-black text-slate-950">Cost-cutting is the primary investor signal in this command ring.</h4>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                    RAHI is currently stripping out flat staffing waste first, then protecting worker retention only where the supply chain would otherwise fracture.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 text-right shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Cost savings live</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{formatCurrency(totalCostSavings)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {formatPercent(costSavingsRate)} lower than the traditional staffing model
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SimulationMetricCard
                label="Daily burn"
                value={formatCurrency(financialOverview.totalDailyBurn)}
                hint="Cash pressure across the active command zone"
                icon={TrendingDown}
                tone="rose"
              />
              <SimulationMetricCard
                label="Cost savings"
                value={formatCurrency(totalCostSavings)}
                hint="Traditional model cost removed by density optimization"
                icon={Zap}
                tone="emerald"
              />
              <SimulationMetricCard
                label="Contribution"
                value={formatCurrency(financialOverview.totalContributionMargin)}
                hint="Projected revenue minus optimized operating cost"
                icon={Target}
                tone="indigo"
              />
              <SimulationMetricCard
                label="Average CAC"
                value={formatCurrency(financialOverview.averageCac)}
                hint="Acquisition cost per zone"
                icon={HandCoins}
                tone="sky"
              />
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Unit economics audit</p>
                  <h4 className="mt-2 text-2xl font-black text-slate-950">CAC vs LTV and burn pressure by zone</h4>
                </div>
                <button
                  type="button"
                  onClick={() => void requestStrategy({
                    analysisMode: "financial_audit",
                    loadingState: "financial_audit",
                  })}
                  disabled={strategyLoading !== false || effectiveAggregatedSectors.length === 0}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition",
                    strategyLoading !== false || effectiveAggregatedSectors.length === 0
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-indigo-600 text-white hover:-translate-y-0.5 hover:bg-indigo-500",
                  )}
                >
                  {strategyLoading === "financial_audit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                  Run Burn Auditor
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.7fr_repeat(5,1fr)] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <span>Zone</span>
                  <span>CAC</span>
                  <span>LTV</span>
                  <span>LTV/CAC</span>
                  <span>Contribution</span>
                  <span>Daily burn</span>
                </div>
                <div className="divide-y divide-slate-100 bg-white">
                  {zoneEconomics.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-semibold text-slate-500">
                      Launch the simulation to populate the financial audit table.
                    </div>
                  ) : zoneEconomics.slice(0, 8).map((zone) => (
                    <div key={zone.sector} className="grid grid-cols-[1.7fr_repeat(5,1fr)] items-center px-4 py-3 text-sm font-semibold text-slate-700">
                      <div>
                        <p className="font-black text-slate-950">{zone.sector}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {formatPercent(zone.salariedRatio)} salaried · burn risk {zone.burnRisk.toFixed(2)}
                        </p>
                      </div>
                      <span>{formatCurrency(zone.acquisitionCost)}</span>
                      <span>{formatCurrency(zone.estimatedLtv)}</span>
                      <span className={cn("font-black", zone.cacToLtvRatio >= 3 ? "text-emerald-700" : "text-amber-700")}>
                        {zone.cacToLtvRatio.toFixed(2)}x
                      </span>
                      <span className={cn("font-black", zone.contributionMargin >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {formatCurrency(zone.contributionMargin)}
                      </span>
                      <span className={cn("font-black", zone.dailyBurn > 0 ? "text-rose-700" : "text-emerald-700")}>
                        {formatCurrency(zone.dailyBurn)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Weakest zone</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{financialOverview.weakestZone?.sector || "NA"}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Highest daily burn: {formatCurrency(financialOverview.weakestZone?.dailyBurn || 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Best zone</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{financialOverview.bestZone?.sector || "NA"}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Best contribution margin: {formatCurrency(financialOverview.bestZone?.contributionMargin || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Investor summary</p>
                  <h4 className="mt-2 text-2xl font-black text-slate-950">Pitch-deck bullets from the strategy agent</h4>
                </div>
                <button
                  type="button"
                  onClick={() => void requestStrategy({
                    analysisMode: "investor_summary",
                    loadingState: "investor_summary",
                  })}
                  disabled={strategyLoading !== false || effectiveAggregatedSectors.length === 0}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition",
                    strategyLoading !== false || effectiveAggregatedSectors.length === 0
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:-translate-y-0.5 hover:bg-indigo-100",
                  )}
                >
                  {strategyLoading === "investor_summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Generate Investor Summary
                </button>
              </div>

              {investorSummary ? (
                <StrategyBriefCard
                  title={investorSummary.signal}
                  reasoning={investorSummary.reasoning}
                  procedures={investorSummary.procedures}
                  provider={investorSummary.provider}
                  model={investorSummary.model}
                  fallback={investorSummary.fallback}
                  className="mt-5"
                />
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                  Generate an investor summary to condense the live zone economics into three pitch-ready bullets.
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Chat with CEO Agent</p>
                  <h4 className="mt-2 text-2xl font-black">Ask the deep-dive question</h4>
                </div>
                <MessageSquareText className="h-6 w-6 text-emerald-300" />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Quick action</span>
                <button
                  type="button"
                  onClick={handleQuickMonsoonRunway}
                  disabled={strategyLoading !== false || effectiveAggregatedSectors.length === 0}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                    strategyLoading !== false || effectiveAggregatedSectors.length === 0
                      ? "cursor-not-allowed border-white/10 bg-white/[0.05] text-slate-500"
                      : "border-emerald-300/40 bg-emerald-300/12 text-emerald-100 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-300/18",
                  )}
                >
                  Analyze 5-Day Monsoon Runway
                </button>
              </div>

              <Textarea
                value={ceoQuestion}
                onChange={(event) => setCeoQuestion(event.target.value)}
                placeholder="Why are we losing money in the weakest zone?"
                className="mt-5 min-h-[120px] border-white/10 bg-white/[0.05] text-sm font-semibold text-white placeholder:text-slate-500"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "How does our contribution margin look if this rain continues for 48 hours?",
                  "Which sector should receive emergency salaried workers first?",
                  "Where should we activate tactical surge pricing without damaging trust?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setCeoQuestion(prompt)}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-emerald-300/50 hover:bg-white/[0.08] hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void requestStrategy({
                    analysisMode: "financial_audit",
                    question: ceoQuestion.trim(),
                    loadingState: "deep_dive",
                  })}
                  disabled={strategyLoading !== false || effectiveAggregatedSectors.length === 0 || ceoQuestion.trim().length === 0}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition",
                    strategyLoading !== false || effectiveAggregatedSectors.length === 0 || ceoQuestion.trim().length === 0
                      ? "cursor-not-allowed bg-white/10 text-slate-500"
                      : "bg-emerald-400 text-slate-950 hover:-translate-y-0.5 hover:bg-emerald-300",
                  )}
                >
                  {strategyLoading === "deep_dive" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  Ask CEO Agent
                </button>
              </div>

              {strategyResponse ? (
                <StrategyBriefCard
                  title={strategyResponse.signal}
                  reasoning={strategyResponse.reasoning}
                  procedures={strategyResponse.procedures}
                  provider={strategyResponse.provider}
                  model={strategyResponse.model}
                  fallback={strategyResponse.fallback}
                  className="mt-5 border-white/10 bg-white/[0.05] text-white"
                  inverse
                />
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-slate-300">
                  Ask about burn traps, CAC pressure, or how the current workforce mix should change.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="economics" className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Chart A</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">Traditional model cost</h4>
            <p className="mt-2 text-sm font-semibold text-slate-500">Low-density zones burn cash when the same staffing model is forced everywhere.</p>
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={economicsData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fontWeight: 700 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="traditionalCost" fill="#f97316" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Chart B</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">RAHI density-optimized model</h4>
            <p className="mt-2 text-sm font-semibold text-slate-500">The Random Forest pushes salaried coverage only where density and demand justify it.</p>
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={economicsData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fontWeight: 700 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="optimizedCost" fill="#4f46e5" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stress" className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Stress test view</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">Real-time batch processing</h4>
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={effectiveBatchTimeline}>
                  <CartesianGrid stroke="#dbe4ef" strokeDasharray="3 3" />
                  <XAxis dataKey="batch" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <RechartsTooltip content={<StressTooltip />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="processingMs" name="Inference ms" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="hotSectors" name="Hot sectors" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">LOGISTICS_CORE_AUDIT [STRICT_PERSISTENCE]</p>
                <h4 className="mt-2 text-2xl font-black">Every simulation decision is being persisted.</h4>
              </div>
              <Activity className="h-6 w-6 text-emerald-300" />
            </div>

            <div className="mt-5 space-y-3">
              {effectiveStatusFeed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-slate-300">
                  Launch the simulation to start the real-time geo command feed.
                </div>
              ) : effectiveStatusFeed.map((entry) => (
                <div key={entry} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-slate-200">
                  {entry}
                </div>
              ))}
            </div>

            {hottestSector && (
              <div className={cn(
                "mt-5 rounded-[1.4rem] border p-4",
                selectedScenario === "monsoon"
                  ? "border-amber-400/25 bg-amber-400/10"
                  : selectedScenario === "supply_crunch"
                    ? "border-rose-400/25 bg-rose-400/10"
                      : "border-emerald-400/25 bg-emerald-400/10",
              )}>
                <p className={cn(
                  "text-xs font-black uppercase tracking-[0.18em]",
                  selectedScenario === "monsoon"
                    ? "text-amber-200"
                    : selectedScenario === "supply_crunch"
                      ? "text-rose-200"
                        : "text-emerald-200",
                )}>
                  {selectedScenario === "monsoon"
                    ? "Storm command moment"
                    : selectedScenario === "supply_crunch"
                      ? "Service preservation moment"
                        : "Investor moment"}
                </p>
                <p className="mt-2 text-base font-black text-white">
                  {hottestSector.areaSector} surfaced as the hottest cluster with {Math.round(hottestSector.salariedRatio)}% salaried coverage recommended.
                </p>
                <p className={cn(
                  "mt-2 text-sm font-semibold",
                  selectedScenario === "monsoon"
                    ? "text-amber-100"
                    : selectedScenario === "supply_crunch"
                      ? "text-rose-100"
                        : "text-emerald-100",
                )}>
                  {selectedScenario === "monsoon"
                    ? `Monsoon response keeps this zone live with daily burn at ${formatCurrency(hottestSector.dailyBurn)} while the model concentrates core labor in urgent repair lanes.`
                    : selectedScenario === "supply_crunch"
                      ? `Supply shortage logic is preserving this zone with a ${Math.round(hottestSector.supplyGapRatio * 100)}% gap and a recommended shift of ${hottestSector.recommendedShift} workers.`
                    : `Estimated margin lift in this zone: ${formatCurrency(hottestSector.traditionalCost - hottestSector.optimizedCost)}.`}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SimulationStoryCard
          title="Center-relative generation"
          body="The 400k synthetic requests now anchor themselves to the exact command pin and radius ring you select, not a fixed Agra spreadsheet."
          icon={MapPinned}
        />
        <SimulationStoryCard
          title="Python-led inference"
          body="Each batch is forwarded to the FastAPI Random Forest service, where density clusters and workforce ratios are predicted before the next batch begins."
          icon={Target}
        />
        <SimulationStoryCard
          title="LLM-ready by design"
          body="The output is already grouped into density buckets, so the next Gemini and Groq phase can reason over strategy instead of 400k raw coordinates."
          icon={BrainCircuit}
        />
      </div>

      <Dialog open={isLocationPickerOpen} onOpenChange={setIsLocationPickerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose The Global Command Pin</DialogTitle>
            <DialogDescription>
              Search for any city or click anywhere on the picker map to move the simulation center.
            </DialogDescription>
          </DialogHeader>
          <LocationPicker
            initialLocation={{
              lat: draftGeoConfig.center.lat,
              lng: draftGeoConfig.center.lng,
              address: selectedAddress,
            }}
            onLocationSelect={(location) => {
              handleMapCenterSelect(location);
              setIsLocationPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SimulationMapViewport({
  center,
  radiusKm,
}: {
  center: { lat: number; lng: number };
  radiusKm: number;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = getRadiusBounds(center, radiusKm);
    map.fitBounds(bounds, { padding: [26, 26], animate: true });
  }, [center, map, radiusKm]);

  return null;
}

function SimulationMapEvents({
  onSelect,
  onViewportSettled,
}: {
  onSelect: (lat: number, lng: number) => void;
  onViewportSettled: (center: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (event) => {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
    moveend: (event) => {
      const center = event.target.getCenter();
      onViewportSettled({
        lat: center.lat,
        lng: center.lng,
      });
    },
  });

  return null;
}

function SimulationMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  tone: "indigo" | "emerald" | "rose" | "sky";
}) {
  const toneMap = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  } as const;

  return (
    <div className={cn("rounded-[1.4rem] border p-4 shadow-sm", toneMap[tone])}>
      <Icon className="mb-4 h-5 w-5" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{hint}</p>
    </div>
  );
}

function SimulationStoryCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="mb-4 h-5 w-5 text-indigo-500" />
      <h4 className="text-lg font-black text-slate-950">{title}</h4>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function MapLegendSwatch({
  color,
  label,
  note,
}: {
  color: string;
  label: string;
  note: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{note}</p>
      </div>
    </div>
  );
}

function DensityBucketCard({
  tone,
  label,
  bucket,
}: {
  tone: "rose" | "indigo" | "sky";
  label: string;
  bucket: {
    sectors: number;
    projectedOrders: number;
    activeWorkers: number;
  };
}) {
  const toneMap = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  } as const;

  return (
    <div className={cn("rounded-2xl border p-4", toneMap[tone])}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{bucket.sectors}</p>
      <p className="mt-3 text-xs font-semibold text-slate-600">
        {bucket.projectedOrders.toLocaleString("en-IN")} projected orders across {bucket.activeWorkers.toLocaleString("en-IN")} workers
      </p>
    </div>
  );
}

function StrategyBriefCard({
  title,
  reasoning,
  procedures,
  provider,
  model,
  fallback,
  className,
  inverse = false,
}: {
  title: string;
  reasoning: string;
  procedures: string[];
  provider?: string;
  model?: string;
  fallback?: boolean;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-[1.4rem] border p-4",
      inverse ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50",
      className,
    )}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]", inverse ? "bg-emerald-400/15 text-emerald-200" : "bg-indigo-100 text-indigo-700")}>
          {fallback ? "Rule Engine" : provider || "Strategy Agent"}
        </span>
        {model && (
          <span className={cn("text-[10px] font-black uppercase tracking-[0.18em]", inverse ? "text-slate-400" : "text-slate-400")}>
            {model}
          </span>
        )}
      </div>
      <h5 className={cn("mt-3 text-lg font-black", inverse ? "text-white" : "text-slate-950")}>{title}</h5>
      <p className={cn("mt-3 text-sm font-semibold leading-6", inverse ? "text-slate-300" : "text-slate-600")}>{reasoning}</p>
      <div className="mt-4 space-y-2">
        {procedures.map((procedure) => (
          <div
            key={procedure}
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              inverse ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-slate-200 bg-white text-slate-700",
            )}
          >
            {procedure}
          </div>
        ))}
      </div>
    </div>
  );
}

function StressTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 space-y-1 text-sm font-bold">
        <p className="text-slate-900">Inference: {payload[0]?.value} ms</p>
        <p className="text-orange-600">Hot sectors: {payload[1]?.value}</p>
      </div>
    </div>
  );
}
