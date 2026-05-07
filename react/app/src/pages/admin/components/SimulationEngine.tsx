import { startTransition, useCallback, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Download,
  Loader2,
  Radar,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  SIMULATION_BATCH_COUNT,
  SIMULATION_BATCH_SIZE,
  SIMULATION_TOTAL_POINTS,
  generateSimulationBatch,
} from "@/utils/simulationData";
import { downloadSimulationReport } from "@/utils/simulationReport";

type SimulationPhase = "idle" | "generating" | "inferencing" | "visualizing" | "complete" | "error";
type DensityCluster = "low_density" | "balanced_density" | "high_density" | "surge_density";

interface SimulationSectorSummary {
  area_sector: string;
  batch_orders: number;
  projected_orders: number;
  active_workers: number;
  density_score: number;
  density_cluster: DensityCluster;
  salaried_ratio: number;
  freelancer_ratio: number;
  recommended_shift: number;
  confidence_score: number;
  traditional_cost: number;
  optimized_cost: number;
  projected_revenue: number;
  burn_risk: number;
  churn_risk: number;
  centroid_lat: number;
  centroid_lng: number;
}

interface SimulationBatchResponse {
  batch_id: number;
  total_batches: number;
  points_received: number;
  processing_ms: number;
  cluster_distribution: Record<string, number>;
  sector_summaries: SimulationSectorSummary[];
  model_version: string;
}

interface AggregatedSector {
  areaSector: string;
  totalOrders: number;
  projectedOrders: number;
  activeWorkers: number;
  densityScore: number;
  densityCluster: DensityCluster;
  salariedRatio: number;
  freelancerRatio: number;
  recommendedShift: number;
  confidenceScore: number;
  traditionalCost: number;
  optimizedCost: number;
  projectedRevenue: number;
  burnRisk: number;
  churnRisk: number;
  centroidLat: number;
  centroidLng: number;
  sampleCount: number;
}

interface BatchLogPoint {
  batch: string;
  processedPoints: number;
  processingMs: number;
  hotSectors: number;
}

const clusterLabel: Record<DensityCluster, string> = {
  low_density: "Low Density",
  balanced_density: "Balanced Density",
  high_density: "High Density",
  surge_density: "Surge Density",
};

const clusterColor: Record<DensityCluster, string> = {
  low_density: "#38bdf8",
  balanced_density: "#6366f1",
  high_density: "#8b5cf6",
  surge_density: "#f97316",
};

const formatCurrency = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

const phaseStatus = (phase: SimulationPhase, target: Exclude<SimulationPhase, "idle" | "error" | "complete">) => {
  const order = ["generating", "inferencing", "visualizing"];
  const currentIndex = order.indexOf(phase as any);
  const targetIndex = order.indexOf(target);

  if (phase === "complete") return "complete";
  if (phase === "error") return targetIndex <= currentIndex ? "complete" : "idle";
  if (targetIndex < currentIndex) return "complete";
  if (target === phase) return "active";
  return "idle";
};

const mergeSummaries = (
  previous: Record<string, AggregatedSector>,
  summaries: SimulationSectorSummary[],
) => {
  const next = { ...previous };

  for (const summary of summaries) {
    const current = next[summary.area_sector];

    if (!current) {
      next[summary.area_sector] = {
        areaSector: summary.area_sector,
        totalOrders: summary.batch_orders,
        projectedOrders: summary.projected_orders,
        activeWorkers: summary.active_workers,
        densityScore: summary.density_score,
        densityCluster: summary.density_cluster,
        salariedRatio: summary.salaried_ratio * 100,
        freelancerRatio: summary.freelancer_ratio * 100,
        recommendedShift: summary.recommended_shift,
        confidenceScore: summary.confidence_score,
        traditionalCost: summary.traditional_cost,
        optimizedCost: summary.optimized_cost,
        projectedRevenue: summary.projected_revenue,
        burnRisk: summary.burn_risk,
        churnRisk: summary.churn_risk,
        centroidLat: summary.centroid_lat,
        centroidLng: summary.centroid_lng,
        sampleCount: 1,
      };
      continue;
    }

    const sampleCount = current.sampleCount + 1;
    const pickCluster = summary.density_score >= current.densityScore ? summary.density_cluster : current.densityCluster;

    next[summary.area_sector] = {
      areaSector: summary.area_sector,
      totalOrders: current.totalOrders + summary.batch_orders,
      projectedOrders: current.projectedOrders + summary.projected_orders,
      activeWorkers: Math.max(current.activeWorkers, summary.active_workers),
      densityScore: Number((((current.densityScore * current.sampleCount) + summary.density_score) / sampleCount).toFixed(2)),
      densityCluster: pickCluster,
      salariedRatio: (((current.salariedRatio * current.sampleCount) + (summary.salaried_ratio * 100)) / sampleCount),
      freelancerRatio: (((current.freelancerRatio * current.sampleCount) + (summary.freelancer_ratio * 100)) / sampleCount),
      recommendedShift: Math.max(current.recommendedShift, summary.recommended_shift),
      confidenceScore: (((current.confidenceScore * current.sampleCount) + summary.confidence_score) / sampleCount),
      traditionalCost: current.traditionalCost + summary.traditional_cost,
      optimizedCost: current.optimizedCost + summary.optimized_cost,
      projectedRevenue: current.projectedRevenue + summary.projected_revenue,
      burnRisk: (((current.burnRisk * current.sampleCount) + summary.burn_risk) / sampleCount),
      churnRisk: (((current.churnRisk * current.sampleCount) + summary.churn_risk) / sampleCount),
      centroidLat: summary.centroid_lat,
      centroidLng: summary.centroid_lng,
      sampleCount,
    };
  }

  return next;
};

export function SimulationEngine() {
  const [phase, setPhase] = useState<SimulationPhase>("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [processedPoints, setProcessedPoints] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [sectorMap, setSectorMap] = useState<Record<string, AggregatedSector>>({});
  const [batchTimeline, setBatchTimeline] = useState<BatchLogPoint[]>([]);
  const [statusFeed, setStatusFeed] = useState<string[]>([]);
  const [modelVersion, setModelVersion] = useState("simulation-rf-v2");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const aggregatedSectors = useMemo(() => (
    Object.values(sectorMap)
      .map((sector) => ({
        ...sector,
        marginLift: sector.traditionalCost - sector.optimizedCost,
      }))
      .sort((left, right) => right.densityScore - left.densityScore)
  ), [sectorMap]);

  const totalTraditionalCost = useMemo(
    () => aggregatedSectors.reduce((sum, sector) => sum + sector.traditionalCost, 0),
    [aggregatedSectors],
  );
  const totalOptimizedCost = useMemo(
    () => aggregatedSectors.reduce((sum, sector) => sum + sector.optimizedCost, 0),
    [aggregatedSectors],
  );
  const totalProjectedOrders = useMemo(
    () => aggregatedSectors.reduce((sum, sector) => sum + sector.projectedOrders, 0),
    [aggregatedSectors],
  );
  const totalRevenue = useMemo(
    () => aggregatedSectors.reduce((sum, sector) => sum + sector.projectedRevenue, 0),
    [aggregatedSectors],
  );

  const hottestSector = aggregatedSectors[0];
  const averageSalariedRatio = useMemo(() => {
    if (aggregatedSectors.length === 0) return 0;
    const totalWeightedRatio = aggregatedSectors.reduce(
      (sum, sector) => sum + (sector.salariedRatio * sector.projectedOrders),
      0,
    );
    return totalWeightedRatio / Math.max(1, totalProjectedOrders);
  }, [aggregatedSectors, totalProjectedOrders]);

  const progressValue = Math.round((processedPoints / SIMULATION_TOTAL_POINTS) * 100);
  const elapsedSeconds = startedAt ? ((finishedAt ?? performance.now()) - startedAt) / 1000 : 0;
  const throughput = elapsedSeconds > 0 ? Math.round(processedPoints / elapsedSeconds) : 0;

  const heatmapGroups = useMemo(() => {
    const groups: Record<DensityCluster, Array<Record<string, number | string>>> = {
      low_density: [],
      balanced_density: [],
      high_density: [],
      surge_density: [],
    };

    aggregatedSectors.forEach((sector) => {
      groups[sector.densityCluster].push({
        sector: sector.areaSector,
        x: Number(sector.centroidLng.toFixed(4)),
        y: Number(sector.centroidLat.toFixed(4)),
        z: Number((sector.densityScore * 100).toFixed(1)),
        densityScore: Number(sector.densityScore.toFixed(2)),
        salariedRatio: Math.round(sector.salariedRatio),
        projectedOrders: Math.round(sector.projectedOrders),
      });
    });

    return groups;
  }, [aggregatedSectors]);

  const economicsData = useMemo(() => (
    aggregatedSectors
      .slice(0, 8)
      .map((sector) => ({
        sector: sector.areaSector.replace("Sector ", "S").replace("Road", "Rd"),
        traditionalCost: Math.round(sector.traditionalCost),
        optimizedCost: Math.round(sector.optimizedCost),
        marginLift: Math.round(sector.marginLift),
      }))
  ), [aggregatedSectors]);

  const recommendationRows = useMemo(() => (
    aggregatedSectors.map((sector) => ({
      ...sector,
      burnDelta: sector.traditionalCost - sector.optimizedCost,
    }))
  ), [aggregatedSectors]);

  const appendFeed = useCallback((message: string) => {
    startTransition(() => {
      setStatusFeed((previous) => [message, ...previous].slice(0, 10));
    });
  }, []);

  const handleExport = useCallback(() => {
    if (aggregatedSectors.length === 0) {
      toast.error("Run the simulation first so there is something meaningful to export.");
      return;
    }

    downloadSimulationReport({
      generatedAt: new Date().toLocaleString("en-IN"),
      totalPoints: processedPoints || SIMULATION_TOTAL_POINTS,
      totalSectors: aggregatedSectors.length,
      totalProjectedOrders,
      totalTraditionalCost,
      totalOptimizedCost,
      marginLift: totalTraditionalCost - totalOptimizedCost,
      averageSalariedRatio,
      hottestSector: hottestSector?.areaSector || "NA",
      sectors: aggregatedSectors.map((sector) => ({
        sector: sector.areaSector,
        densityCluster: clusterLabel[sector.densityCluster],
        densityScore: sector.densityScore,
        salariedRatio: sector.salariedRatio,
        traditionalCost: sector.traditionalCost,
        optimizedCost: sector.optimizedCost,
        projectedRevenue: sector.projectedRevenue,
      })),
    });

    toast.success("Simulation report exported as PDF.");
  }, [
    aggregatedSectors,
    averageSalariedRatio,
    hottestSector?.areaSector,
    processedPoints,
    totalOptimizedCost,
    totalProjectedOrders,
    totalTraditionalCost,
  ]);

  const launchSimulation = useCallback(async () => {
    if (isRunning) return;

    const token = localStorage.getItem("adminToken");
    if (!token) {
      toast.error("Admin authentication is required before launching the simulation.");
      return;
    }

    setIsRunning(true);
    setPhase("generating");
    setProcessedPoints(0);
    setCompletedBatches(0);
    setSectorMap({});
    setBatchTimeline([]);
    setStatusFeed([]);
    setStartedAt(performance.now());
    setFinishedAt(null);
    appendFeed("Simulation booted. Preparing 400,000 synthetic booking requests.");

    try {
      for (let batchIndex = 0; batchIndex < SIMULATION_BATCH_COUNT; batchIndex += 1) {
        setPhase("generating");
        const bookings = generateSimulationBatch({ batchIndex });
        appendFeed(`Batch ${batchIndex + 1}/${SIMULATION_BATCH_COUNT}: generated ${bookings.length.toLocaleString("en-IN")} synthetic requests.`);
        await new Promise((resolve) => window.setTimeout(resolve, 0));

        setPhase("inferencing");
        const response = await fetch(`${API}/analytics/simulation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            batch_id: batchIndex + 1,
            total_batches: SIMULATION_BATCH_COUNT,
            total_points: SIMULATION_TOTAL_POINTS,
            bookings,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || payload.detail || "Simulation inference failed");
        }

        const batchPayload = payload as SimulationBatchResponse;
        setModelVersion(batchPayload.model_version);
        startTransition(() => {
          setCompletedBatches(batchPayload.batch_id);
          setProcessedPoints(batchPayload.batch_id * SIMULATION_BATCH_SIZE);
          setSectorMap((previous) => mergeSummaries(previous, batchPayload.sector_summaries));
          setBatchTimeline((previous) => [
            ...previous,
            {
              batch: `B${batchPayload.batch_id}`,
              processedPoints: batchPayload.batch_id * SIMULATION_BATCH_SIZE,
              processingMs: batchPayload.processing_ms,
              hotSectors: (batchPayload.cluster_distribution.high_density || 0) + (batchPayload.cluster_distribution.surge_density || 0),
            },
          ].slice(-12));
        });

        appendFeed(
          `Batch ${batchPayload.batch_id}: Random Forest closed in ${Math.round(batchPayload.processing_ms)} ms with ${batchPayload.cluster_distribution.surge_density || 0} surge sectors.`,
        );
        await new Promise((resolve) => window.setTimeout(resolve, 16));
      }

      setPhase("visualizing");
      appendFeed("Inference complete. Rendering density heatmap and cost comparison views.");
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setPhase("complete");
      setFinishedAt(performance.now());
      toast.success("RAHI intelligence simulation finished successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Simulation failed";
      setPhase("error");
      appendFeed(`Simulation interrupted: ${message}`);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }, [appendFeed, isRunning]);

  const phaseCopy = {
    idle: "Ready for the investor-grade 400k stress test.",
    generating: "Generating synthetic city-wide booking traffic with faker.js.",
    inferencing: "Streaming batched requests into the Random Forest density engine.",
    visualizing: "Packaging workforce signals into investor-facing visuals.",
    complete: "Simulation complete. You can now export the report.",
    error: "Simulation paused because a batch failed. Fix the service and launch again.",
  } satisfies Record<SimulationPhase, string>;

  return (
    <section className="rounded-[2rem] border border-indigo-200 bg-[linear-gradient(135deg,_rgba(79,70,229,0.06),_rgba(15,23,42,0.02)_44%,_rgba(14,165,233,0.05))] p-6 shadow-sm md:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700">
            <Sparkles className="h-4 w-4" />
            RAHI Intelligence Simulation
          </div>
          <h3 className="mt-4 text-3xl font-black text-slate-950">Launch a 400k city-scale workforce simulation without freezing the admin panel.</h3>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            The frontend generates synthetic booking traffic with faker.js in 10k batches, streams each batch to the Python Random Forest service,
            then converts the response into density clusters, staffing ratios, and an investor-safe cost story.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row xl:flex-col">
          <button
            type="button"
            onClick={() => void launchSimulation()}
            disabled={isRunning}
            className={cn(
              "inline-flex min-w-[240px] items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.18em] transition",
              isRunning
                ? "cursor-not-allowed bg-slate-300 text-slate-600"
                : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 hover:bg-indigo-500",
            )}
          >
            {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />}
            {isRunning ? "Simulation Running" : "Launch 400k Simulation"}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={aggregatedSectors.length === 0}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black uppercase tracking-[0.18em] transition",
              aggregatedSectors.length === 0
                ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
                : "border-indigo-200 bg-white text-indigo-700 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50",
            )}
          >
            <Download className="h-4 w-4" />
            Export Simulation Report
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Simulation progress</p>
            <p className="mt-2 text-lg font-black text-slate-950">{phaseCopy[phase]}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {processedPoints.toLocaleString("en-IN")} / {SIMULATION_TOTAL_POINTS.toLocaleString("en-IN")} requests processed · {throughput.toLocaleString("en-IN")} requests/sec
            </p>
          </div>
          <div className="grid gap-2 text-right text-sm font-black text-slate-600">
            <span>Model: {modelVersion}</span>
            <span>Batches closed: {completedBatches}/{SIMULATION_BATCH_COUNT}</span>
            <span>Elapsed: {elapsedSeconds.toFixed(1)}s</span>
          </div>
        </div>

        <Progress value={progressValue} className="mt-5 h-4 bg-slate-100 [&>div]:bg-indigo-600" />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { key: "generating", label: "1. Data generation", icon: Sparkles },
            { key: "inferencing", label: "2. AI inference", icon: BrainCircuit },
            { key: "visualizing", label: "3. Visualization", icon: Radar },
          ].map((item) => {
            const status = phaseStatus(phase, item.key as "generating" | "inferencing" | "visualizing");
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className={cn(
                  "rounded-2xl border px-4 py-4 transition",
                  status === "active" && "border-indigo-300 bg-indigo-50",
                  status === "complete" && "border-emerald-300 bg-emerald-50",
                  status === "idle" && "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-5 w-5", status === "complete" ? "text-emerald-600" : status === "active" ? "text-indigo-600" : "text-slate-400")} />
                    <p className="text-sm font-black text-slate-900">{item.label}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                    status === "complete" && "bg-emerald-100 text-emerald-700",
                    status === "active" && "bg-indigo-100 text-indigo-700",
                    status === "idle" && "bg-slate-200 text-slate-500",
                  )}>
                    {status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <SimulationMetricCard label="Projected orders" value={totalProjectedOrders.toLocaleString("en-IN")} hint="Random Forest demand output" icon={Target} tone="indigo" />
        <SimulationMetricCard label="Traditional burn" value={formatCurrency(totalTraditionalCost)} hint="Salary-heavy model cost" icon={TrendingDown} tone="rose" />
        <SimulationMetricCard label="Optimized cost" value={formatCurrency(totalOptimizedCost)} hint="Density-balanced ops cost" icon={TrendingUp} tone="emerald" />
        <SimulationMetricCard label="Margin lift" value={formatCurrency(totalTraditionalCost - totalOptimizedCost)} hint="Savings unlocked by RAHI logic" icon={Zap} tone="sky" />
      </div>

      <Tabs defaultValue="heatmap" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-950 p-1 text-white">
          <TabsTrigger value="heatmap" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Density Heatmap</TabsTrigger>
          <TabsTrigger value="economics" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Economics</TabsTrigger>
          <TabsTrigger value="stress" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-950">Stress Test</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Density heatmap</p>
                <h4 className="mt-2 text-2xl font-black text-slate-950">Agra stress zones after {processedPoints.toLocaleString("en-IN")} synthetic requests</h4>
              </div>
              <Radar className="h-6 w-6 text-indigo-500" />
            </div>

            <div className="mt-5 h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid stroke="#dbe4ef" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Longitude" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis type="number" dataKey="y" name="Latitude" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <ZAxis type="number" dataKey="z" range={[80, 340]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<HeatmapTooltip />} />
                  <Legend />
                  {(Object.keys(heatmapGroups) as DensityCluster[]).map((cluster) => (
                    <Scatter
                      key={cluster}
                      name={clusterLabel[cluster]}
                      data={heatmapGroups[cluster]}
                      fill={clusterColor[cluster]}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Top recommendations</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">Workforce shifts the model wants right now</h4>

            <div className="mt-5 space-y-3">
              {recommendationRows.slice(0, 5).map((sector) => (
                <div key={sector.areaSector} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{sector.areaSector}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{clusterLabel[sector.densityCluster]} · Density {sector.densityScore.toFixed(2)}</p>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-700">
                      {Math.round(sector.salariedRatio)}% salaried
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Projected orders" value={sector.projectedOrders.toLocaleString("en-IN")} />
                    <MiniMetric label="Workers to shift" value={`${sector.recommendedShift}`} />
                    <MiniMetric label="Confidence" value={`${Math.round(sector.confidenceScore * 100)}%`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="economics" className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Chart A</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">Traditional model cost</h4>
            <p className="mt-2 text-sm font-semibold text-slate-500">Low-density zones burn cash when the same staffing model is forced everywhere.</p>
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={economicsData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fontWeight: 700 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="traditionalCost" fill="#f97316" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Chart B</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">RAHI density-optimized model</h4>
            <p className="mt-2 text-sm font-semibold text-slate-500">The Random Forest pushes salaried coverage only where density and demand justify it.</p>
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={economicsData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fontWeight: 700 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="optimizedCost" fill="#4f46e5" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stress" className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Stress test view</p>
            <h4 className="mt-2 text-2xl font-black text-slate-950">Real-time batch processing</h4>
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={batchTimeline}>
                  <CartesianGrid stroke="#dbe4ef" strokeDasharray="3 3" />
                  <XAxis dataKey="batch" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <Tooltip content={<StressTooltip />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="processingMs" name="Inference ms" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="hotSectors" name="Hot sectors" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Live command feed</p>
                <h4 className="mt-2 text-2xl font-black">What the AI just did</h4>
              </div>
              <Activity className="h-6 w-6 text-emerald-300" />
            </div>

            <div className="mt-5 space-y-3">
              {statusFeed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-slate-300">
                  Launch the simulation to start the real-time feed.
                </div>
              ) : statusFeed.map((entry) => (
                <div key={entry} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-slate-200">
                  {entry}
                </div>
              ))}
            </div>

            {hottestSector && (
              <div className="mt-5 rounded-[1.4rem] border border-emerald-400/25 bg-emerald-400/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Investor moment</p>
                <p className="mt-2 text-base font-black text-white">
                  {hottestSector.areaSector} just surfaced as the hottest cluster with {Math.round(hottestSector.salariedRatio)}% salaried coverage recommended.
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-100">
                  Estimated margin lift in this zone: {formatCurrency(hottestSector.traditionalCost - hottestSector.optimizedCost)}.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SimulationStoryCard
          title="Batched by design"
          body="The UI only ever holds one 10k batch at a time, so the investor demo feels fast even while 400,000 synthetic requests pass through the stack."
          icon={BrainCircuit}
        />
        <SimulationStoryCard
          title="Python-led inference"
          body="Each batch is forwarded to the FastAPI Random Forest service, where sector density clusters and workforce ratios are predicted before the next batch begins."
          icon={Target}
        />
        <SimulationStoryCard
          title="Pitch-ready export"
          body="Once the run completes, the admin can export a one-page PDF summary to reinforce the operational logic in the investor conversation."
          icon={Download}
        />
      </div>
    </section>
  );
}

function SimulationMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  tone: "indigo" | "emerald" | "rose" | "sky";
}) {
  const toneMap = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  } as const;

  return (
    <div className={cn("rounded-[1.4rem] border p-4 shadow-sm", toneMap[tone])}>
      <Icon className="mb-4 h-5 w-5" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{hint}</p>
    </div>
  );
}

function SimulationStoryCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="mb-4 h-5 w-5 text-indigo-500" />
      <h4 className="text-lg font-black text-slate-950">{title}</h4>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function HeatmapTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{point.sector}</p>
      <div className="mt-3 space-y-1 text-sm font-bold text-slate-900">
        <p>Density: {point.densityScore}</p>
        <p>Projected orders: {point.projectedOrders}</p>
        <p>Salaried mix: {point.salariedRatio}%</p>
      </div>
    </div>
  );
}

function StressTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 space-y-1 text-sm font-bold">
        <p className="text-slate-900">Inference: {payload[0]?.value} ms</p>
        <p className="text-orange-600">Hot sectors: {payload[1]?.value}</p>
      </div>
    </div>
  );
}
