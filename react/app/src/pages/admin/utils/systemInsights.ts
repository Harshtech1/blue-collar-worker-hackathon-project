import {
  buildSimulationGeoConfig,
  GLOBAL_SIMULATION_CITIES,
  sectorSeeds,
} from "@/utils/simulationData";
import {
  ADMIN_ISSUE_SEVERITY_WEIGHT,
  humanizeIssueCode,
  type ObservabilityIssueCode,
} from "../adminSignals";
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundTo = (value: number, digits = 2) => Number(value.toFixed(digits));

const sanitizeInsightText = (value: string) => (
  value
    .replaceAll("ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹", "₹")
    .replaceAll("Ã¢â€šÂ¹", "₹")
    .replaceAll("â‚¹", "₹")
);

const parsePercent = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveMarketIdentity = (routeZoneId: string, zoneLabel: string) => {
  const matchedCity = GLOBAL_SIMULATION_CITIES.find((city) => city.id === routeZoneId) || null;
  const matchedSector = sectorSeeds.find((sector) => sector.id === routeZoneId) || null;
  const inferredCityId = matchedCity?.id
    || GLOBAL_SIMULATION_CITIES.find((city) => (
      matchedSector?.city && city.label.toLowerCase() === matchedSector.city.toLowerCase()
    ))?.id
    || AGRA_CITY_ID;
  const geoConfig = buildSimulationGeoConfig({
    cityId: inferredCityId,
    radiusKm: matchedCity ? 14 : 10,
  });

  return {
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
  const dailyCommissionPerWorker = Math.max(12, Math.round(commissionPerJob * 0.52));
  return clamp(Math.round(projectedCac / dailyCommissionPerWorker), 9, 24);
};

const buildExpansionCity = (city: string, isExistingMarket: boolean) => {
  const normalizedCity = city.trim().toLowerCase();
  if (normalizedCity === "new delhi" || normalizedCity === "chandigarh") {
    return city.trim();
  }

  return isExistingMarket ? "Chandigarh" : "New Delhi";
};

const buildSurgeZones = (city: string, zoneLabel: string, routeZoneId: string) => {
  const directSector = sectorSeeds.find((sector) => sector.id === routeZoneId);
  if (directSector?.label) {
    return [directSector.label];
  }

  const matchingSectors = sectorSeeds
    .filter((sector) => sector.city.toLowerCase() === city.toLowerCase())
    .sort((left, right) => right.demandWeight - left.demandWeight)
    .slice(0, 2)
    .map((sector) => sector.label);

  if (matchingSectors.length > 0) {
    return matchingSectors;
  }

  return [zoneLabel || city];
};

const deriveCriticalIssueCodes = ({
  stats,
  activeWorkerRate,
  llmMode,
  healthSnapshot,
  investorSummary,
}: Pick<BuildSystemInsightsSummaryInput, "stats" | "activeWorkerRate" | "llmMode" | "healthSnapshot" | "investorSummary">) => {
  const issueSet = new Set<ObservabilityIssueCode>();
  const completionRate = Number(investorSummary?.completionRate || 0);
  const cancellationRate = Number(investorSummary?.cancellationRate || 0);
  const pendingRatio = stats.totalBookings > 0 ? stats.pendingBookings / stats.totalBookings : 0;

  if (healthSnapshot?.status && healthSnapshot.status !== "ok") {
    issueSet.add("PAYMENT_FAILURE");
  }

  if (pendingRatio >= 0.28 || cancellationRate >= 12) {
    issueSet.add("BOOKING_ERROR");
  }

  if (completionRate > 0 && completionRate <= 78) {
    issueSet.add("OTP_TIMEOUT");
  }

  if (healthSnapshot?.media?.secureUploadsReady === false) {
    issueSet.add("PROOF_VERIFICATION_REJECTED");
  }

  if (activeWorkerRate < 42) {
    issueSet.add("ASSIGNMENT_TIMEOUT");
  }

  if (llmMode === "fallback") {
    issueSet.add("LLM_FALLBACK");
  }

  return Array.from(issueSet).sort((left, right) => (
    (ADMIN_ISSUE_SEVERITY_WEIGHT[right] || 0) - (ADMIN_ISSUE_SEVERITY_WEIGHT[left] || 0)
  ));
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
  const criticalBugCount = criticalIssueCodes.filter((code) => (
    ADMIN_ISSUE_SEVERITY_WEIGHT[code] >= ADMIN_ISSUE_SEVERITY_WEIGHT.ASSIGNMENT_TIMEOUT
  )).length;

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
      criticalBugs: criticalBugCount,
      primaryCriticalBugCode: criticalIssueCodes[0] || null,
      uptime: roundTo(uptime, 1),
      llmMode,
    },
  };
};

export const buildFallbackStrategyChips = (summary: SystemInsightsSummary): StrategyChip[] => {
  const city = String(summary.marketMetrics.city || "Agra");
  const zoneLabel = String(summary.marketMetrics.zoneLabel || city);
  const expansionCity = String(summary.marketMetrics.recommendedExpansionCity || city);
  const surgeZone = summary.marketMetrics.surgeZones[0] || zoneLabel;
  const criticalBugs = Math.round(Number(summary.systemHealth.criticalBugs || 0));
  const primaryBugLabel = humanizeIssueCode(summary.systemHealth.primaryCriticalBugCode || "OPERATIONS_WATCH");
  const isNonAgraMarket = city.trim().toLowerCase() !== AGRA_CITY_NAME;
  const yieldPerJob = Math.round(summary.unitEconomics.yieldPerJob || 0);
  const cacProjected = Math.round(summary.unitEconomics.cacProjected || 150);
  const paybackDays = Math.round(summary.unitEconomics.paybackDays || 18);

  return [
    {
      id: "local_ops",
      title: "Local Ops",
      tone: "sky",
      actionLabel: "Explain Ops",
      copilotQuery: `Explain the local ops recommendation for ${zoneLabel}. What should the operator do in the next 24 hours?`,
      insight: summary.marketMetrics.density >= 1
        ? `Protect ${surgeZone} first and shift standby coverage into the highest-density lane.`
        : `Keep ${zoneLabel} on disciplined coverage while demand warms; avoid over-staffing before density crosses 1.0.`,
    },
    {
      id: "financial_stability",
      title: "Financial Sustainability",
      tone: criticalBugs > 0 ? "amber" : "emerald",
      actionLabel: "Explain Yield",
      copilotQuery: `Explain the unit economics for ${zoneLabel}. How do yield, CAC, and payback affect sustainability right now?`,
      insight: criticalBugs > 0
        ? `Protect yield at ₹${yieldPerJob} while ${criticalBugs} critical risks stay active; keep CAC near ₹${cacProjected} and hold payback inside ${paybackDays} days.`
        : `Yield is holding near ₹${yieldPerJob}; keep projected CAC near ₹${cacProjected} and payback inside ${paybackDays} days.`,
    },
    {
      id: "expansion_posture",
      title: "Market Expansion",
      tone: "navy",
      actionLabel: "Open Playbook",
      copilotQuery: isNonAgraMarket
        ? `Prepare the expansion playbook for ${city}. Explain the Shadow Launch posture, projected CAC of ₹150, payback window of 18 days, freelancer-first supply coverage, trust rails, and the first 14-day operating plan.`
        : `Explain the expansion playbook for moving from ${city} into ${expansionCity}. What must stay true before the launch window opens?`,
      insight: isNonAgraMarket
        ? "Shadow Launch (Freelancer-First) | Projected CAC: ₹150 | Payback Window: 18 Days"
        : `Agra pilot first: protect the core, keep payback inside ${paybackDays} days, then export the playbook to ${expansionCity}.`,
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
    const remoteInsight = typeof remote?.insight === "string" && remote.insight.trim().length > 0
      ? sanitizeInsightText(remote.insight.trim())
      : seed.insight;

    if (seed.id === "expansion_posture" && !summary.marketMetrics.isExistingMarket) {
      return {
        ...seed,
        insight: seed.insight,
      };
    }

    if (seed.id === "financial_stability" && summary.systemHealth.criticalBugs > 0) {
      return {
        ...seed,
        insight: seed.insight,
      };
    }

    return {
      ...seed,
      insight: remoteInsight,
    };
  });
};
