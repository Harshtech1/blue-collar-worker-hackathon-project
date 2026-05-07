import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CloudRain, Wind, Wrench } from "lucide-react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SimulationScenario } from "@/utils/simulationData";

interface HeatmapData {
  _id: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  service: string;
  status: string;
  count: number;
}

interface HeatmapTabProps {
  token: string;
  scenario?: SimulationScenario;
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const PRIORITY_REPAIR_SERVICES = new Set(["plumbing", "electrical", "roofing", "appliance", "carpentry"]);
const SIMULATION_SCENARIO_STORAGE_KEY = "rahi-simulation-scenario";

const isPriorityRepairService = (service: string) => (
  PRIORITY_REPAIR_SERVICES.has(String(service || "").trim().toLowerCase())
);

export function HeatmapTab({ token, scenario: scenarioOverride }: HeatmapTabProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [scenario, setScenario] = useState<SimulationScenario>(() => {
    if (scenarioOverride) return scenarioOverride;
    if (typeof window === "undefined") return "baseline";
    const storedScenario = window.localStorage.getItem(SIMULATION_SCENARIO_STORAGE_KEY);
    return storedScenario === "monsoon" || storedScenario === "price_war" ? storedScenario : "baseline";
  });

  useEffect(() => {
    void fetchHeatmapData();
  }, []);

  useEffect(() => {
    if (!scenarioOverride) return;
    setScenario(scenarioOverride);
  }, [scenarioOverride]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIMULATION_SCENARIO_STORAGE_KEY, scenario);
  }, [scenario]);

  const fetchHeatmapData = async () => {
    try {
      const res = await fetch(`${API}/admin/heatmap`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHeatmapData(data.data || data);
      }
    } catch (err) {
      console.error("Heatmap fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => (
    heatmapData.filter((item) => {
      if (filter === "all") return true;
      return item.status === filter;
    })
  ), [filter, heatmapData]);

  const points = useMemo(() => (
    filteredData
      .map((item) => {
        const lat = item.location?.coordinates?.[1];
        const lng = item.location?.coordinates?.[0];
        if (typeof lat !== "number" || typeof lng !== "number") return null;

        const priorityRepair = isPriorityRepairService(item.service);
        const competitorPressure = scenario === "price_war" && (
          item.count >= 6
          || (item.status === "pending" && item.count >= 3)
          || (priorityRepair && item.count >= 4)
        );

        return {
          ...item,
          lat,
          lng,
          priorityRepair,
          competitorPressure,
        };
      })
      .filter((item): item is HeatmapData & {
        lat: number;
        lng: number;
        priorityRepair: boolean;
        competitorPressure: boolean;
      } => Boolean(item))
  ), [filteredData, scenario]);

  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return DEFAULT_CENTER;
    const latSum = points.reduce((sum, point) => sum + point.lat, 0);
    const lngSum = points.reduce((sum, point) => sum + point.lng, 0);
    return [latSum / points.length, lngSum / points.length];
  }, [points]);

  const totalHotBookings = useMemo(
    () => points.reduce((sum, point) => sum + point.count, 0),
    [points],
  );

  const pendingBookings = useMemo(
    () => points.filter((point) => point.status === "pending").reduce((acc, point) => acc + point.count, 0),
    [points],
  );

  const repairPressureBookings = useMemo(
    () => points.filter((point) => point.priorityRepair).reduce((acc, point) => acc + point.count, 0),
    [points],
  );
  const competitorPressureBookings = useMemo(
    () => points.filter((point) => point.competitorPressure).reduce((acc, point) => acc + point.count, 0),
    [points],
  );
  const competitorPressureZones = useMemo(
    () => points.filter((point) => point.competitorPressure).length,
    [points],
  );

  const repairPressureShare = totalHotBookings > 0 ? repairPressureBookings / totalHotBookings : 0;
  const competitorPressureShare = totalHotBookings > 0 ? competitorPressureBookings / totalHotBookings : 0;
  const isMonsoon = scenario === "monsoon";
  const isPriceWar = scenario === "price_war";
  const stormIntensity = isMonsoon
    ? Math.min(1, 0.35 + (repairPressureShare * 1.2) + (pendingBookings / Math.max(totalHotBookings, 1)) * 0.3)
    : 0;
  const supplyDropPercent = isMonsoon ? 40 : isPriceWar ? 18 : 0;
  const projectedBurnMultiplier = isMonsoon ? 1.5 : isPriceWar ? 1.28 : 1;
  const weatherMultiplier = isMonsoon ? 1.25 : isPriceWar ? 1.12 : 1;

  const getHeatColor = (count: number) => {
    if (isMonsoon) {
      if (count > 10) return "#f59e0b";
      if (count > 5) return "#fb923c";
      if (count > 2) return "#818cf8";
      return "#34d399";
    }

    if (isPriceWar) {
      if (count > 10) return "#4338ca";
      if (count > 5) return "#4f46e5";
      if (count > 2) return "#818cf8";
      return "#34d399";
    }

    if (count > 10) return "#ef4444";
    if (count > 5) return "#f97316";
    if (count > 2) return "#6366f1";
    return "#22c55e";
  };

  const getRadius = (count: number) => (
    Math.min(
      1800 + (count * 220) + (isMonsoon ? count * 120 : isPriceWar ? count * 90 : 0),
      isMonsoon ? 7600 : isPriceWar ? 7000 : 6000,
    )
  );
  const getMarkerRadius = (count: number) => Math.min(12 + count + (isMonsoon || isPriceWar ? 3 : 0), 30);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <style>
        {`
          @keyframes rahi-alert-pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
          }
        `}
      </style>
      <div className={cn(
        "rounded-[1.8rem] border px-5 py-4 shadow-sm",
        isMonsoon
          ? "border-amber-400/40 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white"
          : isPriceWar
            ? "border-amber-300/40 bg-gradient-to-r from-slate-950 via-indigo-950 to-amber-950 text-white"
          : "border-indigo-200 bg-indigo-50 text-indigo-950",
      )}
      style={isMonsoon || isPriceWar ? { animation: "rahi-alert-pulse 1.5s ease-in-out infinite" } : undefined}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-1 flex h-11 w-11 items-center justify-center rounded-2xl",
              isMonsoon
                ? "bg-amber-400/15 text-amber-300"
                : isPriceWar
                  ? "bg-amber-400/15 text-amber-200"
                  : "bg-indigo-100 text-indigo-700",
            )}>
              {isMonsoon ? <CloudRain className="h-5 w-5" /> : isPriceWar ? <AlertTriangle className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
            </div>
            <div>
              <p className={cn(
                "text-[11px] font-black uppercase tracking-[0.22em]",
                isMonsoon ? "text-amber-200" : isPriceWar ? "text-amber-200" : "text-indigo-500",
              )}>
                {isMonsoon
                  ? "[ALERT] ACTIVE MONSOON DEPLOYMENT PROTOCOL"
                  : isPriceWar
                    ? "[INTEL] COMPETITOR PRESSURE ACTIVE"
                    : "Operational Heat Surface"}
              </p>
              <h3 className="mt-2 text-2xl font-black">
                {isMonsoon
                  ? "Storm pressure is reshaping live demand across the map."
                  : isPriceWar
                    ? "Competitor pressure is colliding with live service density."
                  : "Live hotspot density for the current booking network."}
              </h3>
              <p className={cn(
                "mt-2 max-w-3xl text-sm font-semibold leading-6",
                isMonsoon ? "text-slate-200" : isPriceWar ? "text-slate-200" : "text-indigo-800/80",
              )}>
                {isMonsoon
                  ? "Priority repair lanes are amplified, worker mobility is constrained, and the city should be read as an incident board rather than a passive heatmap."
                  : isPriceWar
                    ? "RAHI Indigo still shows our demand density; the dashed amber competitor pulse simply marks contested hotspots where trust-over-price strategy matters most."
                  : "Canvas rendering stays active so the admin surface remains smooth as hotspot volume grows."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["baseline", "monsoon", "price_war"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setScenario(entry)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition",
                  scenario === entry
                    ? entry === "monsoon"
                      ? "bg-amber-400 text-slate-950 shadow-[0_18px_45px_-22px_rgba(251,191,36,0.75)]"
                      : entry === "price_war"
                        ? "bg-amber-300 text-slate-950 shadow-[0_18px_45px_-22px_rgba(245,158,11,0.72)]"
                      : "bg-indigo-600 text-white shadow-[0_18px_45px_-22px_rgba(79,70,229,0.65)]"
                    : isMonsoon || isPriceWar
                      ? "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                      : "bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {entry === "baseline" ? "Baseline" : entry === "monsoon" ? "Monsoon" : "Price War"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className={cn(
          "rounded-[1.8rem] border p-5 shadow-sm",
          isMonsoon || isPriceWar
            ? "border-slate-800 bg-slate-950 text-white"
            : "border-slate-200 bg-white text-slate-950",
        )}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={cn(
                "text-[11px] font-black uppercase tracking-[0.22em]",
                isMonsoon ? "text-amber-300" : isPriceWar ? "text-amber-200" : "text-slate-400",
              )}>
                Incident controls
              </p>
              <h4 className="mt-2 text-xl font-black">
                {isMonsoon
                  ? "Weather-sensitive operating posture"
                  : isPriceWar
                    ? "Trust-defense operating posture"
                    : "Baseline operating posture"}
              </h4>
            </div>
            {isMonsoon ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : isPriceWar ? <AlertTriangle className="h-5 w-5 text-amber-200" /> : <Wind className="h-5 w-5 text-indigo-500" />}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricPanel
              label={isPriceWar ? "Competitor pressure" : "Repair pressure"}
              value={`${Math.round((isPriceWar ? competitorPressureShare : repairPressureShare) * 100)}%`}
              note={isMonsoon ? "Priority repair mix dominating" : isPriceWar ? "Contested demand mix" : "Priority repair share"}
              tone={isMonsoon ? "amber" : isPriceWar ? "amber" : "indigo"}
            />
            <MetricPanel
              label={isPriceWar ? "Pricing shield" : "Weather multiplier"}
              value={`${weatherMultiplier.toFixed(2)}x`}
              note={isMonsoon ? "Recommended pricing posture" : isPriceWar ? "Trust-over-price posture" : "Standard pricing"}
              tone={isMonsoon ? "amber" : isPriceWar ? "amber" : "emerald"}
            />
            <MetricPanel
              label={isPriceWar ? "CAC stress" : "Supply drop"}
              value={isMonsoon || isPriceWar ? `-${supplyDropPercent}%` : "Stable"}
              note={isMonsoon ? "Mobility shock in workforce" : isPriceWar ? "Discount-led acquisition squeeze" : "Worker movement normal"}
              tone={isMonsoon ? "rose" : isPriceWar ? "amber" : "sky"}
            />
            <MetricPanel
              label="Burn posture"
              value={`${projectedBurnMultiplier.toFixed(2)}x`}
              note={isMonsoon ? "Higher incentive + logistics burn" : isPriceWar ? "Retention and proof costs rising" : "Normal cash pressure"}
              tone={isMonsoon ? "amber" : isPriceWar ? "amber" : "slate"}
            />
          </div>

          <div className={cn(
            "mt-4 rounded-[1.5rem] border px-4 py-4 text-sm font-semibold leading-6",
            isMonsoon || isPriceWar
              ? "border-amber-400/20 bg-amber-400/10 text-slate-100"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}>
            {isMonsoon
              ? "Command recommendation: shift salaried core into Plumbing, Roofing, and Electrical lanes first; hold non-urgent work until the repair queue cools."
              : isPriceWar
                ? "Command recommendation: keep the Indigo demand fill as the truth layer, then use the amber competitor pulse to decide where Verified Pro proof, loyalty retention, and selective pricing should defend margin."
              : "Command recommendation: use this layer for normal hotspot triage, then switch to Monsoon to rehearse operational insurance under real-world disruption."}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Hotspots" value={points.length.toLocaleString("en-IN")} tone={isMonsoon ? "amber" : isPriceWar ? "amber" : "indigo"} />
          <MetricCard label="Pending Jobs" value={pendingBookings.toLocaleString("en-IN")} tone={isMonsoon ? "rose" : isPriceWar ? "orange" : "orange"} />
          <MetricCard label="Active Heat" value={totalHotBookings.toLocaleString("en-IN")} tone={isMonsoon ? "amber" : isPriceWar ? "indigo" : "indigo"} />
          <MetricCard label={isPriceWar ? "Competitor Zones" : "Repair Queue"} value={(isPriceWar ? competitorPressureZones : repairPressureBookings).toLocaleString("en-IN")} tone={isMonsoon ? "emerald" : isPriceWar ? "amber" : "sky"} />
        </div>
      </div>

      <div className="mb-1 flex flex-wrap gap-2">
        {(["all", "pending", "completed"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setFilter(entry)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
              filter === entry
                ? scenario === "monsoon"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-indigo-600 text-white"
                : scenario === "monsoon"
                  ? "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {entry.charAt(0).toUpperCase() + entry.slice(1)}
          </button>
        ))}
      </div>

      <div className={cn(
        "relative h-[560px] overflow-hidden rounded-[2rem] border",
        isMonsoon || isPriceWar ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white",
      )}>
        <MapContainer
          center={center}
          zoom={points.length > 0 ? 10 : 5}
          preferCanvas
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url={isMonsoon || isPriceWar
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
            attribution="&copy; CARTO"
          />
          <HeatmapViewport points={points} fallbackCenter={center} />
          {points.map((item) => {
            const color = getHeatColor(item.count);
            return (
              <Circle
                key={`heat-${item._id}`}
                center={[item.lat, item.lng]}
                radius={getRadius(item.count)}
                pathOptions={{
                  color,
                  weight: isMonsoon ? 1.2 : isPriceWar ? 1.1 : 1,
                  fillColor: color,
                  fillOpacity: isMonsoon ? 0.2 : isPriceWar ? 0.16 : 0.14,
                }}
              />
            );
          })}
          {isPriceWar && points.filter((item) => item.competitorPressure).map((item) => (
            <Circle
              key={`competitor-${item._id}`}
              center={[item.lat, item.lng]}
              radius={Math.round(getRadius(item.count) * 1.14)}
              pathOptions={{
                color: "#f59e0b",
                weight: 2.4,
                opacity: 0.92,
                fillOpacity: 0.02,
                fillColor: "#f59e0b",
                dashArray: "10 12",
              }}
            />
          ))}
          {points.map((item) => {
            const color = getHeatColor(item.count);
            return (
              <CircleMarker
                key={item._id}
                center={[item.lat, item.lng]}
                radius={getMarkerRadius(item.count)}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: isMonsoon || isPriceWar ? 0.82 : 0.68,
                  color,
                  weight: isMonsoon || isPriceWar ? 1.6 : 1.2,
                }}
              >
                <Popup>
                  <div className="p-2">
                    <p className="text-sm font-bold">{item.service || "Service"}</p>
                    <p className="text-xs text-slate-500">
                      {item.count} booking{item.count > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs capitalize text-slate-400">
                      Status: {item.status}
                    </p>
                    {item.priorityRepair && (
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600">
                        Priority repair lane
                      </p>
                    )}
                    {item.competitorPressure && (
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-500">
                        Competitor pulse active
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        <StormCanvasOverlay active={isMonsoon} intensity={stormIntensity} />
        {isMonsoon && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[420] h-32 bg-gradient-to-b from-slate-950/70 via-slate-900/18 to-transparent" />
        )}

        <div className="pointer-events-none absolute left-5 top-5 z-[430] max-w-sm rounded-[1.4rem] border border-white/10 bg-slate-950/78 p-4 text-white backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-1 rounded-2xl p-2",
              isMonsoon ? "bg-amber-400/15 text-amber-300" : isPriceWar ? "bg-amber-400/15 text-amber-200" : "bg-indigo-400/15 text-indigo-200",
            )}>
              {isMonsoon ? <CloudRain className="h-4 w-4" /> : isPriceWar ? <AlertTriangle className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Map brief</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">
                {isMonsoon
                  ? "Amber zones are absorbing repair shock first. Use this surface to decide where salaried core must move before fill-rate collapses."
                  : isPriceWar
                    ? "Indigo remains the demand truth layer. Dashed amber rings mark competitor-heavy hotspots where RAHI should defend trust, margin, and audit-backed proof instead of matching blanket discounts."
                  : "Read hotspot spread first, then use the command-center simulation to decide staffing and pricing moves."}
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-5 right-5 z-[430] rounded-[1.4rem] border border-white/10 bg-slate-950/78 p-4 text-white backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Legend</p>
          <div className="mt-3 space-y-2 text-sm font-semibold">
            <LegendRow color={isMonsoon ? "#f59e0b" : isPriceWar ? "#4338ca" : "#ef4444"} label="High pressure hotspot" />
            <LegendRow color={isMonsoon ? "#818cf8" : "#6366f1"} label="Balanced demand zone" />
            <LegendRow color="#34d399" label="Healthy or low-pressure lane" />
            {isPriceWar && <LegendRow color="#f59e0b" label="Competitor pulse overlay" dashed />}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatmapViewport({
  points,
  fallbackCenter,
}: {
  points: Array<HeatmapData & { lat: number; lng: number; priorityRepair: boolean; competitorPressure: boolean }>;
  fallbackCenter: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(fallbackCenter, 5);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }

    const bounds = points.map((point) => [point.lat, point.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [28, 28], animate: true });
  }, [fallbackCenter, map, points]);

  return null;
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "indigo" | "rose" | "orange" | "emerald" | "sky";
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    orange: "border-orange-200 bg-orange-50 text-orange-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
  };

  return (
    <div className={cn("rounded-[1.6rem] border p-5 shadow-sm", toneClasses[tone])}>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function MetricPanel({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "amber" | "indigo" | "rose" | "emerald" | "sky" | "slate";
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    indigo: "border-indigo-400/20 bg-indigo-400/10 text-indigo-100",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    slate: "border-white/10 bg-white/5 text-slate-100",
  };

  return (
    <div className={cn("rounded-[1.4rem] border p-4", toneClasses[tone])}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold opacity-80">{note}</p>
    </div>
  );
}

function LegendRow({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("h-3 w-3 rounded-full", dashed && "border-2 border-dashed bg-transparent")}
        style={dashed ? { borderColor: color } : { backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}

function StormCanvasOverlay({
  active,
  intensity,
}: {
  active: boolean;
  intensity: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let frameId = 0;
    const drops = Array.from({ length: Math.round(120 + (intensity * 120)) }, () => ({
      x: Math.random(),
      y: Math.random(),
      length: 10 + Math.random() * 18,
      speed: 0.008 + Math.random() * 0.018 + (intensity * 0.012),
      opacity: 0.08 + Math.random() * 0.18,
    }));

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, bounds.width * ratio);
      canvas.height = Math.max(1, bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);

      const mist = context.createLinearGradient(0, 0, 0, height);
      mist.addColorStop(0, "rgba(15, 23, 42, 0.26)");
      mist.addColorStop(0.45, "rgba(30, 41, 59, 0.08)");
      mist.addColorStop(1, "rgba(15, 23, 42, 0)");
      context.fillStyle = mist;
      context.fillRect(0, 0, width, height);

      drops.forEach((drop) => {
        const x = drop.x * width;
        const y = drop.y * height;

        context.beginPath();
        context.strokeStyle = `rgba(148, 163, 184, ${drop.opacity})`;
        context.lineWidth = 1.15;
        context.moveTo(x, y);
        context.lineTo(x - 8, y + drop.length);
        context.stroke();

        drop.y += drop.speed;
        if (drop.y * height > height + drop.length) {
          drop.y = -0.08;
          drop.x = Math.random();
        }
      });

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frameId);
    };
  }, [active, intensity]);

  if (!active) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[410] h-full w-full"
    />
  );
}
