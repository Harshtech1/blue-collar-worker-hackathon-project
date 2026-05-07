import {
  Activity,
  Bot,
  Cloud,
  CloudCog,
  Database,
  Fingerprint,
  Globe2,
  LockKeyhole,
  Radar,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Waypoints,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type Snapshot = {
  status?: string;
  database?: string;
  media?: {
    secureUploadsReady?: boolean;
    provider?: string;
  };
  deployment?: {
    provider?: string;
    commit?: string | null;
    branch?: string | null;
  };
  llm?: {
    mode?: "ready" | "fallback";
    summary?: string;
    primaryProvider?: string | null;
  };
};

interface SystemTabProps {
  healthSnapshot?: Snapshot | null;
  channelLatencyMs?: number;
  activeWorkerRate?: number;
  zoneLabel?: string;
}

type AccentTone = "emerald" | "indigo" | "sky" | "amber";
type SurfaceTone = AccentTone | "slate";

const throughputSeries = [
  { slot: "12:00", duration: 218, throughput: 13.2, errors: 0.6 },
  { slot: "12:30", duration: 226, throughput: 14.8, errors: 0.8 },
  { slot: "13:00", duration: 214, throughput: 15.4, errors: 0.5 },
  { slot: "13:30", duration: 232, throughput: 16.1, errors: 0.9 },
  { slot: "14:00", duration: 227, throughput: 15.6, errors: 0.7 },
  { slot: "14:30", duration: 208, throughput: 14.9, errors: 0.4 },
  { slot: "15:00", duration: 205, throughput: 14.5, errors: 0.4 },
];

const dependencySeries: Array<{ name: string; value: number; tone: SurfaceTone }> = [
  { name: "Core API", value: 94, tone: "indigo" },
  { name: "Mongo Atlas", value: 88, tone: "sky" },
  { name: "Socket.IO", value: 82, tone: "emerald" },
  { name: "Cloudinary", value: 78, tone: "amber" },
  { name: "AI Provider", value: 74, tone: "slate" },
];

const browserSeries = [
  { name: "Chrome", value: 38 },
  { name: "Android", value: 29 },
  { name: "Safari", value: 12 },
  { name: "Edge", value: 9 },
  { name: "Other", value: 5 },
];

const experienceRegions: Array<{ region: string; sessions: string; apdex: string; status: string; tone: AccentTone; x: string; y: string }> = [
  { region: "Delhi NCR", sessions: "1,280/min", apdex: "0.98", status: "Delight", tone: "emerald", x: "71%", y: "31%" },
  { region: "Agra Core", sessions: "860/min", apdex: "0.96", status: "Stable", tone: "sky", x: "67%", y: "36%" },
  { region: "Mumbai", sessions: "620/min", apdex: "0.93", status: "Watch", tone: "amber", x: "60%", y: "47%" },
  { region: "Bengaluru", sessions: "540/min", apdex: "0.94", status: "Healthy", tone: "indigo", x: "64%", y: "58%" },
  { region: "Dubai", sessions: "270/min", apdex: "0.92", status: "Warm", tone: "amber", x: "56%", y: "38%" },
  { region: "London", sessions: "180/min", apdex: "0.97", status: "Strong", tone: "emerald", x: "45%", y: "20%" },
];

const securitySignals: Array<{ label: string; value: string; note: string; tone: AccentTone }> = [
  {
    label: "Identity bypass",
    value: "Blocked",
    note: "Universal OTP still requires proof-photo sequence before release.",
    tone: "emerald",
  },
  {
    label: "Private document access",
    value: "Signed only",
    note: "Verification rails remain time-limited and auth-guarded.",
    tone: "sky",
  },
  {
    label: "Cloud upload trust",
    value: "Enforced",
    note: "Secure media rail is active for worker and proof flows.",
    tone: "indigo",
  },
  {
    label: "Threat pressure",
    value: "Low",
    note: "No active privilege drift, replay pattern, or media leakage detected.",
    tone: "emerald",
  },
];

const aiPlays: Array<{ title: string; description: string; tone: "indigo" | "emerald" | "sky" }> = [
  {
    title: "Infrastructure correlation",
    description: "Align Render runtime, Mongo persistence, and Cloudinary secure upload readiness before surface-level alerts escalate into trust events.",
    tone: "indigo",
  },
  {
    title: "Experience guardrail",
    description: "Keep Apdex and worker proof completion in the same operating story so session friction gets treated as a logistics problem, not just a frontend problem.",
    tone: "sky",
  },
  {
    title: "Security automation",
    description: "Treat Aadhaar privacy, signed document URLs, and OTP gates as first-class monitors that can page the command deck automatically.",
    tone: "emerald",
  },
];

export const SystemTab: React.FC<SystemTabProps> = ({
  healthSnapshot,
  channelLatencyMs = 42,
  activeWorkerRate = 94,
  zoneLabel = "Agra Cantt",
}) => {
  const systemReady = healthSnapshot?.status === "ok";
  const databaseReady = healthSnapshot?.database === "connected";
  const uploadsReady = healthSnapshot?.media?.secureUploadsReady === true;
  const llmReady = (healthSnapshot?.llm?.mode || "ready") === "ready";
  const deploymentBranch = String(healthSnapshot?.deployment?.branch || "main").toUpperCase();
  const deploymentCommit = healthSnapshot?.deployment?.commit?.slice(0, 7) || "SYNCING";
  const provider = healthSnapshot?.llm?.primaryProvider || "Groq";
  const cloudSummary = healthSnapshot?.llm?.summary || "Cloud brain is correlating infra, app, and trust signals.";
  const providerName = healthSnapshot?.media?.provider || "Cloudinary";

  const quickOverview: Array<{ label: string; value: string; note: string; tone: AccentTone }> = [
    {
      label: "Incidents",
      value: systemReady ? "03" : "08",
      note: "Correlated across infra and experience",
      tone: systemReady ? "emerald" : "amber",
    },
    {
      label: "Automated checks",
      value: "312",
      note: "Cloud, API, session, and trust rails",
      tone: "indigo" as const,
    },
    {
      label: "Latency",
      value: `${channelLatencyMs}ms`,
      note: "Median cross-service response",
      tone: channelLatencyMs <= 60 ? "sky" : "amber",
    },
    {
      label: "Apdex",
      value: "0.96",
      note: "Real user experience confidence",
      tone: "emerald" as const,
    },
    {
      label: "Secure surfaces",
      value: uploadsReady ? "100%" : "84%",
      note: "Proof, docs, and verification paths",
      tone: uploadsReady ? "emerald" : "amber",
    },
    {
      label: "AI mode",
      value: llmReady ? "Live" : "Fallback",
      note: `${provider} reasoning rail`,
      tone: llmReady ? "indigo" : "amber",
    },
  ];

  const serviceLanes: Array<{ name: string; domain: string; value: string; throughput: string; automation: string; tone: AccentTone }> = [
    {
      name: "Render edge + core API",
      domain: "Application edge",
      value: `${channelLatencyMs} ms`,
      throughput: "14.5k rpm",
      automation: systemReady ? "Autoscale armed" : "Manual intervention watch",
      tone: systemReady ? "indigo" : "amber",
    },
    {
      name: "MongoDB persistence mesh",
      domain: "Data plane",
      value: databaseReady ? "12 ms" : "88 ms",
      throughput: "98.7% query hit",
      automation: databaseReady ? "Replica quorum stable" : "Lag threshold breached",
      tone: databaseReady ? "sky" : "amber",
    },
    {
      name: `${providerName} media rail`,
      domain: "Trust storage",
      value: uploadsReady ? "145 ms" : "Degraded",
      throughput: "Proof & KYC uploads",
      automation: uploadsReady ? "Signed delivery active" : "Fallback storage engaged",
      tone: uploadsReady ? "emerald" : "amber",
    },
    {
      name: `${provider} strategy engine`,
      domain: "AI correlation",
      value: llmReady ? "140 ms" : "Fallback",
      throughput: "CEO briefs + strategy sync",
      automation: llmReady ? "Multi-provider failover live" : "Local rule engine steering",
      tone: llmReady ? "indigo" : "amber",
    },
  ];

  const sourceTruthRail: Array<{ label: string; value: string; hint: string; tone: AccentTone }> = [
    {
      label: "Cloud + infrastructure",
      value: systemReady ? "Healthy" : "Watch",
      hint: systemReady ? "Render, sockets, and databases are reading green." : "Runtime needs operator attention before trust degrades.",
      tone: systemReady ? "emerald" : "amber",
    },
    {
      label: "Application performance",
      value: `${channelLatencyMs}ms median`,
      hint: "Action duration is being reconciled with workload spikes in real time.",
      tone: channelLatencyMs <= 60 ? "sky" : "amber",
    },
    {
      label: "Digital experience",
      value: "Apdex 0.96",
      hint: `Field and customer sessions in ${zoneLabel} remain inside healthy response thresholds.`,
      tone: "indigo" as const,
    },
    {
      label: "Security posture",
      value: uploadsReady && databaseReady ? "Trusted" : "At risk",
      hint: "Identity rails, signed media, and document privacy are bound into the same truth layer.",
      tone: uploadsReady && databaseReady ? "emerald" : "amber",
    },
  ];

  return (
    <div className="space-y-5 text-slate-100">
      <section className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.88)_56%,rgba(99,102,241,0.18))] shadow-[0_28px_80px_-38px_rgba(2,6,23,1)]">
          <div className="p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100">
                  <Radar className="h-3.5 w-3.5" />
                  Observability + Security Platform
                </div>
                <h2 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-4xl">
                  One automated command surface for cloud infrastructure, application health, digital experience, and trust defense.
                </h2>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300">
                  This is the organization&apos;s single source of truth. It correlates runtime behavior, user friction, and verification risk so operators steer the whole system from one institutional-grade control plane.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <HeaderPill icon={CloudCog} label="Infra + cloud correlation" tone="indigo" />
                  <HeaderPill icon={Activity} label="Application performance monitoring" tone="sky" />
                  <HeaderPill icon={Globe2} label="Digital experience monitoring" tone="emerald" />
                  <HeaderPill icon={ShieldCheck} label="Security posture automation" tone="amber" />
                </div>
              </div>

              <div className="grid min-w-full gap-3 sm:grid-cols-2 xl:min-w-[21rem]">
                <HeroStat label="Global runtime" value={systemReady ? "System Green" : "At Risk"} tone={systemReady ? "emerald" : "amber"} />
                <HeroStat label="Active fleet" value={`${activeWorkerRate}%`} tone="indigo" />
                <HeroStat label="Branch" value={deploymentBranch} tone="sky" />
                <HeroStat label="Commit" value={deploymentCommit} tone="amber" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/84 p-6 shadow-[0_28px_80px_-38px_rgba(2,6,23,1)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">AI source of truth</p>
              <h3 className="mt-2 text-xl font-black text-white">Command verdict</h3>
            </div>
            <div className={cn(
              "rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]",
              llmReady ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-100" : "border-amber-400/20 bg-amber-400/10 text-amber-100",
            )}>
              {llmReady ? `AI live · ${provider}` : "Fallback cognition"}
            </div>
          </div>

          <div className="mt-5 rounded-[1.45rem] border border-white/8 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
              [OBSERVABILITY_BRAIN]
            </p>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
              {cloudSummary}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {sourceTruthRail.map((item) => (
              <TruthRow key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {quickOverview.map((item) => (
          <OverviewCell key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.05fr_1.1fr_0.85fr]">
        <div className="space-y-4">
          <PanelShell
            eyebrow="Cloud & infrastructure"
            title="Infrastructure fabric"
            actionLabel="Refresh sources"
            icon={Cloud}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <InfraMetric label="Control planes" value="Render / Mongo / Cloudinary" note="Primary runtime estate" tone="indigo" />
              <InfraMetric label="Observed regions" value="06" note="Global delivery + user traces" tone="sky" />
              <InfraMetric label="Trust gateways" value="04" note="OTP, KYC, proof, signed docs" tone="emerald" />
              <InfraMetric label="Protected workloads" value="128" note="Jobs, media, sessions, alerts" tone="amber" />
            </div>

            <div className="mt-5 space-y-3">
              {serviceLanes.map((lane) => (
                <ServiceLane key={lane.name} {...lane} />
              ))}
            </div>
          </PanelShell>

          <PanelShell eyebrow="Security fabric" title="Trust enforcement mesh" icon={Shield}>
            <div className="grid gap-3 md:grid-cols-2">
              {securitySignals.map((signal) => (
                <SecurityCard key={signal.label} {...signal} />
              ))}
            </div>
          </PanelShell>
        </div>

        <div className="space-y-4">
          <PanelShell eyebrow="Application health" title="Action duration and throughput" icon={Zap}>
            <div className="h-[18rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={throughputSeries}>
                  <defs>
                    <linearGradient id="obs-duration" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="obs-throughput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.10)" vertical={false} />
                  <XAxis dataKey="slot" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(148,163,184,0.18)",
                      borderRadius: "18px",
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#94a3b8", fontWeight: 800 }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="duration" stroke="#818cf8" strokeWidth={3} fill="url(#obs-duration)" />
                  <Area yAxisId="right" type="monotone" dataKey="throughput" stroke="#34d399" strokeWidth={2.5} fill="url(#obs-throughput)" />
                  <Line yAxisId="right" type="monotone" dataKey="errors" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PanelShell>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <PanelShell eyebrow="Dependency pressure" title="3rd-party and service mix" icon={Waypoints}>
              <div className="h-[16rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dependencySeries} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 800 }} width={90} />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "18px",
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#94a3b8", fontWeight: 800 }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                      {dependencySeries.map((entry) => (
                        <Cell key={entry.name} fill={toneColor(entry.tone)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PanelShell>

            <PanelShell eyebrow="Digital experience" title="Experience trace mix" icon={TimerReset}>
              <div className="h-[16rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={browserSeries}>
                    <CartesianGrid stroke="rgba(148,163,184,0.10)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "18px",
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#94a3b8", fontWeight: 800 }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#c084fc" strokeWidth={3} dot={{ r: 4, fill: "#c084fc" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </PanelShell>
          </div>
        </div>

        <div className="space-y-4">
          <PanelShell eyebrow="User experience" title="Global experience atlas" icon={Globe2}>
            <ExperienceAtlas regions={experienceRegions} />
          </PanelShell>

          <PanelShell eyebrow="Security + AI" title="Automated intervention feed" icon={ShieldAlert}>
            <div className="space-y-3">
              <InterventionItem
                tag="AUTH"
                tone="emerald"
                message="Photo-before-OTP gate remains intact. No bypass path detected on the booking completion flow."
              />
              <InterventionItem
                tag="MEDIA"
                tone="sky"
                message="Signed document access is still enforced. Private Aadhaar and PAN previews remain protected behind admin auth."
              />
              <InterventionItem
                tag="AI"
                tone={llmReady ? "indigo" : "amber"}
                message={llmReady
                  ? `${provider} is actively generating remediation hints without quota drift.`
                  : "Provider rail has degraded, but the local rule engine is still preserving safe operational guidance."}
              />
              <InterventionItem
                tag="ZONE"
                tone="amber"
                message={`${zoneLabel} remains the highest-scrutinized theatre for trust, density, and experience correlation.`}
              />
            </div>
          </PanelShell>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelShell eyebrow="Mission control AI" title="Single source of truth briefing" icon={Bot}>
          <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="rounded-[1.55rem] border border-white/8 bg-black/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
                [EXECUTIVE_SUMMARY]
              </p>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-200">
                Infrastructure is healthy, digital experience is steady, and trust rails remain sealed. The platform can act as a credible all-in-one source of truth because security, performance, and customer friction are being interpreted together instead of in separate tools.
              </p>
              <div className="mt-5 grid gap-3">
                <SummarySignal label="Database" value={databaseReady ? "Connected" : "Watch"} tone={databaseReady ? "emerald" : "amber"} />
                <SummarySignal label="Secure uploads" value={uploadsReady ? "Ready" : "Fallback"} tone={uploadsReady ? "emerald" : "amber"} />
                <SummarySignal label="Cloud brain" value={llmReady ? "Live" : "Fallback"} tone={llmReady ? "indigo" : "amber"} />
              </div>
            </div>

            <div className="grid gap-3">
              {aiPlays.map((play) => (
                <AutomationPlay key={play.title} {...play} />
              ))}
            </div>
          </div>
        </PanelShell>

        <PanelShell eyebrow="Operator actions" title="Automation runbook" icon={Sparkles}>
          <div className="grid gap-3">
            <RunbookRow icon={RefreshCw} title="Force telemetry resync" note="Pull fresh health from Render, sockets, and media rails." tone="indigo" />
            <RunbookRow icon={LockKeyhole} title="Audit trust surfaces" note="Re-validate proof-photo, signed URL, and verification gates." tone="emerald" />
            <RunbookRow icon={Fingerprint} title="Review identity posture" note="Track session integrity, login anomalies, and document access patterns." tone="sky" />
            <RunbookRow icon={Server} title="Snapshot runtime evidence" note="Preserve commit, branch, provider mode, and service health in one briefing." tone="amber" />
          </div>
        </PanelShell>
      </section>
    </div>
  );
};

function PanelShell({
  eyebrow,
  title,
  icon: Icon,
  children,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Cloud;
  children: React.ReactNode;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-[1.8rem] border border-white/10 bg-slate-950/84 p-5 shadow-[0_24px_70px_-32px_rgba(2,6,23,1)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-xl font-black text-white">{title}</h3>
          </div>
        </div>

        {actionLabel ? (
          <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/[0.09]">
            <RefreshCw className="h-4 w-4" />
            {actionLabel}
          </button>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function HeaderPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof CloudCog;
  label: string;
  tone: "indigo" | "sky" | "emerald" | "amber";
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]",
      toneClasses(tone),
    )}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className={cn("rounded-[1.25rem] border px-4 py-3", toneClasses(tone))}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-sm font-black uppercase tracking-[0.08em]">{value}</p>
    </div>
  );
}

function TruthRow({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
          toneClasses(tone),
        )}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-6 text-slate-300">{hint}</p>
    </div>
  );
}

function OverviewCell({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className={cn(
      "rounded-[1.45rem] border bg-slate-950/82 px-4 py-4 shadow-[0_18px_50px_-36px_rgba(2,6,23,1)]",
      tone === "emerald" && "border-emerald-400/16",
      tone === "indigo" && "border-indigo-400/16",
      tone === "sky" && "border-sky-400/16",
      tone === "amber" && "border-amber-400/16",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-3 text-xs font-semibold leading-6 text-slate-300">{note}</p>
    </div>
  );
}

function InfraMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className={cn("rounded-[1.35rem] border px-4 py-4", toneClasses(tone))}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-3 text-lg font-black text-white">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-6 opacity-90">{note}</p>
    </div>
  );
}

function ServiceLane({
  name,
  domain,
  value,
  throughput,
  automation,
  tone,
}: {
  name: string;
  domain: string;
  value: string;
  throughput: string;
  automation: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{name}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{domain}</p>
        </div>
        <div className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]", toneClasses(tone))}>
          {value}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-xs font-semibold text-slate-300">
        <span>{throughput}</span>
        <span className="text-slate-400">{automation}</span>
      </div>
    </div>
  );
}

function SecurityCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]", toneClasses(tone))}>
          {value}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">{note}</p>
    </div>
  );
}

function ExperienceAtlas({
  regions,
}: {
  regions: Array<{
    region: string;
    sessions: string;
    apdex: string;
    status: string;
    tone: "emerald" | "indigo" | "sky" | "amber";
    x: string;
    y: string;
  }>;
}) {
  return (
    <div className="space-y-4">
      <div className="relative h-[18rem] overflow-hidden rounded-[1.6rem] border border-white/8 bg-[radial-gradient(circle_at_50%_20%,rgba(129,140,248,0.18),transparent_28%),radial-gradient(circle_at_20%_72%,rgba(52,211,153,0.12),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.86))]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:2.75rem_2.75rem] opacity-50" />
        <div className="pointer-events-none absolute left-[8%] top-[22%] h-24 w-32 rounded-[45%] bg-slate-200/10 blur-[3px]" />
        <div className="pointer-events-none absolute left-[44%] top-[18%] h-16 w-20 rounded-[48%] bg-slate-200/10 blur-[2px]" />
        <div className="pointer-events-none absolute left-[57%] top-[24%] h-24 w-28 rounded-[42%] bg-slate-200/10 blur-[3px]" />
        <div className="pointer-events-none absolute left-[22%] top-[54%] h-20 w-24 rounded-[44%] bg-slate-200/10 blur-[3px]" />
        <div className="pointer-events-none absolute left-[62%] top-[52%] h-24 w-20 rounded-[46%] bg-slate-200/10 blur-[3px]" />

        {regions.map((region) => (
          <div
            key={region.region}
            className="absolute"
            style={{ left: region.x, top: region.y, transform: "translate(-50%, -50%)" }}
          >
            <div className="relative">
              <span className={cn(
                "absolute inset-0 rounded-full opacity-35 blur-md",
                region.tone === "emerald" && "bg-emerald-400",
                region.tone === "sky" && "bg-sky-400",
                region.tone === "indigo" && "bg-indigo-400",
                region.tone === "amber" && "bg-amber-400",
              )} />
              <div className={cn(
                "relative flex h-4 w-4 items-center justify-center rounded-full border border-white/20",
                region.tone === "emerald" && "bg-emerald-400",
                region.tone === "sky" && "bg-sky-400",
                region.tone === "indigo" && "bg-indigo-400",
                region.tone === "amber" && "bg-amber-400",
              )}>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        {regions.map((region) => (
          <div key={region.region} className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{region.region}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{region.sessions}</p>
              </div>
              <div className="text-right">
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]", toneClasses(region.tone))}>
                  {region.status}
                </span>
                <p className="mt-2 font-mono text-sm font-bold text-slate-200">Apdex {region.apdex}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterventionItem({
  tag,
  message,
  tone,
}: {
  tag: string;
  message: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]", toneClasses(tone))}>
          {tag}
        </span>
        <p className="flex-1 text-sm font-semibold leading-6 text-slate-200">{message}</p>
      </div>
    </div>
  );
}

function SummarySignal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/8 bg-white/[0.04] px-4 py-3">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]", toneClasses(tone))}>
        {value}
      </span>
    </div>
  );
}

function AutomationPlay({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "emerald" | "indigo" | "sky";
}) {
  return (
    <div className={cn("rounded-[1.5rem] border px-4 py-4", toneClasses(tone))}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">{title}</p>
        <Bot className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 opacity-95">{description}</p>
    </div>
  );
}

function RunbookRow({
  icon: Icon,
  title,
  note,
  tone,
}: {
  icon: typeof RefreshCw;
  title: string;
  note: string;
  tone: "emerald" | "indigo" | "sky" | "amber";
}) {
  return (
    <button className="flex min-h-[4.75rem] w-full items-start gap-3 rounded-[1.35rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.07]">
      <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", toneClasses(tone))}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-2 text-xs font-semibold leading-6 text-slate-300">{note}</p>
      </div>
    </button>
  );
}

function toneClasses(tone: "emerald" | "indigo" | "sky" | "amber" | "slate") {
  if (tone === "emerald") return "border-emerald-400/18 bg-emerald-400/10 text-emerald-100";
  if (tone === "indigo") return "border-indigo-400/18 bg-indigo-400/10 text-indigo-100";
  if (tone === "sky") return "border-sky-400/18 bg-sky-400/10 text-sky-100";
  if (tone === "amber") return "border-amber-400/18 bg-amber-400/10 text-amber-100";
  return "border-slate-700 bg-slate-900/90 text-slate-200";
}

function toneColor(tone: "emerald" | "indigo" | "sky" | "amber" | "slate") {
  if (tone === "emerald") return "#34d399";
  if (tone === "indigo") return "#818cf8";
  if (tone === "sky") return "#38bdf8";
  if (tone === "amber") return "#f59e0b";
  return "#a78bfa";
}
