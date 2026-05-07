import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  DollarSign,
  Globe2,
  LineChart,
  Loader2,
  MapPin,
  MessageSquare,
  Radar,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Waypoints,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API } from "@/lib/constants";
import { DataTable } from "./components/DataTable";
import { MissionControlMap } from "./components/MissionControlMap";
import { StrategyChips } from "./components/StrategyChips";
import { StrategyPulse } from "./components/StrategyPulse";
import {
  buildMissionPath,
  buildObservabilityPath,
  buildWarRoomPath,
  DEFAULT_WAR_ROOM_ZONE,
  OBSERVABILITY_PANEL_LABELS,
  type AdminObservabilityPanel,
} from "./adminRoutes";
import { useAdminShellContext } from "./adminShellContext";
import { ADMIN_ISSUE_SEVERITY_WEIGHT, ADMIN_OBSERVABILITY_ISSUES, type ObservabilityIssue } from "./adminSignals";
import { buildSystemInsightsSummary } from "@/pages/admin/utils/systemInsights";
import { buildSimulationGeoConfig, GLOBAL_SIMULATION_CITIES, sectorSeeds } from "@/utils/simulationData";

type CommandOption = {
  id: string;
  label: string;
  meta: string;
  type: "market" | "sector" | "worker";
};

type Tone = "navy" | "emerald" | "sky" | "amber";

type AdminCopilotReply = {
  reply: string;
  navigationTarget?: string | null;
  navigationReason?: string | null;
  auditHighlights?: string[];
  confidence?: "high" | "medium" | "low";
  provider?: string;
  model?: string;
  fallback?: boolean;
};

const getYieldSnapshot = ({
  totalRevenue,
  completedCount,
  fallbackAverageTicket,
  investorSummary,
}: {
  totalRevenue: number;
  completedCount: number;
  fallbackAverageTicket: number;
  investorSummary: ReturnType<typeof useAdminShellContext>["investorSummary"];
}) => {
  const unitEconomics = investorSummary?.unitEconomics;
  const avgTicket = Number(unitEconomics?.avgTicket ?? fallbackAverageTicket ?? 0);
  const commissionPerJob = Number(unitEconomics?.commissionPerJob ?? Math.round(avgTicket * 0.15));
  const marketingPerJob = Number(unitEconomics?.marketingCacPerJob ?? Math.round(avgTicket * 0.028));
  const incentivesPerJob = Number(unitEconomics?.incentivesPerJob ?? Math.round(avgTicket * 0.012));
  const netProfitPerJob = Number(unitEconomics?.netProfitPerJob ?? (commissionPerJob - (marketingPerJob + incentivesPerJob)));
  const totalCommission = Number(unitEconomics?.totalCommission ?? investorSummary?.platformCommission ?? Math.round(totalRevenue * 0.15));
  const sourceLabel = unitEconomics?.source || "frontend fallback";
  const isBackendBacked = Boolean(unitEconomics);

  return {
    avgTicket,
    commissionPerJob,
    marketingPerJob,
    incentivesPerJob,
    netProfitPerJob,
    totalCommission,
    sourceLabel,
    isBackendBacked,
    completedCount: Number(investorSummary?.completedJobs ?? completedCount),
  };
};

export function AdminOverviewPage() {
  const {
    stats,
    chartData,
    activities,
    workersList,
    bookingsList,
    pitchMode,
    routeZoneId,
    zoneLabel,
    globalUptime,
    healthSnapshot,
    llmMode,
    activeWorkerRate,
    averageTicket,
    investorSummary,
    onNavigateTab,
    onSelectWarRoomZone,
  } = useAdminShellContext();

  const weeklyDelta = chartData.length > 1
    ? Number(chartData[chartData.length - 1]?.bookings || 0) - Number(chartData[0]?.bookings || 0)
    : 0;

  const revenueDelta = chartData.length > 1
    ? Number(chartData[chartData.length - 1]?.revenue || 0) - Number(chartData[0]?.revenue || 0)
    : 0;

  const throughputPeak = chartData.reduce((highest, entry) => (
    Number(entry.bookings || 0) > highest ? Number(entry.bookings || 0) : highest
  ), 0);
  const overviewSummary = useMemo(() => buildSystemInsightsSummary({
    routeZoneId,
    zoneLabel,
    stats,
    activeWorkerRate,
    averageTicket,
    globalUptime,
    llmMode,
    healthSnapshot,
    investorSummary,
  }), [
    activeWorkerRate,
    averageTicket,
    globalUptime,
    healthSnapshot,
    investorSummary,
    llmMode,
    routeZoneId,
    stats,
    zoneLabel,
  ]);

  return (
    <ScrollPage>
      <StrategyChips summary={overviewSummary} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(20rem,0.72fr)]">
        <SuitePanel
          eyebrow="Morning Brief"
          title="Operations Pro overview for Karigar 360."
          description="A clean executive surface for live demand, workforce readiness, trust coverage, and unit-economics posture. This route establishes the brand grammar that the rest of RAHI HQ follows."
          icon={Building2}
        >
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
              Market Analytics
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
              Audit coverage active
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
              Live operator routing
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Platform Reach" value={stats.totalUsers.toLocaleString("en-IN")} tone="navy" />
            <MetricTile label="Live Jobs" value={stats.activeBookings.toLocaleString("en-IN")} tone="sky" />
            <MetricTile label="Worker Fleet" value={stats.totalWorkers.toLocaleString("en-IN")} tone="emerald" />
            <MetricTile label="Gross Revenue" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="amber" />
          </div>

          <div className="mt-6 grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Executive framing
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                Growth, reliability, and trust are now aligned inside one operating suite.
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Use this brief as the calm “morning read” before moving into the map-heavy Operations Center. It keeps the investor story disciplined: demand first, staffing second, finance third, and trust always visible.
              </p>
            </div>

            <div className="space-y-3">
              <SignalRow
                label="Booking trend"
                value={weeklyDelta >= 0 ? `+${weeklyDelta} jobs this week` : `${weeklyDelta} jobs this week`}
                tone={weeklyDelta >= 0 ? "emerald" : "amber"}
              />
              <SignalRow
                label="Revenue pace"
                value={revenueDelta >= 0 ? `+INR ${revenueDelta.toLocaleString("en-IN")}` : `INR ${revenueDelta.toLocaleString("en-IN")}`}
                tone={revenueDelta >= 0 ? "navy" : "amber"}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ActionPill label="Open Operations Center" onClick={() => onNavigateTab("intelligence")} />
            <ActionPill label="Review Workforce" onClick={() => onNavigateTab("workers")} />
            <ActionPill label="Review Finance" onClick={() => onNavigateTab("finance")} />
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="System Ribbon"
          title="Boardroom checks"
          description="A compact ribbon of signal health, demand quality, and decision posture."
          icon={ShieldCheck}
        >
          <div className="space-y-3">
            <SignalRow label="Completion Posture" value={`${stats.completedBookings} closed jobs`} tone="navy" />
            <SignalRow label="Pending Queue" value={`${stats.pendingBookings} awaiting action`} tone="amber" />
            <SignalRow label="Cash Lane" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="sky" />
            <SignalRow label="Trust Surface" value="Signed docs + proof active" tone="emerald" />
          </div>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recommendation
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              Keep Overview light, crisp, and institutional. Use the War Room for density drama; use this route for confidence, clarity, and executive trust.
            </p>
          </div>
        </SuitePanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
        <section className="xl:col-span-2 rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                Live City Pulse [{zoneLabel}]
              </p>
              <h2 className="mt-2 text-[1.35rem] font-black text-slate-900">
                Geospatial truth stays visible at the overview layer.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Start the story with a live city surface, not an abstract dashboard. This preview keeps market density, worker spread, and readable geography in view before the investor drills into the full Operations Center.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectWarRoomZone(routeZoneId || DEFAULT_WAR_ROOM_ZONE)}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#0F172A] bg-[#0F172A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Full Theater
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="relative w-full h-full min-h-[450px] overflow-hidden rounded-xl border border-slate-200">
              <MissionControlMap
                activeTab="overview"
                routeZoneId={routeZoneId || DEFAULT_WAR_ROOM_ZONE}
                workers={workersList}
                bookings={bookingsList}
                variant="lite"
                className="h-full min-h-[450px]"
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tactical Preview
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Satellite Hybrid keeps Agra landmarks like Sikandra and Fatehabad Road readable while the overview stays inside the clean Karigar shell.
                </p>
              </div>

              <MetricTile label="Active area" value={zoneLabel} tone="navy" />
              <MetricTile label="Live jobs" value={stats.activeBookings.toLocaleString("en-IN")} tone="sky" />
              <MetricTile label="Worker fleet" value={stats.totalWorkers.toLocaleString("en-IN")} tone="emerald" />
              <MetricTile label="Revenue lane" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="amber" />

              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Demo beat
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Start here, anchor the investor on city density, then open the full theater for command jumps into Chandigarh, New Delhi, or Chennai.
                </p>
              </div>
            </div>
          </div>
        </section>

        <SuitePanel
          eyebrow="Market Analytics"
          title="Seven-day throughput"
          description="A cleaner investor-safe reading of demand motion, with enough contrast to stay useful but enough white space to feel premium."
          icon={BarChart3}
        >
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Throughput peak
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {throughputPeak} jobs
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700">
                Weekly delta {weeklyDelta >= 0 ? `+${weeklyDelta}` : weeklyDelta}
              </div>
            </div>

            <div className="flex items-end gap-3">
            {chartData.map((entry) => {
              const bookings = Number(entry.bookings || 0);
              const height = Math.max(18, bookings * 18);
              return (
                <div key={entry.name} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                  <div className="flex h-44 w-full items-end rounded-[18px] bg-white px-2 py-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                    <div
                      className="w-full rounded-[12px] bg-[#0F172A]"
                      style={{ height: `${Math.min(100, height)}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-900">{bookings}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{entry.name}</p>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="Expansion Playbook"
          title="Operating narrative"
          description="A short professional lane for the investor story: what is stable, what is rising, and where the next executive action belongs."
          icon={Sparkles}
        >
          <div className="space-y-3">
            <FeedItem
              tag="Market"
              tone="navy"
              message="Demand remains readable enough to keep the overview in a clean finance-and-ops posture rather than a high-alert war-room state."
              note="Investor-safe"
            />
            <FeedItem
              tag="Finance"
              tone="amber"
              message={`Gross revenue is INR ${stats.totalRevenue.toLocaleString("en-IN")} with ${stats.activeBookings} jobs currently in motion. Keep margin context adjacent to demand, not buried in a secondary page.`}
              note="Cash discipline"
            />
            <FeedItem
              tag="Trust"
              tone="emerald"
              message="Verification, proof-of-work, and admin-safe document access should remain visible as a core product differentiator."
              note="Brand moat"
            />
          </div>
        </SuitePanel>
      </section>

      {pitchMode ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <SuitePanel
            eyebrow="Pitch Summary"
            title="Boardroom view"
            description="Presentation mode hides operator noise and keeps the investor conversation on growth, trust, and disciplined expansion."
            icon={Sparkles}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Growth lane" value={weeklyDelta >= 0 ? `+${weeklyDelta} jobs` : `${weeklyDelta} jobs`} tone={weeklyDelta >= 0 ? "emerald" : "amber"} />
              <MetricTile label="Revenue pace" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="navy" />
              <MetricTile label="Trust moat" value="Proof + signed docs" tone="sky" />
              <MetricTile label="Next reveal" value="Operations Center" tone="amber" />
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Presentation Narrative"
            title="What to say next"
            description="This strip is tuned for the investor sequence: city demand, operating reliability, and monetization discipline."
            icon={AlertCircle}
          >
            <div className="space-y-3">
              <FeedItem tag="Growth" tone="emerald" message="Demand remains readable and expansion-ready without forcing the admin surface into a technical console." note="Boardroom safe" />
              <FeedItem tag="Profit" tone="amber" message={`Revenue is holding at INR ${stats.totalRevenue.toLocaleString("en-IN")} while margin context stays adjacent to active jobs and payouts.`} note="Unit economics" />
              <FeedItem tag="Trust" tone="sky" message="Verification and proof-of-work remain product strengths, but low-level event streams are intentionally muted during presentation mode." note="Investor clarity" />
            </div>
          </SuitePanel>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SuitePanel
            eyebrow="Operational Log"
            title="Live platform movement"
            description="Activity stays concise here so the surface feels alive without collapsing into a noisy console."
            icon={Activity}
          >
            <div className="space-y-3">
              {activities.slice(0, 5).map((entry, index) => (
                <FeedItem
                  key={`${entry.msg}-${entry.time}-${index}`}
                  tag={entry.role || "Ops"}
                  tone={entry.type === "booking" ? "sky" : "emerald"}
                  message={entry.msg}
                  note={entry.time}
                />
              ))}
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Platform Confidence"
            title="Trust, risk, and route readiness"
            description="A final reading for the morning brief: quality, risk, and system posture stay visible in the same brand language as the customer-facing product."
            icon={AlertCircle}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ADMIN_OBSERVABILITY_ISSUES.map((issue) => (
                <div
                  key={issue.domain}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{issue.domain}</p>
                    <span className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      issue.tone === "amber" && "border-amber-200 bg-white text-amber-700",
                      issue.tone === "emerald" && "border-emerald-200 bg-white text-emerald-700",
                      issue.tone === "sky" && "border-sky-200 bg-white text-sky-700",
                    )}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{issue.message}</p>
                </div>
              ))}
            </div>
          </SuitePanel>
        </section>
      )}
    </ScrollPage>
  );
}

export function AdminWarRoomPage() {
  const {
    stats,
    activities,
    workersList,
    bookingsList,
    healthSnapshot,
    channelLatencyMs,
    activeWorkerRate,
    zoneLabel,
    routeZoneId,
    llmMode,
    llmSummary,
    pendingPayouts,
    averageTicket,
    sevenDayBookings,
    sevenDayRevenue,
    investorSummary,
    globalUptime,
    pitchMode,
    onSelectWarRoomZone,
  } = useAdminShellContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedWorkerId = searchParams.get("worker");

  const commandOptions = useMemo<CommandOption[]>(() => {
    const markets = GLOBAL_SIMULATION_CITIES.map((city) => ({
      id: city.id,
      label: city.label,
      meta: `${city.stateCode || city.country} / launch market`,
      type: "market" as const,
    }));
    const sectors = sectorSeeds.map((sector) => ({
      id: sector.id,
      label: sector.label,
      meta: `${sector.city} / operating sector`,
      type: "sector" as const,
    }));
    const workers = workersList
      .slice(0, 36)
      .map((worker) => ({
        id: String(worker._id || worker.id || worker.phone || worker.name || ""),
        label: worker.name || worker.phone || "Unnamed worker",
        meta: `${worker.profession || worker.service || "Field ops"} / ${worker._id || "No ID"}`,
        type: "worker" as const,
      }))
      .filter((worker) => worker.id);

    return [...markets, ...sectors, ...workers];
  }, [workersList]);

  const highlightedWorker = useMemo(
    () => workersList.find((worker) => String(worker._id || worker.id || "").toLowerCase() === String(highlightedWorkerId || "").toLowerCase()) || null,
    [highlightedWorkerId, workersList],
  );

  const handleWorkerSelect = (workerId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("worker", workerId);
    setSearchParams(next, { replace: true });
  };

  const watchStatus = healthSnapshot?.status === "ok" && llmMode === "ready"
    ? "Healthy"
    : "Watch";
  const activeMarketGeo = useMemo(() => {
    const isGlobalMarket = GLOBAL_SIMULATION_CITIES.some((city) => city.id === routeZoneId);
    return buildSimulationGeoConfig({
      cityId: isGlobalMarket ? routeZoneId || undefined : undefined,
      radiusKm: isGlobalMarket ? 14 : 10,
    });
  }, [routeZoneId]);
  const marketContextLabel = useMemo(() => {
    switch (activeMarketGeo.cityTier) {
      case "pilot":
        return "Pilot Optimization Context";
      case "tier_1":
        return "Tier-1 Expansion Context";
      case "tier_2":
        return "Tier-2 Expansion Context";
      case "tier_3":
        return "Emerging Market Context";
      default:
        return "International Expansion Context";
    }
  }, [activeMarketGeo.cityTier]);
  const effectiveLlmSummary = useMemo(() => {
    if (llmSummary && llmSummary !== "Cloud Engine: Monitoring") {
      return llmSummary;
    }

    if (activeMarketGeo.isExistingMarket) {
      return `Pilot Optimization Context. ${activeMarketGeo.marketContext} Prioritize routing efficiency, worker density, and repeat-demand retention in the active pilot.`;
    }

    return `${marketContextLabel}. ${activeMarketGeo.marketContext} Focus launch readiness on workforce seeding, controlled marketing CAC, and synthetic demand validation before live order history appears.`;
  }, [activeMarketGeo, llmSummary, marketContextLabel]);

  const totalRevenue = Number(investorSummary?.revenue ?? stats.totalRevenue ?? 0);
  const yieldSnapshot = getYieldSnapshot({
    totalRevenue,
    completedCount: stats.completedBookings,
    fallbackAverageTicket: averageTicket,
    investorSummary,
  });
  const warRoomSummary = useMemo(() => buildSystemInsightsSummary({
    routeZoneId,
    zoneLabel,
    stats,
    activeWorkerRate,
    averageTicket,
    globalUptime,
    llmMode,
    healthSnapshot,
    investorSummary,
  }), [
    activeWorkerRate,
    averageTicket,
    globalUptime,
    healthSnapshot,
    investorSummary,
    llmMode,
    routeZoneId,
    stats,
    zoneLabel,
  ]);

  return (
    <div className="mission-scrollbar h-full overflow-y-auto pr-1">
      <div className="grid min-h-full gap-6 p-6 xl:h-full xl:grid-cols-[minmax(0,1.24fr)_minmax(22rem,0.76fr)] xl:grid-rows-[auto_minmax(0,1fr)_minmax(15rem,0.58fr)]">
        <div className="xl:col-span-2">
          <CommandBar
            activeZoneLabel={zoneLabel}
            highlightedWorkerLabel={highlightedWorker?.name || null}
            options={commandOptions}
            onSelectMarket={onSelectWarRoomZone}
            onSelectWorker={handleWorkerSelect}
          />

          <div className="mt-4">
            <StrategyChips summary={warRoomSummary} />
          </div>
        </div>

        <section className="flex min-h-[43rem] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.18)] xl:min-h-0">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Operations Center
              </p>
              <h2 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">
                {zoneLabel} live command map
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Keep the map as the operational foundation, but frame it in a cleaner enterprise container so the geography, workers, and market signals stay legible in daylight.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">
                Satellite Hybrid
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                Fleet readiness {activeWorkerRate}%
              </div>
              <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-700">
                Latency {channelLatencyMs}ms
              </div>
            </div>
          </div>

          <div className="mt-5 h-[32rem] min-h-[32rem] xl:h-[calc(100%-7.5rem)]">
            <MissionControlMap
              activeTab="overview"
              routeZoneId={routeZoneId}
              workers={workersList}
              bookings={bookingsList}
              onZoneSelect={onSelectWarRoomZone}
              highlightWorkerId={highlightedWorkerId}
              className="h-full"
            />
          </div>
        </section>

        <aside className="min-h-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_48px_-34px_rgba(15,23,42,0.18)]">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Market Analytics
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">
                  Market Analytics
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Zone posture, AI routing, and selected worker context in one clean decision surface.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {zoneLabel}
              </div>
            </div>
          </div>

          <div className="mission-scrollbar h-auto overflow-y-visible p-5 xl:h-[calc(100%-7.5rem)] xl:overflow-y-auto">
            <div className="space-y-5">
            <SuitePanel
              eyebrow="Zone Snapshot"
              title="Operational posture"
              description="The map is only half of the story. These are the executive checks that sit beside it."
              icon={Radar}
              surface="flat"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile label="Users" value={stats.totalUsers.toLocaleString("en-IN")} tone="navy" />
                <MetricTile label="Bookings" value={stats.totalBookings.toLocaleString("en-IN")} tone="sky" />
                <MetricTile label="Workers" value={stats.totalWorkers.toLocaleString("en-IN")} tone="emerald" />
                <MetricTile label="Avg ticket" value={`INR ${averageTicket.toLocaleString("en-IN")}`} tone="amber" />
              </div>
            </SuitePanel>

            <SuitePanel
              eyebrow={marketContextLabel}
              title="Market brief"
              description="Professional guidance should feel like a market memo, not a terminal dump."
              icon={LineChart}
              surface="flat"
            >
              <div className="space-y-3">
                <SignalRow label="Area focus" value={zoneLabel} tone="navy" />
                <SignalRow label="Cloud intelligence" value={llmMode === "ready" ? "Live cascade" : "Fallback mode"} tone={llmMode === "ready" ? "emerald" : "amber"} />
                <SignalRow label="Operational health" value={watchStatus} tone={watchStatus === "Healthy" ? "sky" : "amber"} />
                <p className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  {effectiveLlmSummary}
                </p>
              </div>
            </SuitePanel>

            {!pitchMode ? (
              <SuitePanel
                eyebrow="Search Focus"
                title="Selected entity"
                description="Command palette selections stay visible so the map and the sidebar tell the same story."
                icon={Users}
                surface="flat"
              >
                {highlightedWorker ? (
                  <div className="space-y-3">
                    <SignalRow label="Worker" value={highlightedWorker.name || "Unnamed"} tone="emerald" />
                    <SignalRow label="Role" value={String(highlightedWorker.profession || highlightedWorker.service || "Field ops")} tone="sky" />
                    <SignalRow label="Trace" value={String(highlightedWorker._id || highlightedWorker.id || "No ID")} tone="navy" />
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    Use <span className="font-bold text-slate-900">Ctrl/Cmd + K</span> to jump to Chandigarh, Chennai, Kolkata, New Delhi, or a specific worker record.
                  </p>
                )}
              </SuitePanel>
            ) : (
              <SuitePanel
                eyebrow="Expansion Read"
                title="Presentation cues"
                description="Pitch Mode keeps the route centered on geography, unit economics, and the next market jump."
                icon={Globe2}
                surface="flat"
              >
                <div className="space-y-3">
                  <SignalRow label="Primary reveal" value={zoneLabel} tone="navy" />
                  <SignalRow label="Next leap" value="New Delhi or Chandigarh" tone="sky" />
                  <SignalRow label="Narrative" value="Density -> Yield -> Expansion" tone="emerald" />
                </div>
              </SuitePanel>
            )}
            </div>
          </div>
        </aside>

      <section className="xl:col-span-2 min-h-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_48px_-34px_rgba(15,23,42,0.18)]">
        <div className="grid h-full gap-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(22rem,0.82fr)]">
          <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Operational Recommendations
                </p>
                <h3 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">
                  AI copilot recommendation lane
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                  This bottom lane keeps strategy, financial posture, and the verified audit trail in one calm recommendation strip beneath the map.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {llmMode === "ready" ? "AI READY" : "FALLBACK MODE"}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(18rem,0.98fr)]">
              <div className="space-y-3">
                <SignalRow label="Area focus" value={zoneLabel} tone="navy" />
                <SignalRow label="Operational health" value={watchStatus} tone={watchStatus === "Healthy" ? "emerald" : "amber"} />
                <SignalRow label="Pending payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {marketContextLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {effectiveLlmSummary}
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Unit economic stability
                </p>
                <h4 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  Platform Yield / Job
                </h4>
                <p className={cn(
                  "mt-3 text-[1.75rem] font-semibold tracking-tight",
                  yieldSnapshot.netProfitPerJob >= 0 ? "text-emerald-700" : "text-amber-700",
                )}>
                  INR {yieldSnapshot.netProfitPerJob.toLocaleString("en-IN")}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Platform Commission - (Marketing CAC + Incentives)
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricTile label="Commission" value={`INR ${yieldSnapshot.commissionPerJob.toLocaleString("en-IN")}`} tone="navy" />
                  <MetricTile label="CAC" value={`INR ${yieldSnapshot.marketingPerJob.toLocaleString("en-IN")}`} tone="sky" />
                  <MetricTile label="Incentives" value={`INR ${yieldSnapshot.incentivesPerJob.toLocaleString("en-IN")}`} tone="amber" />
                </div>
                <p className="mt-4 text-xs leading-6 text-slate-500">
                  {yieldSnapshot.isBackendBacked
                    ? `Live backend yield rail using ${yieldSnapshot.sourceLabel}. Commission is server-backed; CAC and incentives are refreshed from the admin analytics model.`
                    : "Fallback yield model derived from live order value while the backend finance rail warms up."}
                </p>
              </div>
            </div>
          </div>

          {pitchMode ? (
            <div className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Pitch Summary
              </p>
              <h3 className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">
                Executive expansion read
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricTile label="7D revenue" value={`INR ${sevenDayRevenue.toLocaleString("en-IN")}`} tone="navy" />
                <MetricTile label="Platform yield" value={`INR ${yieldSnapshot.netProfitPerJob.toLocaleString("en-IN")}`} tone={yieldSnapshot.netProfitPerJob >= 0 ? "emerald" : "amber"} />
                <MetricTile label="Active fleet" value={`${activeWorkerRate}%`} tone="emerald" />
                <MetricTile label="Cloud status" value={llmMode === "ready" ? "Ready" : "Fallback"} tone={llmMode === "ready" ? "sky" : "amber"} />
              </div>
              <div className="mt-4 space-y-3">
                <FeedItem tag="Narrative" tone="navy" message={`${zoneLabel} is ready for the map -> yield -> expansion story without exposing the low-level audit stream.`} />
                <FeedItem tag="Economics" tone="amber" message={`Current platform yield is INR ${yieldSnapshot.netProfitPerJob.toLocaleString("en-IN")} per job with pending payouts at INR ${pendingPayouts.toLocaleString("en-IN")}.`} />
                <FeedItem tag="Expansion" tone="emerald" message="Use the command search to jump into Chandigarh or New Delhi once the Agra baseline is established." />
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 gap-0 md:grid-cols-2 xl:grid-cols-1">
              <div className="min-h-0 border-b border-slate-200 p-5 xl:min-h-[13rem]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Verified Audit Trail
                </p>
                <h3 className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">
                  Live operating events
                </h3>
                <div className="mission-scrollbar mt-4 h-[calc(100%-4.2rem)] overflow-y-auto">
                  <div className="space-y-3 pr-1">
                    {activities.slice(0, 6).map((entry, index) => (
                      <FeedItem
                        key={`${entry.msg}-${entry.time}-${index}`}
                        tag={entry.role || "Ops"}
                        tone={entry.type === "booking" ? "sky" : "emerald"}
                        message={entry.msg}
                        note={entry.time}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 p-5 xl:min-h-[13rem]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Executive Metrics
                </p>
                <h3 className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">
                  Business and delivery health
                </h3>
                <div className="mission-scrollbar mt-4 h-[calc(100%-4.2rem)] overflow-y-auto">
                  <div className="grid gap-3 pr-1 sm:grid-cols-2">
                    <MetricTile label="Latency" value={`${channelLatencyMs} ms`} tone="sky" />
                    <MetricTile label="Active fleet" value={`${activeWorkerRate}%`} tone="emerald" />
                    <MetricTile label="7D revenue" value={`INR ${sevenDayRevenue.toLocaleString("en-IN")}`} tone="navy" />
                    <MetricTile label="7D flow" value={`${sevenDayBookings.toLocaleString("en-IN")} jobs`} tone="sky" />
                    <MetricTile label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "Ready" : "Fallback"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber"} />
                    <MetricTile label="Cloud mode" value={llmMode === "ready" ? "Live" : "Fallback"} tone={llmMode === "ready" ? "emerald" : "amber"} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

export function AdminWorkforcePage() {
  const {
    stats,
    loading,
    usersList,
    workersList,
    bookingsList,
    onOpenVerificationDocument,
    verificationViewerLoadingId,
  } = useAdminShellContext();

  const verifiedWorkers = workersList.filter((worker) => worker.status === "verified").length;
  const activeWorkers = workersList.filter((worker) => worker.isAvailable || worker.status === "online").length;

  const workerColumns = [
    { key: "name", label: "Operator", render: (value: string) => <span className="font-semibold text-slate-900">{value || "Unassigned"}</span> },
    { key: "profession", label: "Role", render: (value: string) => <span className="text-slate-600">{value || "General ops"}</span> },
    {
      key: "logisticsScore",
      label: "Trust",
      render: (value: number, row: any) => (
        <span className={cn(
          "font-semibold",
          Number(value || row.reliabilityScore || 0) >= 85 ? "text-emerald-700" : Number(value || row.reliabilityScore || 0) >= 70 ? "text-amber-700" : "text-rose-700",
        )}>
          {Math.round(Number(value || row.reliabilityScore || 0))}%
        </span>
      ),
    },
    {
      key: "isAvailable",
      label: "Lane",
      render: (value: boolean) => (
        <span className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
          value ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
        )}>
          {value ? "Active" : "Busy"}
        </span>
      ),
    },
    {
      key: "verificationDocument",
      label: "Audit",
      render: (_value: unknown, row: any) => {
        const hasAadhaar = Boolean(row?.aadhaar?.public_id || row?.aadhaar?.url || row?.aadhaar_url);
        return hasAadhaar ? (
          <button
            type="button"
            onClick={() => onOpenVerificationDocument(row, "aadhaar")}
            disabled={verificationViewerLoadingId === `${row._id}:aadhaar`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {verificationViewerLoadingId === `${row._id}:aadhaar` ? "Loading" : "Open"}
          </button>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Pending</span>
        );
      },
    },
  ];

  const userColumns = [
    { key: "name", label: "Customer", render: (value: string) => <span className="font-semibold text-slate-900">{value || "Unknown"}</span> },
    { key: "email", label: "Identity", render: (value: string) => <span className="text-slate-600">{value || "N/A"}</span> },
    { key: "phone", label: "Channel", render: (value: string) => <span className="text-slate-500">{value || "--"}</span> },
  ];

  const bookingColumns = [
    { key: "service", label: "Task", render: (value: string) => <span className="font-semibold text-slate-900">{value || "General service"}</span> },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <span className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
          value === "completed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          value === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
          (value === "matched" || value === "in_progress") && "border-sky-200 bg-sky-50 text-sky-700",
        )}>
          {String(value || "pending").replace("_", " ")}
        </span>
      ),
    },
    { key: "total_price", label: "Value", render: (value: number | string) => <span className="font-semibold text-slate-900">INR {Number(value || 0).toLocaleString("en-IN")}</span> },
  ];

  return (
    <ScrollPage>
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SuitePanel
          eyebrow="Workforce"
          title="Worker quality and capacity in one place."
          description="The workforce route isolates trust, verification, and delivery capacity so staffing decisions are not mixed into map or finance views."
          icon={Briefcase}
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Total workers" value={stats.totalWorkers.toLocaleString("en-IN")} tone="navy" />
            <MetricTile label="Available now" value={activeWorkers.toLocaleString("en-IN")} tone="emerald" />
            <MetricTile label="Verified" value={verifiedWorkers.toLocaleString("en-IN")} tone="sky" />
            <MetricTile label="Active jobs" value={stats.activeBookings.toLocaleString("en-IN")} tone="amber" />
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="Operator Guidance"
          title="Read before changing incentives"
          description="A staffing problem and a verification problem look similar from far away. This page separates them."
          icon={ShieldCheck}
        >
          <div className="space-y-3">
            <SignalRow label="Verification coverage" value={`${verifiedWorkers}/${stats.totalWorkers || 0}`} tone="emerald" />
            <SignalRow label="Capacity lane" value={activeWorkers >= Math.max(1, Math.round(stats.totalWorkers * 0.45)) ? "Healthy" : "Thin"} tone={activeWorkers >= Math.max(1, Math.round(stats.totalWorkers * 0.45)) ? "sky" : "amber"} />
            <SignalRow label="Queue posture" value={`${stats.activeBookings} live jobs`} tone="navy" />
          </div>
        </SuitePanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <DataTable
          title="WORKER FLEET"
          description="Trust, verification posture, and lane availability."
          columns={workerColumns}
          data={workersList}
          loading={loading}
          viewportClassName="max-h-[38rem] overflow-auto"
          hideFooter
        />

        <div className="space-y-4">
          <DataTable
            title="CUSTOMER DIRECTORY"
            description="Recent customer records for support and operations."
            columns={userColumns}
            data={usersList.slice(0, 8)}
            loading={loading}
            viewportClassName="max-h-[18rem] overflow-auto"
            hideFooter
          />
          <DataTable
            title="QUEUE SNAPSHOT"
            description="Booking load aligned to current staffing pressure."
            columns={bookingColumns}
            data={bookingsList.slice(0, 8)}
            loading={loading}
            viewportClassName="max-h-[18rem] overflow-auto"
            hideFooter
          />
        </div>
      </section>
    </ScrollPage>
  );
}

export function AdminFinancePage() {
  const { stats, bookingsList, investorSummary, pitchMode } = useAdminShellContext();

  const completed = bookingsList.filter((booking) => booking.status === "completed" && booking.total_price);
  const matchedOrInProgress = bookingsList.filter((booking) => booking.status === "in_progress" || booking.status === "matched");
  const totalRevenue = Number(investorSummary?.revenue ?? stats.totalRevenue ?? 0);
  const yieldSnapshot = getYieldSnapshot({
    totalRevenue,
    completedCount: completed.length,
    fallbackAverageTicket: completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
    investorSummary,
  });
  const completedCount = yieldSnapshot.completedCount;
  const avgTicket = yieldSnapshot.avgTicket;
  const commissionPerJob = yieldSnapshot.commissionPerJob;
  const marketingPerJob = yieldSnapshot.marketingPerJob;
  const incentivesPerJob = yieldSnapshot.incentivesPerJob;
  const netProfitPerJob = yieldSnapshot.netProfitPerJob;
  const totalCommission = yieldSnapshot.totalCommission;
  const pendingPayouts = matchedOrInProgress.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);

  const serviceRevenue = completed.reduce<Record<string, number>>((accumulator, booking) => {
    const key = booking.service || "General";
    accumulator[key] = (accumulator[key] || 0) + Number(booking.total_price || 0);
    return accumulator;
  }, {});

  const topServices = Object.entries(serviceRevenue)
    .map(([service, value]) => ({ service, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);

  const transactionData = completed.slice(0, 10).map((booking) => ({
    id: booking._id,
    service: booking.service || "General service",
    amount: Number(booking.total_price || 0),
    commission: Math.round(Number(booking.commission ?? commissionPerJob)),
    status: booking.status || "completed",
  }));

  return (
    <ScrollPage>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SuitePanel
          eyebrow="Unit Economics"
          title="Net profit per job is visible above the fold."
          description="This card is the investor hook: it makes the business model legible without needing to decode the rest of the dashboard."
          icon={Wallet}
        >
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Formula</p>
              <p className="mt-3 text-2xl font-black text-slate-900">
                Net Profit per Job = Commission - (Marketing CAC + Incentives)
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Commission is pulled from the backend finance rail. CAC and incentives are refreshed from the live admin operating model, not hard-coded mocks.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MetricTile label="Commission" value={`INR ${commissionPerJob}`} tone="navy" />
                <MetricTile label="Marketing CAC" value={`INR ${marketingPerJob}`} tone="amber" />
                <MetricTile label="Incentives" value={`INR ${incentivesPerJob}`} tone="sky" />
              </div>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                {yieldSnapshot.isBackendBacked ? "Live backend outcome" : "Fallback outcome"}
              </p>
              <p className={cn(
                "mt-3 text-4xl font-black",
                netProfitPerJob >= 0 ? "text-emerald-700" : "text-rose-700",
              )}>
                INR {netProfitPerJob}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {yieldSnapshot.isBackendBacked
                  ? `Updated from /api/admin/investor-analytics using ${yieldSnapshot.sourceLabel}.`
                  : "Derived from the current order book while backend finance analytics are unavailable."}
              </p>
            </div>
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="Finance Posture"
          title="A CFO view of the operating model."
          description="The rest of the route supports the headline economics with settlement and service mix context."
          icon={DollarSign}
        >
          <div className="space-y-3">
            <SignalRow label="Gross revenue" value={`INR ${totalRevenue.toLocaleString("en-IN")}`} tone="navy" />
            <SignalRow label="Platform commission" value={`INR ${totalCommission.toLocaleString("en-IN")}`} tone="emerald" />
            <SignalRow label="Pending payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
            <SignalRow label="Average ticket" value={`INR ${avgTicket.toLocaleString("en-IN")}`} tone="sky" />
          </div>
        </SuitePanel>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Completed jobs" value={completedCount.toLocaleString("en-IN")} tone="navy" />
        <MetricTile label="Average ticket" value={`INR ${avgTicket.toLocaleString("en-IN")}`} tone="sky" />
        <MetricTile label="Pending payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
        <MetricTile label="Net per job" value={`INR ${netProfitPerJob.toLocaleString("en-IN")}`} tone={netProfitPerJob >= 0 ? "emerald" : "amber"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <SuitePanel
          eyebrow="Service Yield"
          title="Where revenue is concentrating"
          description="A concise read on the categories carrying the current revenue mix."
          icon={LineChart}
        >
          <div className="space-y-3">
            {topServices.length > 0 ? topServices.map((service, index) => {
              const width = Math.max(16, Math.round((service.value / Math.max(topServices[0]?.value || 1, 1)) * 100));
              return (
                <div key={service.service} className="rounded-[12px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{service.service}</p>
                    <p className="text-sm font-bold text-slate-700">INR {service.value.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        index === 0 ? "bg-slate-900" : index === 1 ? "bg-emerald-600" : index === 2 ? "bg-sky-600" : "bg-amber-500",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No cleared services yet.
              </div>
            )}
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="Investor Read"
          title="How to narrate the economics"
          description="These supporting checks turn the formula into a business conversation."
          icon={Globe2}
        >
          <div className="space-y-3">
            <FeedItem tag="Margin" tone="emerald" message="Commission is locked at 8 percent, which keeps revenue logic clean and explainable." />
            <FeedItem tag="Acquisition" tone="amber" message="Modeled marketing cost is separated from incentives so CAC pressure is visible, not buried." />
            <FeedItem tag="Cash" tone="sky" message="Pending payouts remain visible on the same route, which keeps liquidity risk tied to growth." />
          </div>
        </SuitePanel>
      </section>

      {pitchMode ? (
        <SuitePanel
          eyebrow="Pitch Narrative"
          title="Presentation mode is hiding the raw ledger."
          description="The finance route is now focused on yield, service concentration, and the margin story. Re-enable full operations mode to inspect transaction-level evidence."
          icon={Wallet}
        >
          <div className="space-y-3">
            <FeedItem tag="Yield" tone={netProfitPerJob >= 0 ? "emerald" : "amber"} message={`Platform yield is currently INR ${netProfitPerJob.toLocaleString("en-IN")} per completed job.`} />
            <FeedItem tag="Commission" tone="navy" message={`Total platform commission is INR ${totalCommission.toLocaleString("en-IN")} with an average ticket of INR ${avgTicket.toLocaleString("en-IN")}.`} />
            <FeedItem tag="Cash" tone="amber" message={`Pending payouts remain visible at INR ${pendingPayouts.toLocaleString("en-IN")} so the investor story stays grounded in real operating cash movement.`} />
          </div>
        </SuitePanel>
      ) : (
        <DataTable
          title="FINANCIAL LEDGER"
          description="Completed transactions with commission visibility."
          columns={[
            { key: "id", label: "Txn ID", render: (value) => <span className="font-semibold text-slate-900">#{value}</span> },
            { key: "service", label: "Service", render: (value) => <span className="text-slate-700">{value}</span> },
            { key: "amount", label: "Amount", render: (value) => <span className="font-semibold text-slate-900">INR {Number(value).toLocaleString("en-IN")}</span> },
            { key: "commission", label: "Commission", render: (value) => <span className="font-semibold text-emerald-700">INR {Number(value).toLocaleString("en-IN")}</span> },
            {
              key: "status",
              label: "Status",
              render: (value) => (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  {value}
                </span>
              ),
            },
          ]}
          data={transactionData.length > 0 ? transactionData : [{ id: "TXN-0001", service: "No settled jobs yet", amount: 0, commission: 0, status: "waiting" }]}
          viewportClassName="max-h-[28rem] overflow-auto"
          hideFooter
        />
      )}
    </ScrollPage>
  );
}

export function AdminHeatmapPage() {
  return <AdminWarRoomPage />;
}

export function AdminObservabilityPage() {
  const {
    currentObservabilityPanel,
    healthSnapshot,
    channelLatencyMs,
    activeWorkerRate,
    routeZoneId,
    zoneLabel,
    activities,
    llmMode,
    llmSummary,
    pendingPayouts,
    averageTicket,
    sevenDayBookings,
    sevenDayRevenue,
    pitchMode,
    onSelectTool,
  } = useAdminShellContext();

  const prioritizedIssues = useMemo(() => (
    [...ADMIN_OBSERVABILITY_ISSUES].sort((left, right) => ADMIN_ISSUE_SEVERITY_WEIGHT[right.code] - ADMIN_ISSUE_SEVERITY_WEIGHT[left.code])
  ), []);

  const primaryIssue = prioritizedIssues[0];
  const criticalIssueCount = prioritizedIssues.filter((issue) => issue.severity === "critical").length;

  const systemCards: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: "Database",
      value: healthSnapshot?.database === "connected" ? "Connected" : "Watch",
      tone: healthSnapshot?.database === "connected" ? "emerald" : "amber",
    },
    {
      label: "Secure uploads",
      value: healthSnapshot?.media?.secureUploadsReady ? "Ready" : "Fallback",
      tone: healthSnapshot?.media?.secureUploadsReady ? "sky" : "amber",
    },
    {
      label: "AI cascade",
      value: llmMode === "ready" ? "Live" : "Fallback",
      tone: llmMode === "ready" ? "navy" : "amber",
    },
    {
      label: "Branch",
      value: String(healthSnapshot?.deployment?.branch || "main").toUpperCase(),
      tone: "navy" as const,
    },
  ];

  return (
    <>
      <ScrollPage>
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SuitePanel
          eyebrow="Observability"
          title="A lighter control room for system health."
          description="We kept this route in the same daylight palette as the rest of the suite so the platform reads as one mature product."
          icon={Waypoints}
        >
          <div className="mt-5 flex flex-wrap gap-2">
            {([
              "system-health",
              "bug-monitor",
              "api-telemetry",
              "audit-logs",
            ] as AdminObservabilityPanel[]).map((panel) => (
              <button
                key={panel}
                type="button"
                onClick={() => onSelectTool(panel)}
                className={cn(
                  "rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition",
                  currentObservabilityPanel === panel
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {OBSERVABILITY_PANEL_LABELS[panel]}
              </button>
            ))}
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="Current Panel"
          title={OBSERVABILITY_PANEL_LABELS[currentObservabilityPanel]}
          description="The route stays visually consistent, while the content density steps up to match operator needs."
          icon={ShieldCheck}
        >
          <div className="space-y-3">
            <SignalRow label="Active theater" value={zoneLabel} tone="navy" />
            <SignalRow label="Cloud intelligence" value={llmMode === "ready" ? "Live cascade" : "Fallback mode"} tone={llmMode === "ready" ? "emerald" : "amber"} />
            <SignalRow label="Latency" value={`${channelLatencyMs} ms`} tone="sky" />
            <SignalRow label="Fleet availability" value={`${activeWorkerRate}%`} tone="emerald" />
          </div>
        </SuitePanel>
      </section>

      {pitchMode ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SuitePanel
            eyebrow="Pitch Safe Observability"
            title="Only high-impact assurance signals stay visible."
            description="Presentation mode keeps the conversation on resilience, trust, and financial protection instead of low-level operator telemetry."
            icon={AlertCircle}
          >
            <div className="space-y-3">
              <SignalRow label="Critical incidents" value={String(criticalIssueCount)} tone={criticalIssueCount > 0 ? "amber" : "emerald"} />
              <SignalRow label="Top escalation" value={primaryIssue?.code.replaceAll("_", " ") || "No active incidents"} tone={primaryIssue?.severity === "critical" ? "amber" : "emerald"} />
              <SignalRow label="Primary exposure" value={primaryIssue?.impact || "Trust and revenue are stable"} tone={primaryIssue?.severity === "critical" ? "amber" : "emerald"} />
              <SignalRow label="Recommended action" value={primaryIssue?.recommendedAction || "Monitor only"} tone="navy" />
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Platform Assurance"
            title="Readiness without the console noise"
            description="This lane keeps only the proof points an investor cares about: uptime, secure media, intelligence readiness, and cash protection."
            icon={ShieldCheck}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "Ready" : "Fallback"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber"} />
              <MetricTile label="Cloud mode" value={llmMode === "ready" ? "Live" : "Fallback"} tone={llmMode === "ready" ? "sky" : "amber"} />
              <MetricTile label="Latency" value={`${channelLatencyMs} ms`} tone="navy" />
              <MetricTile label="Pending payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
            </div>
            <div className="mt-4 space-y-3">
              <FeedItem tag="Audit" tone="emerald" message="Low-level logs and API telemetry are muted in Pitch Mode. Switch back to operations mode for full incident forensics." />
              <FeedItem tag="Revenue" tone="amber" message={`The route is still grounded in live exposure: ${sevenDayBookings.toLocaleString("en-IN")} jobs moved INR ${sevenDayRevenue.toLocaleString("en-IN")} over the last seven days.`} />
            </div>
          </SuitePanel>
        </section>
      ) : currentObservabilityPanel === "system-health" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SuitePanel
            eyebrow="System Health"
            title="Core dependencies"
            description="Primary readiness checks across infrastructure, media, and AI."
            icon={Activity}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {systemCards.map((card) => (
                <MetricTile key={card.label} label={card.label} value={card.value} tone={card.tone} />
              ))}
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Operational Summary"
            title="Current platform posture"
            description="A concise read for leadership before drilling into raw logs."
            icon={Sparkles}
          >
            <div className="space-y-3">
              <FeedItem tag="AI" tone={llmMode === "ready" ? "emerald" : "amber"} message={llmSummary} />
              <FeedItem tag="Media" tone={healthSnapshot?.media?.secureUploadsReady ? "sky" : "amber"} message={`Secure media rail is ${healthSnapshot?.media?.secureUploadsReady ? "ready" : "in fallback mode"}.`} />
              <FeedItem tag="Deploy" tone="navy" message={`Current branch is ${String(healthSnapshot?.deployment?.branch || "main").toUpperCase()}.`} />
            </div>
          </SuitePanel>
        </section>
      ) : null}

      {currentObservabilityPanel === "bug-monitor" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SuitePanel
            eyebrow="Bug Monitor"
            title="Prioritized issues"
            description="Incidents are ranked by business impact first, so revenue, bookings, OTP, proof, and assignment failures surface before lower-risk noise."
            icon={AlertCircle}
          >
            <div className="space-y-3">
              {prioritizedIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    "rounded-[22px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
                    issue.severity === "critical"
                      ? "border-rose-200 bg-rose-50/85"
                      : "border-slate-200 bg-slate-50/85",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        issue.tone === "navy" && "border-slate-200 bg-white text-slate-700",
                        issue.tone === "emerald" && "border-emerald-200 bg-white text-emerald-700",
                        issue.tone === "sky" && "border-sky-200 bg-white text-sky-700",
                        issue.tone === "amber" && "border-amber-200 bg-white text-amber-700",
                      )}>
                        {issue.domain}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {issue.code.replaceAll("_", " ")}
                      </span>
                      {issue.severity === "critical" ? (
                        <span className="rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">
                          CRITICAL
                        </span>
                      ) : (
                        <span className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                          issue.severity === "watch"
                            ? "border-amber-200 bg-amber-100 text-amber-700"
                            : "border-emerald-200 bg-emerald-100 text-emerald-700",
                        )}>
                          {issue.severity}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      Weight {ADMIN_ISSUE_SEVERITY_WEIGHT[issue.code]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">
                    {issue.message}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {issue.impact}
                  </p>
                </div>
              ))}
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Recovery Guidance"
            title="What the operator should do next"
            description="The response lane follows the highest-ranked incident automatically so the first action protects revenue and trust."
            icon={ShieldCheck}
          >
            <div className="space-y-3">
              <SignalRow label="Critical incidents" value={String(criticalIssueCount)} tone={criticalIssueCount > 0 ? "amber" : "emerald"} />
              <SignalRow label="Top escalation" value={primaryIssue?.code.replaceAll("_", " ") || "No active incidents"} tone={primaryIssue?.severity === "critical" ? "amber" : "emerald"} />
              <SignalRow label="Primary exposure" value={primaryIssue?.impact || "Trust and revenue are stable"} tone={primaryIssue?.severity === "critical" ? "amber" : "emerald"} />
              <SignalRow label="Recommended action" value={primaryIssue?.recommendedAction || "Monitor only"} tone="navy" />
            </div>
          </SuitePanel>
        </section>
      ) : null}

      {currentObservabilityPanel === "api-telemetry" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SuitePanel
            eyebrow="API Telemetry"
            title="Latency and load"
            description="These metrics connect infrastructure behavior to business throughput."
            icon={Waypoints}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Median latency" value={`${channelLatencyMs} ms`} tone="sky" />
              <MetricTile label="Active fleet" value={`${activeWorkerRate}%`} tone="emerald" />
              <MetricTile label="7D flow" value={`${sevenDayBookings.toLocaleString("en-IN")} jobs`} tone="navy" />
              <MetricTile label="7D revenue" value={`INR ${sevenDayRevenue.toLocaleString("en-IN")}`} tone="amber" />
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Provider Cascade"
            title="Current strategy path"
            description="The LLM lane is visible, but described like an enterprise dependency rather than a developer terminal."
            icon={Globe2}
          >
            <div className="space-y-3">
              <SignalRow label="Reasoning rail" value={llmMode === "ready" ? "Groq -> Gemini" : "Local fallback"} tone={llmMode === "ready" ? "emerald" : "amber"} />
              <SignalRow label="Database" value={healthSnapshot?.database === "connected" ? "Connected" : "Watch"} tone={healthSnapshot?.database === "connected" ? "sky" : "amber"} />
              <SignalRow label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "Ready" : "Fallback"} tone={healthSnapshot?.media?.secureUploadsReady ? "navy" : "amber"} />
            </div>
          </SuitePanel>
        </section>
      ) : null}

      {currentObservabilityPanel === "audit-logs" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SuitePanel
            eyebrow="Audit Logs"
            title="Verified operating trail"
            description="A clean activity log is easier to trust than a noisy console wall."
            icon={ShieldCheck}
          >
            <div className="space-y-3">
              {activities.slice(0, 8).map((entry, index) => (
                <FeedItem
                  key={`${entry.msg}-${entry.time}-${index}`}
                  tag={entry.role || "Ops"}
                  tone={entry.type === "booking" ? "sky" : "emerald"}
                  message={entry.msg}
                  note={entry.time}
                />
              ))}
            </div>
          </SuitePanel>

          <SuitePanel
            eyebrow="Trust Summary"
            title="Media, payouts, and proof"
            description="The right side ties cash movement and proof systems into the same trust narrative."
            icon={Wallet}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Pending payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
              <MetricTile label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "Ready" : "Fallback"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "sky"} />
              <MetricTile label="Deploy branch" value={String(healthSnapshot?.deployment?.branch || "main").toUpperCase()} tone="navy" />
              <MetricTile label="Commit" value={healthSnapshot?.deployment?.commit?.slice(0, 7) || "Syncing"} tone="sky" />
            </div>
          </SuitePanel>
        </section>
      ) : null}
      </ScrollPage>

      {!pitchMode ? (
        <ObservabilityCopilotBubble
          currentPanel={currentObservabilityPanel}
          routeZoneId={routeZoneId}
          zoneLabel={zoneLabel}
          llmMode={llmMode}
          llmSummary={llmSummary}
          healthSnapshot={healthSnapshot}
          latencyMs={channelLatencyMs}
          activeWorkerRate={activeWorkerRate}
          averageTicket={averageTicket}
          pendingPayouts={pendingPayouts}
          sevenDayBookings={sevenDayBookings}
          sevenDayRevenue={sevenDayRevenue}
          issues={prioritizedIssues}
          activities={activities}
        />
      ) : null}
    </>
  );
}

export function AdminSettingsPage() {
  return (
    <ScrollPage>
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SuitePanel
          eyebrow="Platform Settings"
          title="A consistent light suite across every route."
          description="Observability stays in light mode too. That keeps leadership, audit, and operational users inside one brand language."
          icon={ShieldCheck}
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricTile label="Background" value="#F8FAFC" tone="navy" />
            <MetricTile label="Surface" value="#FFFFFF" tone="sky" />
            <MetricTile label="Primary tone" value="#0F172A" tone="emerald" />
            <MetricTile label="Map mode" value="Light command" tone="amber" />
          </div>
        </SuitePanel>

        <SuitePanel
          eyebrow="Next Step"
          title="Global leap demo path"
          description="The recommended investor move is still Agra first, then Cmd/Ctrl + K into Chandigarh for the market-entry reveal."
          icon={MapPin}
        >
          <div className="space-y-3">
            <SignalRow label="Demo open" value="Agra baseline" tone="navy" />
            <SignalRow label="Command jump" value="Chandigarh" tone="sky" />
            <SignalRow label="Investor hook" value="Unit economics + market brief" tone="emerald" />
          </div>
        </SuitePanel>
      </section>
    </ScrollPage>
  );
}

export function AdminLegacyRedirect({
  kind,
}: {
  kind: "war-room" | "workforce" | "system-health" | "bug-monitor" | "audit-logs" | "settings";
}) {
  const params = useParams();

  if (kind === "war-room") {
    return <Navigate to={buildWarRoomPath(params.zoneId || DEFAULT_WAR_ROOM_ZONE)} replace />;
  }

  if (kind === "workforce") {
    return <Navigate to={buildMissionPath("workforce")} replace />;
  }

  if (kind === "settings") {
    return <Navigate to={buildMissionPath("settings")} replace />;
  }

  return <Navigate to={buildObservabilityPath(kind)} replace />;
}

function ObservabilityCopilotBubble({
  currentPanel,
  routeZoneId,
  zoneLabel,
  llmMode,
  llmSummary,
  healthSnapshot,
  latencyMs,
  activeWorkerRate,
  averageTicket,
  pendingPayouts,
  sevenDayBookings,
  sevenDayRevenue,
  issues,
  activities,
}: {
  currentPanel: AdminObservabilityPanel;
  routeZoneId: string;
  zoneLabel: string;
  llmMode: "ready" | "fallback";
  llmSummary: string;
  healthSnapshot: ReturnType<typeof useAdminShellContext>["healthSnapshot"];
  latencyMs: number;
  activeWorkerRate: number;
  averageTicket: number;
  pendingPayouts: number;
  sevenDayBookings: number;
  sevenDayRevenue: number;
  issues: ObservabilityIssue[];
  activities: Array<{ type?: string; msg: string; time: string; role?: string }>;
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("What are the most urgent system failures right now?");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AdminCopilotReply | null>(null);
  const [hasPrimed, setHasPrimed] = useState(false);

  const criticalIssues = useMemo(
    () => issues.filter((issue) => issue.severity === "critical").slice(0, 3),
    [issues],
  );

  const askCopilot = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    const token = localStorage.getItem("adminToken");
    if (!token) {
      toast.error("Admin authentication is required before using the copilot.");
      return;
    }

    setIsLoading(true);

    try {
      const fetchResponse = await fetch(`${API}/admin/copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          currentRoute: `/admin-portal-2026/observability/${currentPanel}`,
          providerPreference: "groq",
          systemContext: {
            currentMission: "observability",
            currentObservabilityPanel: currentPanel,
            currentZoneId: routeZoneId || DEFAULT_WAR_ROOM_ZONE,
            zoneLabel,
            globalUptime: healthSnapshot?.status === "ok" ? "99.90%" : "Watch",
            latencyMs,
            llmMode,
            llmSummary,
            activeWorkerRate,
            activeBugs: issues.filter((issue) => issue.severity === "critical").length,
            pendingPayouts,
            averageTicket,
            sevenDayBookings,
            sevenDayRevenue,
            healthSnapshot,
          },
          issues: issues.slice(0, 8).map((issue) => ({
            code: issue.code,
            domain: issue.domain,
            severity: issue.severity,
            message: issue.message,
            impact: issue.impact,
            recommendedAction: issue.recommendedAction,
          })),
          auditTrail: activities.slice(0, 8).map((entry) => ({
            source: entry.role || entry.type || "audit",
            severity: entry.type === "error" ? "critical" : "info",
            message: entry.msg,
            time: entry.time,
          })),
        }),
      });

      const payload = await fetchResponse.json();
      if (!fetchResponse.ok) {
        throw new Error(payload.message || payload.detail || "Copilot request failed");
      }

      setResponse(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Copilot request failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || hasPrimed) return;

    setHasPrimed(true);
    void askCopilot("What are the most urgent system failures right now, and which admin route should I inspect next?");
  }, [hasPrimed, isOpen]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-30">
      {isOpen ? (
        <div className="pointer-events-auto w-[22rem] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_64px_-28px_rgba(15,23,42,0.26)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">AI Copilot</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">High-impact incident guide</h3>
              <p className="mt-1 text-sm text-slate-600">Loaded with critical failures and the latest audit rail.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Critical queue</p>
              <div className="mt-3 space-y-2">
                {criticalIssues.map((issue) => (
                  <div key={issue.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                    <span>{issue.code.replaceAll("_", " ")}: {issue.domain}</span>
                  </div>
                ))}
              </div>
            </div>

            {response ? (
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-sm leading-7 text-slate-700">{response.reply}</p>
                {response.auditHighlights?.length ? (
                  <div className="mt-3 space-y-2">
                    {response.auditHighlights.slice(0, 3).map((highlight, index) => (
                      <p key={`${highlight}-${index}`} className="text-xs leading-6 text-slate-500">
                        {highlight}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                    {response.confidence || "medium"} confidence
                  </span>
                  {response.provider ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                      {response.provider}
                    </span>
                  ) : null}
                </div>
                {response.navigationTarget ? (
                  <button
                    type="button"
                    onClick={() => navigate(response.navigationTarget || buildObservabilityPath("bug-monitor"))}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800"
                  >
                    Open suggested route
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                Ask why the current failures matter, what is inference versus proof, or which admin route should be inspected next.
              </div>
            )}

            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                className="w-full resize-none border-none bg-transparent text-sm leading-6 text-slate-700 outline-none"
                placeholder="Ask about the current issue queue or the next route to inspect."
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void askCopilot("What is the most urgent incident, and what should the operator do first?")}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-100"
                >
                  Explain failures
                </button>
                <button
                  type="button"
                  onClick={() => void askCopilot(question)}
                  disabled={isLoading || question.trim().length === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                  Ask copilot
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="pointer-events-auto ml-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-white shadow-[0_22px_44px_-24px_rgba(15,23,42,0.38)] transition hover:bg-slate-800"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    </div>
  );
}

function ScrollPage({ children }: { children: ReactNode }) {
  return (
    <div className="mission-scrollbar h-full overflow-y-auto pr-1">
      <div className="space-y-6 p-8 pb-8">{children}</div>
    </div>
  );
}

function SuitePanel({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  surface = "default",
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: typeof Activity;
  children: ReactNode;
  surface?: "default" | "flat";
}) {
  return (
    <section className={cn(
      "rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.18)] backdrop-blur-sm",
      surface === "flat" && "border-0 bg-transparent p-0 shadow-none",
    )}>
      <div className={cn("mb-4 flex items-start justify-between gap-3", surface === "flat" && "px-0")}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            {description}
          </p>
        </div>
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className={cn(
      "min-h-[112px] rounded-[22px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
      tone === "navy" && "border-slate-200 bg-slate-50 text-slate-900",
      tone === "emerald" && "border-emerald-200 bg-emerald-50 text-emerald-800",
      tone === "sky" && "border-sky-200 bg-sky-50 text-sky-800",
      tone === "amber" && "border-amber-200 bg-amber-50 text-amber-800",
    )}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>
      <p className="mt-3 text-[1.45rem] font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function SignalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className={cn(
        "text-sm font-semibold",
        tone === "navy" && "text-slate-900",
        tone === "emerald" && "text-emerald-700",
        tone === "sky" && "text-sky-700",
        tone === "amber" && "text-amber-700",
      )}>
        {value}
      </p>
    </div>
  );
}

function FeedItem({
  tag,
  message,
  note,
  tone,
}: {
  tag: string;
  message: string;
  note?: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn(
          "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
          tone === "navy" && "border-slate-200 bg-white text-slate-700",
          tone === "emerald" && "border-emerald-200 bg-white text-emerald-700",
          tone === "sky" && "border-sky-200 bg-white text-sky-700",
          tone === "amber" && "border-amber-200 bg-white text-amber-700",
        )}>
          {tag}
        </div>
        {note ? (
          <span className="text-xs font-medium text-slate-500">{note}</span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-700">{message}</p>
    </div>
  );
}

function ActionPill({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#0F172A] bg-[#0F172A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function CommandBar({
  activeZoneLabel,
  highlightedWorkerLabel,
  options,
  onSelectMarket,
  onSelectWorker,
}: {
  activeZoneLabel: string;
  highlightedWorkerLabel: string | null;
  options: CommandOption[];
  onSelectMarket: (zoneId: string) => void;
  onSelectWorker: (workerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options.slice(0, 8);

    return options.filter((option) => (
      option.label.toLowerCase().includes(normalizedQuery)
      || option.meta.toLowerCase().includes(normalizedQuery)
      || option.id.toLowerCase().includes(normalizedQuery)
    )).slice(0, 8);
  }, [options, query]);

  return (
    <div className="relative rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Search
          </p>
          <h2 className="mt-2 text-lg font-black text-slate-900">
            Find a market or worker
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">
            Active area: {activeZoneLabel}
          </div>
          {highlightedWorkerLabel ? (
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Worker focus: {highlightedWorkerLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search Agra, Chandigarh, Chennai, Kolkata, New Delhi, or a worker"
          className="w-full rounded-[12px] border border-slate-200 bg-slate-50 py-3 pl-11 pr-24 text-sm text-slate-900 outline-none transition focus:border-slate-400"
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Ctrl/Cmd + K
        </div>
      </div>

      {open && query.trim().length > 0 && filteredOptions.length > 0 ? (
        <div className="absolute inset-x-4 top-[calc(100%-0.15rem)] z-20 mt-2 overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-xl">
          <div className="p-2">
            {filteredOptions.map((option) => (
              <button
                key={`${option.type}-${option.id}`}
                type="button"
                onClick={() => {
                  if (option.type === "worker") {
                    onSelectWorker(option.id);
                  } else {
                    onSelectMarket(option.id);
                  }
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-start justify-between gap-4 rounded-[10px] px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{option.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{option.meta}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {option.type}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
