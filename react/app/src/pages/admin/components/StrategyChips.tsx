import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitAdminCopilotSeed } from "../adminCopilotEvents";
import { useSystemInsights } from "../hooks/useSystemInsights";
import type { StrategyChip, SystemInsightsSummary } from "@/pages/admin/utils/systemInsights";

interface StrategyChipsProps {
  summary: SystemInsightsSummary;
  className?: string;
  onChipClick?: (chip: StrategyChip) => void;
}

const CHIP_ACCENTS: Record<string, string> = {
  local_ops: "bg-sky-500",
  financial_stability: "bg-emerald-500",
  expansion_posture: "bg-[#0F172A]",
};

export function StrategyChips({ summary, className, onChipClick }: StrategyChipsProps) {
  const { chips, loading, provider, fallback } = useSystemInsights(summary);
  const statusLabel = loading
    ? "Refreshing guidance"
    : fallback
      ? "Rule-backed posture"
      : `${String(provider || "cloud").toUpperCase()} guidance`;

  return (
    <section
      className={cn(
        "rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
      style={{ fontFamily: "\"Plus Jakarta Sans\", Inter, system-ui, sans-serif" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Agentic Pulse
          </p>
          <h3 className="mt-2 text-lg font-black text-[#0F172A]">
            Proactive strategy guidance
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Concise action cues generated from market density, unit economics, and system health.
          </p>
        </div>

        <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-700">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-slate-500" />
          )}
          {statusLabel}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {chips.map((chip, index) => (
            <motion.button
              key={`${summary.marketMetrics.city}-${chip.id}-${chip.insight}`}
              type="button"
              onClick={() => {
                if (onChipClick) {
                  onChipClick(chip);
                  return;
                }

                emitAdminCopilotSeed({
                  prompt: chip.copilotQuery,
                  sourceLabel: chip.title,
                  mode: "send",
                });
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, delay: index * 0.04, ease: "easeOut" }}
              className="flex h-full min-h-[132px] flex-col rounded-[26px] border border-slate-200 bg-white px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_34px_-24px_rgba(15,23,42,0.22)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn("h-2.5 w-2.5 rounded-full", CHIP_ACCENTS[chip.id] || "bg-slate-300")} />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {chip.title}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0F172A]">
                      {chip.actionLabel}
                    </p>
                  </div>
                </div>

                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0F172A]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold leading-6 text-[#0F172A]">
                {chip.insight}
              </p>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
