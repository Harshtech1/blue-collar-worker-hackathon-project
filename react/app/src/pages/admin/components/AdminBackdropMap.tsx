import { useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { sectorSeeds } from "@/utils/simulationData";

interface AdminBackdropMapProps {
  focusZoneId?: string;
  activeTabLabel: string;
}

interface CommandZone {
  id: string;
  label: string;
  center: [number, number];
  polygon: [number, number][];
  density: number;
  markers: Array<{
    id: string;
    position: [number, number];
    intensity: "low" | "medium" | "high";
  }>;
}

const zonePolygons: CommandZone[] = sectorSeeds.map((seed, index) => {
  const centerLat = Number(((seed.latRange[0] + seed.latRange[1]) / 2).toFixed(4));
  const centerLng = Number(((seed.lngRange[0] + seed.lngRange[1]) / 2).toFixed(4));
  const density = Number(((seed.demandWeight * 1.45) + (seed.historicalTraffic * 0.62)).toFixed(2));

  return {
    id: seed.id,
    label: seed.label,
    center: [centerLat, centerLng],
    polygon: [
      [seed.latRange[0], seed.lngRange[0]],
      [seed.latRange[0], seed.lngRange[1]],
      [seed.latRange[1], seed.lngRange[1]],
      [seed.latRange[1], seed.lngRange[0]],
    ],
    density,
    markers: [
      {
        id: `${seed.id}-a`,
        position: [Number((centerLat + 0.0036).toFixed(4)), Number((centerLng - 0.0042).toFixed(4))],
        intensity: density > 2.3 ? "high" : density > 1.7 ? "medium" : "low",
      },
      {
        id: `${seed.id}-b`,
        position: [Number((centerLat - 0.0028).toFixed(4)), Number((centerLng + 0.0034).toFixed(4))],
        intensity: density > 2.5 ? "high" : "medium",
      },
    ],
  };
});

function getZoneTone(density: number) {
  if (density >= 2.4) {
    return {
      stroke: "#f59e0b",
      fill: "rgba(245, 158, 11, 0.18)",
      label: "Critical density",
    };
  }

  if (density >= 1.85) {
    return {
      stroke: "#6366f1",
      fill: "rgba(99, 102, 241, 0.18)",
      label: "High density",
    };
  }

  return {
    stroke: "#34d399",
    fill: "rgba(52, 211, 153, 0.15)",
    label: "Balanced density",
  };
}

function markerTone(intensity: CommandZone["markers"][number]["intensity"]) {
  if (intensity === "high") {
    return {
      stroke: "#f97316",
      fill: "#f59e0b",
      radius: 8,
    };
  }

  if (intensity === "medium") {
    return {
      stroke: "#818cf8",
      fill: "#6366f1",
      radius: 6,
    };
  }

  return {
    stroke: "#6ee7b7",
    fill: "#34d399",
    radius: 5,
  };
}

function MapViewport({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 12, { animate: true, duration: 1.1 });
  return null;
}

export function AdminBackdropMap({
  focusZoneId = "agra-cantt",
  activeTabLabel,
}: AdminBackdropMapProps) {
  const focusZone = useMemo(
    () => zonePolygons.find((zone) => zone.id === focusZoneId) || zonePolygons[0],
    [focusZoneId],
  );

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[#06101e]">
      <style>
        {`
          @keyframes rahi-shell-scanline {
            0% { transform: translateY(-18%); opacity: 0; }
            10% { opacity: 0.18; }
            100% { transform: translateY(1180%); opacity: 0; }
          }

          .rahi-shell-scanline {
            animation: rahi-shell-scanline 5.2s linear infinite;
          }

          .rahi-shell-map .leaflet-control-container {
            opacity: 0.72;
          }

          .rahi-shell-map .leaflet-control-attribution {
            background: rgba(2, 6, 23, 0.72);
            color: rgba(226, 232, 240, 0.7);
            border-radius: 999px;
            padding: 2px 10px;
            backdrop-filter: blur(12px);
          }
        `}
      </style>

      <MapContainer
        center={focusZone.center}
        zoom={12}
        scrollWheelZoom
        preferCanvas
        zoomControl={false}
        className="rahi-shell-map h-full w-full"
      >
        <MapViewport center={focusZone.center} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        {zonePolygons.map((zone) => {
          const tone = getZoneTone(zone.density);
          const active = zone.id === focusZone.id;

          return (
            <Polygon
              key={zone.id}
              positions={zone.polygon}
              pathOptions={{
                color: active ? "#22d3ee" : tone.stroke,
                weight: active ? 2.4 : 1.4,
                fillColor: active ? "rgba(34, 211, 238, 0.18)" : tone.fill,
                fillOpacity: active ? 0.38 : 0.22,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-950">{zone.label}</p>
                  <p className="text-xs font-bold text-slate-500">{tone.label}</p>
                  <p className="text-xs font-bold text-slate-700">Density {zone.density.toFixed(2)}</p>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        <Circle
          center={focusZone.center}
          radius={7600}
          pathOptions={{
            color: "#22d3ee",
            fillColor: "#22d3ee",
            fillOpacity: 0.04,
            opacity: 0.68,
            weight: 1.3,
          }}
        />

        {zonePolygons.flatMap((zone) => zone.markers).map((marker) => {
          const tone = markerTone(marker.intensity);
          return (
            <CircleMarker
              key={marker.id}
              center={marker.position}
              radius={tone.radius}
              pathOptions={{
                color: tone.stroke,
                fillColor: tone.fill,
                fillOpacity: 0.8,
                weight: 1.4,
              }}
            />
          );
        })}

        <CircleMarker
          center={focusZone.center}
          radius={11}
          pathOptions={{
            color: "#ecfeff",
            fillColor: "#22d3ee",
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            Route focus - {focusZone.label}
          </Tooltip>
        </CircleMarker>
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.12),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.12),_rgba(2,6,23,0.62))]" />
      <div className="rahi-shell-scanline pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-300/15 via-cyan-200/5 to-transparent" />

      <div className="pointer-events-none absolute left-5 top-5 rounded-[1.4rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/75">RAHI mission grid</p>
        <p className="mt-2 text-lg font-black">{focusZone.label}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{activeTabLabel}</p>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 rounded-[1.4rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Watch legend</p>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-slate-300">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Critical</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />High</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Balanced</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />Route focus</span>
        </div>
      </div>
    </div>
  );
}
