import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { API } from "@/lib/constants";

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
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

export function HeatmapTab({ token }: HeatmapTabProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  useEffect(() => {
    void fetchHeatmapData();
  }, []);

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

        return {
          ...item,
          lat,
          lng,
        };
      })
      .filter((item): item is HeatmapData & { lat: number; lng: number } => Boolean(item))
  ), [filteredData]);

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

  const getHeatColor = (count: number) => {
    if (count > 10) return "#ef4444";
    if (count > 5) return "#f97316";
    if (count > 2) return "#6366f1";
    return "#22c55e";
  };

  const getRadius = (count: number) => Math.min(1800 + (count * 220), 6000);
  const getMarkerRadius = (count: number) => Math.min(12 + count, 28);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
        Canvas rendering is active for this heatmap, so the admin surface stays smooth as hotspot volume grows.
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "pending", "completed"] as const).map((entry) => (
          <button
            key={entry}
            onClick={() => setFilter(entry)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              filter === entry
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {entry.charAt(0).toUpperCase() + entry.slice(1)}
          </button>
        ))}
      </div>

      <div className="h-[500px] overflow-hidden rounded-2xl border border-slate-200">
        <MapContainer
          center={center}
          zoom={points.length > 0 ? 10 : 5}
          preferCanvas
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
                  weight: 1,
                  fillColor: color,
                  fillOpacity: 0.14,
                }}
              />
            );
          })}
          {points.map((item) => {
            const color = getHeatColor(item.count);
            return (
              <CircleMarker
                key={item._id}
                center={[item.lat, item.lng]}
                radius={getMarkerRadius(item.count)}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.68,
                  color,
                  weight: 1.2,
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
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Total Hotspots</p>
          <p className="text-2xl font-black text-slate-900">{points.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Pending Jobs</p>
          <p className="text-2xl font-black text-orange-600">
            {points.filter((point) => point.status === "pending").reduce((acc, point) => acc + point.count, 0)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Active Heat</p>
          <p className="text-2xl font-black text-indigo-600">
            {totalHotBookings.toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}

function HeatmapViewport({
  points,
  fallbackCenter,
}: {
  points: Array<HeatmapData & { lat: number; lng: number }>;
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
