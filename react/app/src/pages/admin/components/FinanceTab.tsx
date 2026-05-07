import {
  ArrowDownCircle,
  CreditCard,
  DollarSign,
  HandCoins,
  PieChart as PieIcon,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "./DataTable";
import { cn } from "@/lib/utils";

interface FinanceTabProps {
  revenue?: number;
  bookings?: Array<{
    _id: string;
    service?: string;
    total_price?: number | string;
    status?: string;
  }>;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({ revenue = 0, bookings = [] }) => {
  const completed = bookings.filter((booking) => booking.status === "completed" && booking.total_price);
  const pendingPayouts = bookings
    .filter((booking) => booking.status === "in_progress" || booking.status === "matched")
    .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
  const avgTicket = completed.length > 0 ? Math.round(revenue / completed.length) : 0;
  const platformShare = Math.round(revenue * 0.08);
  const workerShare = Math.max(0, revenue - platformShare);

  const aggregatedServices = completed.reduce<Record<string, number>>((accumulator, booking) => {
    const service = booking.service || "General";
    accumulator[service] = (accumulator[service] || 0) + Number(booking.total_price || 0);
    return accumulator;
  }, {});

  const tones = ["#34d399", "#818cf8", "#f59e0b", "#38bdf8", "#fb7185", "#22c55e"];
  const serviceData = Object.entries(aggregatedServices).map(([name, value], index) => ({
    name,
    value,
    color: tones[index % tones.length],
  }));

  const revenueTrend = Object.entries(aggregatedServices)
    .slice(0, 5)
    .map(([name, value], index) => ({
      name: name.length > 12 ? `${name.slice(0, 12)}…` : name,
      value,
      fill: index === 0 ? "#34d399" : "#1e293b",
    }));

  const transactionData = completed.slice(0, 8).map((booking) => ({
    id: booking._id,
    method: "Platform Gateway",
    amount: Number(booking.total_price || 0),
    type: "settlement",
    status: "success",
  }));

  return (
    <div className="space-y-5 text-slate-100">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92)_55%,rgba(21,128,61,0.18))] shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                  <WalletCards className="h-3.5 w-3.5" />
                  Financial Posture
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Margin defense, payout pressure, and commission clarity in one finance rail.
                </h2>
                <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300">
                  Treat this view like a CFO console. Read burn, payout exposure, and service yield before widening incentives or overcommitting salaried capacity.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FinanceChip label="Gross value" value={`INR ${revenue.toLocaleString("en-IN")}`} tone="emerald" />
                <FinanceChip label="Platform share" value={`INR ${platformShare.toLocaleString("en-IN")}`} tone="indigo" />
                <FinanceChip label="Worker share" value={`INR ${workerShare.toLocaleString("en-IN")}`} tone="sky" />
                <FinanceChip label="Payout exposure" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/86 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardContent className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Finance doctrine</p>
            <div className="mt-4 space-y-3">
              <FinanceSignal label="Commission lane" value="8%" hint="Investor-safe take rate" tone="indigo" />
              <FinanceSignal label="Average ticket" value={`INR ${avgTicket.toLocaleString("en-IN")}`} hint="Service basket quality" tone="emerald" />
              <FinanceSignal label="Pending settlement" value={`${bookings.filter((booking) => booking.status === "in_progress").length}`} hint="Jobs still clearing payout" tone="amber" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard icon={DollarSign} label="Gross booking value" value={`INR ${revenue.toLocaleString("en-IN")}`} tone="emerald" note="Tracked completed jobs" />
        <FinanceMetricCard icon={ArrowDownCircle} label="RAHI commission" value={`INR ${platformShare.toLocaleString("en-IN")}`} tone="indigo" note="Platform earnings rail" />
        <FinanceMetricCard icon={CreditCard} label="Pending payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" note="Settlement still in motion" />
        <FinanceMetricCard icon={PieIcon} label="Average ticket" value={`INR ${avgTicket.toLocaleString("en-IN")}`} tone="sky" note="Completed booking average" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardHeader className="border-b border-white/10 px-6 py-5">
            <CardTitle className="text-xl font-black text-white">Service yield split</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-4 py-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="h-[18rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceData.length > 0 ? serviceData : [{ name: "No revenue", value: 1, color: "#1e293b" }]}
                    innerRadius={54}
                    outerRadius={86}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(serviceData.length > 0 ? serviceData : [{ name: "No revenue", value: 1, color: "#1e293b" }]).map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `INR ${Number(value).toLocaleString("en-IN")}`}
                    contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "18px", color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {(serviceData.length > 0 ? serviceData : [{ name: "No cleared services yet", value: 0, color: "#1e293b" }]).map((service) => (
                <div key={service.name} className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: service.color }} />
                      <p className="text-sm font-black text-white">{service.name}</p>
                    </div>
                    <p className="font-mono text-sm font-bold text-slate-300">
                      {service.value > 0 ? `INR ${service.value.toLocaleString("en-IN")}` : "--"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.7rem] border border-white/10 bg-slate-950/84 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
          <CardHeader className="border-b border-white/10 px-6 py-5">
            <CardTitle className="text-xl font-black text-white">Cash concentration</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-5">
            <div className="h-[18rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueTrend.length > 0 ? revenueTrend : [{ name: "No data", value: 0, fill: "#1e293b" }]}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <Tooltip
                    formatter={(value) => `INR ${Number(value).toLocaleString("en-IN")}`}
                    contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "18px", color: "#fff" }}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {(revenueTrend.length > 0 ? revenueTrend : [{ name: "No data", value: 0, fill: "#1e293b" }]).map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <DataTable
        title="FINANCIAL LEDGER"
        description="Settlement traffic, payout posture, and cleared booking value."
        columns={[
          { key: "id", label: "Txn ID", render: (value) => <span className="font-mono text-slate-300">#{value}</span> },
          { key: "method", label: "Rail", render: (value) => <span className="inline-flex items-center gap-2 font-mono text-slate-100"><HandCoins className="h-3.5 w-3.5 text-emerald-300" />{value}</span> },
          { key: "amount", label: "Amount", render: (value) => <span className="font-mono text-emerald-300">INR {Number(value).toLocaleString("en-IN")}</span> },
          {
            key: "type",
            label: "Type",
            render: (value) => (
              <span className={cn(
                "inline-flex rounded-full border px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em]",
                value === "payout"
                  ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                  : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
              )}>
                {value}
              </span>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (value) => (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                {value}
              </span>
            ),
          },
        ]}
        data={transactionData.length > 0 ? transactionData : [
          { id: "TXN-0001", method: "Platform Gateway", amount: 0, type: "settlement", status: "waiting" },
        ]}
        variant="hud"
      />
    </div>
  );
};

function FinanceMetricCard({
  icon: Icon,
  label,
  value,
  tone,
  note,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  tone: "emerald" | "indigo" | "amber" | "sky";
  note: string;
}) {
  return (
    <Card className={cn(
      "rounded-[1.55rem] border bg-slate-950/82",
      tone === "emerald" && "border-emerald-400/18",
      tone === "indigo" && "border-indigo-400/18",
      tone === "amber" && "border-amber-400/18",
      tone === "sky" && "border-sky-400/18",
    )}>
      <CardContent className="p-5">
        <div className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl border",
          tone === "emerald" && "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
          tone === "indigo" && "border-indigo-400/20 bg-indigo-400/10 text-indigo-200",
          tone === "amber" && "border-amber-400/20 bg-amber-400/10 text-amber-200",
          tone === "sky" && "border-sky-400/20 bg-sky-400/10 text-sky-200",
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <p className="mt-3 font-mono text-2xl font-black text-white">{value}</p>
        <p className="mt-3 text-xs font-semibold text-slate-300">{note}</p>
      </CardContent>
    </Card>
  );
}

function FinanceChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "indigo" | "amber" | "sky";
}) {
  return (
    <div className={cn(
      "rounded-[1.2rem] border px-4 py-3",
      tone === "emerald" && "border-emerald-400/18 bg-emerald-400/10 text-emerald-100",
      tone === "indigo" && "border-indigo-400/18 bg-indigo-400/10 text-indigo-100",
      tone === "amber" && "border-amber-400/18 bg-amber-400/10 text-amber-100",
      tone === "sky" && "border-sky-400/18 bg-sky-400/10 text-sky-100",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}

function FinanceSignal({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "indigo" | "amber";
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
          tone === "emerald" && "bg-emerald-400/12 text-emerald-200",
          tone === "indigo" && "bg-indigo-400/12 text-indigo-200",
          tone === "amber" && "bg-amber-400/12 text-amber-200",
        )}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-300">{hint}</p>
    </div>
  );
}
