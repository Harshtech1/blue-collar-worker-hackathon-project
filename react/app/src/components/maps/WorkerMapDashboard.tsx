import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Calendar, 
  User, 
  Phone, 
  MessageSquare,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
// import type { Database } from '@/integrations/supabase/types';

// Extend Leaflet to fix default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Job {
  id: string;
  category_id: string;
  customer_id: string;
  customer_user_id: string;
  status: 'pending' | 'matched' | 'accepted' | 'arriving' | 'otp_verify' | 'in_progress' | 'completed' | 'cancelled' | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  scheduled_at: string | null;
  created_at: string | null;
  service_categories: { name: string } | null;
  customer_profiles: { full_name: string; phone: string } | null;
}

interface WorkerLocation {
  lat: number;
  lng: number;
  timestamp: Date;
}

export default function WorkerMapDashboard() {
  const { user, profile } = useAuth();
  const { socket } = useSocket();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const workerMarkerRef = useRef<L.Marker | null>(null);
  const jobMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const [currentLocation, setCurrentLocation] = useState<WorkerLocation | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [activeRoute, setActiveRoute] = useState<{ points: [number, number][]; distance: number; eta: number } | null>(null);

  // Fetch jobs and worker location
  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchJobs();
      startLocationTracking();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [user, profile]);

  const fetchJobs = async () => {
    if (!user) return;

    try {
      const { data: workerProfile, error: profileError } = await db
        .collection('worker_profiles')
        .select('id')
        .eq('user_id', user.id || (user as any)._id)
        .single();

      if (profileError) {
        console.error('Error fetching worker profile:', profileError);
        return;
      }

      // Fetch upcoming jobs with customer details
      const { data: jobsData, error: jobsError } = await db
        .collection('bookings')
        .select(`
          id, 
          category_id, 
          customer_id, 
          status, 
          address, 
          latitude, 
          longitude,
          scheduled_at,
          created_at,
          customer_user_id,
          service_categories!inner(name),
          customer_profiles!inner(full_name, phone)
        `)
        .eq('worker_id', workerProfile.id)
        .in('status', ['pending', 'matched', 'accepted', 'in_progress'])
        .order('scheduled_at', { ascending: true });

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        return;
      }

      setJobs(jobsData || []);
    } catch (error) {
      console.error('Error in fetchJobs:', error);
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
          // Use default location (New Delhi)
          const defaultLocation = {
            lat: 28.6139,
            lng: 77.2090,
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
          updateWorkerMarker(location);

          // Emit location update via socket if we have a selected job
          if (socket && isTracking && selectedJob) {
            socket.emit('location_update', {
              userId: user.id || user._id,
              lat: location.lat,
              lng: location.lng,
              bookingId: selectedJob.id,
              customerId: selectedJob.customer_user_id
            });
          }
        },
        (error) => console.error('Watch position error:', error),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  };

  const initializeMap = (location: WorkerLocation) => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [location.lat, location.lng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add worker marker
    const workerIcon = L.divIcon({
      html: `
        <div class="relative">
          <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <User class="h-3 w-3 text-white" />
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rotate-45"></div>
        </div>
      `,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    workerMarkerRef.current = L.marker([location.lat, location.lng], { icon: workerIcon })
      .addTo(map)
      .bindPopup(`<b>You are here</b><br>Updated: ${location.timestamp.toLocaleTimeString()}`);

    mapInstanceRef.current = map;
    addJobMarkers();
  };

  const updateWorkerMarker = (location: WorkerLocation) => {
    if (workerMarkerRef.current && mapInstanceRef.current) {
      workerMarkerRef.current.setLatLng([location.lat, location.lng]);
      workerMarkerRef.current.setPopupContent(
        `<b>You are here</b><br>Updated: ${location.timestamp.toLocaleTimeString()}`
      );
    }
  };

  const addJobMarkers = () => {
    if (!mapInstanceRef.current || jobs.length === 0) return;

    // Clear existing job markers
    jobMarkersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker));
    jobMarkersRef.current = [];

    jobs.forEach(job => {
      if (job.latitude && job.longitude) {
        const jobIcon = L.divIcon({
          html: `
            <div class="relative">
              <div class="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <MapPin class="h-4 w-4 text-white" />
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45"></div>
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([job.latitude, job.longitude], { icon: jobIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div class="font-medium">${job.service_categories?.name || 'Service'}</div>
            <div class="text-sm">${job.address}</div>
            <div class="text-sm mt-1">Customer: ${job.customer_profiles?.full_name || 'Unknown'}</div>
            <div class="text-sm">${job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'N/A'}</div>
            <button onclick="selectJob('${job.id}')" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm">
              View Details
            </button>
          `);

        jobMarkersRef.current.push(marker);
      }
    });

    // Fit bounds to show all markers
    const allPoints = [
      [currentLocation?.lat || 28.6139, currentLocation?.lng || 77.2090],
      ...jobs.filter(job => job.latitude && job.longitude)
        .map(job => [job.latitude, job.longitude])
    ];

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints as [number, number][]);
      mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const calculateRoute = async (job: Job) => {
    if (!currentLocation) return;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${job.longitude},${job.latitude}?overview=full&geometries=geojson`
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
          color: '#3b82f6',
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

  const updateBookingStatus = async (jobId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const res = await fetch(`${API_URL}/bookings/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        // Update local state
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus as any } : j));
        if (selectedJob?.id === jobId) {
          setSelectedJob({ ...selectedJob, status: newStatus as any });
        }
      }
    } catch (err) {
      console.error('Error updating booking status:', err);
    }
  };

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
    calculateRoute(job);
  };

  // Make selectJob function available globally for popup buttons
  (window as any).selectJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      handleJobSelect(job);
    }
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
  };

  const resetView = () => {
    if (mapInstanceRef.current && currentLocation) {
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 13);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Worker Map Dashboard</h1>
            <p className="text-muted-foreground">Track your jobs and navigate efficiently</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isTracking ? "default" : "secondary"}>
              {isTracking ? "Tracking Active" : "Tracking Paused"}
            </Badge>
            <Button size="icon" variant="outline" onClick={toggleTracking}>
              {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
                <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                <div>
                  <p className="text-sm font-medium">Your Location</p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {currentLocation.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Route Info */}
          {activeRoute && (
            <div className="absolute top-4 right-4 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg z-[1000]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Route Info</span>
                </div>
                <p className="text-xs">Distance: {activeRoute.distance} km</p>
                <p className="text-xs">ETA: {activeRoute.eta} min</p>
              </div>
            </div>
          )}
        </div>

        {/* Job Details Panel */}
        <div className="w-80 bg-background border-l overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Upcoming Jobs</h2>
            
            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No upcoming jobs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedJob?.id === job.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleJobSelect(job)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium">{job.service_categories?.name || 'Service'}</h3>
                      <Badge variant={
                        job.status === 'pending' ? 'secondary' :
                        job.status === 'matched' ? 'default' :
                        job.status === 'accepted' ? 'default' :
                        job.status === 'in_progress' ? 'outline' : 'destructive'
                      }>
                        {job.status?.replace('_', ' ') || 'unknown'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{job.address}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{job.customer_profiles?.full_name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{job.customer_profiles?.phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                    
                    {selectedJob?.id === job.id && activeRoute && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span>Distance: {activeRoute.distance} km</span>
                          <span>ETA: {activeRoute.eta} min</span>
                        </div>
                        
                        {job.status === 'accepted' || job.status === 'matched' ? (
                          <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBookingStatus(job.id, 'arriving');
                            }}
                          >
                            <Navigation className="h-4 w-4 mr-2" />
                            Start Heading to Customer
                          </Button>
                        ) : job.status === 'arriving' ? (
                          <Button 
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBookingStatus(job.id, 'otp_verify');
                            }}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            I Have Arrived
                          </Button>
                        ) : job.status === 'otp_verify' ? (
                          <div className="text-xs text-center p-2 bg-amber-50 text-amber-700 rounded border border-amber-200">
                            Waiting for customer to provide OTP
                          </div>
                        ) : (
                          <Button className="w-full" size="sm" variant="outline" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            Status: {job.status?.replace('_', ' ')}
                          </Button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}