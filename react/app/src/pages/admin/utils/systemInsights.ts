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
  findMarketCity,
  getMarketDistrictBySlug,
  getMarketDistrictsForCity,
  resolveMarketContext,
  resolveMarketLabel,
} from "../marketRegistry";

export type StrategyChipId =
  | "local_ops"
  | "financial_stability"
  | "expansion_posture"
  | "expansion_budget"
  | "revenue_potential";

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
  };
  unitEconomics: {
    yieldPerJob: number;
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
}

type MarketIdentity = {
  state: string;
  stateSlug: string;
  city: string;
  citySlug: string;
  zone: string;
  cityTier: "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";
  isExistingMarket: boolean;
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

const deriveExplicitMarketIdentity = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
): MarketIdentity | null => {
  if (!stateSlug && !citySlug) return null;

  const context = resolveMarketContext(stateSlug, citySlug);
  return {
    state: context.state.label,
    stateSlug: context.state.slug,
    city: context.city.label,
    citySlug: context.city.slug,
    zone: resolveMarketLabel(context.state.slug, context.city.slug, districtSlug || null),
    cityTier: context.city.tier,
    isExistingMarket: context.city.launchStatus === "pilot",
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
      cityTier: matchedMarketCity.tier,
      isExistingMarket: matchedMarketCity.launchStatus === "pilot",
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
    cityTier: geoConfig.cityTier,
    isExistingMarket: geoConfig.isExistingMarket,
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

const getRegionalBudgetProfile = (
  cityTier: MarketIdentity["cityTier"],
  isExistingMarket: boolean,
): RegionalBudgetProfile => {
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

const getRevenueProjectionProfile = (cityTier: MarketIdentity["cityTier"]): RevenueProjectionProfile => {
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
) => {
  if (isNonAgraMarket) {
    return getRegionalBudgetProfile(marketIdentity.cityTier, marketIdentity.isExistingMarket).launchCacPerWorker;
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
}: BuildSystemInsightsSummaryInput): SystemInsightsSummary => {
  const marketIdentity = resolveMarketIdentity({
    routeZoneId,
    zoneLabel,
    stateSlug,
    citySlug,
    districtSlug,
  });
  const isNonAgraMarket = marketIdentity.city.trim().toLowerCase() !== AGRA_CITY_NAME;
  const budgetProfile = getRegionalBudgetProfile(marketIdentity.cityTier, marketIdentity.isExistingMarket);
  const revenueProfile = getRevenueProjectionProfile(marketIdentity.cityTier);
  const scalabilityProfile = getScalabilityProfile(marketIdentity.cityTier);
  const availableWorkers = Math.max(1, Math.round(stats.totalWorkers * (Math.max(activeWorkerRate, 1) / 100)));
  const density = roundTo(clamp(stats.activeBookings / availableWorkers, 0.35, 2.8));
  const yieldPerJob = deriveYieldPerJob(investorSummary, averageTicket);
  const cacProjected = deriveProjectedCac(isNonAgraMarket, marketIdentity, investorSummary, yieldPerJob);
  const paybackDays = derivePaybackDays(isNonAgraMarket, cacProjected, investorSummary, averageTicket);
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
    },
    unitEconomics: {
      yieldPerJob,
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
      title: "Financial Stability",
      tone: criticalBugs > 0 ? "amber" : "emerald",
      actionLabel: "Explain Yield",
      copilotQuery: `Explain the unit economics for ${zoneLabel}. How do yield, CAC, and payback affect sustainability right now?`,
      insight: criticalBugs > 0
        ? `Protect yield at INR ${yieldPerJob} while ${criticalBugs} critical risks stay active; keep CAC near INR ${cacProjected} and hold payback inside ${paybackDays} days.`
        : `Yield is holding near INR ${yieldPerJob}; keep projected CAC near INR ${cacProjected} and payback inside ${paybackDays} days.`,
    },
    {
      id: "expansion_posture",
      title: "Expansion Posture",
      tone: "navy",
      actionLabel: "Open Playbook",
      copilotQuery: isNonAgraMarket
        ? `Prepare the expansion playbook for ${city}. Explain the Shadow Launch posture, projected CAC of INR 150, payback window of 18 days, freelancer-first supply coverage, trust rails, and the first 14-day operating plan.`
        : `Explain the expansion playbook for moving from ${city} into ${expansionCity}. What must stay true before the launch window opens?`,
      insight: isNonAgraMarket
        ? `Shadow Launch (Freelancer-First) | Projected CAC: INR ${cacProjected} | Payback Window: ${paybackDays} Days`
        : `Agra pilot first: protect the core, keep payback inside ${paybackDays} days, then export the playbook to ${expansionCity}.`,
    },
    {
      id: "expansion_budget",
      title: "Expansion Budget",
      tone: "navy",
      actionLabel: "Explain Burn",
      copilotQuery: `Explain the burn-to-scale ratio and regional entry budget for ${summary.marketMetrics.state}, focused on ${city}. Use the ${summary.unitEconomics.launchMode.toLowerCase()} posture, ${marketCapacity.toLocaleString("en-IN")} target workers, INR ${launchCacPerWorker} launch CAC per worker, INR ${regionalEntryBudget.toLocaleString("en-IN")} total entry budget, and show how fast this market can scale without breaking payback discipline.`,
      insight: `${summary.marketMetrics.state}: ${regionalBudgetLabel} launch budget | ${marketCapacity.toLocaleString("en-IN")} workers | Burn-to-scale ${burnToScaleRatio.toFixed(2)}x`,
    },
    {
      id: "revenue_potential",
      title: "Revenue Potential",
      tone: "emerald",
      actionLabel: "Open Revenue",
      copilotQuery: `In ${city}, RAHI projects a Year-1 revenue of INR ${projectedFirstYearRevenue.toLocaleString("en-IN")} with a ${marketShareCapture}% market capture, a ${roi12m.toFixed(0)}% projected 12-month ROI, and a ${paybackDays}-day payback period. Explain the burn-to-scale ratio, launch mode, and the unit-economic multiplier using Delta Profit = (New Workers x Efficiency Gain) x Current Margin. Use ${scalabilityNewWorkers} new workers, an efficiency gain of ${(summary.unitEconomics.operationalEfficiencyGain * 100).toFixed(1)}%, and quantify the uplift as INR ${scalabilityDeltaProfit.toLocaleString("en-IN")} monthly and INR ${scalabilityDeltaProfitAnnualized.toLocaleString("en-IN")} annualized. Also identify ${underservedSector} as the strongest underserved sector and explain how the teal moat identifies captured neighborhoods in ${city}.`,
      insight: `${city}: ${revenuePotentialLabel} Year-1 revenue | ${marketShareCapture}% capture | ${roi12m.toFixed(0)}% ROI | Underserved ${underservedSector} | Delta +${scalabilityDeltaLabel}/mo`,
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
