import { ArrowRight, Loader2, Radar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitAdminCopilotSeed } from "../adminCopilotEvents";
import { useSystemInsights } from "../hooks/useSystemInsights";
import type { StrategyChip, SystemInsightsSummary } from "../utils/systemInsights";

interface StrategyPulseProps {
  summary: SystemInsightsSummary;
  className?: string;
}

const CHIP_TONES: Record<StrategyChip["id"], string> = {
  local_ops: "border-sky-200 bg-sky-50/70 text-sky-950",
  financial_stability: "border-amber-200 bg-amber-50/80 text-amber-950",
  expansion_posture: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
};

export function StrategyPulse({ summary, className }: StrategyPulseProps) {
  const { chips, loading, provider, fallback } = useSystemInsights(summary);
  const statusLabel = loading
    ? "Refreshing strategic pulse"
    : fallback
      ? "Rule-backed intent"
      : `${String(provider || "cloud").toUpperCase()} guidance`;

  return (
    <section
      className={cn(
        "rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.18)]",
        className,
      )}
      style={{ fontFamily: "\"Plus Jakarta Sans\", Inter, system-ui, sans-serif" }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-[#0F172A]" />
            Strategic Pulse
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            AI-ranked business intent stays pinned above the mission surface so the admin sees expansion posture, live risk, and yield before digging into the page.
          </p>
        </div>

        <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-700">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <Radar className="h-4 w-4 text-slate-500" />
          )}
          {statusLabel}
        </div>
      </div>

      <div className="mission-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <button
            key={`${chip.id}-${chip.insight}`}
            type="button"
            onClick={() => emitAdminCopilotSeed({
              prompt: chip.copilotQuery,
              sourceLabel: chip.title,
              mode: "send",
            })}
            className={cn(
              "group min-w-[320px] flex-1 rounded-[22px] border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-30px_rgba(15,23,42,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
              CHIP_TONES[chip.id],
            )}
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-current/70">
                  {chip.title}
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-current">
                  {chip.insight}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current/70">
                  Copilot handoff
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-current">
                  {chip.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
