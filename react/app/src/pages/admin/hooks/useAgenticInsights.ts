import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/constants";
import { buildSimulationGeoConfig, sectorSeeds, type SimulationGeoConfig } from "@/utils/simulationData";
import type { AdminShellContextValue } from "../adminShellContext";
import { buildMissionPath, buildObservabilityPath, buildWarRoomPath } from "../adminRoutes";
import {
  ADMIN_OBSERVABILITY_ISSUES,
  humanizeIssueCode,
  type ObservabilityIssue,
} from "../adminSignals";

const DEMO_ADMIN_TOKEN = "demo-admin-token";
const INSIGHTS_DEBOUNCE_MS = 700;

export type AgenticChipTone = "navy" | "emerald" | "sky" | "amber";
export type AgenticChipKind = "expansion" | "profit" | "risk";

export type AgenticInsightChip = {
  id: AgenticChipKind;
  label: string;
  message: string;
  tone: AgenticChipTone;
  actionLabel: string;
  navigationTarget: string | null;
  source: "local" | "llm";
  confidence: "high" | "medium" | "low";
};

export type AgenticSystemSummary = {
  currentCity: string;
  zoneId: string;
  zoneLabel: string;
  currentMission: string;
  currentRoute: string;
  density: number;
  validatedDensity: number;
  highDemandZones: string[];
  unitEconomics: {
    yieldPerJob: number;
    cacProjected: number;
    paybackDays: number;
  };
  systemHealth: {
    uptime: string;
    criticalBugCodes: string[];
    criticalBugCount: number;
    llmMode: "ready" | "fallback";
  };
  marketContext: {
    isExistingMarket: boolean;
    cityTier: string;
    posture: string;
    projectedRoi: number;
    marketLabel: string;
  };
  activeWorkerRate: number;
  averageTicket: number;
  pendingPayouts: number;
  sevenDayBookings: number;
  sevenDayRevenue: number;
  expansionTargetCity: string;
  expansionTargetRoute: string;
  financeRoute: string;
  riskRoute: string;
  opsRoute: string;
  issues: ObservabilityIssue[];
  auditTrail: Array<{
    source: string;
    severity: "critical" | "watch" | "info";
    message: string;
    time?: string;
  }>;
  llmSummary: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatCurrency = (value: number) => `INR ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const resolveCurrentCity = (context: AdminShellContextValue, geoConfig?: SimulationGeoConfig) => {
  if (geoConfig?.cityLabel) return geoConfig.cityLabel;

  const sector = sectorSeeds.find((entry) => entry.id === context.routeZoneId);
  if (sector?.city) return sector.city;

  return context.zoneLabel || "Agra";
};

const resolveExpansionTarget = (summaryCity: string, currentZoneId: string, isExistingMarket: boolean) => {
  if (!isExistingMarket) {
    return {
      city: summaryCity,
      route: buildWarRoomPath(currentZoneId || "new-delhi"),
    };
  }

  return {
    city: "Chandigarh",
    route: buildWarRoomPath("chandigarh"),
  };
};

const buildDemandZones = (city: string, zoneLabel: string) => {
  const matchingSectors = sectorSeeds
    .filter((sector) => sector.city.toLowerCase() === city.toLowerCase())
    .sort((left, right) => right.demandWeight - left.demandWeight)
    .slice(0, 2)
    .map((sector) => sector.label);

  if (matchingSectors.length > 0) return matchingSectors;
  return [zoneLabel];
};

export const buildAgenticSystemSummary = (
  context: AdminShellContextValue,
  options: {
    geoConfig?: SimulationGeoConfig;
    currentRoute?: string;
  } = {},
): AgenticSystemSummary => {
  const geoConfig = options.geoConfig || buildSimulationGeoConfig({ cityId: context.routeZoneId || "agra" });
  const currentCity = resolveCurrentCity(context, geoConfig);
  const yieldPerJob = Number(context.investorSummary?.unitEconomics?.netProfitPerJob ?? Math.max(0, context.averageTicket * 0.11));
  const cacProjected = Math.max(90, Math.round((context.averageTicket || 600) * (geoConfig.isExistingMarket ? 0.15 : 0.18)));
  const paybackDays = clamp(Math.round(cacProjected / Math.max(yieldPerJob * 0.1, 1)), 7, 30);
  const validatedDensity = Number(clamp(
    ((context.activeWorkerRate / 100) * 0.45)
      + ((geoConfig.demandScale || 1) * 0.32)
      + ((context.stats.activeBookings / Math.max(context.stats.totalWorkers || 1, 1)) * 0.28),
    0.52,
    0.96,
  ).toFixed(2));
  const projectedRoi = clamp(
    Math.round((validatedDensity * 24) + (geoConfig.isExistingMarket ? -2 : 1)),
    12,
    32,
  );
  const criticalBugCodes = ADMIN_OBSERVABILITY_ISSUES
    .filter((issue) => issue.severity === "critical")
    .map((issue) => issue.code);
  const expansionTarget = resolveExpansionTarget(currentCity, context.routeZoneId, geoConfig.isExistingMarket);

  return {
    currentCity,
    zoneId: context.routeZoneId,
    zoneLabel: context.zoneLabel,
    currentMission: context.currentMission,
    currentRoute: options.currentRoute || buildMissionPath(context.currentMission, {
      zoneId: context.routeZoneId,
      panel: context.currentObservabilityPanel,
    }),
    density: validatedDensity,
    validatedDensity,
    highDemandZones: buildDemandZones(currentCity, context.zoneLabel),
    unitEconomics: {
      yieldPerJob,
      cacProjected,
      paybackDays,
    },
    systemHealth: {
      uptime: context.globalUptime,
      criticalBugCodes,
      criticalBugCount: criticalBugCodes.length,
      llmMode: context.llmMode,
    },
    marketContext: {
      isExistingMarket: geoConfig.isExistingMarket,
      cityTier: geoConfig.cityTier,
      posture: geoConfig.isExistingMarket ? "Pilot Optimization" : "Shadow Launch (Freelancer-First)",
      projectedRoi,
      marketLabel: geoConfig.marketLabel,
    },
    activeWorkerRate: context.activeWorkerRate,
    averageTicket: context.averageTicket,
    pendingPayouts: context.pendingPayouts,
    sevenDayBookings: context.sevenDayBookings,
    sevenDayRevenue: context.sevenDayRevenue,
    expansionTargetCity: expansionTarget.city,
    expansionTargetRoute: expansionTarget.route,
    financeRoute: buildMissionPath("finance"),
    riskRoute: buildObservabilityPath("bug-monitor"),
    opsRoute: buildWarRoomPath(context.routeZoneId || "agra-cantt"),
    issues: ADMIN_OBSERVABILITY_ISSUES,
    auditTrail: context.activities.slice(0, 8).map((activity) => ({
      source: activity.role || activity.type || "ops",
      severity: activity.type === "booking" ? "watch" : "info",
      message: activity.msg,
      time: activity.time,
    })),
    llmSummary: context.llmSummary,
  };
};

const buildLocalInsightChips = (summary: AgenticSystemSummary): AgenticInsightChip[] => {
  const topRisk = summary.systemHealth.criticalBugCodes[0];
  const surgeZone = summary.highDemandZones[0] || summary.zoneLabel;
  const isExpansionCity = !summary.marketContext.isExistingMarket;
  const yieldHealthy = summary.unitEconomics.yieldPerJob >= Math.round(summary.unitEconomics.cacProjected * 0.7)
    && summary.pendingPayouts <= Math.max(summary.sevenDayRevenue * 0.35, 1500);

  return [
    {
      id: "expansion",
      label: "Expansion Alpha",
      message: isExpansionCity
        ? `Initiate Shadow Launch for ${summary.currentCity}? Validated Density: ${Math.round(summary.validatedDensity * 100)}%. CAC ${formatCurrency(summary.unitEconomics.cacProjected)} | Payback ${summary.unitEconomics.paybackDays} days | ROI ${summary.marketContext.projectedRoi}%.`
        : `${summary.expansionTargetCity} is tracking close to Agra's pilot benchmark. Shadow Launch posture is ready with CAC ${formatCurrency(summary.unitEconomics.cacProjected)} and ${summary.unitEconomics.paybackDays}-day payback.`,
      tone: "sky",
      actionLabel: isExpansionCity ? "Open Market Entry Brief" : `Open ${summary.expansionTargetCity}`,
      navigationTarget: isExpansionCity ? summary.opsRoute : summary.expansionTargetRoute,
      source: "local",
      confidence: "high",
    },
    {
      id: "profit",
      label: "Profitability",
      message: yieldHealthy
        ? `Yield is holding at ${formatCurrency(summary.unitEconomics.yieldPerJob)}/job. CAC is modeled at ${formatCurrency(summary.unitEconomics.cacProjected)} with a ${summary.unitEconomics.paybackDays}-day recovery window.`
        : `Yield Alert: incentives and payout pressure in ${summary.currentCity} are compressing margin. Review the finance lane before scaling promotions.`,
      tone: yieldHealthy ? "emerald" : "amber",
      actionLabel: "Open Finance",
      navigationTarget: summary.financeRoute,
      source: "local",
      confidence: yieldHealthy ? "medium" : "high",
    },
    {
      id: "risk",
      label: "Risk & Ops",
      message: topRisk
        ? `${humanizeIssueCode(topRisk)} is the top live risk. Protect revenue first, then reopen growth once the issue monitor is clear.`
        : `Surge Detected: ${surgeZone} is operating at ${Math.round(summary.validatedDensity * 170)}% of baseline demand. Deploy 5 freelancers to keep SLAs intact?`,
      tone: topRisk ? "amber" : "navy",
      actionLabel: topRisk ? "Review Issue Monitor" : "Open Operations Center",
      navigationTarget: topRisk ? summary.riskRoute : summary.opsRoute,
      source: "local",
      confidence: "high",
    },
  ];
};

const buildCopilotRequestBody = (message: string, summary: AgenticSystemSummary) => ({
  message,
  currentRoute: summary.currentRoute,
  systemContext: {
    currentMission: summary.currentMission,
    currentZoneId: summary.zoneId,
    zoneLabel: summary.zoneLabel,
    globalUptime: summary.systemHealth.uptime,
    latencyMs: 42,
    llmMode: summary.systemHealth.llmMode,
    llmSummary: summary.llmSummary,
    activeWorkerRate: summary.activeWorkerRate,
    activeBugs: summary.systemHealth.criticalBugCount,
    pendingPayouts: summary.pendingPayouts,
    averageTicket: summary.averageTicket,
    sevenDayBookings: summary.sevenDayBookings,
    sevenDayRevenue: summary.sevenDayRevenue,
    healthSnapshot: {
      status: summary.systemHealth.criticalBugCount > 0 ? "warning" : "ok",
      database: "connected",
      media: {
        secureUploadsReady: true,
      },
      llm: {
        mode: summary.systemHealth.llmMode,
        summary: summary.llmSummary,
      },
    },
  },
  issues: summary.issues,
  auditTrail: summary.auditTrail,
});

const requestRemoteInsightReplies = async (summary: AgenticSystemSummary, token: string) => {
  const prompts: Record<AgenticChipKind, string> = {
    expansion: `Generate one concise expansion insight chip for the RAHI admin suite. Current city: ${summary.currentCity}. If this is not Agra, recommend a Shadow Launch using freelancer-first posture. Mention CAC ${formatCurrency(summary.unitEconomics.cacProjected)}, payback ${summary.unitEconomics.paybackDays} days, and ROI ${summary.marketContext.projectedRoi}% when useful. Keep it under 24 words.`,
    profit: `Generate one concise finance insight chip for the RAHI admin suite. Focus on unit economics, payout pressure, and profit protection. Current yield per job is ${formatCurrency(summary.unitEconomics.yieldPerJob)} and pending payouts are ${formatCurrency(summary.pendingPayouts)}. Keep it under 24 words.`,
    risk: `Generate one concise operations or risk insight chip for the RAHI admin suite. Prioritize critical bugs or surge zones. Critical bug count: ${summary.systemHealth.criticalBugCount}. Surge zones: ${summary.highDemandZones.join(", ")}. Keep it under 24 words.`,
  };

  const entries = await Promise.all(
    (Object.entries(prompts) as Array<[AgenticChipKind, string]>).map(async ([kind, message]) => {
      const response = await fetch(`${API}/admin/copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        body: JSON.stringify(buildCopilotRequestBody(message, summary)),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Strategic insight request failed");
      }

      const payload = await response.json();
      return [kind, String(payload?.reply || "").trim()] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<AgenticChipKind, string>;
};

export const useAgenticInsights = (summary: AgenticSystemSummary) => {
  const summarySignature = useMemo(() => JSON.stringify(summary), [summary]);
  const localInsights = useMemo(() => buildLocalInsightChips(summary), [summarySignature]);
  const [chips, setChips] = useState<AgenticInsightChip[]>(localInsights);
  const [source, setSource] = useState<"local" | "llm">("local");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setChips(localInsights);
    setSource("local");

    const token = localStorage.getItem("adminToken");
    const isDemoMode = localStorage.getItem("adminDemoMode") === "true" || !token || token === DEMO_ADMIN_TOKEN;
    if (isDemoMode) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const remoteReplies = await requestRemoteInsightReplies(summary, token);
        if (cancelled) return;

        setChips([
          {
            ...localInsights[0],
            message: remoteReplies.expansion || localInsights[0].message,
            source: "llm",
          },
          {
            ...localInsights[1],
            message: remoteReplies.profit || localInsights[1].message,
            source: "llm",
          },
          {
            ...localInsights[2],
            message: remoteReplies.risk || localInsights[2].message,
            source: "llm",
          },
        ]);
        setSource("llm");
      } catch {
        if (!cancelled) {
          setChips(localInsights);
          setSource("local");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, INSIGHTS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [summarySignature, localInsights]);

  return {
    chips,
    source,
    loading,
  };
};
