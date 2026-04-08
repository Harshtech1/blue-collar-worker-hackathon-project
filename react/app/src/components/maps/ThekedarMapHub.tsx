import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { motion } from 'framer-motion';
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
  Eye
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
import { db } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';

// Extend Leaflet to fix default icon issues
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
}

interface Location {
  lat: number;
  lng: number;
  timestamp: Date;
}

export default function ThekedarMapHub() {
  const { user, profile } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const teamMarkersRef = useRef<L.Marker[]>([]);
  const visitMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [activeRoute, setActiveRoute] = useState<{ points: [number, number][]; distance: number; eta: number } | null>(null);
  const [heatmapData, setHeatmapData] = useState<{ lat: number; lng: number; service: string }[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const heatmapLayersRef = useRef<L.Circle[]>([]);

  // Fetch team and site visit data
  useEffect(() => {
    if (user && profile?.role === 'thekedar') {
      fetchData();
      fetchHeatmapData();
      startLocationTracking();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [user, profile]);

  const fetchHeatmapData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/thekedar/demand-heatmap`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch heatmap');
      const data = await response.json();
      setHeatmapData(data);
    } catch (err) {
      console.error('fetchHeatmapData Error:', err);
    }
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      
      // Fetch team members from backend
      const teamRes = await fetch(`${API_BASE}/thekedar/team`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const teamData = await teamRes.json();

      // Fetch site visits from backend
      const visitsRes = await fetch(`${API_BASE}/thekedar/visits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const visitsData = await visitsRes.json();

      setTeamMembers(teamData || []);
      setSiteVisits(visitsData || []);
    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  };

  const startLocationTracking = () => {
    if (navigator.geolocation) {
      // Get initial location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date(position.timestamp)
          };
          setCurrentLocation(location);
          initializeMap(location);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Use default location (Chandigarh Center)
          const defaultLocation = {
            lat: 30.7333,
            lng: 76.7794,
            timestamp: new Date()
          };
          setCurrentLocation(defaultLocation);
          initializeMap(defaultLocation);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );

      // Start continuous tracking
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date(position.timestamp)
          };
          setCurrentLocation(location);
          updateLocationMarker(location);
        },
        (error) => console.error('Watch position error:', error),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  };

  const initializeMap = (location: Location) => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [location.lat, location.lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add thekedar marker
    const thekedarIcon = L.divIcon({
      html: `
        <div class="relative">
          <div class="w-8 h-8 bg-purple-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <Target class="h-4 w-4 text-white" />
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 rotate-45"></div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([location.lat, location.lng], { icon: thekedarIcon })
      .addTo(map)
      .bindPopup(`<b>Your Location</b><br>Updated: ${location.timestamp.toLocaleTimeString()}`);

    mapInstanceRef.current = map;
    addTeamMarkers();
    addVisitMarkers();
    if (showHeatmap) addHeatmap();
  };

  const addHeatmap = () => {
    if (!mapInstanceRef.current || heatmapData.length === 0) return;

    // Clear existing
    heatmapLayersRef.current.forEach(layer => mapInstanceRef.current?.removeLayer(layer));
    heatmapLayersRef.current = [];

    heatmapData.forEach(point => {
      const circle = L.circle([point.lat, point.lng], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.4,
        radius: 300,
        stroke: false,
        className: 'animate-pulse'
      }).addTo(mapInstanceRef.current!);
      
      circle.bindTooltip(`High Demand: ${point.service}`);
      heatmapLayersRef.current.push(circle);
    });
  };

  useEffect(() => {
    if (mapInstanceRef.current) {
      if (showHeatmap) {
        addHeatmap();
      } else {
        heatmapLayersRef.current.forEach(layer => mapInstanceRef.current?.removeLayer(layer));
        heatmapLayersRef.current = [];
      }
    }
  }, [showHeatmap, heatmapData]);

  const updateLocationMarker = (location: Location) => {
    if (mapInstanceRef.current) {
      // Update existing marker or add new one
      const marker = L.marker([location.lat, location.lng]).addTo(mapInstanceRef.current);
      marker.bindPopup(`<b>Your Location</b><br>Updated: ${location.timestamp.toLocaleTimeString()}`);
    }
  };

  const addTeamMarkers = () => {
    if (!mapInstanceRef.current || teamMembers.length === 0) return;

    // Clear existing team markers
    teamMarkersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker));
    teamMarkersRef.current = [];

    teamMembers.forEach(member => {
      const lat = member.latitude;
      const lng = member.longitude;
      
      if (lat && lng) {
        const status = member.status || 'offline';
        const color = status === 'online' ? 'bg-green-500' : 
                     status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500';

        const teamIcon = L.divIcon({
          html: `
            <div class="relative">
              <div class="w-6 h-6 ${color} rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <Users class="h-3 w-3 text-white" />
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 ${color} rotate-45"></div>
            </div>
          `,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([lat, lng], { icon: teamIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div class="font-medium">${member.full_name || 'Team Member'}</div>
            <div class="text-sm">Status: ${status}</div>
            <div class="text-sm">Jobs: ${member.totalJobs || 0}</div>
            <button onclick="selectTeamMember('${member._id}')" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm">
              View Details
            </button>
          `);

        teamMarkersRef.current.push(marker);
      }
    });
  };

  const addVisitMarkers = () => {
    if (!mapInstanceRef.current || siteVisits.length === 0) return;

    // Clear existing visit markers
    visitMarkersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker));
    visitMarkersRef.current = [];

    siteVisits.forEach(visit => {
      const lat = visit.lat;
      const lng = visit.lng;
      
      if (lat && lng) {
        const statusColor = visit.status === 'pending' ? 'bg-red-500' :
                           visit.status === 'scheduled' ? 'bg-blue-500' :
                           visit.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-500';

        const visitIcon = L.divIcon({
          html: `
            <div class="relative">
              <div class="w-8 h-8 ${statusColor} rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <MapPin class="h-4 w-4 text-white" />
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 ${statusColor} rotate-45"></div>
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon: visitIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div class="font-medium">Site Visit</div>
            <div class="text-sm">${visit.address || 'Address not available'}</div>
            <div class="text-sm mt-1">Worker: ${visit.workerName || 'Pending'}</div>
            <div class="text-sm">Customer: ${visit.customerName || 'Unknown'}</div>
            <div class="text-sm">Status: ${visit.status}</div>
            <button onclick="selectVisit('${visit.id}')" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm">
              View Details
            </button>
          `);

        visitMarkersRef.current.push(marker);
      }
    });

    // Fit bounds to show all markers
    const allPoints = [
      [currentLocation?.lat || 28.6139, currentLocation?.lng || 77.2090],
      ...teamMembers
        .filter(m => m.latitude && m.longitude)
        .map(m => [m.latitude!, m.longitude!]),
      ...siteVisits
        .filter(v => v.lat && v.lng)
        .map(v => [v.lat!, v.lng!])
    ];

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints as [number, number][]);
      mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const calculateRoute = async (visit: SiteVisit) => {
    if (!currentLocation || !visit.lat || !visit.lng) return;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${visit.lng},${visit.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][];
        const distance = route.distance / 1000; // km
        const duration = route.duration / 60; // minutes

        setActiveRoute({
          points: coordinates,
          distance: parseFloat(distance.toFixed(2)),
          eta: Math.round(duration)
        });

        // Update polyline on map
        if (routePolylineRef.current) {
          mapInstanceRef.current?.removeLayer(routePolylineRef.current);
        }

        routePolylineRef.current = L.polyline(coordinates, {
          color: '#8b5cf6',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(mapInstanceRef.current!);

        // Fit map to route
        const bounds = L.latLngBounds(coordinates);
        mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  const handleVisitSelect = (visit: SiteVisit) => {
    setSelectedVisit(visit);
    calculateRoute(visit);
  };

  // Make global functions for popup buttons
  (window as any).selectVisit = (visitId: string) => {
    const visit = siteVisits.find(v => v.id === visitId);
    if (visit) {
      handleVisitSelect(visit);
    }
  };

  (window as any).selectTeamMember = (memberId: string) => {
    console.log('Selected team member:', memberId);
    // Implement team member details view
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
  };

  const resetView = () => {
    if (mapInstanceRef.current && currentLocation) {
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 12);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Thekedar Map Hub</h1>
            <p className="text-muted-foreground">Manage your team and site visits</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showHeatmap ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={showHeatmap ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              <Flame className="h-4 w-4 mr-2" />
              Demand Heatmap
            </Button>
            <Badge variant={isTracking ? "default" : "secondary"}>
              {isTracking ? "Tracking Active" : "Tracking Paused"}
            </Badge>
            <Button size="icon" variant={showHeatmap ? "default" : "outline"} onClick={() => setShowHeatmap(!showHeatmap)} title="Toggle Demand Heatmap">
              <Flame className={`h-4 w-4 ${showHeatmap ? "text-orange-200" : "text-orange-500"}`} />
            </Button>
            <Button size="icon" variant="outline" onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="h-full w-full" />
          
          {/* Current Location Indicator */}
          {currentLocation && (
            <div className="absolute top-4 left-4 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg z-[1000]">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500 animate-pulse" />
                <div>
                  <p className="text-sm font-medium">Your Location</p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {currentLocation.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Panel */}
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg z-[1000]">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span>Team: {teamMembers.length} members</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500" />
                <span>Visits: {siteVisits.length} scheduled</span>
              </div>
              {activeRoute && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Route Info</span>
                  </div>
                  <p className="text-xs">Distance: {activeRoute.distance} km</p>
                  <p className="text-xs">ETA: {activeRoute.eta} min</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="w-80 bg-background border-l overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Site Visits</h2>
            
            {siteVisits.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No scheduled visits</p>
                <Button className="mt-3" variant="outline">
                  Schedule Visit
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {siteVisits.map((visit) => (
                  <motion.div
                    key={visit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedVisit?.id === visit.id 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleVisitSelect(visit)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium">Site Visit</h3>
                      <Badge variant={
                        visit.status === 'pending' ? 'secondary' :
                        visit.status === 'scheduled' ? 'default' :
                        visit.status === 'in_progress' ? 'outline' : 'destructive'
                      }>
                        {visit.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{visit.address || 'Address not available'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{visit.customerName || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(visit.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {selectedVisit?.id === visit.id && (
                      <div className="mt-3 pt-3 border-t">
                        <Button className="w-full" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Team Members Section */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">Team Members</h2>
              {teamMembers.length === 0 ? (
                <div className="text-center py-4">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No team members</p>
                  <Button className="mt-2" variant="outline" size="sm">
                    Add Members
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member._id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          member.status === 'online' ? 'bg-green-100' :
                          member.status === 'busy' ? 'bg-yellow-100' : 'bg-gray-100'
                        }`}>
                          <Users className={`h-5 w-5 ${
                            member.status === 'online' ? 'text-green-600' :
                            member.status === 'busy' ? 'text-yellow-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {member.full_name || 'Team Member'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.status || 'offline'}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            member.status === 'online' ? 'default' :
                            member.status === 'busy' ? 'outline' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {member.status || 'offline'}
                        </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}