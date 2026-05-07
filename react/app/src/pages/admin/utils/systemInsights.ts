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
  const isNonAgraMarket = city.trim().toLowerCase() !== "agra";
  const availableWorkers = Math.max(1, Math.round(stats.totalWorkers * (Math.max(activeWorkerRate, 1) / 100)));
  const density = roundTo(clamp(stats.activeBookings / availableWorkers, 0.35, 2.8));
  const yieldPerJob = deriveYieldPerJob(investorSummary, averageTicket);
  const cacProjected = deriveProjectedCac(isNonAgraMarket, investorSummary, yieldPerJob);
  const paybackDays = derivePaybackDays(isNonAgraMarket, cacProjected, investorSummary, averageTicket);
  const uptime = parsePercent(globalUptime) ?? (healthSnapshot?.status === "ok" ? 99.9 : 99.2);
  const criticalIssueCodes = ADMIN_OBSERVABILITY_ISSUES
    .filter((issue) => issue.severity === "critical")
    .map((issue) => issue.code);

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

const buildExpansionInsight = (summary: SystemInsightsSummary) => {
  const city = summary.marketMetrics.city.trim();
  const yieldPerJob = Math.round(summary.unitEconomics.yieldPerJob || 0);
  const cacProjected = Math.round(summary.unitEconomics.cacProjected || 150);
  const paybackDays = Math.round(summary.unitEconomics.paybackDays || 18);

  if (city.toLowerCase() !== "agra") {
    return `Shadow Launch (Freelancer-First) | Projected CAC: ₹${cacProjected} | Payback Window: ${paybackDays} Days`;
  }

  return `Agra pilot first: protect yield at INR ${yieldPerJob}/job and keep payback inside ${paybackDays} days before expansion.`;
};

export const buildFallbackStrategyChips = (summary: SystemInsightsSummary): StrategyChip[] => {
  const city = String(summary.marketMetrics.city || "Agra");
  const zoneLabel = summary.marketMetrics.zoneLabel || city;
  const surgeZone = summary.marketMetrics.surgeZones[0] || zoneLabel;
  const density = Number(summary.marketMetrics.density || 0.8);
  const criticalBugs = Math.round(Number(summary.systemHealth.criticalBugs || 0));
  const primaryBugLabel = humanizeIssueCode(summary.systemHealth.primaryCriticalBugCode || "critical_bug");
  const yieldPerJob = Math.round(Number(summary.unitEconomics.yieldPerJob || 0));
  const cacProjected = Math.round(Number(summary.unitEconomics.cacProjected || 150));
  const paybackDays = Math.round(Number(summary.unitEconomics.paybackDays || 18));

  return [
    {
      id: "local_ops",
      title: "Local Ops",
      tone: density >= 1 ? "sky" : "navy",
      actionLabel: "Explain Ops",
      copilotQuery: `Explain the local ops recommendation for ${zoneLabel}. What should the operator do in the next 24 hours?`,
      insight: density >= 1
        ? `Protect ${surgeZone} first and move standby coverage into the densest active lane.`
        : `Keep ${surgeZone} under light-touch coverage until density climbs above 1.0.`,
    },
    {
      id: "financial_stability",
      title: "Financial Sustainability",
      tone: criticalBugs > 0 ? "amber" : "emerald",
      actionLabel: "Explain Yield",
      copilotQuery: `Explain the profit recommendation for ${city}. How do yield, CAC, payout pressure, and payback affect financial sustainability?`,
      insight: criticalBugs > 0
        ? `Hold yield near INR ${yieldPerJob} while ${criticalBugs} critical issues stay active and CAC remains near INR ${cacProjected}.`
        : `Yield is holding near INR ${yieldPerJob}; keep projected CAC near INR ${cacProjected} and payback at ${paybackDays} days.`,
    },
    {
      id: "expansion_posture",
      title: "Market Expansion",
      tone: city.trim().toLowerCase() !== "agra" ? "navy" : "sky",
      actionLabel: "Open Playbook",
      copilotQuery: city.trim().toLowerCase() !== "agra"
        ? `Explain the Shadow Launch (Freelancer-First) playbook for ${city}. Why are we modeling Projected CAC at INR ${cacProjected} and the Payback Window at ${paybackDays} days?`
        : "Explain the Agra profit yield opening narrative. Why should we protect pilot payback before expanding into a new city?",
      insight: buildExpansionInsight(summary),
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
  const isNonAgraMarket = summary.marketMetrics.city.trim().toLowerCase() !== "agra";

  return fallback.map((seed) => {
    const remote = sourceMap.get(seed.id);
    const title = typeof remote?.title === "string" && remote.title.trim().length > 0
      ? remote.title.trim()
      : seed.title;
    let insight = typeof remote?.insight === "string" && remote.insight.trim().length > 0
      ? remote.insight.trim()
      : seed.insight;

    if (seed.id === "expansion_posture" && isNonAgraMarket) {
      const hasShadowLaunch = /shadow launch \(freelancer-first\)/i.test(insight);
      const hasProjectedCac = /projected cac:/i.test(insight);
      const hasPaybackWindow = /payback window:/i.test(insight);

      if (!hasShadowLaunch || !hasProjectedCac || !hasPaybackWindow) {
        insight = seed.insight;
      }
    }

    return {
      ...seed,
      title,
      insight,
    };
  });
};
