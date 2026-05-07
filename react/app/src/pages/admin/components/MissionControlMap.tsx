import { useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import {
  buildSimulationGeoConfig,
  DEFAULT_SIMULATION_CITY_ID,
  generateSimulationBatch,
  sectorSeeds,
} from "@/utils/simulationData";
import type { AdminTab } from "./AdminSidebar";

interface MissionControlWorker {
  _id?: string;
  id?: string;
  name?: string;
  profession?: string;
  service?: string;
  status?: string;
  isAvailable?: boolean;
  logisticsScore?: number;
  acceptanceRate?: number;
  reliabilityScore?: number;
}

interface MissionControlBooking {
  _id: string;
  service?: string;
  total_price?: number | string;
  status?: string;
  createdAt?: string | Date;
}

interface MissionControlMapProps {
  activeTab: AdminTab;
  routeZoneId?: string | null;
  workers: MissionControlWorker[];
  bookings: MissionControlBooking[];
  onZoneSelect?: (zoneId: string) => void;
  className?: string;
}

interface ZoneAnchor {
  id: string;
  label: string;
  city: string;
  center: [number, number];
  intensity: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const EARTH_RADIUS_KM = 6371;

const hashString = (value: string) => (
  Array.from(value).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7)
);

const offsetCoordinate = (lat: number, lng: number, distanceKm: number, bearingDeg: number) => {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const startLat = toRadians(lat);
  const startLng = toRadians(lng);

  const nextLat = Math.asin(
    (Math.sin(startLat) * Math.cos(angularDistance))
      + (Math.cos(startLat) * Math.sin(angularDistance) * Math.cos(bearing)),
  );

  const nextLng = startLng + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLat),
    Math.cos(angularDistance) - (Math.sin(startLat) * Math.sin(nextLat)),
  );

  return [
    Number(toDegrees(nextLat).toFixed(6)),
    Number((((toDegrees(nextLng) + 540) % 360) - 180).toFixed(6)),
  ] as [number, number];
};

const buildZoneAnchors = (): ZoneAnchor[] => (
  sectorSeeds.map((seed) => ({
    id: seed.id,
    label: seed.label,
    city: seed.city,
    center: [
      Number((((seed.latRange[0] + seed.latRange[1]) / 2)).toFixed(6)),
      Number((((seed.lngRange[0] + seed.lngRange[1]) / 2)).toFixed(6)),
    ] as [number, number],
    intensity: Number((seed.demandWeight * seed.historicalTraffic).toFixed(2)),
  }))
);

const scenarioByTab: Record<AdminTab, "baseline" | "monsoon" | "price_war" | "supply_crunch"> = {
  overview: "baseline",
  users: "baseline",
  workers: "baseline",
  bookings: "monsoon",
  finance: "price_war",
  heatmap: "price_war",
  intelligence: "supply_crunch",
  system: "baseline",
  bugs: "supply_crunch",
  audit: "price_war",
  settings: "baseline",
};

export function MissionControlMap({
  activeTab,
  routeZoneId,
  workers,
  bookings,
  onZoneSelect,
  className,
}: MissionControlMapProps) {
  const zoneAnchors = useMemo(() => buildZoneAnchors(), []);
  const highlightedZone = useMemo(
    () => zoneAnchors.find((zone) => zone.id === routeZoneId) || zoneAnchors[0],
    [routeZoneId, zoneAnchors],
  );

  const simulationPoints = useMemo(() => {
    const geoConfig = buildSimulationGeoConfig({
      cityId: DEFAULT_SIMULATION_CITY_ID,
      center: {
        lat: highlightedZone.center[0],
        lng: highlightedZone.center[1],
      },
      radiusKm: 10,
    });

    return generateSimulationBatch({
      batchIndex: 0,
      batchSize: 260,
      geoConfig,
      scenario: scenarioByTab[activeTab],
    }).map((point, index) => ({
      id: `${point.areaSector}-${index}`,
      center: [point.lat, point.lng] as [number, number],
      value: point.estimatedValue,
      serviceType: point.serviceType,
      isEmergency: point.isEmergency,
    }));
  }, [activeTab, highlightedZone.center]);

  const workerReticles = useMemo(() => {
    const source = workers.length > 0 ? workers : Array.from({ length: 12 }, (_, index) => ({
      _id: `synthetic-worker-${index}`,
      name: `Worker ${index + 1}`,
      profession: index % 3 === 0 ? "Plumbing Specialist" : index % 3 === 1 ? "Electrical Pro" : "Cleaning Lead",
      status: index % 4 === 0 ? "busy" : "verified",
      isAvailable: index % 4 !== 0,
      logisticsScore: 78 + ((index * 7) % 19),
      acceptanceRate: 71 + ((index * 9) % 21),
      reliabilityScore: 76 + ((index * 11) % 18),
      service: index % 3 === 0 ? "Plumbing Repair" : index % 3 === 1 ? "Wiring Check" : "Deep Cleaning",
    }));

    return source.slice(0, 18).map((worker, index) => {
      const zone = zoneAnchors[index % zoneAnchors.length];
      const workerId = worker._id || ("id" in worker ? worker.id : undefined) || `worker-${index}`;
      const bearing = (hashString(`${workerId || worker.name || index}`) % 360);
      const distanceKm = 0.35 + ((index % 5) * 0.12);
      const position = offsetCoordinate(zone.center[0], zone.center[1], distanceKm, bearing);
      const trustScore = Math.round((
        Number(worker.logisticsScore || 0) * 0.55
        + Number(worker.acceptanceRate || 0) * 0.2
        + Number(worker.reliabilityScore || 0) * 0.25
      ) || (78 + (index % 16)));

      return {
        id: workerId,
        name: worker.name || `RAHI Worker ${index + 1}`,
        profession: worker.profession || worker.service || "General Field Ops",
        currentJob: worker.service || bookings[index % Math.max(1, bookings.length)]?.service || "Standby dispatch",
        isAvailable: worker.isAvailable ?? worker.status !== "busy",
        trustScore,
        position,
      };
    });
  }, [bookings, workers, zoneAnchors]);

  const zonePressure = useMemo(() => {
    const base = new Map<string, { total: number; emergency: number }>();
    zoneAnchors.forEach((zone) => base.set(zone.id, { total: 0, emergency: 0 }));

    simulationPoints.forEach((point, index) => {
      const zone = zoneAnchors[index % zoneAnchors.length];
      const current = base.get(zone.id);
      if (!current) return;
      current.total += Math.max(1, Math.round(point.value / 900));
      if (point.isEmergency) {
        current.emergency += 1;
      }
    });

    return zoneAnchors.map((zone) => {
      const totals = base.get(zone.id) || { total: 0, emergency: 0 };
      return {
        ...zone,
        total: totals.total,
        emergency: totals.emergency,
      };
    });
  }, [simulationPoints, zoneAnchors]);

  const streamSignals = useMemo(
    () => simulationPoints
      .filter((point) => point.isEmergency)
      .slice(0, 10)
      .map((point) => [highlightedZone.center, point.center] as [[number, number], [number, number]]),
    [highlightedZone.center, simulationPoints],
  );

  const activePressureColor = activeTab === "finance" || activeTab === "heatmap" || activeTab === "audit"
    ? "#f59e0b"
    : activeTab === "intelligence" || activeTab === "bugs"
      ? "#34d399"
      : "#6366f1";

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-[1.9rem] border-2 border-slate-800/90 bg-[#020617] shadow-[0_28px_70px_-36px_rgba(2,6,23,1)]", className)}>
      <style>{`
        @keyframes rahi-mission-scanline {
          0% { transform: translateY(-12%); opacity: 0; }
          16% { opacity: 0.34; }
          100% { transform: translateY(1240%); opacity: 0; }
        }

        @keyframes rahi-reticle-pulse {
          0% { transform: scale(0.94); opacity: 0.92; }
          70% { transform: scale(1.16); opacity: 0; }
          100% { transform: scale(1.16); opacity: 0; }
        }

        .rahi-map-shell .leaflet-container {
          background: #020617;
          height: 100%;
          width: 100%;
        }

        .rahi-map-shell .leaflet-tile-pane {
          filter: contrast(1.1) brightness(0.7) grayscale(0.2) saturate(0.95);
        }

        .rahi-map-shell .leaflet-control-container {
          display: none;
        }

        .rahi-command-scanline {
          animation: rahi-mission-scanline 5s linear infinite;
        }

        .rahi-mission-tooltip {
          background: rgba(2, 6, 23, 0.92);
          border: 1px solid rgba(51, 65, 85, 0.95);
          border-radius: 14px;
          box-shadow: 0 24px 40px rgba(2, 6, 23, 0.5);
          color: #e2e8f0;
          font-family: "JetBrains Mono", "Fira Code", monospace;
        }

        .rahi-mission-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.96);
        }

        .rahi-zone-stream {
          stroke-dasharray: 6 14;
          animation: dash 1.2s linear infinite;
        }

        @keyframes dash {
          to { stroke-dashoffset: -40; }
        }

        @media (prefers-reduced-motion: reduce) {
          .rahi-command-scanline,
          .rahi-zone-stream {
            animation: none !important;
          }
        }
      `}</style>

      <div className="rahi-map-shell absolute inset-0">
        <MapContainer
          center={highlightedZone.center}
          zoom={12}
          preferCanvas
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <MissionViewport center={highlightedZone.center} zoom={12} />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
            opacity={0.72}
          />

          <Pane name="pressure-zones" style={{ zIndex: 420 }}>
            {zonePressure.map((zone) => (
              <Circle
                key={`${zone.id}-ring`}
                center={zone.center}
                radius={4200 + Math.min(zone.total * 12, 3200)}
                eventHandlers={onZoneSelect ? { click: () => onZoneSelect(zone.id) } : undefined}
                pathOptions={{
                  color: zone.id === highlightedZone.id ? activePressureColor : "#475569",
                  fillColor: zone.id === highlightedZone.id ? activePressureColor : "#1e293b",
                  fillOpacity: zone.id === highlightedZone.id ? 0.16 : 0.08,
                  weight: zone.id === highlightedZone.id ? 1.4 : 0.8,
                }}
              >
                <Tooltip sticky className="rahi-mission-tooltip" direction="top">
                  <div className="space-y-2 text-[11px]">
                    <p className="font-black uppercase tracking-[0.18em] text-slate-400">ZONE LOCK</p>
                    <p className="text-sm font-black text-slate-100">{zone.label}</p>
                    <p className="text-slate-400">Projected load: {zone.total.toLocaleString("en-IN")}</p>
                    <p className="text-emerald-300">Emergency lanes: {zone.emergency.toLocaleString("en-IN")}</p>
                  </div>
                </Tooltip>
              </Circle>
            ))}
          </Pane>

          <Pane name="heat-orbits" style={{ zIndex: 430 }}>
            {simulationPoints.map((point, index) => (
              <Circle
                key={point.id}
                center={point.center}
                radius={240 + Math.min(point.value / 2.6, 1420)}
                pathOptions={{
                  color: point.isEmergency ? "#f59e0b" : "#6366f1",
                  fillColor: point.isEmergency ? "#f59e0b" : "#6366f1",
                  fillOpacity: point.isEmergency ? 0.14 : index % 2 === 0 ? 0.08 : 0.05,
                  weight: 0,
                }}
              />
            ))}
          </Pane>

          <Pane name="command-streams" style={{ zIndex: 440 }}>
            {streamSignals.map((segment, index) => (
              <Polyline
                key={`stream-${index}`}
                positions={segment}
                pathOptions={{
                  color: "#34d399",
                  opacity: 0.52,
                  weight: 1.4,
                  className: "rahi-zone-stream",
                }}
              />
            ))}
          </Pane>

          <Pane name="worker-reticles" style={{ zIndex: 470 }}>
            {workerReticles.map((worker) => (
              <Circle
                key={`${worker.id}-ring`}
                center={worker.position}
                radius={worker.isAvailable ? 620 : 430}
                pathOptions={{
                  color: worker.isAvailable ? "#34d399" : "#f59e0b",
                  fillOpacity: 0,
                  opacity: 0.38,
                  weight: 1.1,
                }}
              />
            ))}
            {workerReticles.map((worker) => (
              <CircleMarker
                key={worker.id}
                center={worker.position}
                radius={worker.isAvailable ? 7 : 6}
                pathOptions={{
                  color: worker.isAvailable ? "#34d399" : "#f59e0b",
                  fillColor: worker.isAvailable ? "#34d399" : "#f59e0b",
                  fillOpacity: 0.92,
                  weight: 1.5,
                }}
              >
                <Tooltip sticky className="rahi-mission-tooltip" direction="top" offset={[0, -10]}>
                  <div className="space-y-2 text-[11px]">
                    <p className="font-black uppercase tracking-[0.18em] text-slate-400">AUDIT HUD</p>
                    <p className="text-sm font-black text-slate-100">{worker.name}</p>
                    <p className="text-slate-300">{worker.profession}</p>
                    <p className={cn("font-black", worker.isAvailable ? "text-emerald-300" : "text-amber-300")}>
                      Trust Score {worker.trustScore}
                    </p>
                    <p className="text-slate-400">Current Job: {worker.currentJob}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </Pane>

          <Pane name="command-pin" style={{ zIndex: 490 }}>
            <CircleMarker
              center={highlightedZone.center}
              radius={10}
              pathOptions={{
                color: "#818cf8",
                fillColor: "#818cf8",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip sticky className="rahi-mission-tooltip" direction="top">
                <div className="space-y-2 text-[11px]">
                  <p className="font-black uppercase tracking-[0.18em] text-slate-400">COMMAND PIN</p>
                  <p className="text-sm font-black text-slate-100">{highlightedZone.label}</p>
                  <p className="text-slate-400">{highlightedZone.city} theater</p>
                </div>
              </Tooltip>
            </CircleMarker>
            <Circle
              center={highlightedZone.center}
              radius={6800}
              pathOptions={{
                color: "#818cf8",
                fillOpacity: 0,
                opacity: 0.55,
                weight: 1.2,
                dashArray: "6 12",
              }}
            />
          </Pane>
        </MapContainer>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#020617] via-[#020617]/42 to-transparent" />
      <div className="rahi-command-scanline pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-emerald-300/12 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(16,185,129,0.14),transparent_22%),radial-gradient(circle_at_80%_18%,rgba(99,102,241,0.12),transparent_24%),radial-gradient(circle_at_50%_82%,rgba(245,158,11,0.08),transparent_26%)]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-[600]">
        <div className="absolute left-3 top-3 h-5 w-5 border-l border-t border-emerald-300/50" />
        <div className="absolute right-3 top-3 h-5 w-5 border-r border-t border-emerald-300/50" />
        <div className="absolute bottom-3 left-3 h-5 w-5 border-b border-l border-emerald-300/50" />
        <div className="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-emerald-300/50" />
        <div className="absolute left-4 top-4 rounded-full border border-slate-700/80 bg-slate-950/90 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 shadow-[0_14px_32px_-20px_rgba(2,6,23,1)]">
          Command Theater
        </div>
        <div className="absolute bottom-4 right-4 rounded-full border border-slate-700/80 bg-slate-950/90 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-200 shadow-[0_14px_32px_-20px_rgba(2,6,23,1)]">
          LAT {highlightedZone.center[0].toFixed(3)} | LNG {highlightedZone.center[1].toFixed(3)}
        </div>
      </div>
    </div>
  );
}

function MissionViewport({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.1 });
  }, [center, map, zoom]);

  return null;
}
