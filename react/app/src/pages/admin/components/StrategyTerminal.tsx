import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Cpu, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StrategyTerminalStatus = "idle" | "thinking" | "ready" | "error";

export interface StrategyTerminalBrief {
  signal: string;
  reasoning: string;
  procedures: string[];
  provider: string;
  model: string;
  historyId?: string | null;
  saved?: boolean;
  fallback?: boolean;
}

interface StrategyTerminalProps {
  activeZoneId: string;
  activeZoneLabel: string;
  activeCity: string;
  predictedDemand: number;
  liveDensityScore: number;
  liveDemandGap: number;
  auditCoverage: number;
  payoutMultiplier: number;
  timeLensLabel: string;
  simulationAttached: boolean;
  simulationPoints?: number;
  strategyStatus: StrategyTerminalStatus;
  strategyMessage: string;
  strategyBrief: StrategyTerminalBrief | null;
  strategyScript: string;
  providerLabel: string;
  tacticalState: "steady" | "surge" | "analyzing";
  lastExecutedLabel?: string | null;
  primaryInterventionLabel: string;
  secondaryInterventionLabel: string;
  onRunBriefing: () => void;
  onRequestDeepDive: () => void;
  onOpenSimulationLab: () => void;
  onPrimaryIntervention: () => void;
  onSecondaryIntervention: () => void;
  onExecuteStrategy: () => void;
  canExecuteStrategy: boolean;
}

const monoFontFamily = "\"JetBrains Mono\", \"Fira Code\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const ribbonTone = {
  steady: {
    dot: "bg-emerald-400",
    pill: "border-emerald-300/25 bg-emerald-300/12 text-emerald-100",
    label: "Steady State",
  },
  surge: {
    dot: "bg-amber-400",
    pill: "border-amber-300/25 bg-amber-300/12 text-amber-100",
    label: "Density Surge",
  },
  analyzing: {
    dot: "bg-slate-300",
    pill: "border-slate-300/15 bg-slate-300/10 text-slate-100",
    label: "Analyzing",
  },
} as const;

export function StrategyTerminal({
  activeZoneId,
  activeZoneLabel,
  activeCity,
  predictedDemand,
  liveDensityScore,
  liveDemandGap,
  auditCoverage,
  payoutMultiplier,
  timeLensLabel,
  simulationAttached,
  simulationPoints,
  strategyStatus,
  strategyMessage,
  strategyBrief,
  strategyScript,
  providerLabel,
  tacticalState,
  lastExecutedLabel,
  primaryInterventionLabel,
  secondaryInterventionLabel,
  onRunBriefing,
  onRequestDeepDive,
  onOpenSimulationLab,
  onPrimaryIntervention,
  onSecondaryIntervention,
  onExecuteStrategy,
  canExecuteStrategy,
}: StrategyTerminalProps) {
  const typedScript = useTypewriterScript(strategyScript, strategyStatus === "thinking" ? 90 : 56);
  const tone = ribbonTone[tacticalState];

  return (
    <div
      id="strategy-terminal"
      className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]", tone.pill)}>
          <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot, tacticalState !== "steady" && "motion-safe:animate-pulse")} />
          {tone.label}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          System Online
        </div>
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-200/90">Strategy terminal</p>
          <h3 className="mt-2 text-2xl font-black text-indigo-50 2xl:text-[2rem]">RAHI COO briefing for {activeZoneLabel}</h3>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-300 2xl:max-w-2xl">
            This terminal translates simulation pressure, density logic, and LLM strategy into an operating decision your team can act on immediately.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Provider lane</p>
          <p className="mt-2 text-sm font-black text-white">{providerLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <TerminalMetric
          label="Zone route"
          value={`/intelligence/${activeZoneId}`}
          hint={activeCity}
        />
        <TerminalMetric
          label="Simulation state"
          value={simulationAttached ? "Attached" : "Waiting"}
          hint={simulationAttached && simulationPoints
            ? `${simulationPoints.toLocaleString("en-IN")} points in the evidence pack`
            : "Run the 400k engine to attach batch evidence"}
        />
        <TerminalMetric
          label="Forecast lens"
          value={timeLensLabel}
          hint={`${predictedDemand} predicted jobs in focus`}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TerminalMetric label="Density" value={liveDensityScore.toFixed(2)} hint="Live pressure" compact />
        <TerminalMetric label="Gap" value={`${liveDemandGap > 0 ? "+" : ""}${liveDemandGap}`} hint="Demand delta" compact />
        <TerminalMetric label="Audit" value={`${auditCoverage.toFixed(0)}%`} hint="Proof coverage" compact />
        <TerminalMetric label="Payout" value={`${payoutMultiplier.toFixed(2)}x`} hint="Recommended lane" compact />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRunBriefing}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
        >
          {strategyStatus === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Run zone briefing
        </button>
        <button
          type="button"
          onClick={onRequestDeepDive}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.12]"
        >
          <Cpu className="h-4 w-4" />
          Request deep dive
        </button>
        <button
          type="button"
          onClick={onOpenSimulationLab}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/20"
        >
          <ChevronRight className="h-4 w-4" />
          Open simulation lab
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPrimaryIntervention}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-300"
        >
          {primaryInterventionLabel}
        </button>
        <button
          type="button"
          onClick={onSecondaryIntervention}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:-translate-y-0.5 hover:bg-white/[0.12]"
        >
          {secondaryInterventionLabel}
        </button>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border",
            strategyStatus === "thinking"
              ? "border-slate-300/30 bg-slate-300/10 text-slate-100"
              : strategyStatus === "ready"
                ? "border-indigo-300/30 bg-indigo-300/10 text-indigo-100"
                : strategyStatus === "error"
                  ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                  : "border-white/10 bg-white/[0.04] text-slate-300",
          )}>
            {strategyStatus === "thinking" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : strategyStatus === "ready" ? (
              <StrategyChip />
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

        <div className="mt-5 rounded-[1.4rem] border border-indigo-300/20 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_50px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200/80">Typewritten briefing stream</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                The command center exposes reasoning before the recommendation lands.
              </p>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
              strategyStatus === "thinking"
                ? "bg-slate-300/12 text-slate-100"
                : strategyStatus === "error"
                  ? "bg-amber-300/12 text-amber-100"
                  : "bg-indigo-300/12 text-indigo-100",
            )}>
              {strategyStatus === "thinking" ? "Streaming" : strategyStatus === "error" ? "Fallback" : "Ready"}
            </span>
          </div>

          <pre
            className="mt-4 min-h-[14rem] whitespace-pre-wrap break-words text-[13px] leading-6 text-indigo-50 2xl:min-h-[16rem] 2xl:text-[14px]"
            style={{ fontFamily: monoFontFamily }}
          >
            {typedScript}
            <span className={cn("rahi-terminal-caret", strategyStatus !== "error" && "bg-emerald-200")} />
          </pre>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-400">
              {lastExecutedLabel ? `Last deployment synced to ${lastExecutedLabel}.` : "No AI deployment has been executed in the simulation yet."}
            </p>
            <button
              type="button"
              onClick={onExecuteStrategy}
              disabled={!canExecuteStrategy}
              className={cn(
                "inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] transition",
                canExecuteStrategy
                  ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 hover:bg-emerald-300"
                  : "cursor-not-allowed bg-slate-800 text-slate-500",
              )}
            >
              Execute AI Strategy
            </button>
          </div>
        </div>

        {strategyBrief ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3">
              {strategyBrief.procedures.map((procedure, index) => (
                <div
                  key={`${procedure}-${index}`}
                  className="flex gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-xs font-black text-indigo-100">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold leading-6 text-slate-100">{procedure}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TerminalMetric
                label="Model"
                value={strategyBrief.model || "density-rule-fallback"}
                hint={strategyBrief.fallback ? "Fallback rules are active" : "LLM-backed strategy"}
              />
              <TerminalMetric
                label="History"
                value={strategyBrief.saved ? "Persisted" : "Local only"}
                hint={strategyBrief.historyId ? `History id ${strategyBrief.historyId}` : "No Mongo history row written"}
              />
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[1.4rem] border border-dashed border-white/10 px-4 py-5 text-sm font-semibold leading-6 text-slate-300">
            No strategy briefing yet. Run the simulation or trigger a zone briefing to see the signal, reasoning, and next procedures.
          </div>
        )}
      </div>
    </div>
  );
}

function TerminalMetric({
  label,
  value,
  hint,
  compact = false,
}: {
  label: string;
  value: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-4 py-3",
      compact && "py-2.5",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-white" style={{ fontFamily: monoFontFamily }}>{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function StrategyChip() {
  return (
    <div className="grid h-5 w-5 grid-cols-2 gap-0.5">
      {[...Array(4)].map((_, index) => (
        <span key={index} className="rounded-[3px] bg-current/90" />
      ))}
    </div>
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

function useTypewriterScript(script: string, intervalMs = 56) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const tokens = useMemo(() => script.split(/(\s+)/).filter(Boolean), [script]);
  const [visibleTokenCount, setVisibleTokenCount] = useState(tokens.length);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleTokenCount(tokens.length);
      return undefined;
    }

    setVisibleTokenCount(0);

    if (tokens.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setVisibleTokenCount((current) => {
        if (current >= tokens.length) {
          window.clearInterval(intervalId);
          return current;
        }

        return current + 1;
      });
    }, Math.max(20, intervalMs));

    return () => window.clearInterval(intervalId);
  }, [intervalMs, prefersReducedMotion, tokens]);

  return useMemo(() => tokens.slice(0, visibleTokenCount).join(""), [tokens, visibleTokenCount]);
}
