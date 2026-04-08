import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
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

export function HeatmapTab({ token }: HeatmapTabProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  useEffect(() => {
    fetchHeatmapData();
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

  const filteredData = heatmapData.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const center: [number, number] = [30.7333, 76.7794]; // Chandigarh default

  const getHeatColor = (count: number) => {
    if (count > 10) return "#ef4444"; // red
    if (count > 5) return "#f97316"; // orange
    if (count > 2) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  const getRadius = (count: number) => {
    return Math.min(20 + count * 3, 50);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="h-[500px] rounded-2xl overflow-hidden border border-slate-200">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />
          {filteredData.map((item) => {
            const lat = item.location?.coordinates?.[1];
            const lng = item.location?.coordinates?.[0];
            if (!lat || !lng) return null;
            return (
              <CircleMarker
                key={item._id}
                center={[lat, lng]}
                radius={getRadius(item.count)}
                pathOptions={{
                  fillColor: getHeatColor(item.count),
                  fillOpacity: 0.6,
                  color: getHeatColor(item.count),
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="p-2">
                    <p className="font-bold text-sm">{item.service || "Service"}</p>
                    <p className="text-xs text-slate-500">
                      {item.count} booking{item.count > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">
                      Status: {item.status}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-xs text-slate-500 font-bold uppercase">Total Hotspots</p>
          <p className="text-2xl font-black text-slate-900">{filteredData.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-xs text-slate-500 font-bold uppercase">Pending Jobs</p>
          <p className="text-2xl font-black text-orange-600">
            {filteredData.filter((d) => d.status === "pending").reduce((acc, d) => acc + d.count, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-xs text-slate-500 font-bold uppercase">Completed</p>
          <p className="text-2xl font-black text-green-600">
            {filteredData.filter((d) => d.status === "completed").reduce((acc, d) => acc + d.count, 0)}
          </p>
        </div>
      </div>
    </div>
  );
}