import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Users, 
  Calendar, 
  Target, 
  Clock, 
  Phone,
  Play,
  Pause,
  RotateCcw,
  Flame,
  TrendingUp,
  LayoutGrid,
  Eye,
  Radio,
  Activity,
  Zap,
  Wifi,
  ChevronUp,
  ChevronDown,
  X,
  Command,
  Layers,
  Map,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Circle,
  BarChart3
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import StrategyTerminal from './StrategyTerminal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface TeamMember {
  _id: string;
  full_name: string;
  phone: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  totalEarnings: number;
  totalJobs: number;
  skills?: string[];
  rating?: number;
}

interface SiteVisit {
  id: string;
  status: string;
  createdAt: string;
  estimatedAmount: number;
  address: string;
  lat: number;
  lng: number;
  workerName: string;
  customerName: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface Location {
  lat: number;
  lng: number;
  timestamp: Date;
}

interface SystemStats {
  uptime: number;
  latency: number;
  activeWorkers: number;
  pendingJobs: number;
}

const COLORS = {
  bg: '#020617',
  emerald: '#10b981',
  amber: '#f59e0b',
  rahiIndigo: '#6366f1',
  glassBg: 'rgba(2, 6, 23, 0.75)',
  glassBorder: 'rgba(99, 102, 241, 0.2)',
};

export default function ThekedarMapHub() {
  const { user, profile } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const teamMarkersRef = useRef<L.Marker[]>([]);
  const visitMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineRef = useRef<L.Layer | null>(null);
  const heatmapLayersRef = useRef<L.Circle[]>([]);
  
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [activeRoute, setActiveRoute] = useState<{ points: [number, number][]; distance: number; eta: number } | null>(null);
  const [heatmapData, setHeatmapData] = useState<{ lat: number; lng: number; service: string; intensity: number }[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [systemStats, setSystemStats] = useState<SystemStats>({ uptime: 99.9, latency: 12, activeWorkers: 0, pendingJobs: 0 });
  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<TeamMember | null>(null);
  const [scanlinePosition, setScanlinePosition] = useState(0);

  useEffect(() => {
    if (user && profile?.role === 'thekedar') {
      fetchData();
      fetchHeatmapData();
      startLocationTracking();
      startSystemMonitor();
      startScanlineAnimation();
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [user, profile]);

  const startSystemMonitor = () => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        ...prev,
        latency: Math.floor(Math.random() * 20) + 5,
        activeWorkers: teamMembers.filter(m => m.status === 'online').length,
        pendingJobs: siteVisits.filter(v => v.status === 'pending').length
      }));
    }, 3000);
    return () => clearInterval(interval);
  };

  const startScanlineAnimation = () => {
    const interval = setInterval(() => {
      setScanlinePosition(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  };

  const fetchHeatmapData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/thekedar/demand-heatmap`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch heatmap');
      const data = await response.json();
      setHeatmapData(data.map((d: any, i: number) => ({ ...d, intensity: Math.random() * 0.5 + 0.3 })));
    } catch (err) {
      console.error('fetchHeatmapData Error:', err);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const [teamRes, visitsRes] = await Promise.all([
        fetch(`${API_BASE}/thekedar/team`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/thekedar/visits`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const teamData = await teamRes.json();
      const visitsData = await visitsRes.json();
      setTeamMembers(teamData || []);
      setSiteVisits(visitsData || []);
    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  };

  const startLocationTracking = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude, timestamp: new Date(position.timestamp) };
          setCurrentLocation(location);
          initializeMap(location);
        },
        () => {
          const defaultLocation = { lat: 30.7333, lng: 76.7794, timestamp: new Date() };
          setCurrentLocation(defaultLocation);
          initializeMap(defaultLocation);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  };

  const initializeMap = (location: Location) => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [location.lat, location.lng], zoom: 13, zoomControl: false });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
    }).addTo(map);
    
    const thekedarIcon = L.divIcon({
      html: `
        <div class="relative animate-pulse">
          <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full border-2 border-cyan-400 shadow-[0_0_20px_rgba(99,102,241,0.6)] flex items-center justify-center">
            <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-cyan-400 rotate-45 shadow-[0_0_10px_rgba(34,211,238,0.6)]"></div>
        </div>
      `,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    L.marker([location.lat, location.lng], { icon: thekedarIcon }).addTo(map).bindPopup(`<b style="color:#6366f1">HQ LOCATION</b><br/>Updated: ${location.timestamp.toLocaleTimeString()}`);
    mapInstanceRef.current = map;
    addTeamMarkers();
    addVisitMarkers();
    if (showHeatmap) addHeatmap();
  };

  const addHeatmap = useCallback(() => {
    if (!mapInstanceRef.current || heatmapData.length === 0) return;
    heatmapLayersRef.current.forEach(layer => mapInstanceRef.current?.removeLayer(layer));
    heatmapLayersRef.current = [];
    heatmapData.forEach(point => {
      const circle = L.circle([point.lat, point.lng], {
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: point.intensity,
        radius: 400,
        className: 'heatmap-pulse'
      }).addTo(mapInstanceRef.current!);
      circle.bindTooltip(`⚡ High Demand: ${point.service}`);
      heatmapLayersRef.current.push(circle);
    });
  }, [heatmapData]);

  useEffect(() => {
    if (mapInstanceRef.current && heatmapData.length > 0) {
      if (showHeatmap) addHeatmap();
      else {
        heatmapLayersRef.current.forEach(layer => mapInstanceRef.current?.removeLayer(layer));
        heatmapLayersRef.current = [];
      }
    }
  }, [showHeatmap, heatmapData, addHeatmap]);

  const addTeamMarkers = useCallback(() => {
    if (!mapInstanceRef.current || teamMembers.length === 0) return;
    teamMarkersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker));
    teamMarkersRef.current = [];
    teamMembers.forEach(member => {
      if (member.latitude && member.longitude) {
        const status = member.status || 'offline';
        const statusColor = status === 'online' ? '#10b981' : status === 'busy' ? '#f59e0b' : '#6b7280';
        const reticleHtml = `
          <div class="worker-reticle" data-worker-id="${member._id}" style="
            width: 48px; height: 48px;
            background: linear-gradient(135deg, ${statusColor}40, ${statusColor}20);
            border: 2px solid ${statusColor};
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 0 15px ${statusColor}60;
            cursor: pointer;
            animation: ${status === 'online' ? 'pulse-ring 2s infinite' : 'none'};
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <style>
            @keyframes pulse-ring {
              0% { box-shadow: 0 0 0 0 ${statusColor}80; }
              70% { box-shadow: 0 0 0 15px ${statusColor}00; }
              100% { box-shadow: 0 0 0 0 ${statusColor}00; }
            }
          </style>
        `;
        const teamIcon = L.divIcon({ html: reticleHtml, className: '', iconSize: [48, 48], iconAnchor: [24, 24] });
        const marker = L.marker([member.latitude, member.longitude], { icon: teamIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div style="font-family: 'JetBrains Mono', monospace; min-width: 180px;">
              <div style="font-weight: 600; color: #6366f1; font-size: 14px;">${member.full_name || 'Team Member'}</div>
              <div style="font-size: 12px; color: ${statusColor}; margin: 4px 0;">● ${status.toUpperCase()}</div>
              <div style="font-size: 11px; color: #9ca3af;">📊 Jobs: ${member.totalJobs || 0} | 💰 ₹${member.totalEarnings?.toLocaleString() || 0}</div>
              ${member.rating ? `<div style="font-size: 11px; color: #f59e0b;">⭐ ${member.rating.toFixed(1)}</div>` : ''}
              <button onclick="window.selectTeamMember('${member._id}')" style="
                margin-top: 8px; width: 100%; padding: 6px; background: #6366f1; 
                color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;
              ">VIEW AUDIT</button>
            </div>
          `);
        teamMarkersRef.current.push(marker);
      }
    });
  }, [teamMembers]);

  useEffect(() => {
    if (mapInstanceRef.current && teamMembers.length > 0) addTeamMarkers();
  }, [teamMembers, addTeamMarkers]);

  const addVisitMarkers = useCallback(() => {
    if (!mapInstanceRef.current || siteVisits.length === 0) return;
    visitMarkersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker));
    visitMarkersRef.current = [];
    siteVisits.forEach(visit => {
      if (visit.lat && visit.lng) {
        const statusColor = visit.status === 'pending' ? '#ef4444' : visit.status === 'scheduled' ? '#3b82f6' : visit.status === 'in_progress' ? '#f59e0b' : '#6b7280';
        const priorityColor = visit.priority === 'critical' ? '#ef4444' : visit.priority === 'high' ? '#f97316' : '#f59e0b';
        const visitIcon = L.divIcon({
          html: `
            <div class="relative">
              <div class="w-8 h-8 ${visit.priority === 'critical' ? 'animate-pulse' : ''}" style="background: ${statusColor}; border-radius: 50%; border: 2px solid ${priorityColor}; box-shadow: 0 0 12px ${statusColor}80;">
                <svg class="h-4 w-4 mx-auto mt-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([visit.lat, visit.lng], { icon: visitIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div style="font-family: 'JetBrains Mono', monospace; min-width: 160px;">
              <div style="font-weight: 600; color: #6366f1;">SITE VISIT</div>
              <div style="font-size: 11px; color: #9ca3af;">${visit.address || 'Address N/A'}</div>
              <div style="font-size: 11px; color: ${statusColor};">● ${visit.status.replace('_', ' ').toUpperCase()}</div>
              <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">Worker: ${visit.workerName || 'Pending'}</div>
              <button onclick="window.selectVisit('${visit.id}')" style="
                margin-top: 6px; width: 100%; padding: 4px; background: #6366f1; 
                color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;
              ">SELECT ROUTE</button>
            </div>
          `);
        visitMarkersRef.current.push(marker);
      }
    });
  }, [siteVisits]);

  useEffect(() => {
    if (mapInstanceRef.current && siteVisits.length > 0) addVisitMarkers();
  }, [siteVisits, addVisitMarkers]);

  const calculateRoute = async (visit: SiteVisit) => {
    if (!currentLocation || !visit.lat || !visit.lng) return;
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${visit.lng},${visit.lat}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][];
        setActiveRoute({ points: coordinates, distance: parseFloat((route.distance / 1000).toFixed(2)), eta: Math.round(route.duration / 60) });
        if (routePolylineRef.current) mapInstanceRef.current?.removeLayer(routePolylineRef.current);
        routePolylineRef.current = L.polyline(coordinates, { color: '#6366f1', weight: 4, opacity: 0.8, dashArray: '10, 10' }).addTo(mapInstanceRef.current!);
        const bounds = L.latLngBounds(coordinates);
        mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) { console.error('Error calculating route:', error); }
  };

  const handleVisitSelect = (visit: SiteVisit) => {
    setSelectedVisit(visit);
    calculateRoute(visit);
  };

  (window as any).selectVisit = (visitId: string) => {
    const visit = siteVisits.find(v => v.id === visitId);
    if (visit) handleVisitSelect(visit);
  };

  (window as any).selectTeamMember = (memberId: string) => {
    const member = teamMembers.find(m => m._id === memberId);
    if (member) setSelectedWorker(member);
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: COLORS.bg, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .heatmap-pulse { animation: heat-pulse 3s ease-in-out infinite; }
        @keyframes heat-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        .scanline { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #22d3ee, transparent); opacity: 0.5; pointer-events: none; z-index: 1000; }
        .glass-panel { background: ${COLORS.glassBg}; backdrop-filter: blur(12px); border: 1px solid ${COLORS.glassBorder}; }
        .data-glow { text-shadow: 0 0 10px currentColor; }
        .hud-text { font-variant-numeric: tabular-nums; letter-spacing: 0.05em; }
        .tool-belt-btn { transition: all 0.2s ease; }
        .tool-belt-btn:hover { background: rgba(99, 102, 241, 0.3); transform: scale(1.1); }
        .terminal-cursor::after { content: '█'; animation: blink 1s step-end infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(2, 6, 23, 0.5); }
        ::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 2px; }
      `}</style>

      {/* Scanline Effect */}
      <motion.div 
        className="scanline" 
        animate={{ top: `${scanlinePosition}%` }}
        transition={{ duration: 0.1 }}
      />

      {/* Header HUD */}
      <motion.header 
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 h-14 glass-panel flex items-center justify-between px-6 z-[1000]"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-wider">RAHI <span className="text-cyan-400">HQ</span></span>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <span className="text-xs text-zinc-400">GLOBAL COMMAND DECK</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 hud-text">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-emerald-400 text-sm">UPTIME</span>
              <span className="text-white font-bold">{systemStats.uptime}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-amber-400 text-sm">LATENCY</span>
              <span className="text-white font-bold">{systemStats.latency}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm">ACTIVE</span>
              <span className="text-white font-bold">{systemStats.activeWorkers}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <span className="text-purple-400 text-sm">PENDING</span>
              <span className="text-white font-bold">{systemStats.pendingJobs}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={showHeatmap ? 'text-amber-400' : 'text-zinc-500'}
            >
              <Flame className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Left Tool Belt Sidebar */}
      <motion.aside 
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="fixed left-0 top-14 bottom-0 w-16 glass-panel flex flex-col items-center py-6 gap-4 z-[900]"
      >
        {[
          { icon: Map, label: 'Map', active: true },
          { icon: Layers, label: 'Layers' },
          { icon: Navigation, label: 'Navigate' },
          { icon: BarChart3, label: 'Analytics' },
          { icon: Users, label: 'Team' },
          { icon: AlertTriangle, label: 'Alerts' },
        ].map((tool, i) => (
          <button 
            key={tool.label}
            className={cn(
              "tool-belt-btn w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400",
              tool.active && "bg-indigo-500/30 text-cyan-400 border border-indigo-500/50"
            )}
            title={tool.label}
          >
            <tool.icon className="h-5 w-5" />
          </button>
        ))}
        <div className="mt-auto">
          <button className="tool-belt-btn w-10 h-10 rounded-lg flex items-center justify-center text-zinc-600">
            <Command className="h-5 w-5" />
          </button>
        </div>
      </motion.aside>

      {/* Main Map Area */}
      <div className="fixed left-16 top-14 right-0 bottom-0">
        <div ref={mapRef} className="h-full w-full" style={{ filter: 'contrast(1.1) brightness(0.85)' }} />
        
        {/* Top Right Intervention Ribbon - Priority HUD */}
        <motion.div 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="absolute top-4 right-4 glass-panel rounded-lg p-3 z-[1000] min-w-[200px]"
        >
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-4 w-4 text-amber-400 animate-pulse" />
            <span className="text-amber-400 text-xs font-bold tracking-wider">PRIORITY HUD</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Critical Jobs</span>
              <span className="text-red-400 font-bold">{siteVisits.filter(v => v.priority === 'critical').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">High Priority</span>
              <span className="text-orange-400 font-bold">{siteVisits.filter(v => v.priority === 'high').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">In Transit</span>
              <span className="text-cyan-400 font-bold">{siteVisits.filter(v => v.status === 'in_progress').length}</span>
            </div>
          </div>
        </motion.div>

        {/* Current Location Badge */}
        {currentLocation && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="absolute top-4 left-4 glass-panel rounded-lg p-3 z-[1000]"
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></div>
              <div>
                <p className="text-xs text-zinc-400">HQ LOCATION</p>
                <p className="text-xs text-white font-bold">{currentLocation.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Active Route Info */}
        {activeRoute && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-24 right-4 glass-panel rounded-lg p-3 z-[1000] min-w-[160px]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-indigo-400" />
              <span className="text-indigo-400 text-xs font-bold">ROUTE DATA</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Distance</span>
                <span className="text-white font-bold">{activeRoute.distance} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ETA</span>
                <span className="text-amber-400 font-bold">{activeRoute.eta} min</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Docked Strategy Terminal - STRICT_PERSISTENCE */}
      <StrategyTerminal 
        isExpanded={terminalExpanded}
        onToggle={() => setTerminalExpanded(!terminalExpanded)}
        teamMembers={teamMembers}
      />

      {/* Worker Detail Popup */}
      <AnimatePresence>
        {selectedWorker && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed right-20 top-20 w-80 glass-panel rounded-lg z-[1100] overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedWorker.full_name}</h3>
                <p className="text-xs text-zinc-500">ID: {selectedWorker._id.slice(0, 8)}...</p>
              </div>
              <button onClick={() => setSelectedWorker(null)} className="text-zinc-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <Badge variant={selectedWorker.status === 'online' ? 'default' : 'secondary'} className={selectedWorker.status === 'online' ? 'bg-emerald-500' : ''}>
                  {selectedWorker.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Jobs Completed</span>
                <span className="text-white font-bold">{selectedWorker.totalJobs || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Earnings</span>
                <span className="text-emerald-400 font-bold">₹{selectedWorker.totalEarnings?.toLocaleString() || 0}</span>
              </div>
              {selectedWorker.rating && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Rating</span>
                  <span className="text-amber-400 font-bold">⭐ {selectedWorker.rating.toFixed(1)}</span>
                </div>
              )}
              {selectedWorker.skills && (
                <div className="mt-3">
                  <span className="text-zinc-500 text-xs">Skills</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedWorker.skills.map(skill => (
                      <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-white/10">
                <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <Navigation className="h-3 w-3 mr-2" /> Assign Job
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}