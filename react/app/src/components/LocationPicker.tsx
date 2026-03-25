import { useState, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from './ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { LocateFixed, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icon missing assets
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

// Custom draggable marker icon
const draggableIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); cursor: grab; display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

interface LocationPickerProps {
  onConfirm: (location: { lat: number; lng: number; address: string }) => void;
  onCancel: () => void;
}

// Component to handle map clicks and marker updates
const LocationMarker = ({ position, setPosition }: { position: L.LatLng, setPosition: (pos: L.LatLng) => void }) => {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    }
  });

  return (
    <Marker 
      position={position} 
      icon={draggableIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          setPosition(e.target.getLatLng());
        },
      }}
    >
      <Popup>Drag to adjust location</Popup>
    </Marker>
  );
};

// Component to handle external center updates and size invalidation
const ChangeView = ({ center }: { center: L.LatLng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
    // Important for maps in dialogs/tabs
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [center, map]);
  return null;
};

export default function LocationPicker({ onConfirm, onCancel }: LocationPickerProps) {
  const { language } = useLanguage();
  const { location: globalLocation, detectLocation, loading: detecting } = useLocation();
  const [position, setPosition] = useState<L.LatLng>(
    globalLocation 
      ? new L.LatLng(globalLocation.lat, globalLocation.lng)
      : new L.LatLng(28.6139, 77.2090)
  );
  const [loading, setLoading] = useState(false);

  // Sync with global location if it changes
  useEffect(() => {
    if (globalLocation) {
      setPosition(new L.LatLng(globalLocation.lat, globalLocation.lng));
    }
  }, [globalLocation]);

  const handleDetectLocation = async () => {
    try {
      const loc = await detectLocation();
      const newPos = new L.LatLng(loc.lat, loc.lng);
      setPosition(newPos);
      toast.success(language === 'hi' ? 'स्थान मिल गया!' : 'Location detected!');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Could not detect location');
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Reverse geocoding using OpenStreetMap Nominatim API (Free, requires user-agent)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'RahiApp/1.0' } }
      );
      const data = await response.json();
      
      const addr = data.address || {};
      const addressParts = [];
      
      // 1. Specific Place Name
      if (data.name && !data.display_name.startsWith(data.name)) {
        addressParts.push(data.name);
      }

      // 2. Building / Shop / Office
      const building = addr.building || addr.amenity || addr.shop || addr.office || addr.commercial || addr.industrial;
      if (building) addressParts.push(building);

      // 3. House Number and Road
      if (addr.house_number && addr.road) {
        addressParts.push(`${addr.house_number}, ${addr.road}`);
      } else {
        if (addr.house_number) addressParts.push(addr.house_number);
        if (addr.road) addressParts.push(addr.road);
      }

      // 4. Sub-locality
      const subLocality = addr.neighbourhood || addr.suburb || addr.residential || addr.village;
      if (subLocality) addressParts.push(subLocality);

      // 5. District / City Area
      if (addr.city_district) addressParts.push(addr.city_district);

      // 6. City / Town
      const city = addr.city || addr.town || addr.municipality;
      if (city) addressParts.push(city);

      // 7. State and Postcode
      if (addr.state) addressParts.push(addr.state);
      if (addr.postcode) addressParts.push(addr.postcode);

      // Filter duplicates and empty values
      let formattedAddress = Array.from(new Set(addressParts.filter(Boolean))).join(', ');

      // Fallback to display_name if our construction is too short (less than 3 parts)
      if (addressParts.filter(Boolean).length < 3) {
        formattedAddress = data.display_name;
      }

      console.log("📍 Final constructed address:", formattedAddress);

      onConfirm({
        lat: position.lat,
        lng: position.lng,
        address: formattedAddress || data.display_name || `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
      });
    } catch (error) {
      console.error("Geocoding error:", error);
      // Fallback if API fails
      onConfirm({
        lat: position.lat,
        lng: position.lng,
        address: `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="relative flex-grow h-full w-full min-h-[300px]">
        <MapContainer 
          center={position} 
          zoom={15} 
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
          <ChangeView center={position} />
        </MapContainer>
        
        {/* Helper Badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg z-[1000] text-xs font-bold pointer-events-none flex items-center gap-2 border border-slate-200">
          <MapPin className="h-3 w-3 text-primary" />
          {language === 'hi' ? 'स्थान चुनने के लिए टैप करें या खींचें' : 'Tap or drag to set location'}
        </div>

        {/* Current Location Button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-24 right-4 z-[1000] rounded-full shadow-xl bg-white hover:bg-slate-50 border border-slate-200 h-12 w-12"
          onClick={handleDetectLocation}
          disabled={detecting}
        >
          {detecting ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LocateFixed className="h-5 w-5 text-primary" />}
        </Button>
      </div>

      <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold text-slate-500" onClick={onCancel} disabled={loading}>
            {language === 'hi' ? 'रद्द करें' : 'Cancel'}
          </Button>
          <Button className="flex-[2] h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleConfirm} disabled={loading || detecting}>
            {loading 
              ? (language === 'hi' ? 'पुष्टि हो रही है...' : 'Confirming...') 
              : (language === 'hi' ? 'स्थान की पुष्टि करें' : 'Confirm Location')
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

