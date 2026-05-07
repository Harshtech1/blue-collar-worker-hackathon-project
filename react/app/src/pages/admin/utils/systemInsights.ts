import {
  buildSimulationGeoConfig,
  GLOBAL_SIMULATION_CITIES,
  sectorSeeds,
} from "@/utils/simulationData";
import { ADMIN_OBSERVABILITY_ISSUES, humanizeIssueCode } from "../adminSignals";
import type {
  AdminDashboardStats,
  AdminInvestorAnalyticsSummary,
  AdminSystemHealthSnapshot,
} from "../adminShellContext";

export type StrategyChipId =
  | "local_ops"
  | "financial_stability"
  | "expansion_posture";

export type StrategyChipTone = "navy" | "emerald" | "sky" | "amber";

export interface StrategyChip {
  id: StrategyChipId;
  title: string;
  insight: string;
  tone: StrategyChipTone;
  actionLabel: string;
  copilotQuery: string;
}

export interface SystemInsightsSummary {
  marketMetrics: {
    city: string;
    zoneLabel: string;
    recommendedExpansionCity: string;
    density: number;
    surgeZones: string[];
    cityTier: "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";
    isExistingMarket: boolean;
  };
  unitEconomics: {
    yieldPerJob: number;
    cacProjected: number;
    paybackDays: number;
  };
  systemHealth: {
    criticalBugs: number;
    primaryCriticalBugCode: string | null;
    uptime: number;
    llmMode: "ready" | "fallback";
  };
}

export interface BuildSystemInsightsSummaryInput {
  routeZoneId: string;
  zoneLabel: string;
  stats: AdminDashboardStats;
  activeWorkerRate: number;
  averageTicket: number;
  globalUptime: string;
  llmMode: "ready" | "fallback";
  healthSnapshot: AdminSystemHealthSnapshot | null;
  investorSummary: AdminInvestorAnalyticsSummary | null;
}

const AGRA_CITY_ID = "agra";
const AGRA_CITY_NAME = "agra";
const STRATEGIC_MARGIN_PERCENT = 14.2;
const STRATEGIC_EXPANSION_CITIES = new Set(["chandigarh", "new delhi"]);
const RUPEE_SYMBOL = "₹";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundTo = (value: number, digits = 2) => Number(value.toFixed(digits));

const parsePercent = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveMarketIdentity = (routeZoneId: string, zoneLabel: string) => {
  const matchedCity = GLOBAL_SIMULATION_CITIES.find((city) => city.id === routeZoneId) || null;
  const matchedSector = sectorSeeds.find((sector) => sector.id === routeZoneId) || null;
  const geoConfig = buildSimulationGeoConfig({
    cityId: matchedCity?.id || AGRA_CITY_ID,
    radiusKm: matchedCity ? 14 : 10,
  });

  return {
    matchedCity,
    matchedSector,
    city: matchedCity?.label || matchedSector?.city || geoConfig.cityLabel || "Agra",
    zone: zoneLabel || matchedSector?.label || matchedCity?.label || geoConfig.cityLabel || "Agra",
    geoConfig,
  };
};

const deriveYieldPerJob = (
  investorSummary: AdminInvestorAnalyticsSummary | null,
  averageTicket: number,
) => {
  const mappedYield = Number(investorSummary?.unitEconomics?.netProfitPerJob || 0);
  if (mappedYield > 0) {
    return Math.round(mappedYield);
  }

  return Math.max(220, Math.round((averageTicket * 0.24) - 110));
};

const deriveProjectedCac = (
  isNonAgraMarket: boolean,
  investorSummary: AdminInvestorAnalyticsSummary | null,
  yieldPerJob: number,
) => {
  if (isNonAgraMarket) {
    return 150;
  }

  const mappedCac = Number(investorSummary?.unitEconomics?.marketingCacPerJob || 0);
  if (mappedCac > 0) {
    return Math.round(mappedCac);
  }

  return Math.max(105, Math.round(yieldPerJob * 0.44));
};

const derivePaybackDays = (
  isNonAgraMarket: boolean,
  projectedCac: number,
  investorSummary: AdminInvestorAnalyticsSummary | null,
  averageTicket: number,
) => {
  if (isNonAgraMarket) {
    return 18;
  }

  const commissionPerJob = Number(
    investorSummary?.unitEconomics?.commissionPerJob
    || Math.max(42, averageTicket * 0.18),
  );
  const averageDailyCommissionPerWorker = Math.max(12, Math.round(commissionPerJob * 0.52));
  return clamp(Math.round(projectedCac / averageDailyCommissionPerWorker), 9, 24);
};

const buildExpansionCity = (city: string, isExistingMarket: boolean) => {
  if (!isExistingMarket) {
    return city;
  }

  return "Chandigarh";
};

const resolveExpansionTargetCity = (summary: SystemInsightsSummary) => {
  const currentCity = summary.marketMetrics.city.trim();
  const recommendedCity = summary.marketMetrics.recommendedExpansionCity.trim();

  if (STRATEGIC_EXPANSION_CITIES.has(currentCity.toLowerCase())) {
    return currentCity;
  }

  if (STRATEGIC_EXPANSION_CITIES.has(recommendedCity.toLowerCase())) {
    return recommendedCity;
  }

  return recommendedCity || currentCity;
};

const buildSurgeZones = (city: string, zoneLabel: string, routeZoneId: string) => {
  const sector = sectorSeeds.find((entry) => entry.id === routeZoneId);
  if (sector?.label) {
    return [sector.label];
  }

  const sameCitySectors = sectorSeeds
    .filter((entry) => entry.city.toLowerCase() === city.toLowerCase())
    .sort((left, right) => right.demandWeight - left.demandWeight)
    .slice(0, 2)
    .map((entry) => entry.label);

  if (sameCitySectors.length > 0) {
    return sameCitySectors;
  }

  return [zoneLabel];
};

const deriveCriticalIssueCodes = ({
  llmMode,
  healthSnapshot,
}: {
  stats: AdminDashboardStats;
  activeWorkerRate: number;
  llmMode: "ready" | "fallback";
  healthSnapshot: AdminSystemHealthSnapshot | null;
  investorSummary: AdminInvestorAnalyticsSummary | null;
}) => {
  const seededCriticals = ADMIN_OBSERVABILITY_ISSUES
    .filter((issue) => issue.severity === "critical")
    .map((issue) => issue.code);

  if (llmMode === "fallback" && !seededCriticals.includes("LLM_FALLBACK")) {
    seededCriticals.push("LLM_FALLBACK");
  }

  if (healthSnapshot?.media?.secureUploadsReady === false && !seededCriticals.includes("UPLOAD_LATENCY")) {
    seededCriticals.push("UPLOAD_LATENCY");
  }

  return seededCriticals;
};

export const buildSystemInsightsSummary = ({
  routeZoneId,
  zoneLabel,
  stats,
  activeWorkerRate,
  averageTicket,
  globalUptime,
  llmMode,
  healthSnapshot,
  investorSummary,
}: BuildSystemInsightsSummaryInput): SystemInsightsSummary => {
  const { city, zone, geoConfig } = resolveMarketIdentity(routeZoneId, zoneLabel);
  const isNonAgraMarket = city.trim().toLowerCase() !== AGRA_CITY_NAME;
  const availableWorkers = Math.max(1, Math.round(stats.totalWorkers * (Math.max(activeWorkerRate, 1) / 100)));
  const density = roundTo(clamp(stats.activeBookings / availableWorkers, 0.35, 2.8));
  const yieldPerJob = deriveYieldPerJob(investorSummary, averageTicket);
  const cacProjected = deriveProjectedCac(isNonAgraMarket, investorSummary, yieldPerJob);
  const paybackDays = derivePaybackDays(isNonAgraMarket, cacProjected, investorSummary, averageTicket);
  const uptime = parsePercent(globalUptime) ?? (healthSnapshot?.status === "ok" ? 99.9 : 99.2);
  const criticalIssueCodes = deriveCriticalIssueCodes({
    stats,
    activeWorkerRate,
    llmMode,
    healthSnapshot,
    investorSummary,
  });

  return {
    marketMetrics: {
      city,
      zoneLabel: zone,
      recommendedExpansionCity: buildExpansionCity(city, geoConfig.isExistingMarket),
      density,
      surgeZones: buildSurgeZones(city, zone, routeZoneId),
      cityTier: geoConfig.cityTier,
      isExistingMarket: geoConfig.isExistingMarket,
    },
    unitEconomics: {
      yieldPerJob,
      cacProjected,
      paybackDays,
    },
    systemHealth: {
      criticalBugs: criticalIssueCodes.length,
      primaryCriticalBugCode: criticalIssueCodes[0] || null,
      uptime: roundTo(uptime, 1),
      llmMode,
    },
  };
};

export const buildFallbackStrategyChips = (summary: SystemInsightsSummary): StrategyChip[] => {
  const city = String(summary.marketMetrics.city || "Agra");
  const criticalBugs = Math.round(Number(summary.systemHealth.criticalBugs || 0));
  const primaryBugLabel = humanizeIssueCode(summary.systemHealth.primaryCriticalBugCode || "critical_bug");
  const expansionCity = resolveExpansionTargetCity(summary);
  const shouldPushShadowLaunch = STRATEGIC_EXPANSION_CITIES.has(expansionCity.trim().toLowerCase());

  return [
    {
      id: "local_ops",
      title: "Expansion",
      tone: shouldPushShadowLaunch ? "sky" : "navy",
      actionLabel: "Market Entry Brief",
      copilotQuery: `Prepare the Market Entry Brief for ${expansionCity}. Focus on Shadow Launch Recommended, projected CAC of ${RUPEE_SYMBOL}150, payback in 18 days, freelancer-first supply coverage, trust rails, and the first 14-day rollout plan.`,
      insight: shouldPushShadowLaunch
        ? `Shadow Launch Recommended | Projected CAC: ${RUPEE_SYMBOL}150 | Payback: 18 Days.`
        : `Expansion watchlist is active for ${expansionCity}. Protect the Agra pilot until CAC and payback stay inside launch guardrails.`,
    },
    {
      id: "financial_stability",
      title: "Risk",
      tone: criticalBugs > 0 ? "amber" : "navy",
      actionLabel: "Analyze RCA",
      copilotQuery: criticalBugs > 0
        ? `Operational Risk detected in ${city}. Read the STRICT_PERSISTENCE audit trail, explain why ${primaryBugLabel} is active, and recommend the next RCA step.`
        : `Read the STRICT_PERSISTENCE audit trail and confirm whether any critical operational risk is active for ${city}.`,
      insight: criticalBugs > 0
        ? `Operational Risk: ${primaryBugLabel} detected. Analyze RCA?`
        : "Operational Risk: No critical bug detected. Keep the verified rails under watch.",
    },
    {
      id: "expansion_posture",
      title: "Finance",
      tone: "emerald",
      actionLabel: "Open Finance",
      copilotQuery: `Show me the money for ${city} and walk me through unit economics before taking me to finance.`,
      insight: `Yield Update: Current Margin at ${STRATEGIC_MARGIN_PERCENT.toFixed(1)}%. Optimization available.`,
    },
  ];
};

export const normalizeStrategyChips = (
  candidate: unknown,
  summary: SystemInsightsSummary,
): StrategyChip[] => {
  const fallback = buildFallbackStrategyChips(summary);
  const source = Array.isArray(candidate) ? candidate : [];
  const sourceMap = new Map(
    source
      .filter((entry): entry is Partial<StrategyChip> & { id: StrategyChipId } => (
        typeof entry === "object"
        && entry !== null
        && typeof (entry as { id?: unknown }).id === "string"
      ))
      .map((entry) => [entry.id, entry]),
  );

  return fallback.map((seed) => {
    const remote = sourceMap.get(seed.id);
    return {
      ...seed,
      tone: remote?.tone === "navy" || remote?.tone === "emerald" || remote?.tone === "sky" || remote?.tone === "amber"
        ? remote.tone
        : seed.tone,
    };
  });
};
