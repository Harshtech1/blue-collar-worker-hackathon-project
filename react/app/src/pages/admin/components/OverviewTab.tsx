import {
  Activity,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Radar,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { type AdminTab } from "./AdminSidebar";

interface OverviewProps {
  stats: {
    totalUsers: number;
    totalBookings: number;
    totalWorkers: number;
    totalRevenue: number;
    activeBookings: number;
    completedBookings: number;
    pendingBookings: number;
  };
  loading: boolean;
  setActiveTab: (tab: AdminTab) => void;
  chartData?: Array<{ name: string; bookings?: number; revenue?: number }>;
  activities?: Array<{ type?: string; msg: string; time: string; role?: string }>;
}

const metricCards = [
  {
    key: "users" as const,
    label: "Platform Reach",
    note: "User registry growth",
    icon: Users,
    tone: "sky",
  },
  {
    key: "bookings" as const,
    label: "Live Pulse",
    note: "Jobs in motion",
    icon: Activity,
    tone: "indigo",
  },
  {
    key: "workers" as const,
    label: "Fleet Readiness",
    note: "Available operators",
    icon: Briefcase,
    tone: "emerald",
  },
  {
    key: "finance" as const,
    label: "Revenue Posture",
    note: "Gross command value",
    icon: DollarSign,
    tone: "amber",
  },
];

export const OverviewTab: React.FC<OverviewProps> = ({
  stats,
  loading,
  setActiveTab,
  chartData = [],
  activities = [],
}) => {
  const marketData = chartData.length > 0 ? chartData : [{ name: "Now", bookings: 0, revenue: 0 }];
  const resolvedActivities = activities.length > 0
    ? activities
    : [{ msg: "Command surface waiting for fresh activity.", time: "--", role: "SYSTEM", type: "system" }];

  return (
    <div className="space-y-5 text-slate-100">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.82)_55%,rgba(30,41,59,0.75))] shadow-[0_28px_80px_-36px_rgba(2,6,23,1)]">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                  <Radar className="h-3.5 w-3.5" />
                  Command Summary
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                  City-scale operations now read as one command surface, not separate dashboards.
                </h2>
                <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300">
                  Read reach, job velocity, worker readiness, and revenue posture from one dark-matter strip before routing deeper into fleet, dispatch, or finance.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatusChip label="Active bookings" value={String(stats.activeBookings)} tone="indigo" />
                <StatusChip label="Resolved jobs" value={String(stats.completedBookings)} tone="emerald" />
                <StatusChip label="Pending queue" value={String(stats.pendingBookings)} tone="amber" />
                <StatusChip label="Gross value" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="sky" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/86 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardContent className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Command notes</p>
            <div className="mt-4 space-y-3">
              <SignalRow label="Global uptime" value="99.90%" hint="Infrastructure stable" tone="emerald" />
              <SignalRow label="Channel latency" value="42 ms" hint="Realtime rail" tone="sky" />
              <SignalRow label="AI error rate" value="0.04%" hint="Cloud brain healthy" tone="emerald" />
              <SignalRow label="Audit readiness" value="91%" hint="Proof coverage" tone="amber" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          const value = card.key === "users"
            ? stats.totalUsers
            : card.key === "bookings"
              ? stats.totalBookings
              : card.key === "workers"
                ? stats.totalWorkers
                : stats.totalRevenue;

          const action = card.key === "bookings" ? "bookings" : card.key === "workers" ? "workers" : card.key === "finance" ? "finance" : "users";

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setActiveTab(action)}
              className="text-left"
            >
              <Card className={cn(
                "h-full rounded-[1.55rem] border bg-slate-950/82 transition duration-300 hover:-translate-y-1 hover:border-white/20",
                card.tone === "sky" && "border-sky-400/18",
                card.tone === "indigo" && "border-indigo-400/18",
                card.tone === "emerald" && "border-emerald-400/18",
                card.tone === "amber" && "border-amber-400/18",
              )}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl border",
                      card.tone === "sky" && "border-sky-400/20 bg-sky-400/10 text-sky-200",
                      card.tone === "indigo" && "border-indigo-400/20 bg-indigo-400/10 text-indigo-200",
                      card.tone === "emerald" && "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                      card.tone === "amber" && "border-amber-400/20 bg-amber-400/10 text-amber-200",
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </div>

                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
                  <p className="mt-3 font-mono text-3xl font-black text-white">
                    {loading
                      ? "--"
                      : card.key === "finance"
                        ? `INR ${Number(value).toLocaleString("en-IN")}`
                        : Number(value).toLocaleString("en-IN")}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                    <TrendingUp className="h-3 w-3" />
                    {card.note}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardHeader className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Market velocity</p>
                <CardTitle className="mt-2 text-xl font-black text-white">Dispatch throughput</CardTitle>
              </div>
              <div className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100">
                7-day lens
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-5">
            <div className="h-[18.5rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={marketData}>
                  <defs>
                    <linearGradient id="overview-bookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <Tooltip
                    contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "18px", color: "#fff" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: 800 }}
                  />
                  <Area type="monotone" dataKey="bookings" stroke="#818cf8" strokeWidth={3} fill="url(#overview-bookings)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardHeader className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Revenue posture</p>
                <CardTitle className="mt-2 text-xl font-black text-white">Collection momentum</CardTitle>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
                Healthy cash lane
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-5">
            <div className="h-[18.5rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketData}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <Tooltip
                    contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "18px", color: "#fff" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: 800 }}
                  />
                  <Bar dataKey="revenue" radius={[10, 10, 0, 0]}>
                    {marketData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={index === marketData.length - 1 ? "#34d399" : "#1e293b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardHeader className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Live operational log</p>
                <CardTitle className="mt-2 text-xl font-black text-white">Command traffic</CardTitle>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Stream online
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {resolvedActivities.slice(0, 6).map((activity, index) => (
                <div
                  key={`${activity.msg}-${index}`}
                  className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {activity.type === "booking" ? <Activity className="h-3.5 w-3.5 text-indigo-300" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
                      {activity.role || "Ops"}
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-500">{activity.time}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">{activity.msg}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Command posture</p>
              <div className="mt-4 space-y-3">
                <SignalRow label="Queue pressure" value={`${stats.activeBookings} live`} hint="Dispatch load" tone="indigo" />
                <SignalRow label="Proof coverage" value="91%" hint="Audit confidence" tone="emerald" />
                <SignalRow label="Utilization" value="94%" hint="Fleet saturation" tone="amber" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Operator doctrine</p>
              <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-300">
                <DoctrineRow icon={ShieldCheck} copy="Trust rails stay visible so quality decisions are never detached from operations." />
                <DoctrineRow icon={Clock3} copy="Contained scroll keeps the shell readable at 1440px without losing tactical density." />
                <DoctrineRow icon={Radar} copy="The map remains the anchor while every module becomes an operational lens." />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "indigo" | "sky";
}) {
  return (
    <div className={cn(
      "rounded-[1.25rem] border px-4 py-3",
      tone === "emerald" && "border-emerald-400/18 bg-emerald-400/10 text-emerald-100",
      tone === "amber" && "border-amber-400/18 bg-amber-400/10 text-amber-100",
      tone === "indigo" && "border-indigo-400/18 bg-indigo-400/10 text-indigo-100",
      tone === "sky" && "border-sky-400/18 bg-sky-400/10 text-sky-100",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}

function SignalRow({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "amber" | "indigo" | "sky";
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
          tone === "emerald" && "bg-emerald-400/12 text-emerald-200",
          tone === "amber" && "bg-amber-400/12 text-amber-200",
          tone === "indigo" && "bg-indigo-400/12 text-indigo-200",
          tone === "sky" && "bg-sky-400/12 text-sky-200",
        )}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-300">{hint}</p>
    </div>
  );
}

function DoctrineRow({
  icon: Icon,
  copy,
}: {
  icon: typeof ShieldCheck;
  copy: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200">
        <Icon className="h-4 w-4" />
      </div>
      <p>{copy}</p>
    </div>
  );
}
