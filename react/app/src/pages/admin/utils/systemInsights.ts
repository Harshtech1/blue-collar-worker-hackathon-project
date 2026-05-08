import {
  buildSimulationGeoConfig,
  GLOBAL_SIMULATION_CITIES,
  sectorSeeds,
} from "@/utils/simulationData";
import {
  ADMIN_ISSUE_SEVERITY_WEIGHT,
  type ObservabilityIssueCode,
} from "../adminSignals";
import type {
  AdminDashboardStats,
  AdminInvestorAnalyticsSummary,
  AdminSystemHealthSnapshot,
} from "../adminShellContext";
import {
  getPressureFactor,
  labelsOverlap,
  resolveCompetitorHotspot,
  type AdminCompetitorHotspot,
} from "./marketDefense";
import type { AdminMarketSnapshot } from "./adminMarketSnapshot";
import {
  findMarketCity,
  getMarketDistrictBySlug,
  getMarketDistrictsForCity,
  resolveMarketContext,
  resolveMarketLabel,
} from "../marketRegistry";
import {
  findPunjabVillageEntry,
  PUNJAB_STATE_AVERAGES,
  type PunjabVillageMetrics,
} from "../data/punjabVillageRegistry";

export type StrategyChipId =
  | "local_ops"
  | "financial_stability"
  | "expansion_posture"
  | "expansion_budget"
  | "revenue_potential"
  | "defensive_posture";

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
    state: string;
    stateSlug: string;
    city: string;
    citySlug: string;
    zoneLabel: string;
    marketLabel: string;
    recommendedExpansionCity: string;
    density: number;
    surgeZones: string[];
    underservedSector: string | null;
    cityTier: "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";
    isExistingMarket: boolean;
    entryPosture: string;
    hierarchyPath: string;
  };
  unitEconomics: {
    yieldPerJob: number;
    averageWorkerEarningPerJob: number;
    cacProjected: number;
    paybackDays: number;
    launchCacPerWorker: number;
    marketCapacity: number;
    setupOverhead: number;
    regionalEntryBudget: number;
    burnToScaleRatio: number;
    roi12m: number;
    launchMode: string;
    jobsPerWorkerPerMonth: number;
    commissionPerProjectedJob: number;
    projectedFirstYearRevenue: number;
    marketShareCapture: number;
    marginExpansionPer100Workers: number;
    operationalEfficiencyGain: number;
    scalabilityNewWorkers: number;
    scalabilityDeltaProfit: number;
    scalabilityDeltaProfitAnnualized: number;
  };
  marketReadiness: PunjabVillageReadinessSummary | null;
  marketDefense: {
    targetHotspot: AdminCompetitorHotspot | null;
    loyaltyMultiplier: number;
    pressureFactor: number;
    activeWorkersInThreatZone: number;
    defendedWorkers: number;
    estimatedJobsAtRisk: number;
    churnPreventionCost: number;
    replacementCac: number;
    projectedSavings: number;
    protectedMarketShare: number;
  };
  systemHealth: {
    criticalBugs: number;
    primaryCriticalBugCode: string | null;
    uptime: number;
    llmMode: "ready" | "fallback";
  };
}

export interface PunjabVillageReadinessSummary {
  villageCode: string;
  laborAvailabilityIndex: number;
  connectivityStability: number;
  infrastructureGapScore: number;
  villageReadinessScore: number;
  projectedCac: number;
  popDensity: number;
  domesticPowerHours: number;
  hhSize: number;
  agriPowerHours: number;
  deltas: PunjabVillageMetrics["deltas"];
  benchmarkLabel: string;
  comparisonNarrative: string;
}

export interface BuildSystemInsightsSummaryInput {
  routeZoneId: string;
  zoneLabel: string;
  stateSlug?: string | null;
  citySlug?: string | null;
  districtSlug?: string | null;
  stats: AdminDashboardStats;
  activeWorkerRate: number;
  averageTicket: number;
  sevenDayBookings?: number;
  globalUptime: string;
  llmMode: "ready" | "fallback";
  healthSnapshot: AdminSystemHealthSnapshot | null;
  investorSummary: AdminInvestorAnalyticsSummary | null;
  marketSnapshot?: AdminMarketSnapshot | null;
}

type MarketIdentity = {
  state: string;
  stateSlug: string;
  city: string;
  citySlug: string;
  zone: string;
  districtSlug: string | null;
  districtLabel: string | null;
  cityTier: "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";
  isExistingMarket: boolean;
  isPunjabVillage: boolean;
  entryPosture: string;
  hierarchyPath: string;
};

type RegionalBudgetProfile = {
  launchCacPerWorker: number;
  marketCapacity: number;
  setupOverhead: number;
  launchMode: string;
};

type RevenueProjectionProfile = {
  jobsPerWorkerPerMonth: number;
  commissionPerJob: number;
  marketShareCapture: number;
};

type ScalabilityProfile = {
  marginExpansionPer100Workers: number;
  operationalEfficiencyGain: number;
};

const AGRA_CITY_ID = "agra";
const AGRA_CITY_NAME = "agra";
const SCALABILITY_NEW_WORKER_BLOCK = 100;
const LOYALTY_MULTIPLIER = 0.15;
const UNDERSERVED_SECTOR_HINTS: Record<string, string> = {
  agra: "Sikandra",
  amritsar: "Ranjit Avenue",
  chandigarh: "Manimajra",
  lucknow: "Gomti Nagar",
  ludhiana: "Sarabha Nagar",
  "new-delhi": "Dwarka Sector 21",
  noida: "Sector 62",
  "north-delhi": "Burari",
  "south-delhi": "Vasant Kunj",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundTo = (value: number, digits = 2) => Number(value.toFixed(digits));
const formatCompactInrAscii = (value: number) => {
  const normalizedValue = Math.round(Number(value || 0));
  if (normalizedValue >= 10000000) {
    const croreValue = normalizedValue / 10000000;
    return `INR ${Number.isInteger(croreValue) ? croreValue.toFixed(0) : croreValue.toFixed(1)}Cr`;
  }

  if (normalizedValue >= 100000) {
    const lakhValue = normalizedValue / 100000;
    return `INR ${Number.isInteger(lakhValue) ? lakhValue.toFixed(0) : lakhValue.toFixed(1)}L`;
  }

  if (normalizedValue >= 1000) {
    return `INR ${Math.round(normalizedValue / 1000)}K`;
  }

  return `INR ${normalizedValue}`;
};

const formatCompactInr = (value: number) => {
  const normalizedValue = Math.round(Number(value || 0));
  if (normalizedValue >= 100000) {
    const lakhValue = normalizedValue / 100000;
    return `₹${Number.isInteger(lakhValue) ? lakhValue.toFixed(0) : lakhValue.toFixed(1)}L`;
  }

  if (normalizedValue >= 1000) {
    return `₹${Math.round(normalizedValue / 1000)}K`;
  }

  return `₹${normalizedValue}`;
};

const sanitizeInsightText = (value: string) => (
  value
    .replaceAll("ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹", "₹")
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

const formatSignedDelta = (value: number, digits = 0) => {
  const normalized = Number(value || 0);
  const formatted = digits > 0
    ? normalized.toFixed(digits)
    : Math.round(normalized).toString();
  return `${normalized >= 0 ? "+" : ""}${formatted}`;
};

const buildPunjabVillageReadinessSummary = (
  villageSlug?: string | null,
): PunjabVillageReadinessSummary | null => {
  const village = findPunjabVillageEntry(villageSlug || null);
  if (!village) return null;

  const laborDelta = village.metrics.deltas.laborAvailabilityIndex;
  const connectivityDelta = village.metrics.deltas.domesticPowerHours;
  const readinessDelta = village.metrics.deltas.villageReadinessScore;
  const normalizedConnectivityDelta = roundTo(Math.abs(Number(connectivityDelta || 0)), 1);
  const laborQualifier = laborDelta >= 0 ? "above" : "below";
  const connectivityQualifier = connectivityDelta >= 0 ? "stronger" : "lighter";
  const comparisonNarrative = [
    `${village.label} sits ${Math.abs(Math.round(laborDelta))} points ${laborQualifier} the Punjab labor baseline`,
    `with ${normalizedConnectivityDelta} hours ${connectivityQualifier} household power stability`,
    `and a readiness score ${formatSignedDelta(readinessDelta)} versus the state average.`,
  ].join(", ");

  return {
    villageCode: village.villageCode,
    laborAvailabilityIndex: village.metrics.laborAvailabilityIndex,
    connectivityStability: village.metrics.connectivityStability,
    infrastructureGapScore: village.metrics.infrastructureGapScore,
    villageReadinessScore: village.metrics.villageReadinessScore,
    projectedCac: village.metrics.projectedCac,
    popDensity: village.metrics.popDensity,
    domesticPowerHours: village.metrics.domesticPowerHours,
    hhSize: village.metrics.hhSize,
    agriPowerHours: village.metrics.agriPowerHours,
    deltas: village.metrics.deltas,
    benchmarkLabel: "Punjab state average",
    comparisonNarrative,
  };
};

const deriveExplicitMarketIdentity = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
): MarketIdentity | null => {
  if (!stateSlug && !citySlug) return null;

  const context = resolveMarketContext(stateSlug, citySlug, districtSlug);
  const district = getMarketDistrictBySlug(districtSlug || null, context.city.slug) || null;
  const punjabVillage = context.state.slug === "punjab"
    ? findPunjabVillageEntry(districtSlug || null)
    : null;
  const districtLabel = district?.label || punjabVillage?.label || null;
  const entryPosture = context.city.launchStatus === "pilot"
    ? "Pilot Optimization"
    : punjabVillage
      ? "Micro-Market Entry"
      : "Shadow Launch (Freelancer-First)";
  return {
    state: context.state.label,
    stateSlug: context.state.slug,
    city: context.city.label,
    citySlug: context.city.slug,
    zone: resolveMarketLabel(context.state.slug, context.city.slug, districtSlug || null),
    districtSlug: district?.slug || punjabVillage?.slug || null,
    districtLabel,
    cityTier: context.city.tier,
    isExistingMarket: context.city.launchStatus === "pilot",
    isPunjabVillage: Boolean(punjabVillage),
    entryPosture,
    hierarchyPath: districtLabel
      ? `${context.state.label} > ${context.city.label} > ${districtLabel}`
      : `${context.state.label} > ${context.city.label}`,
  };
};

const resolveMarketIdentity = ({
  routeZoneId,
  zoneLabel,
  stateSlug,
  citySlug,
  districtSlug,
}: Pick<BuildSystemInsightsSummaryInput, "routeZoneId" | "zoneLabel" | "stateSlug" | "citySlug" | "districtSlug">): MarketIdentity => {
  const explicitIdentity = deriveExplicitMarketIdentity(stateSlug, citySlug, districtSlug);
  if (explicitIdentity) return explicitIdentity;

  const matchedMarketCity = findMarketCity(routeZoneId);
  if (matchedMarketCity) {
    return {
      state: matchedMarketCity.stateLabel,
      stateSlug: matchedMarketCity.stateSlug,
      city: matchedMarketCity.label,
      citySlug: matchedMarketCity.slug,
      zone: resolveMarketLabel(matchedMarketCity.stateSlug, matchedMarketCity.slug, districtSlug || null),
      districtSlug: districtSlug || null,
      districtLabel: getMarketDistrictBySlug(districtSlug || null, matchedMarketCity.slug)?.label || null,
      cityTier: matchedMarketCity.tier,
      isExistingMarket: matchedMarketCity.launchStatus === "pilot",
      isPunjabVillage: Boolean(
        matchedMarketCity.stateSlug === "punjab" && findPunjabVillageEntry(districtSlug || null),
      ),
      entryPosture: matchedMarketCity.launchStatus === "pilot"
        ? "Pilot Optimization"
        : matchedMarketCity.stateSlug === "punjab" && findPunjabVillageEntry(districtSlug || null)
          ? "Micro-Market Entry"
          : "Shadow Launch (Freelancer-First)",
      hierarchyPath: buildMarketPathLabel(
        matchedMarketCity.stateLabel,
        matchedMarketCity.label,
        getMarketDistrictBySlug(districtSlug || null, matchedMarketCity.slug)?.label || null,
      ),
    };
  }

  const matchedCity = GLOBAL_SIMULATION_CITIES.find((city) => city.id === routeZoneId) || null;
  const matchedSector = sectorSeeds.find((sector) => sector.id === routeZoneId) || null;
  const inferredCityId = matchedCity?.id
    || findMarketCity(matchedSector?.city?.toLowerCase().replace(/\s+/g, "-") || "")?.slug
    || AGRA_CITY_ID;
  const geoConfig = buildSimulationGeoConfig({
    cityId: inferredCityId,
    radiusKm: matchedCity ? 14 : 10,
  });

  return {
    state: matchedCity?.stateName || "Uttar Pradesh",
    stateSlug: findMarketCity(inferredCityId)?.stateSlug || "uttar-pradesh",
    city: matchedCity?.label || matchedSector?.city || geoConfig.cityLabel || "Agra",
    citySlug: matchedCity?.id || inferredCityId,
    zone: zoneLabel || matchedSector?.label || matchedCity?.label || geoConfig.cityLabel || "Agra",
    districtSlug: districtSlug || null,
    districtLabel: getMarketDistrictBySlug(districtSlug || null, inferredCityId)?.label || null,
    cityTier: geoConfig.cityTier,
    isExistingMarket: geoConfig.isExistingMarket,
    isPunjabVillage: Boolean(
      findMarketCity(inferredCityId)?.stateSlug === "punjab" && findPunjabVillageEntry(districtSlug || null),
    ),
    entryPosture: geoConfig.isExistingMarket ? "Pilot Optimization" : "Shadow Launch (Freelancer-First)",
    hierarchyPath: buildMarketPathLabel(
      matchedCity?.stateName || "Uttar Pradesh",
      matchedCity?.label || matchedSector?.city || geoConfig.cityLabel || "Agra",
      getMarketDistrictBySlug(districtSlug || null, inferredCityId)?.label || null,
    ),
  };
};

const buildMarketPathLabel = (
  stateLabel: string,
  cityLabel: string,
  districtLabel?: string | null,
) => (
  districtLabel
    ? `${stateLabel} > ${cityLabel} > ${districtLabel}`
    : `${stateLabel} > ${cityLabel}`
);

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

const getRegionalBudgetProfile = (
  marketIdentity: MarketIdentity,
  villageReadiness: PunjabVillageReadinessSummary | null,
): RegionalBudgetProfile => {
  if (marketIdentity.isPunjabVillage && villageReadiness) {
    return {
      launchCacPerWorker: villageReadiness.projectedCac,
      marketCapacity: clamp(
        Math.round(140 + (villageReadiness.laborAvailabilityIndex * 1.4)),
        120,
        280,
      ),
      setupOverhead: 18000,
      launchMode: "Micro-Market Entry",
    };
  }

  const { cityTier, isExistingMarket } = marketIdentity;
  if (cityTier === "tier_1" || cityTier === "international") {
    return {
      launchCacPerWorker: 150,
      marketCapacity: 1500,
      setupOverhead: 75000,
      launchMode: "Tier-1 Shadow Launch",
    };
  }

  return {
    launchCacPerWorker: 120,
    marketCapacity: isExistingMarket ? 500 : 500,
    setupOverhead: 30000,
    launchMode: isExistingMarket ? "Pilot Reinforcement" : "Shadow Launch",
  };
};

const getRevenueProjectionProfile = (
  marketIdentity: MarketIdentity,
  villageReadiness: PunjabVillageReadinessSummary | null,
): RevenueProjectionProfile => {
  if (marketIdentity.isPunjabVillage && villageReadiness) {
    return {
      jobsPerWorkerPerMonth: clamp(Math.round(8 + (villageReadiness.connectivityStability / 18)), 8, 13),
      commissionPerJob: clamp(Math.round(55 + (villageReadiness.laborAvailabilityIndex / 5)), 55, 78),
      marketShareCapture: clamp(Math.round(6 + (villageReadiness.villageReadinessScore / 18)), 6, 12),
    };
  }

  const { cityTier } = marketIdentity;
  if (cityTier === "tier_1" || cityTier === "international") {
    return {
      jobsPerWorkerPerMonth: 20,
      commissionPerJob: 100,
      marketShareCapture: 12,
    };
  }

  return {
    jobsPerWorkerPerMonth: 15,
    commissionPerJob: 80,
    marketShareCapture: 12,
  };
};

const getScalabilityProfile = (_cityTier: MarketIdentity["cityTier"]): ScalabilityProfile => ({
  marginExpansionPer100Workers: 4.2,
  operationalEfficiencyGain: 0.042,
});

const deriveProjectedCac = (
  isNonAgraMarket: boolean,
  marketIdentity: MarketIdentity,
  investorSummary: AdminInvestorAnalyticsSummary | null,
  yieldPerJob: number,
  villageReadiness: PunjabVillageReadinessSummary | null,
) => {
  if (marketIdentity.isPunjabVillage && villageReadiness) {
    return Math.round(villageReadiness.projectedCac);
  }

  if (isNonAgraMarket) {
    return getRegionalBudgetProfile(marketIdentity, villageReadiness).launchCacPerWorker;
  }

  const mappedCac = Number(investorSummary?.unitEconomics?.marketingCacPerJob || 0);
  if (mappedCac > 0) {
    return Math.round(mappedCac);
  }

  return Math.max(105, Math.round(yieldPerJob * 0.44));
};

const derivePaybackDays = (
  isNonAgraMarket: boolean,
  marketIdentity: MarketIdentity,
  projectedCac: number,
  investorSummary: AdminInvestorAnalyticsSummary | null,
  averageTicket: number,
  yieldPerJob: number,
  villageReadiness: PunjabVillageReadinessSummary | null,
) => {
  if (marketIdentity.isPunjabVillage && villageReadiness) {
    const dailyCommissionPerWorker = Math.max(8, Math.round(yieldPerJob * 0.2));
    return clamp(Math.round(projectedCac / dailyCommissionPerWorker), 12, 28);
  }

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

const deriveProjectedMonthlyJobsRunRate = ({
  sevenDayBookings,
  completedBookings,
  activeBookings,
}: {
  sevenDayBookings?: number;
  completedBookings: number;
  activeBookings: number;
}) => {
  if (Number(sevenDayBookings || 0) > 0) {
    return Math.max(1, Math.round(((sevenDayBookings || 0) / 7) * 30));
  }

  if (completedBookings > 0) {
    return Math.max(1, Math.round(completedBookings * 4.2));
  }

  return Math.max(1, Math.round(activeBookings * 3.4));
};

const buildExpansionCity = (city: string, isExistingMarket: boolean) => {
  const normalizedCity = city.trim().toLowerCase();
  if (normalizedCity === "new delhi" || normalizedCity === "chandigarh") {
    return city.trim();
  }

  return isExistingMarket ? "Chandigarh" : "New Delhi";
};

const buildSurgeZones = ({
  citySlug,
  cityLabel,
  zoneLabel,
  routeZoneId,
  districtSlug,
}: {
  citySlug: string;
  cityLabel: string;
  zoneLabel: string;
  routeZoneId: string;
  districtSlug?: string | null;
}) => {
  const explicitDistrict = getMarketDistrictBySlug(districtSlug || null);
  if (explicitDistrict?.label) {
    return [explicitDistrict.label];
  }

  const directSector = sectorSeeds.find((sector) => sector.id === routeZoneId);
  if (directSector?.label) {
    return [directSector.label];
  }

  const districtZones = getMarketDistrictsForCity(citySlug)
    .slice(0, 2)
    .map((district) => district.label);

  if (districtZones.length > 0) {
    return districtZones;
  }

  const matchingSectors = sectorSeeds
    .filter((sector) => sector.city.toLowerCase() === cityLabel.toLowerCase())
    .sort((left, right) => right.demandWeight - left.demandWeight)
    .slice(0, 2)
    .map((sector) => sector.label);

  if (matchingSectors.length > 0) {
    return matchingSectors;
  }

  return [`${cityLabel} Core`, zoneLabel].filter((value, index, array) => array.indexOf(value) === index);
};

const resolveUnderservedSector = ({
  citySlug,
  surgeZones,
  zoneLabel,
}: {
  citySlug: string;
  surgeZones: string[];
  zoneLabel: string;
}) => {
  const hintedSector = UNDERSERVED_SECTOR_HINTS[citySlug];
  if (hintedSector) {
    return hintedSector;
  }

  return surgeZones.find((zone) => zone !== zoneLabel) || surgeZones[0] || zoneLabel || null;
};

const resolveThreatZoneWorkerCount = ({
  marketSnapshot,
  hotspot,
  zoneLabel,
}: {
  marketSnapshot?: AdminMarketSnapshot | null;
  hotspot: AdminCompetitorHotspot | null;
  zoneLabel: string;
}) => {
  if (!marketSnapshot) return 0;

  const matchingRegion = marketSnapshot.regions.find((region) => (
    (hotspot && labelsOverlap(region.label, hotspot.label))
    || labelsOverlap(region.label, zoneLabel)
  ));

  return matchingRegion?.workerCount || marketSnapshot.stats?.workerCount || 0;
};

const buildMarketDefense = ({
  stateSlug,
  citySlug,
  districtSlug,
  zoneLabel,
  marketSnapshot,
  activeWorkerRate,
  marketShareCapture,
  jobsPerWorkerPerMonth,
  averageWorkerEarningPerJob,
  launchCacPerWorker,
}: {
  stateSlug: string;
  citySlug: string;
  districtSlug?: string | null;
  zoneLabel: string;
  marketSnapshot?: AdminMarketSnapshot | null;
  activeWorkerRate: number;
  marketShareCapture: number;
  jobsPerWorkerPerMonth: number;
  averageWorkerEarningPerJob: number;
  launchCacPerWorker: number;
}) => {
  const districtLabel = marketSnapshot?.market.regionLabel
    || getMarketDistrictBySlug(districtSlug || null, citySlug)?.label
    || zoneLabel;
  const targetHotspot = resolveCompetitorHotspot({
    stateSlug,
    citySlug,
    districtLabel,
    zoneLabel,
  });
  const pressureFactor = getPressureFactor(targetHotspot?.pressure);
  const threatZoneWorkers = resolveThreatZoneWorkerCount({
    marketSnapshot,
    hotspot: targetHotspot,
    zoneLabel,
  });
  const activeWorkersInThreatZone = Math.max(
    1,
    Math.ceil((threatZoneWorkers || 1) * clamp(activeWorkerRate / 100, 0.18, 1)),
  );
  const defendedWorkers = Math.max(
    1,
    Math.ceil(activeWorkersInThreatZone * pressureFactor),
  );
  const estimatedJobsAtRisk = Math.max(
    1,
    Math.ceil(defendedWorkers * Math.max(1, jobsPerWorkerPerMonth)),
  );
  const churnPreventionCost = Math.round(
    estimatedJobsAtRisk * Math.max(averageWorkerEarningPerJob, 1) * LOYALTY_MULTIPLIER,
  );
  const replacementCac = Math.round(defendedWorkers * Math.max(launchCacPerWorker, 1));
  const projectedSavings = Math.max(replacementCac - churnPreventionCost, 0);

  return {
    targetHotspot,
    loyaltyMultiplier: LOYALTY_MULTIPLIER,
    pressureFactor,
    activeWorkersInThreatZone,
    defendedWorkers,
    estimatedJobsAtRisk,
    churnPreventionCost,
    replacementCac,
    projectedSavings,
    protectedMarketShare: Math.max(1, Math.round(marketShareCapture)),
  };
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
  stateSlug,
  citySlug,
  districtSlug,
  stats,
  activeWorkerRate,
  averageTicket,
  sevenDayBookings,
  globalUptime,
  llmMode,
  healthSnapshot,
  investorSummary,
  marketSnapshot,
}: BuildSystemInsightsSummaryInput): SystemInsightsSummary => {
  const marketIdentity = resolveMarketIdentity({
    routeZoneId,
    zoneLabel,
    stateSlug,
    citySlug,
    districtSlug,
  });
  const isNonAgraMarket = marketIdentity.city.trim().toLowerCase() !== AGRA_CITY_NAME;
  const villageReadiness = buildPunjabVillageReadinessSummary(marketIdentity.districtSlug);
  const budgetProfile = getRegionalBudgetProfile(marketIdentity, villageReadiness);
  const revenueProfile = getRevenueProjectionProfile(marketIdentity, villageReadiness);
  const scalabilityProfile = getScalabilityProfile(marketIdentity.cityTier);
  const availableWorkers = Math.max(1, Math.round(stats.totalWorkers * (Math.max(activeWorkerRate, 1) / 100)));
  const density = roundTo(clamp(stats.activeBookings / availableWorkers, 0.35, 2.8));
  const yieldPerJob = deriveYieldPerJob(investorSummary, averageTicket);
  const cacProjected = deriveProjectedCac(isNonAgraMarket, marketIdentity, investorSummary, yieldPerJob, villageReadiness);
  const paybackDays = derivePaybackDays(
    isNonAgraMarket,
    marketIdentity,
    cacProjected,
    investorSummary,
    averageTicket,
    yieldPerJob,
    villageReadiness,
  );
  const regionalEntryBudget = (budgetProfile.marketCapacity * budgetProfile.launchCacPerWorker) + budgetProfile.setupOverhead;
  const projectedFirstYearRevenue = budgetProfile.marketCapacity
    * revenueProfile.jobsPerWorkerPerMonth
    * revenueProfile.commissionPerJob
    * 12;
  const surgeZones = buildSurgeZones({
    citySlug: marketIdentity.citySlug,
    cityLabel: marketIdentity.city,
    zoneLabel: marketIdentity.zone,
    routeZoneId,
    districtSlug,
  });
  const projectedMonthlyJobsRunRate = deriveProjectedMonthlyJobsRunRate({
    sevenDayBookings,
    completedBookings: Number(investorSummary?.completedJobs ?? stats.completedBookings ?? 0),
    activeBookings: stats.activeBookings,
  });
  const projectedMonthlyNetProfit = Math.max(0, Math.round(yieldPerJob * projectedMonthlyJobsRunRate));
  const averageWorkerEarningPerJob = Math.round(
    Number(
      investorSummary?.workerEarnings && investorSummary?.completedJobs
        ? Number(investorSummary.workerEarnings) / Math.max(Number(investorSummary.completedJobs), 1)
        : Math.max((averageTicket || 0) - yieldPerJob, 0),
    ),
  );
  const roi12m = roundTo(
    (((projectedMonthlyNetProfit * 12) - regionalEntryBudget) / Math.max(1, regionalEntryBudget)) * 100,
    1,
  );
  const currentMarginPerWorkerPerMonth = yieldPerJob * revenueProfile.jobsPerWorkerPerMonth;
  const scalabilityDeltaProfit = Math.round(
    (SCALABILITY_NEW_WORKER_BLOCK * scalabilityProfile.operationalEfficiencyGain) * currentMarginPerWorkerPerMonth,
  );
  const scalabilityDeltaProfitAnnualized = scalabilityDeltaProfit * 12;
  const burnToScaleRatio = roundTo(
    regionalEntryBudget / Math.max(1, budgetProfile.marketCapacity * yieldPerJob),
    2,
  );
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
  const underservedSector = resolveUnderservedSector({
    citySlug: marketIdentity.citySlug,
    surgeZones,
    zoneLabel: marketIdentity.zone,
  });
  const marketDefense = buildMarketDefense({
    stateSlug: marketIdentity.stateSlug,
    citySlug: marketIdentity.citySlug,
    districtSlug,
    zoneLabel: marketIdentity.zone,
    marketSnapshot,
    activeWorkerRate,
    marketShareCapture: revenueProfile.marketShareCapture,
    jobsPerWorkerPerMonth: revenueProfile.jobsPerWorkerPerMonth,
    averageWorkerEarningPerJob,
    launchCacPerWorker: budgetProfile.launchCacPerWorker,
  });

  return {
    marketMetrics: {
      state: marketIdentity.state,
      stateSlug: marketIdentity.stateSlug,
      city: marketIdentity.city,
      citySlug: marketIdentity.citySlug,
      zoneLabel: marketIdentity.zone,
      marketLabel: `${marketIdentity.city}, ${marketIdentity.state}`,
      recommendedExpansionCity: buildExpansionCity(marketIdentity.city, marketIdentity.isExistingMarket),
      density,
      surgeZones,
      underservedSector,
      cityTier: marketIdentity.cityTier,
      isExistingMarket: marketIdentity.isExistingMarket,
      entryPosture: marketIdentity.entryPosture,
      hierarchyPath: marketIdentity.hierarchyPath,
    },
    unitEconomics: {
      yieldPerJob,
      averageWorkerEarningPerJob,
      cacProjected,
      paybackDays,
      launchCacPerWorker: budgetProfile.launchCacPerWorker,
      marketCapacity: budgetProfile.marketCapacity,
      setupOverhead: budgetProfile.setupOverhead,
      regionalEntryBudget,
      burnToScaleRatio,
      roi12m,
      launchMode: budgetProfile.launchMode,
      jobsPerWorkerPerMonth: revenueProfile.jobsPerWorkerPerMonth,
      commissionPerProjectedJob: revenueProfile.commissionPerJob,
      projectedFirstYearRevenue,
      marketShareCapture: revenueProfile.marketShareCapture,
      marginExpansionPer100Workers: scalabilityProfile.marginExpansionPer100Workers,
      operationalEfficiencyGain: scalabilityProfile.operationalEfficiencyGain,
      scalabilityNewWorkers: SCALABILITY_NEW_WORKER_BLOCK,
      scalabilityDeltaProfit,
      scalabilityDeltaProfitAnnualized,
    },
    marketReadiness: villageReadiness,
    marketDefense,
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
  const isNonAgraMarket = city.trim().toLowerCase() !== AGRA_CITY_NAME;
  const yieldPerJob = Math.round(summary.unitEconomics.yieldPerJob || 0);
  const cacProjected = Math.round(summary.unitEconomics.cacProjected || 150);
  const paybackDays = Math.round(summary.unitEconomics.paybackDays || 18);
  const regionalEntryBudget = Math.round(summary.unitEconomics.regionalEntryBudget || 0);
  const marketCapacity = Math.round(summary.unitEconomics.marketCapacity || 0);
  const launchCacPerWorker = Math.round(summary.unitEconomics.launchCacPerWorker || cacProjected);
  const burnToScaleRatio = Number(summary.unitEconomics.burnToScaleRatio || 0);
  const roi12m = Number(summary.unitEconomics.roi12m || 0);
  const projectedFirstYearRevenue = Math.round(summary.unitEconomics.projectedFirstYearRevenue || 0);
  const marketShareCapture = Math.round(summary.unitEconomics.marketShareCapture || 12);
  const marginExpansionPer100Workers = Number(summary.unitEconomics.marginExpansionPer100Workers || 4.2);
  const scalabilityNewWorkers = Math.round(summary.unitEconomics.scalabilityNewWorkers || SCALABILITY_NEW_WORKER_BLOCK);
  const scalabilityDeltaProfit = Math.round(summary.unitEconomics.scalabilityDeltaProfit || 0);
  const scalabilityDeltaProfitAnnualized = Math.round(summary.unitEconomics.scalabilityDeltaProfitAnnualized || 0);
  const regionalBudgetLabel = formatCompactInrAscii(regionalEntryBudget);
  const revenuePotentialLabel = formatCompactInrAscii(projectedFirstYearRevenue);
  const scalabilityDeltaLabel = formatCompactInrAscii(scalabilityDeltaProfit);
  const underservedSector = summary.marketMetrics.underservedSector || surgeZone;
  const villageReadiness = summary.marketReadiness;
  const isMicroMarket = Boolean(villageReadiness);

  return [
    {
      id: "local_ops",
      title: "Local Ops",
      tone: "sky",
      actionLabel: "Explain Ops",
      copilotQuery: isMicroMarket
        ? `Explain the local ops recommendation for ${zoneLabel}. Compare labor availability and connectivity against the Punjab state average, then outline the next 14 days for a freelancer-first village launch.`
        : `Explain the local ops recommendation for ${zoneLabel}. What should the operator do in the next 24 hours?`,
      insight: isMicroMarket && villageReadiness
        ? `Seed ${zoneLabel} first. Labor index ${villageReadiness.laborAvailabilityIndex}/100 and connectivity ${villageReadiness.connectivityStability}/100 support a disciplined Punjab village launch.`
        : summary.marketMetrics.density >= 1
        ? `Protect ${surgeZone} first and shift standby coverage into the highest-density lane.`
        : `Keep ${zoneLabel} on disciplined coverage while demand warms; avoid over-staffing before density crosses 1.0.`,
    },
    {
      id: "financial_stability",
      title: "Financial Stability",
      tone: criticalBugs > 0 ? "amber" : "emerald",
      actionLabel: "Explain Yield",
      copilotQuery: isMicroMarket && villageReadiness
        ? `Explain the unit economics for ${zoneLabel}. Use projected CAC of INR ${cacProjected}, payback of ${paybackDays} days, and compare this village against the Punjab average for labor density and domestic power reliability.`
        : `Explain the unit economics for ${zoneLabel}. How do yield, CAC, and payback affect sustainability right now?`,
      insight: isMicroMarket && villageReadiness
        ? `Projected CAC is INR ${cacProjected} with payback near ${paybackDays} days. ${zoneLabel} is ${formatSignedDelta(villageReadiness.deltas.laborAvailabilityIndex)} labor points vs Punjab baseline.`
        : criticalBugs > 0
        ? `Protect yield at INR ${yieldPerJob} while ${criticalBugs} critical risks stay active; keep CAC near INR ${cacProjected} and hold payback inside ${paybackDays} days.`
        : `Yield is holding near INR ${yieldPerJob}; keep projected CAC near INR ${cacProjected} and payback inside ${paybackDays} days.`,
    },
    {
      id: "expansion_posture",
      title: "Expansion Posture",
      tone: "navy",
      actionLabel: "Open Playbook",
      copilotQuery: isMicroMarket && villageReadiness
        ? `Prepare the entry playbook for village ${zoneLabel}. Explain the Micro-Market Entry posture, projected CAC of INR ${cacProjected}, payback window of ${paybackDays} days, labor availability ${villageReadiness.laborAvailabilityIndex}/100, connectivity stability ${villageReadiness.connectivityStability}/100, and how this compares with the Punjab state average.`
        : isNonAgraMarket
        ? `Prepare the expansion playbook for ${city}. Explain the Shadow Launch posture, projected CAC of INR 150, payback window of 18 days, freelancer-first supply coverage, trust rails, and the first 14-day operating plan.`
        : `Explain the expansion playbook for moving from ${city} into ${expansionCity}. What must stay true before the launch window opens?`,
      insight: isMicroMarket && villageReadiness
        ? `Micro-Market Entry | Projected CAC: INR ${cacProjected} | Payback Window: ${paybackDays} Days | Readiness ${villageReadiness.villageReadinessScore}/100`
        : isNonAgraMarket
        ? `Shadow Launch (Freelancer-First) | Projected CAC: INR ${cacProjected} | Payback Window: ${paybackDays} Days`
        : `Agra pilot first: protect the core, keep payback inside ${paybackDays} days, then export the playbook to ${expansionCity}.`,
    },
    {
      id: "expansion_budget",
      title: "Expansion Budget",
      tone: "navy",
      actionLabel: "Explain Burn",
      copilotQuery: isMicroMarket && villageReadiness
        ? `Explain the launch budget for ${zoneLabel} in Punjab. Use the ${summary.unitEconomics.launchMode.toLowerCase()} posture, ${marketCapacity.toLocaleString("en-IN")} target workers, INR ${launchCacPerWorker} launch CAC per worker, and INR ${regionalEntryBudget.toLocaleString("en-IN")} total entry budget.`
        : `Explain the burn-to-scale ratio and regional entry budget for ${summary.marketMetrics.state}, focused on ${city}. Use the ${summary.unitEconomics.launchMode.toLowerCase()} posture, ${marketCapacity.toLocaleString("en-IN")} target workers, INR ${launchCacPerWorker} launch CAC per worker, INR ${regionalEntryBudget.toLocaleString("en-IN")} total entry budget, and show how fast this market can scale without breaking payback discipline.`,
      insight: isMicroMarket && villageReadiness
        ? `${zoneLabel}: ${regionalBudgetLabel} launch budget | ${marketCapacity.toLocaleString("en-IN")} workers | ${villageReadiness.comparisonNarrative}`
        : `${summary.marketMetrics.state}: ${regionalBudgetLabel} launch budget | ${marketCapacity.toLocaleString("en-IN")} workers | Burn-to-scale ${burnToScaleRatio.toFixed(2)}x`,
    },
    {
      id: "revenue_potential",
      title: "Revenue Potential",
      tone: "emerald",
      actionLabel: "Open Revenue",
      copilotQuery: `In ${city}, RAHI projects a Year-1 revenue of INR ${projectedFirstYearRevenue.toLocaleString("en-IN")} with a ${marketShareCapture}% market capture, a ${roi12m.toFixed(0)}% projected 12-month ROI, and a ${paybackDays}-day payback period. Explain the burn-to-scale ratio, launch mode, and the unit-economic multiplier using Delta Profit = (New Workers x Efficiency Gain) x Current Margin. Use ${scalabilityNewWorkers} new workers, an efficiency gain of ${(summary.unitEconomics.operationalEfficiencyGain * 100).toFixed(1)}%, and quantify the uplift as INR ${scalabilityDeltaProfit.toLocaleString("en-IN")} monthly and INR ${scalabilityDeltaProfitAnnualized.toLocaleString("en-IN")} annualized. Also identify ${underservedSector} as the strongest underserved sector, explain how the teal moat identifies captured neighborhoods in ${city}, and recommend whether a temporary defensive payout should protect market share in any contested red zones.`,
      insight: `${city}: ${revenuePotentialLabel} Year-1 revenue | ${marketShareCapture}% capture | ${roi12m.toFixed(0)}% ROI | Underserved ${underservedSector} | Delta +${scalabilityDeltaLabel}/mo`,
    },
  ];
};

export const buildDefensivePostureChip = ({
  summary,
  showCompetitorOverlay,
  defensivePostureActive,
}: {
  summary: SystemInsightsSummary;
  showCompetitorOverlay: boolean;
  defensivePostureActive: boolean;
}): StrategyChip | null => {
  const hotspot = summary.marketDefense.targetHotspot;
  if (!showCompetitorOverlay || !hotspot || hotspot.pressure !== "high") {
    return null;
  }

  const loyaltyPercent = Math.round(summary.marketDefense.loyaltyMultiplier * 100);
  const preventionCostLabel = formatCompactInrAscii(summary.marketDefense.churnPreventionCost);
  const projectedSavingsLabel = formatCompactInrAscii(summary.marketDefense.projectedSavings);

  return {
    id: "defensive_posture",
    title: "Defensive Posture",
    tone: defensivePostureActive ? "emerald" : "amber",
    actionLabel: defensivePostureActive ? "Defense Active" : "Activate Defense",
    copilotQuery: `Warning: High competitor activity in ${hotspot.label}. Activating Defensive Payout logic to protect ${summary.marketDefense.protectedMarketShare}% market capture. Deploy a ${loyaltyPercent}% loyalty multiplier for ${summary.marketDefense.defendedWorkers} defended workers. Estimated churn prevention cost: INR ${summary.marketDefense.churnPreventionCost.toLocaleString("en-IN")}. Replacement CAC avoided: INR ${summary.marketDefense.replacementCac.toLocaleString("en-IN")}. Projected savings: INR ${summary.marketDefense.projectedSavings.toLocaleString("en-IN")}. Explain why retaining workers here is cheaper than re-acquiring them.`,
    insight: `High rival pressure in ${hotspot.label} | +${loyaltyPercent}% loyalty multiplier | Cost ${preventionCostLabel} | Savings ${projectedSavingsLabel}`,
  };
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

    if (
      summary.marketReadiness
      && (
        seed.id === "local_ops"
        || seed.id === "financial_stability"
        || seed.id === "expansion_posture"
        || seed.id === "expansion_budget"
        || seed.id === "revenue_potential"
      )
    ) {
      return {
        ...seed,
        insight: seed.insight,
      };
    }

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

    if (seed.id === "revenue_potential") {
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
