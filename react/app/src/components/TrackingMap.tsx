import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon missing assets in production build
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for user and worker
const userIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3b82f6; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [15, 15],
  iconAnchor: [7, 7]
});

const workerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f59e0b; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Component to fly to the worker's new location gracefully
const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
};

interface TrackingMapProps {
  userLocation: [number, number];
  workerLocation: [number, number] | null;
}

const TrackingMap = ({ userLocation, workerLocation }: TrackingMapProps) => {
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  // Fetch OSRM route
  useEffect(() => {
    if (!workerLocation) return;
    
    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${workerLocation[1]},${workerLocation[0]};${userLocation[1]},${userLocation[0]}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const coordinates = data.routes[0].geometry.coordinates;
          // OSRM returns [lng, lat], Leaflet needs [lat, lng]
          setRoutePath(coordinates.map((coord: number[]) => [coord[1], coord[0]]));
        }
      } catch (error) {
        console.error("Error fetching route:", error);
        // Fallback to straight line
        setRoutePath([workerLocation, userLocation]);
      }
    };

    fetchRoute();
  }, [userLocation, workerLocation]);

  return (
    <MapContainer 
      center={userLocation} 
      zoom={15} 
      scrollWheelZoom={false} 
      className="h-full w-full z-0"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      
      <Marker position={userLocation} icon={userIcon}>
        <Popup>Your Location</Popup>
      </Marker>
      
      {workerLocation && (
        <Marker position={workerLocation} icon={workerIcon}>
          <Popup>Worker Location</Popup>
        </Marker>
      )}

      {/* Dynamic Route Line */}
      {workerLocation && routePath.length > 0 && (
        <Polyline 
          positions={routePath}
          pathOptions={{ 
            color: '#3b82f6', 
            weight: 5, 
            opacity: 0.8, 
            lineCap: 'round',
            lineJoin: 'round'
          }} 
        />
      )}

      {workerLocation && <RecenterMap center={workerLocation} />}
    </MapContainer>
  );
};

export default TrackingMap;
