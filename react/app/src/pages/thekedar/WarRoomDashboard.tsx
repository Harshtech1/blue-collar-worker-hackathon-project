import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Briefcase, 
  Users,
  TrendingUp,
  BarChart3,
  Bell,
  Activity,
  Zap,
  Crosshair,
  Radio,
  Target,
  Layers,
  Grid3X3,
  Eye,
  Settings,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Terminal,
  Cpu,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const mockWorkerLocations = [
  { id: 1, name: 'Ramesh Kumar', lat: 28.6139, lng: 77.2090, status: 'active', jobs: 28, rating: 4.8 },
  { id: 2, name: 'Suresh Patel', lat: 28.6294, lng: 77.2151, status: 'active', jobs: 24, rating: 4.6 },
  { id: 3, name: 'Mohan Singh', lat: 28.6328, lng: 77.2197, status: 'idle', jobs: 22, rating: 4.7 },
  { id: 4, name: 'Ravi Sharma', lat: 28.6201, lng: 77.2323, status: 'active', jobs: 18, rating: 4.5 },
  { id: 5, name: 'Amit Verma', lat: 28.6150, lng: 77.2500, status: 'busy', jobs: 15, rating: 4.4 },
];

const mockHeatmapPoints = Array.from({ length: 50 }, (_, i) => ({
  lat: 28.61 + Math.random() * 0.05,
  lng: 77.20 + Math.random() * 0.06,
  intensity: Math.random() * 100
}));

const customMarkerIcon = (status: string) => {
  const colors: Record<string, string> = {
    active: '#10b981',
    idle: '#f59e0b',
    busy: '#ef4444'
  };
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      background: ${colors[status] || '#6366f1'};
      border: 2px solid #020617;
      border-radius: 50%;
      box-shadow: 0 0 10px ${colors[status] || '#6366f1'}80;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const ScanlineOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-[1000] overflow-hidden">
    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent animate-scanline" 
      style={{ animation: 'scanline 5s linear infinite' }} />
  </div>
);

const DataStreamParticles = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-[999] overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div 
          key={i}
          className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse"
          style={{
            left: `${50 + (Math.random() - 0.5) * 30}%`,
            top: '50%',
            animationDelay: `${i * 0.2}s`,
            animationDuration: '2s'
          }}
        />
      ))}
    </div>
  );
};

const GlassPanel = ({ 
  children, 
  className = '', 
  position = 'bottom-right',
  width = 'auto'
}: { 
  children: React.ReactNode; 
  className?: string; 
  position?: string;
  width?: string;
}) => {
  const positionClasses: Record<string, string> = {
    'top-left': 'top-20 left-20',
    'top-right': 'top-20 right-4',
    'bottom-left': 'bottom-24 left-4',
    'bottom-right': 'bottom-24 right-4',
    'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2',
  };
  
  return (
    <div 
      className={`
        absolute ${positionClasses[position]} z-[500]
        bg-slate-900/80 backdrop-blur-xl 
        border border-slate-700/50 
        shadow-2xl shadow-emerald-900/20
        rounded-lg overflow-hidden
        ${className}
      `}
      style={{ width }}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      {children}
    </div>
  );
};

const TerminalPanel = ({ 
  logs, 
  expanded,
  onToggle 
}: { 
  logs: string[]; 
  expanded: boolean;
  onToggle: () => void;
}) => (
  <div 
    className={`
      absolute bottom-0 left-0 right-0 z-[600]
      bg-slate-950/95 backdrop-blur-2xl
      border-t border-emerald-500/30
      transition-all duration-300 ease-out
      ${expanded ? 'h-64' : 'h-12'}
    `}
  >
    <div 
      className="flex items-center justify-between px-4 py-2 cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <Terminal className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-mono text-emerald-400 tracking-wider">
          LOGISTICS_CORE_AUDIT [STRICT_PERSISTENCE]
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-slate-400">LIVE</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </div>
    
    {expanded && (
      <div className="px-4 pb-4 h-48 overflow-y-auto font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className="py-0.5 text-slate-300">
            <span className="text-slate-500">[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>{' '}
            <span className="text-emerald-400">{'>'}</span> {log}
          </div>
        ))}
        <div className="py-0.5 flex items-center gap-2">
          <span className="text-slate-500">[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>{' '}
          <span className="text-emerald-400">{'>'}</span>
          <span className="w-2 h-4 bg-emerald-400 animate-pulse inline-block" />
        </div>
      </div>
    )}
  </div>
);

const WarRoomDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.6139, 77.2090]);
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[INIT] RAHI Command Deck loaded successfully',
    '[MAP] Satellite tiles connected',
    '[WORKERS] 5 units tracked in Agra sector',
    '[SIMULATION] 400,000 point analysis ready',
    '[SYSTEM] All subsystems operational'
  ]);
  const [systemStats, setSystemStats] = useState({
    uptime: 99.98,
    latency: 12,
    activeWorkers: 5,
    totalJobs: 127,
    efficiency: 94
  });
  const [showSimulation, setShowSimulation] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        ...prev,
        latency: Math.floor(Math.random() * 10) + 8,
        activeWorkers: Math.floor(Math.random() * 3) + 4
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const runSimulation = () => {
    setShowSimulation(true);
    setTerminalLogs(prev => [...prev, '[SIMULATION] Initiating 400k point analysis...']);
    setTimeout(() => {
      setTerminalLogs(prev => [...prev, '[ANALYSIS] Computing optimal worker distribution...']);
    }, 1000);
    setTimeout(() => {
      setTerminalLogs(prev => [...prev, '[RESULT] Sector 7 breakpoint detected - recommend immediate intervention']);
      setShowSimulation(false);
    }, 3000);
  };

  const addLog = (message: string) => {
    setTerminalLogs(prev => [...prev, message]);
  };

  const moveToCity = (city: string, lat: number, lng: number) => {
    setMapCenter([lat, lng]);
    addLog(`[NAV] Relocating to ${city.toUpperCase()} coordinates: ${lat}, ${lng}`);
    setTimeout(() => {
      addLog(`[DETECTED] NEW MARKET: ${city.toUpperCase()}. ANALYZING DENSITY...`);
    }, 1500);
    setTimeout(() => {
      addLog(`[STRATEGY] High-density core detected. Estimated LTV: INR ${Math.floor(8000 + Math.random() * 8000)}`);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-[#020617] overflow-hidden font-sans">
      {/* ====== GLOBAL STYLES ====== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        * { font-family: 'JetBrains Mono', monospace; }
        
        .font-mono-numbers { font-family: 'JetBrains Mono', monospace; }
        
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        
        .animate-scanline {
          animation: scanline 5s linear infinite;
        }
        
        .leaflet-container {
          background: #020617 !important;
          filter: contrast(1.1) brightness(0.7) grayscale(0.2);
        }
        
        .glass-panel {
          background: rgba(2, 6, 23, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .glow-border {
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 20px rgba(16, 185, 129, 0.05);
        }
        
        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, transparent);
          animation: scan 4s linear infinite;
          opacity: 0.5;
        }
        
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>

      {/* ====== MAP LAYER ====== */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <MapController center={mapCenter} />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri"
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="CartoDB"
          />
          
          {/* Worker Markers */}
          {mockWorkerLocations.map(worker => (
            <Marker 
              key={worker.id} 
              position={[worker.lat, worker.lng]}
              icon={customMarkerIcon(worker.status)}
            >
              <Popup className="custom-popup">
                <div className="bg-slate-900 p-3 rounded-lg min-w-[200px]">
                  <div className="font-bold text-white text-sm">{worker.name}</div>
                  <div className="text-emerald-400 text-xs mt-1">Status: {worker.status.toUpperCase()}</div>
                  <div className="text-slate-400 text-xs">Jobs: {worker.jobs} | Rating: {worker.rating}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Scanline Effect */}
      <ScanlineOverlay />
      <DataStreamParticles active={showSimulation} />

      {/* ====== TOP HUD ====== */}
      <div className="absolute top-0 left-0 right-0 h-14 z-[700] bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <Crosshair className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-wider">RAHI<span className="text-emerald-400">HQ</span></span>
            </div>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
              <Radio className="h-3 w-3 mr-1 animate-pulse" />
              COMMAND DECK
            </Badge>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-slate-400">UPTIME</span>
                <span className="text-sm font-bold text-emerald-400">{systemStats.uptime}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-slate-400">LATENCY</span>
                <span className="text-sm font-bold text-amber-400">{systemStats.latency}ms</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-slate-400">WORKERS</span>
                <span className="text-sm font-bold text-blue-400">{systemStats.activeWorkers}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-slate-400">JOBS</span>
                <span className="text-sm font-bold text-purple-400">{systemStats.totalJobs}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-slate-400 hover:text-white"
                onClick={() => navigate('/thekedar/notifications')}
              >
                <Bell className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ====== LEFT SIDEBAR TOOLBELT ====== */}
      <div className="absolute left-0 top-14 bottom-0 w-16 z-[600] bg-slate-950/90 backdrop-blur-xl border-r border-slate-800/50 flex flex-col items-center py-4 gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          className="text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30"
          title="Overview"
        >
          <Grid3X3 className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          title="Heatmap"
          onClick={() => navigate('/thekedar/map')}
        >
          <Layers className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          title="Analytics"
          onClick={() => navigate('/thekedar/analytics')}
        >
          <Eye className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          title="Team"
          onClick={() => navigate('/thekedar/team')}
        >
          <Users className="h-5 w-5" />
        </Button>
        
        <div className="flex-1" />
        
        <Button 
          variant="ghost" 
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* ====== TOP RIGHT PRIORITY HUD ====== */}
      <div className="absolute top-20 right-4 z-[550]">
        <div className="glass-panel rounded-lg p-3 border-amber-500/30 glow-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 tracking-wider">INTERVENTION PRIORITY</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Sector 7</span>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50 text-xs">SURGE</Badge>
            </div>
            <Progress value={78} className="h-1.5 bg-slate-800" />
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Demand: 78%</span>
              <span className="text-amber-400">ACTION REQUIRED</span>
            </div>
          </div>
        </div>
      </div>

      {/* ====== TOP LEFT STATS PANEL ====== */}
      <GlassPanel position="top-left" width="280px">
        <div className="p-4">
          <div className="text-xs text-slate-500 mb-3 tracking-wider">GLOBAL PULSE</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-500 mb-1">Earnings Today</div>
              <div className="text-lg font-bold text-emerald-400">₹12,450</div>
              <div className="text-xs text-emerald-500 flex items-center gap-1">
                <TrendingUp className="h-2 w-2" /> +15%
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-500 mb-1">Active Jobs</div>
              <div className="text-lg font-bold text-purple-400">8</div>
              <div className="text-xs text-slate-500">of 12 scheduled</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-500 mb-1">Team Online</div>
              <div className="text-lg font-bold text-blue-400">{systemStats.activeWorkers}/5</div>
              <div className="text-xs text-slate-500">workers active</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-500 mb-1">Efficiency</div>
              <div className="text-lg font-bold text-amber-400">{systemStats.efficiency}%</div>
              <div className="text-xs text-slate-500">optimal route</div>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* ====== BOTTOM RIGHT WORKER RETICLES ====== */}
      <GlassPanel position="bottom-right" width="320px">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-400 tracking-wider">WORKER RETICLES</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs text-slate-400 hover:text-white"
              onClick={() => navigate('/thekedar/team')}
            >
              View All
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {mockWorkerLocations.map(worker => (
              <div 
                key={worker.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-2 h-2 rounded-full
                    ${worker.status === 'active' ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : ''}
                    ${worker.status === 'idle' ? 'bg-amber-400 shadow-lg shadow-amber-400/50' : ''}
                    ${worker.status === 'busy' ? 'bg-red-400 shadow-lg shadow-red-400/50' : ''}
                  `} />
                  <div>
                    <div className="text-sm text-white font-medium">{worker.name}</div>
                    <div className="text-xs text-slate-500">{worker.jobs} jobs | {worker.rating}★</div>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`
                    text-xs
                    ${worker.status === 'active' ? 'border-emerald-500/50 text-emerald-400' : ''}
                    ${worker.status === 'idle' ? 'border-amber-500/50 text-amber-400' : ''}
                    ${worker.status === 'busy' ? 'border-red-500/50 text-red-400' : ''}
                  `}
                >
                  {worker.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>

      {/* ====== BOTTOM LEFT QUICK ACTIONS ====== */}
      <GlassPanel position="bottom-left" width="200px">
        <div className="p-3">
          <div className="text-xs text-slate-500 mb-2 tracking-wider">RAPID DEPLOY</div>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              onClick={runSimulation}
            >
              <Cpu className="h-3 w-3 mr-1" />
              400K SIM
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              onClick={() => navigate('/thekedar/map')}
            >
              <MapPin className="h-3 w-3 mr-1" />
              LIVE MAP
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              onClick={() => navigate('/thekedar/team')}
            >
              <Users className="h-3 w-3 mr-1" />
              DISPATCH
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              onClick={() => navigate('/thekedar/earnings')}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              ANALYTICS
            </Button>
          </div>
        </div>
      </GlassPanel>

      {/* ====== CITY SELECTOR RIBBON ====== */}
      <div className="absolute top-20 left-20 z-[550]">
        <div className="glass-panel rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-2 tracking-wider">THEATER SELECT</div>
          <div className="flex gap-2">
            <Button 
              size="sm"
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => moveToCity('Agra', 28.6139, 77.2090)}
            >
              AGRA
            </Button>
            <Button 
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-400 hover:bg-slate-800"
              onClick={() => moveToCity('Delhi', 28.6294, 77.2151)}
            >
              DELHI
            </Button>
            <Button 
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-400 hover:bg-slate-800"
              onClick={() => moveToCity('Noida', 28.5355, 77.2100)}
            >
              NOIDA
            </Button>
            <Button 
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-400 hover:bg-slate-800"
              onClick={() => moveToCity('Gurgaon', 28.4595, 77.0266)}
            >
              GURGAON
            </Button>
          </div>
        </div>
      </div>

      {/* ====== BOTTOM TERMINAL ====== */}
      <TerminalPanel 
        logs={terminalLogs} 
        expanded={terminalExpanded}
        onToggle={() => setTerminalExpanded(!terminalExpanded)}
      />

      {/* ====== SIMULATION OVERLAY ====== */}
      {showSimulation && (
        <div className="absolute inset-0 z-[800] bg-slate-950/30 flex items-center justify-center pointer-events-none">
          <div className="glass-panel rounded-xl p-8 text-center glow-border">
            <Cpu className="h-16 w-16 text-emerald-400 mx-auto mb-4 animate-pulse" />
            <div className="text-xl font-bold text-white mb-2">COMPUTING 400K SIMULATION</div>
            <div className="text-sm text-slate-400">Analyzing worker distribution patterns...</div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarRoomDashboard;