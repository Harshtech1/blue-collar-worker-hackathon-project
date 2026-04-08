import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Users, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

// Fix for default marker icons in Leaflet + React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom icons
const workerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});

// Custom DivIcons for ripples
const rippleIcon = L.divIcon({
  className: '',
  html: '<div class="customer-pulse-ring" style="width: 60px; height: 60px;"></div>',
  iconSize: [60, 60],
  iconAnchor: [30, 30]
});

const dotIcon = L.divIcon({
  className: '',
  html: '<div class="customer-pulse-core" style="width: 16px; height: 16px;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

interface Worker {
  _id: string;
  user: {
    full_name: string;
    phone: string;
  };
  location: {
    coordinates: [number, number]; // [lng, lat]
  };
  bio?: string;
  is_verified?: boolean;   // ✅ Aadhaar-verified flag
  aadhaar_url?: string;    // Document presence = trust signal
}

interface NearbyWorkersMapProps {
  center: [number, number]; // [lat, lng]
  radius?: number;
  onWorkerClick?: (worker: Worker) => void;
  onWidenSearch?: () => void;
}

function PanToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const NearbyWorkersMap: React.FC<NearbyWorkersMapProps> = ({ 
  center, 
  radius = 10000, 
  onWorkerClick,
  onWidenSearch 
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [simulatingArrival, setSimulatingArrival] = useState(false);

  const fetchNearby = async () => {
    try {
      setError(false);
      const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/workers/nearby?lng=${center[1]}&lat=${center[0]}&radius=${radius}`);
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      } else {
        setError(true);
      }
    } catch (error) {
      console.error('Error fetching nearby workers:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const simulateWorkerArrival = () => {
    if (workers.length === 0 || simulatingArrival) return;
    setSimulatingArrival(true);
    
    const targetWorker = workers[0];
    const steps = 10;
    let step = 0;
    
    const startLat = targetWorker.location.coordinates[1];
    const startLng = targetWorker.location.coordinates[0];
    const endLat = center[0] + 0.002;
    const endLng = center[1] + 0.002;
    
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const newLat = startLat + (endLat - startLat) * progress;
      const newLng = startLng + (endLng - startLng) * progress;
      
      setWorkers(prev => prev.map((w, i) => 
        i === 0 ? { ...w, location: { coordinates: [newLng, newLat] } } : w
      ));
      
      if (step >= steps) {
        clearInterval(interval);
        setSimulatingArrival(false);
      }
    }, 500);
  };

  useEffect(() => {
    fetchNearby();
    const interval = setInterval(fetchNearby, 15000);
    return () => clearInterval(interval);
  }, [center, radius]);

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-900 overflow-hidden group">
      {/* Loading State Overlay */}
      {loading && workers.length === 0 && (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
          <div className="relative w-20 h-20 mb-4">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <Search className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
          </div>
          <p className="text-white font-bold tracking-widest text-xs uppercase animate-pulse">Scanning Surface...</p>
        </div>
      )}

      {/* Empty State Overlay */}
      {!loading && workers.length === 0 && (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl p-8 text-center">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-4 border border-rose-500/30">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h3 className="text-white font-black text-xl mb-2">No Workers in Range</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-[250px]">
            We couldn't find any active professionals within 10km of your location.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[200px]">
            <Button 
              onClick={onWidenSearch}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
            >
              Widen Search Area
            </Button>
            <Button 
              variant="outline" 
              onClick={fetchNearby}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl font-bold"
            >
              Retry
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-500 text-xs hover:text-primary"
            >
              Notify me when worker is near
            </Button>
          </div>
        </div>
      )}
      
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        <PanToCenter center={center} />

        {/* Scan Radius Visualizer */}
        <Circle 
          center={center}
          radius={radius}
          className="leaflet-circle"
          pathOptions={{
            color: '#2dd4bf',
            fillColor: '#2dd4bf',
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '5, 10'
          }}
        />

        {/* Pro-Level Pulse Markers for Customer */}
        <Marker position={center} icon={rippleIcon} zIndexOffset={-100} />
        <Marker position={center} icon={dotIcon} zIndexOffset={100}>
          <Popup className="custom-popup">
            <div className="p-2 font-sans">
              <p className="font-bold text-gray-900">Your Base</p>
              <p className="text-xs text-gray-600">Searching active zone...</p>
            </div>
          </Popup>
        </Marker>

        {/* Nearby Workers */}
        {workers.map((worker) => (
          <Marker 
            key={worker._id} 
            position={[worker.location.coordinates[1], worker.location.coordinates[0]]}
            icon={workerIcon}
            eventHandlers={{
              click: () => onWorkerClick && onWorkerClick(worker)
            }}
          >
            <Popup className="worker-popup">
              <div className="p-3 font-sans min-w-[160px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {worker.user.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{worker.user.full_name}</p>
                    <p className="text-[10px] text-green-600 font-black uppercase">Active Now</p>
                  </div>
                </div>
                {/* Trust badge — shown when Aadhaar doc is present or flagged verified */}
                {(worker.is_verified || worker.aadhaar_url) && (
                  <div className="flex items-center gap-1 mb-2 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 w-fit">
                    <ShieldCheck className="h-3 w-3 text-blue-600" />
                    <span className="text-[10px] font-bold text-blue-700">ID Verified</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                  {worker.bio || 'Professional Service Provider'}
                </p>
                <Button 
                  onClick={() => onWorkerClick && onWorkerClick(worker)}
                  className="w-full h-8 text-[11px] font-bold rounded-lg shadow-sm"
                >
                  View Details
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Meta Stats */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-lg flex items-center gap-3">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-wider">
            {workers.length} Professionals In Range
          </span>
        </div>
        
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-lg flex items-center gap-3">
          <MapPin className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-black text-white uppercase tracking-wider">
            Sector 17, Chandigarh
          </span>
        </div>

        {/* Demo: Simulate Worker Arrival Button */}
        {workers.length > 0 && (
          <button
            onClick={simulateWorkerArrival}
            disabled={simulatingArrival}
            className="pointer-events-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-3 py-2 rounded-2xl border border-white/20 shadow-lg flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-wider disabled:opacity-50 transition-all"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white ${simulatingArrival ? 'opacity-75' : 'opacity-0'}`}></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            {simulatingArrival ? 'Arriving...' : 'Demo: Simulate Arrival'}
          </button>
        )}
      </div>

      {/* Bottom Scan Banner */}
      <div className="absolute bottom-6 left-6 right-6 z-[1000] pointer-events-none">
        {!loading && workers.length > 0 && (
          <div className="bg-primary/90 backdrop-blur px-4 py-3 rounded-2xl border border-white/20 shadow-2xl flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-white" />
              <p className="text-[11px] font-bold text-white">
                Best matches found! Tap a worker to view details.
              </p>
            </div>
            <div className="h-1.5 w-12 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white animate-progress-indefinite" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NearbyWorkersMap;
