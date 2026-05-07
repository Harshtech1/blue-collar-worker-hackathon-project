import { useState } from "react";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Terminal,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorEntry {
  id: string;
  type: "frontend" | "backend" | "api" | "payment" | "otp";
  message: string;
  source: string;
  time: string;
  count: number;
  status: "unresolved" | "resolved" | "ignored";
  stack?: string;
}

const errors: ErrorEntry[] = [
  {
    id: "err-1",
    type: "api",
    message: "NetworkError: Failed to fetch http://localhost:8000/api/chat",
    source: "ChatAssistant.tsx:71",
    time: "2 mins ago",
    count: 14,
    status: "unresolved",
    stack: "TypeError: Failed to fetch\n  at ChatAssistant.sendMessage (ChatAssistant.tsx:71)\n  at onClick (ChatAssistant.tsx:142)",
  },
  {
    id: "err-2",
    type: "frontend",
    message: "ReferenceError: VOICE_PRESETS.RACHEL_PROFESSIONAL is undefined",
    source: "ChatAssistant.tsx:40",
    time: "15 mins ago",
    count: 1,
    status: "resolved",
  },
  {
    id: "err-3",
    type: "payment",
    message: "PaymentGatewayException: Signature mismatch on callback",
    source: "/api/v1/payments/verify",
    time: "45 mins ago",
    count: 2,
    status: "unresolved",
  },
  {
    id: "err-4",
    type: "otp",
    message: "SMSProviderError: Resource exhausted (limit reached)",
    source: "Twilio Integration",
    time: "1 hour ago",
    count: 42,
    status: "unresolved",
  },
];

export const BugsTab: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(errors[0]?.id || null);

  return (
    <div className="space-y-5 text-slate-100">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.9)_55%,rgba(248,113,113,0.12))] shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                  <Bug className="h-3.5 w-3.5" />
                  Exception Console
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Error telemetry should feel like a live operations console, not a flat issue list.
                </h2>
                <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300">
                  This surface tracks failures by domain, stack, and impact so operators can resolve friction before it becomes a trust problem in the field.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <BugChip label="Unresolved" value={String(errors.filter((entry) => entry.status === "unresolved").length)} tone="rose" />
                <BugChip label="Resolved" value={String(errors.filter((entry) => entry.status === "resolved").length)} tone="emerald" />
                <BugChip label="Payment alerts" value={String(errors.filter((entry) => entry.type === "payment").length)} tone="amber" />
                <BugChip label="API failures" value={String(errors.filter((entry) => entry.type === "api").length)} tone="indigo" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/86 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardContent className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Operator actions</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/[0.09]">
                <Filter className="h-4 w-4" />
                Filter stack domain
              </button>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100">
                <CheckCircle2 className="h-4 w-4" />
                Resolve all low-risk
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <BugSignal label="Most active class" value="OTP / SMS saturation" hint="42 events in one hour" tone="amber" />
              <BugSignal label="Highest severity rail" value="Payment callback mismatch" hint="Customer money path" tone="rose" />
              <BugSignal label="Frontend recovery" value="Voice preset defect fixed" hint="Resolved 15 minutes ago" tone="emerald" />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[1.8rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
        <CardContent className="p-0">
          <div className="divide-y divide-white/8">
            {errors.map((error) => {
              const expanded = expandedId === error.id;

              return (
                <div key={error.id} className={cn("transition", expanded ? "bg-white/[0.03]" : "hover:bg-white/[0.02]")}>
                  <div
                    className="flex cursor-pointer items-start gap-4 px-5 py-5 md:px-6"
                    onClick={() => setExpandedId(expanded ? null : error.id)}
                  >
                    <button className="mt-1 rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-slate-400">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                          error.type === "frontend" && "border-sky-400/25 bg-sky-400/10 text-sky-200",
                          error.type === "backend" && "border-indigo-400/25 bg-indigo-400/10 text-indigo-200",
                          error.type === "api" && "border-amber-400/25 bg-amber-400/10 text-amber-200",
                          (error.type === "payment" || error.type === "otp") && "border-rose-400/25 bg-rose-400/10 text-rose-200",
                        )}>
                          {getStatusIcon(error.type)}
                          {error.type}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                          error.status === "resolved" ? "bg-emerald-400/12 text-emerald-200" : "bg-rose-400/12 text-rose-200",
                        )}>
                          {error.status === "resolved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                          {error.status}
                        </span>
                        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          Occurred {error.time}
                        </span>
                      </div>

                      <h3 className="mt-4 text-base font-black leading-7 text-white md:text-lg">{error.message}</h3>
                      <p className="mt-2 font-mono text-xs text-slate-400">{error.source}</p>
                    </div>

                    <div className="hidden min-w-[5.5rem] rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-center lg:block">
                      <p className="font-mono text-2xl font-black text-white">{error.count}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">events</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-emerald-400/25 hover:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-rose-400/25 hover:text-rose-200">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-white/8 px-5 pb-5 pt-4 md:px-6">
                      <div className="rounded-[1.35rem] border border-white/8 bg-black/40 p-4 font-mono text-[12px] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            Stack trace / exception log
                          </span>
                          <button className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200 transition hover:text-white">
                            Copy trace
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap break-words">{error.stack || "No detailed stack trace available."}</pre>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <ExpandedStat label="Impacted users" value="4 users" />
                        <ExpandedStat label="Browser / env" value="Chrome / Windows" />
                        <ExpandedStat label="Last latency" value="1248 ms" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function getStatusIcon(type: ErrorEntry["type"]) {
  switch (type) {
    case "frontend":
      return <Terminal className="h-3.5 w-3.5" />;
    case "backend":
      return <Bug className="h-3.5 w-3.5" />;
    case "api":
      return <AlertCircle className="h-3.5 w-3.5" />;
    case "payment":
      return <PaymentIcon className="h-3.5 w-3.5" />;
    default:
      return <Bug className="h-3.5 w-3.5" />;
  }
}

function PaymentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function BugChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "emerald" | "amber" | "indigo";
}) {
  return (
    <div className={cn(
      "rounded-[1.2rem] border px-4 py-3",
      tone === "rose" && "border-rose-400/18 bg-rose-400/10 text-rose-100",
      tone === "emerald" && "border-emerald-400/18 bg-emerald-400/10 text-emerald-100",
      tone === "amber" && "border-amber-400/18 bg-amber-400/10 text-amber-100",
      tone === "indigo" && "border-indigo-400/18 bg-indigo-400/10 text-indigo-100",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}

function BugSignal({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "rose" | "amber" | "emerald";
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
          tone === "rose" && "bg-rose-400/12 text-rose-200",
          tone === "amber" && "bg-amber-400/12 text-amber-200",
          tone === "emerald" && "bg-emerald-400/12 text-emerald-200",
        )}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-300">{hint}</p>
    </div>
  );
}

function ExpandedStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-sm font-bold text-white">{value}</p>
    </div>
  );
}
