import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LocationData {
  lat: number;
  lng: number;
  address: string;
  city?: string;
}

interface LocationContextType {
  location: LocationData | null;
  setLocation: (location: LocationData) => void;
  detectLocation: () => Promise<LocationData>;
  loading: boolean;
  error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationData | null>(() => {
    const saved = localStorage.getItem('user_location');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLocation = (newLocation: LocationData) => {
    setLocationState(newLocation);
    localStorage.setItem('user_location', JSON.stringify(newLocation));
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<LocationData> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
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

      console.log("🌍 Context constructed address:", formattedAddress);
      
      return {
        lat,
        lng,
        address: formattedAddress || data.display_name,
        city: city || 'Unknown City'
      };
    } catch (err) {
      console.error("Reverse geocoding failed", err);
      return {
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        city: 'Unknown City'
      };
    }
  };

  const detectLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      setError(null);

      if (!navigator.geolocation) {
        const err = "Geolocation is not supported by your browser";
        setError(err);
        setLoading(false);
        reject(err);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const locData = await reverseGeocode(position.coords.latitude, position.coords.longitude);
            setLocation(locData);
            setLoading(false);
            resolve(locData);
          } catch (err) {
            setError("Failed to get address for your location");
            setLoading(false);
            reject(err);
          }
        },
        (err) => {
          let msg = "Failed to detect location";
          if (err.code === err.PERMISSION_DENIED) msg = "Location permission denied";
          setError(msg);
          setLoading(false);
          reject(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  // Automatically detect location on first load if not present
  useEffect(() => {
    if (!location) {
      detectLocation().catch(() => {
        // Silent catch, user can manually trigger detection
      });
    }
  }, []);

  return (
    <LocationContext.Provider value={{ location, setLocation, detectLocation, loading, error }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
