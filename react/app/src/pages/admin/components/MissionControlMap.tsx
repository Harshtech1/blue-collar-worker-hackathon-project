import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SIMULATION_CITY_ID,
  generateSimulationBatch,
  GLOBAL_SIMULATION_CITIES,
  type GlobalSimulationCity,
  sectorSeeds,
} from "@/utils/simulationData";
import {
  buildMarketBreadcrumb,
  buildMarketGeoConfig,
  getMarketDistrictBySlug,
  getMarketDistrictsForCity,
  type MarketCity,
} from "../marketRegistry";
import type { AdminMapStyle } from "../adminShellContext";
import type { AdminMarketSnapshot } from "../utils/adminMarketSnapshot";
import type { AdminTab } from "./AdminSidebar";

interface MissionControlWorker {
  _id?: string;
  id?: string;
  name?: string;
  profession?: string;
  service?: string;
  status?: string;
  isAvailable?: boolean;
  logisticsScore?: number;
  acceptanceRate?: number;
  reliabilityScore?: number;
  lat?: number;
  lng?: number;
  qualityScore?: number;
  regionName?: string;
  workerCount?: number;
  activeJobs?: number;
}

interface MissionControlBooking {
  _id: string;
  service?: string;
  total_price?: number | string;
  status?: string;
  createdAt?: string | Date;
}

interface MissionControlMapProps {
  activeTab: AdminTab;
  routeZoneId?: string | null;
  selectedMarket?: MarketCity | null;
  selectedDistrictId?: string | null;
  marketSnapshot?: AdminMarketSnapshot | null;
  workers: MissionControlWorker[];
  bookings: MissionControlBooking[];
  onZoneSelect?: (zoneId: string) => void;
  highlightWorkerId?: string | null;
  mapStyleMode?: AdminMapStyle;
  onMapStyleChange?: (mapStyle: AdminMapStyle) => void;
  pitchMode?: boolean;
  variant?: "full" | "lite";
  className?: string;
}

interface ZoneAnchor {
  id: string;
  label: string;
  city: string;
  center: [number, number];
  intensity: number;
  scope: "sector" | "city";
  zoomLevel?: number;
  readinessScore?: number;
  landmarkLabel?: string;
  bounds?: [[number, number], [number, number]];
  baseWorkers?: number;
  activeJobs?: number;
}

interface ViewportTelemetry {
  center: [number, number];
  zoom: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const EARTH_RADIUS_KM = 6371;
const MAP_LABEL_FONT = "\"Inter\", \"Plus Jakarta Sans\", system-ui, sans-serif";
const MARKET_TIER_BADGES: Record<string, string> = {
  agra: "TIER-2",
  amritsar: "TIER-2",
  lucknow: "TIER-2",
  ludhiana: "TIER-2",
  noida: "TIER-1",
  "north-delhi": "TIER-1",
  chandigarh: "TIER-2",
  chennai: "TIER-1",
  bengaluru: "TIER-1",
  kolkata: "TIER-1",
  mumbai: "TIER-1",
  "new-delhi": "TIER-1",
  "south-delhi": "TIER-1",
  dubai: "GLOBAL",
  singapore: "GLOBAL",
  london: "GLOBAL",
  "new-york": "GLOBAL",
  "sao-paulo": "GLOBAL",
};

const hashString = (value: string) => (
  Array.from(value).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7)
);

const offsetCoordinate = (lat: number, lng: number, distanceKm: number, bearingDeg: number) => {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const startLat = toRadians(lat);
  const startLng = toRadians(lng);

  const nextLat = Math.asin(
    (Math.sin(startLat) * Math.cos(angularDistance))
      + (Math.cos(startLat) * Math.sin(angularDistance) * Math.cos(bearing)),
  );

  const nextLng = startLng + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLat),
    Math.cos(angularDistance) - (Math.sin(startLat) * Math.sin(nextLat)),
  );

  return [
    Number(toDegrees(nextLat).toFixed(6)),
    Number((((toDegrees(nextLng) + 540) % 360) - 180).toFixed(6)),
  ] as [number, number];
};

const buildZoneAnchors = (): ZoneAnchor[] => {
  const allowedAgraDistricts = new Set(getMarketDistrictsForCity("agra").map((district) => district.slug));

  return sectorSeeds
    .filter((seed) => allowedAgraDistricts.has(seed.id))
    .map((seed) => ({
    id: seed.id,
    label: seed.label,
    city: seed.city,
    center: [
      Number((((seed.latRange[0] + seed.latRange[1]) / 2)).toFixed(6)),
      Number((((seed.lngRange[0] + seed.lngRange[1]) / 2)).toFixed(6)),
    ] as [number, number],
    intensity: Number((seed.demandWeight * seed.historicalTraffic).toFixed(2)),
    scope: "sector" as const,
    zoomLevel: 13.8,
    readinessScore: Math.max(68, Math.min(97, Math.round((seed.demandWeight * 34) + (seed.historicalTraffic * 30) + 18))),
    landmarkLabel: `${seed.city} service zone`,
    baseWorkers: seed.baseWorkers,
    bounds: [
      [seed.latRange[0], seed.lngRange[0]],
      [seed.latRange[1], seed.lngRange[1]],
    ],
  }));
};

const buildCityAnchors = (city: Pick<GlobalSimulationCity, "id" | "label" | "lat" | "lng">): ZoneAnchor[] => {
  const registryDistricts = getMarketDistrictsForCity(city.id);
  if (registryDistricts.length > 0) {
    return registryDistricts.map((district) => ({
      id: district.slug,
      label: district.label,
      city: city.label,
      center: district.centerCoords || [city.lat, city.lng] as [number, number],
      intensity: Number((0.82 + ((district.readinessScore || 78) / 100) * 0.78).toFixed(2)),
      scope: "city" as const,
      zoomLevel: district.zoomLevel || 12.4,
      readinessScore: district.readinessScore || 78,
      landmarkLabel: district.landmarkLabel,
    }));
  }

  const anchorBlueprints = [
    { id: city.id, label: `${city.label} Core`, distanceKm: 0, bearingDeg: 0, intensity: 1.38 },
    { id: `${city.id}-north`, label: `${city.label} North`, distanceKm: 4.2, bearingDeg: 0, intensity: 1.1 },
    { id: `${city.id}-east`, label: `${city.label} East`, distanceKm: 4.8, bearingDeg: 90, intensity: 1.08 },
    { id: `${city.id}-south`, label: `${city.label} South`, distanceKm: 4.6, bearingDeg: 180, intensity: 1.04 },
    { id: `${city.id}-west`, label: `${city.label} West`, distanceKm: 4.4, bearingDeg: 270, intensity: 1.05 },
    { id: `${city.id}-orbit`, label: `${city.label} Orbit`, distanceKm: 6.2, bearingDeg: 48, intensity: 0.96 },
  ];

  return anchorBlueprints.map((anchor) => ({
    id: anchor.id,
    label: anchor.label,
    city: city.label,
    center: anchor.distanceKm === 0
      ? [city.lat, city.lng] as [number, number]
      : offsetCoordinate(city.lat, city.lng, anchor.distanceKm, anchor.bearingDeg),
    intensity: anchor.intensity,
    scope: "city",
    zoomLevel: anchor.distanceKm === 0 ? 12.8 : 12.2,
  }));
};

const buildSnapshotZoneAnchors = (snapshot: AdminMarketSnapshot): ZoneAnchor[] => (
  snapshot.regions.map((region, index) => ({
    id: region.id,
    label: region.label,
    city: snapshot.market.cityLabel,
    center: [region.lat, region.lng] as [number, number],
    intensity: Number((Math.max(0.8, (region.activeJobs / Math.max(1, region.workerCount)) + 0.65)).toFixed(2)),
    scope: "city" as const,
    zoomLevel: snapshot.market.regionId === region.id ? 12.6 : snapshot.market.zoom,
    readinessScore: region.readiness,
    landmarkLabel: `${snapshot.market.cityLabel} market zone`,
    baseWorkers: region.workerCount,
    activeJobs: region.activeJobs,
  }))
);

const estimateObservationAltitude = (lat: number, zoom: number) => {
  const groundResolution = 156543.03392 * Math.cos(toRadians(lat)) / Math.pow(2, zoom);
  return Math.max(180, Math.round(groundResolution * 900));
};

const formatAltitude = (meters: number) => `${Math.round(meters).toLocaleString("en-IN")}m`;

const scenarioByTab: Record<AdminTab, "baseline" | "monsoon" | "price_war" | "supply_crunch"> = {
  overview: "baseline",
  users: "baseline",
  workers: "baseline",
  bookings: "monsoon",
  finance: "price_war",
  heatmap: "price_war",
  intelligence: "supply_crunch",
  system: "baseline",
  bugs: "supply_crunch",
  audit: "price_war",
  settings: "baseline",
};

export function MissionControlMap({
  activeTab,
  routeZoneId,
  selectedMarket,
  selectedDistrictId,
  workers,
  bookings,
  onZoneSelect,
  highlightWorkerId,
  mapStyleMode,
  onMapStyleChange,
  variant = "full",
  className,
}: MissionControlMapProps) {
  const isLite = variant === "lite";
  const agraZoneAnchors = useMemo(() => buildZoneAnchors(), []);
  const activeCitySlug = selectedMarket?.simulationCityId || routeZoneId || DEFAULT_SIMULATION_CITY_ID;
  const selectedGlobalCity = useMemo(
    () => GLOBAL_SIMULATION_CITIES.find((city) => city.id === activeCitySlug) || null,
    [activeCitySlug],
  );
  const resolvedCitySurface = useMemo(() => {
    if (selectedGlobalCity) {
      return {
        id: selectedGlobalCity.id,
        label: selectedGlobalCity.label,
        lat: selectedGlobalCity.lat,
        lng: selectedGlobalCity.lng,
      };
    }

    if (selectedMarket) {
      return {
        id: selectedMarket.slug,
        label: selectedMarket.label,
        lat: selectedMarket.lat,
        lng: selectedMarket.lng,
      };
    }

    return {
      id: "agra",
      label: "Agra",
      lat: 27.1767,
      lng: 78.0081,
    };
  }, [selectedGlobalCity, selectedMarket]);
  const seededDistricts = useMemo(
    () => getMarketDistrictsForCity(selectedMarket?.slug || activeCitySlug),
    [activeCitySlug, selectedMarket?.slug],
  );
  const usingGlobalCityScope = (selectedMarket?.slug || activeCitySlug) !== "agra";
  const zoneAnchors = useMemo(
    () => usingGlobalCityScope
      ? buildCityAnchors(resolvedCitySurface)
      : agraZoneAnchors,
    [agraZoneAnchors, resolvedCitySurface, usingGlobalCityScope],
  );
  const highlightedZone = useMemo(
    () => {
      if (selectedDistrictId) {
        const matchedDistrict = zoneAnchors.find((zone) => zone.id === selectedDistrictId);
        if (matchedDistrict) return matchedDistrict;
      }

      if (!usingGlobalCityScope) {
        return zoneAnchors[0];
      }

      return zoneAnchors[0];
    },
    [selectedDistrictId, usingGlobalCityScope, zoneAnchors],
  );
  const [mapViewMode, setMapViewMode] = useState<"road" | "satellite">(
    mapStyleMode === "road" ? "road" : "satellite",
  );
  const [showSectorOverlays, setShowSectorOverlays] = useState(true);
  const [showMapSettings, setShowMapSettings] = useState(false);
  const activeDistrict = useMemo(
    () => getMarketDistrictBySlug(selectedDistrictId, selectedMarket?.slug || activeCitySlug),
    [activeCitySlug, selectedDistrictId, selectedMarket?.slug],
  );

  useEffect(() => {
    if (!mapStyleMode) return;

    if (mapStyleMode === "road") {
      setMapViewMode("road");
      setShowSectorOverlays(true);
      return;
    }

    setMapViewMode("satellite");
    setShowSectorOverlays(true);
  }, [mapStyleMode]);

  const simulationGeoConfig = useMemo(() => {
    return buildMarketGeoConfig({
      market: selectedMarket || undefined,
      citySlug: selectedMarket?.slug || activeCitySlug,
      districtSlug: selectedDistrictId,
      center: {
        lat: highlightedZone.center[0],
        lng: highlightedZone.center[1],
      },
      radiusKm: usingGlobalCityScope ? 14 : 10,
    });
  }, [
    activeCitySlug,
    highlightedZone.center,
    selectedMarket,
    selectedDistrictId,
    usingGlobalCityScope,
  ]);

  const simulationPoints = useMemo(() => {
    return generateSimulationBatch({
      batchIndex: 0,
      batchSize: 260,
      geoConfig: simulationGeoConfig,
      scenario: scenarioByTab[activeTab],
    }).map((point, index) => ({
      id: `${point.areaSector}-${index}`,
      center: [point.lat, point.lng] as [number, number],
      value: point.estimatedValue,
      serviceType: point.serviceType,
      isEmergency: point.isEmergency,
    }));
  }, [activeTab, simulationGeoConfig]);

  const workerReticles = useMemo(() => {
    const normalizedHighlightWorkerId = String(highlightWorkerId || "").trim().toLowerCase();
    const source = workers.length > 0 ? workers : Array.from({ length: 12 }, (_, index) => ({
      _id: `synthetic-worker-${index}`,
      name: `Worker ${index + 1}`,
      profession: index % 3 === 0 ? "Plumbing Specialist" : index % 3 === 1 ? "Electrical Pro" : "Cleaning Lead",
      status: index % 4 === 0 ? "busy" : "verified",
      isAvailable: index % 4 !== 0,
      logisticsScore: 78 + ((index * 7) % 19),
      acceptanceRate: 71 + ((index * 9) % 21),
      reliabilityScore: 76 + ((index * 11) % 18),
      service: index % 3 === 0 ? "Plumbing Repair" : index % 3 === 1 ? "Wiring Check" : "Deep Cleaning",
    }));

    return source.slice(0, 18).map((worker, index) => {
      const zone = zoneAnchors[index % zoneAnchors.length];
      const workerId = worker._id || ("id" in worker ? worker.id : undefined) || `worker-${index}`;
      const bearing = (hashString(`${workerId || worker.name || index}`) % 360);
      const distanceKm = 0.35 + ((index % 5) * 0.12);
      const position = offsetCoordinate(zone.center[0], zone.center[1], distanceKm, bearing);
      const trustScore = Math.round((
        Number(worker.logisticsScore || 0) * 0.55
        + Number(worker.acceptanceRate || 0) * 0.2
        + Number(worker.reliabilityScore || 0) * 0.25
      ) || (78 + (index % 16)));
      const normalizedWorkerId = String(workerId || "").toLowerCase();
      const normalizedWorkerName = String(worker.name || "").toLowerCase();
      const isHighlighted = Boolean(
        normalizedHighlightWorkerId
        && (normalizedWorkerId === normalizedHighlightWorkerId || normalizedWorkerName === normalizedHighlightWorkerId),
      );

      return {
        id: workerId,
        zoneId: zone.id,
        name: worker.name || `RAHI Worker ${index + 1}`,
        profession: worker.profession || worker.service || "General Field Ops",
        currentJob: worker.service || bookings[index % Math.max(1, bookings.length)]?.service || "Standby dispatch",
        isAvailable: worker.isAvailable ?? worker.status !== "busy",
        status: worker.isAvailable ?? worker.status !== "busy" ? "LIVE" : String(worker.status || "BUSY").toUpperCase(),
        trustScore,
        position,
        isHighlighted,
      };
    });
  }, [bookings, highlightWorkerId, workers, zoneAnchors]);

  const zonePressure = useMemo(() => {
    const base = new Map<string, { total: number; emergency: number }>();
    zoneAnchors.forEach((zone) => base.set(zone.id, { total: 0, emergency: 0 }));

    simulationPoints.forEach((point, index) => {
      const zone = zoneAnchors[index % zoneAnchors.length];
      const current = base.get(zone.id);
      if (!current) return;
      current.total += Math.max(1, Math.round(point.value / 900));
      if (point.isEmergency) {
        current.emergency += 1;
      }
    });

    return zoneAnchors.map((zone) => {
      const totals = base.get(zone.id) || { total: 0, emergency: 0 };
      return {
        ...zone,
        total: totals.total,
        emergency: totals.emergency,
      };
    });
  }, [simulationPoints, zoneAnchors]);

  const streamSignals = useMemo(
    () => simulationPoints
      .filter((point) => point.isEmergency)
      .slice(0, 10)
      .map((point) => [highlightedZone.center, point.center] as [[number, number], [number, number]]),
    [highlightedZone.center, simulationPoints],
  );

  const activePressureColor = "#0F172A";
  const baseZoomLevel = activeDistrict?.zoomLevel
    || highlightedZone.zoomLevel
    || selectedMarket?.zoomLevel
    || (usingGlobalCityScope ? 11.4 : 12.6);
  const defaultZoom = Math.max(10.2, baseZoomLevel - (isLite ? 0.6 : 0));
  const [viewportTelemetry, setViewportTelemetry] = useState<ViewportTelemetry>({
    center: highlightedZone.center,
    zoom: defaultZoom,
  });

  useEffect(() => {
    setViewportTelemetry({
      center: highlightedZone.center,
      zoom: defaultZoom,
    });
  }, [defaultZoom, highlightedZone.center]);

  const workerCountsByZone = useMemo(() => {
    const counts = new Map<string, { active: number; total: number }>();
    zoneAnchors.forEach((zone) => counts.set(zone.id, { active: 0, total: 0 }));

    workerReticles.forEach((worker) => {
      const entry = counts.get(worker.zoneId);
      if (!entry) return;
      entry.total += 1;
      if (worker.isAvailable) entry.active += 1;
    });

    return counts;
  }, [workerReticles, zoneAnchors]);

  const labeledZones = useMemo(() => (
    zonePressure.map((zone) => {
      const workerCounts = workerCountsByZone.get(zone.id) || { active: 0, total: 0 };
      const activeWorkers = workerCounts.active || Math.max(1, Math.round((zone.baseWorkers || 12) / 26));
      const pressureRatio = zone.total / Math.max(1, activeWorkers);
      const badgeTone = pressureRatio > 1.55 ? "critical" : pressureRatio > 1.15 ? "surge" : "healthy";

      return {
        ...zone,
        activeWorkers,
        totalWorkers: workerCounts.total,
        pressureRatio,
        badgeTone,
      };
    })
  ), [workerCountsByZone, zonePressure]);

  const visibleZoneLabels = useMemo(() => {
    return labeledZones.filter((zone, index) => {
      if (usingGlobalCityScope) return true;
      if (viewportTelemetry.zoom >= 12.25) return true;
      if (viewportTelemetry.zoom >= 11.55) {
        return zone.id === highlightedZone.id || zone.pressureRatio >= 1.1 || index % 2 === 0;
      }
      return zone.id === highlightedZone.id || zone.badgeTone === "critical";
    });
  }, [highlightedZone.id, labeledZones, usingGlobalCityScope, viewportTelemetry.zoom]);

  const zoneLabelIcons = useMemo(() => {
    return new Map(visibleZoneLabels.map((zone) => {
      const badgeClass = zone.badgeTone === "critical"
        ? "rahi-zone-badge rahi-zone-badge--critical"
        : zone.badgeTone === "surge"
          ? "rahi-zone-badge rahi-zone-badge--surge"
          : "rahi-zone-badge rahi-zone-badge--healthy";

      const html = `
        <div class="rahi-zone-label${zone.id === highlightedZone.id ? " rahi-zone-label--active" : ""}">
          <span class="rahi-zone-label__name">${zone.label}</span>
          <span class="${badgeClass}">${zone.activeWorkers} Workers</span>
        </div>
      `;

      return [
        zone.id,
        L.divIcon({
          className: "rahi-zone-label-wrapper",
          html,
          iconSize: [170, 44],
          iconAnchor: [85, 22],
        }),
      ] as const;
    }));
  }, [highlightedZone.id, visibleZoneLabels]);

  const coordinateAltitude = useMemo(
    () => formatAltitude(estimateObservationAltitude(viewportTelemetry.center[0], viewportTelemetry.zoom)),
    [viewportTelemetry.center, viewportTelemetry.zoom],
  );

  const marketBadgeLabel = useMemo(() => {
    const activeCityLabel = selectedMarket?.label || selectedGlobalCity?.label || highlightedZone.city || "Agra";
    const activeCityId = selectedMarket?.simulationCityId || selectedGlobalCity?.id || DEFAULT_SIMULATION_CITY_ID;
    const tierBadge = MARKET_TIER_BADGES[activeCityId]
      || (selectedMarket?.tier === "tier_1"
        ? "TIER-1"
        : selectedMarket?.tier === "tier_2"
          ? "TIER-2"
          : selectedMarket?.tier === "tier_3"
            ? "TIER-3"
            : selectedMarket?.tier === "pilot"
              ? "PILOT"
              : "LIVE");
    const breadcrumbLabel = selectedMarket
      ? buildMarketBreadcrumb(selectedMarket.stateSlug, selectedMarket.slug, selectedDistrictId)
      : `Markets > India > ${activeCityLabel}`;
    return `${breadcrumbLabel} | ${tierBadge}`;
  }, [highlightedZone.city, selectedDistrictId, selectedGlobalCity, selectedMarket]);

  return (
    <div className={cn("relative w-full h-full min-h-[450px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_50px_-30px_rgba(15,23,42,0.18)]", className)}>
      <style>{`
        .rahi-map-shell .leaflet-container {
          background: #f8fafc;
          height: 100%;
          min-height: 400px;
          width: 100%;
        }

        .rahi-map-shell .leaflet-tile-pane {
          filter: ${mapViewMode === "road"
            ? "contrast(1.02) brightness(1) saturate(0.92)"
            : "contrast(1.08) brightness(0.94) saturate(1.02)"};
        }

        .rahi-map-shell .leaflet-control-container {
          display: none;
        }

        .rahi-mission-tooltip {
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 14px;
          box-shadow: 0 18px 30px rgba(15, 23, 42, 0.14);
          color: #0f172a;
        }

        .rahi-mission-tooltip::before {
          border-top-color: rgba(255, 255, 255, 0.98);
        }

        .rahi-zone-label-wrapper {
          background: transparent;
          border: 0;
        }

        .rahi-zone-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 32px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(226, 232, 240, 0.98);
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 10px 24px -20px rgba(15, 23, 42, 0.32);
          white-space: nowrap;
        }

        .rahi-zone-label--active {
          border-color: rgba(15, 23, 42, 0.18);
          box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06), 0 14px 28px -24px rgba(15, 23, 42, 0.4);
        }

        .rahi-zone-label__name {
          color: #0f172a;
          font-family: ${MAP_LABEL_FONT};
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.01em;
          text-shadow: 0 0 8px rgba(255,255,255,0.98), 0 0 2px rgba(255,255,255,1);
        }

        .rahi-zone-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-family: ${MAP_LABEL_FONT};
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .rahi-zone-badge--healthy {
          background: rgba(16, 185, 129, 0.16);
          color: #065f46;
        }

        .rahi-zone-badge--surge {
          background: rgba(245, 158, 11, 0.16);
          color: #92400e;
        }

        .rahi-zone-badge--critical {
          background: rgba(239, 68, 68, 0.16);
          color: #991b1b;
        }

      `}</style>

      <div className="rahi-map-shell absolute inset-0 min-h-[450px]">
        <MapContainer
          center={highlightedZone.center}
          zoom={defaultZoom}
          preferCanvas
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={!isLite}
          style={{ height: "100%", width: "100%", minHeight: "400px" }}
        >
          <MissionViewport
            center={highlightedZone.center}
            zoom={defaultZoom}
            onViewportChange={setViewportTelemetry}
          />
          {mapViewMode === "road" ? (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            />
          ) : (
            <>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
              />
              <TileLayer
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution="Labels &copy; Esri"
              />
            </>
          )}

          <Pane name="sector-boxes" style={{ zIndex: 418 }}>
            {showSectorOverlays && !usingGlobalCityScope && labeledZones.filter((zone) => zone.bounds).map((zone) => (
              <Rectangle
                key={`${zone.id}-bounds`}
                bounds={zone.bounds!}
                eventHandlers={onZoneSelect ? { click: () => onZoneSelect(zone.id) } : undefined}
                pathOptions={{
                  color: zone.id === highlightedZone.id ? activePressureColor : zone.badgeTone === "critical" ? "#b45309" : zone.badgeTone === "surge" ? "#c2410c" : "#94a3b8",
                  fillColor: zone.id === highlightedZone.id ? "#1E3A8A" : zone.badgeTone === "critical" ? "#f59e0b" : zone.badgeTone === "surge" ? "#fdba74" : "#cbd5e1",
                  fillOpacity: zone.id === highlightedZone.id ? 0.05 : 0.025,
                  opacity: zone.id === highlightedZone.id ? 0.58 : 0.28,
                  weight: zone.id === highlightedZone.id ? 1.6 : 0.95,
                  dashArray: zone.id === highlightedZone.id ? "5 8" : "3 8",
                }}
              />
            ))}
          </Pane>

          <Pane name="pressure-zones" style={{ zIndex: 420 }}>
            {showSectorOverlays && labeledZones.map((zone) => (
              <Circle
                key={`${zone.id}-ring`}
                center={zone.center}
                radius={4200 + Math.min(zone.total * 12, 3200)}
                eventHandlers={onZoneSelect ? { click: () => onZoneSelect(zone.id) } : undefined}
                pathOptions={{
                  color: zone.id === highlightedZone.id ? activePressureColor : "#94a3b8",
                  fillColor: zone.id === highlightedZone.id ? "#1E3A8A" : "#cbd5e1",
                  fillOpacity: zone.id === highlightedZone.id ? 0.1 : 0.04,
                  weight: zone.id === highlightedZone.id ? 1.4 : 0.8,
                }}
              >
                <Tooltip sticky className="rahi-mission-tooltip" direction="top">
                  <div className="space-y-2 text-[11px]">
                    <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Zone focus</p>
                    <p className="text-sm font-bold text-slate-900">{zone.label}</p>
                    <p className="text-slate-600">Projected load: {zone.total.toLocaleString("en-IN")}</p>
                    {zone.landmarkLabel ? <p className="text-slate-600">{zone.landmarkLabel}</p> : null}
                    <p className="text-emerald-600">Active workers: {zone.activeWorkers.toLocaleString("en-IN")}</p>
                    <p className="text-slate-600">Pressure ratio: {zone.pressureRatio.toFixed(2)}</p>
                    <p className="text-amber-600">Emergency lanes: {zone.emergency.toLocaleString("en-IN")}</p>
                  </div>
                </Tooltip>
              </Circle>
            ))}
          </Pane>

          <Pane name="zone-labels" style={{ zIndex: 465 }}>
            {showSectorOverlays && visibleZoneLabels.map((zone) => (
              <Marker
                key={`${zone.id}-label`}
                position={zone.center}
                icon={zoneLabelIcons.get(zone.id)!}
                interactive={false}
              />
            ))}
          </Pane>

          <Pane name="heat-orbits" style={{ zIndex: 430 }}>
            {simulationPoints.map((point, index) => (
              <Circle
                key={point.id}
                center={point.center}
                radius={240 + Math.min(point.value / 2.6, 1420)}
                pathOptions={{
                  color: point.isEmergency ? "#d97706" : "#1d4ed8",
                  fillColor: point.isEmergency ? "#f59e0b" : "#1d4ed8",
                  fillOpacity: point.isEmergency ? 0.12 : index % 2 === 0 ? 0.08 : 0.045,
                  weight: 0,
                }}
              />
            ))}
          </Pane>

          <Pane name="command-streams" style={{ zIndex: 440 }}>
            {streamSignals.map((segment, index) => (
              <Polyline
                key={`stream-${index}`}
                positions={segment}
                pathOptions={{
                  color: "#0f766e",
                  opacity: 0.16,
                  weight: 1.2,
                }}
              />
            ))}
          </Pane>

          <Pane name="worker-reticles" style={{ zIndex: 470 }}>
            {workerReticles.map((worker) => (
              <Circle
                key={`${worker.id}-ring`}
                center={worker.position}
                radius={worker.isHighlighted ? 780 : worker.isAvailable ? 620 : 430}
                pathOptions={{
                  color: worker.isHighlighted ? "#2563eb" : worker.isAvailable ? "#10b981" : "#f59e0b",
                  fillOpacity: 0,
                  opacity: worker.isHighlighted ? 0.48 : 0.28,
                  weight: worker.isHighlighted ? 1.6 : 1.1,
                }}
              />
            ))}
            {workerReticles.map((worker) => (
              <CircleMarker
                key={worker.id}
                center={worker.position}
                radius={worker.isHighlighted ? 9 : worker.isAvailable ? 7 : 6}
                pathOptions={{
                  color: worker.isHighlighted ? "#2563eb" : worker.isAvailable ? "#10b981" : "#f59e0b",
                  fillColor: worker.isHighlighted ? "#2563eb" : worker.isAvailable ? "#10b981" : "#f59e0b",
                  fillOpacity: 0.88,
                  weight: worker.isHighlighted ? 2.2 : 1.5,
                }}
              >
                <Tooltip sticky className="rahi-mission-tooltip" direction="top" offset={[0, -10]}>
                  <div className="space-y-2 text-[11px]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      <span>{String(worker.id).slice(-6).toUpperCase()}</span>
                      <span className="text-emerald-600">Trust {worker.trustScore}</span>
                      <span className={worker.isAvailable ? "text-emerald-600" : "text-amber-600"}>{worker.status}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{worker.name}</p>
                    <p className="text-slate-600">{worker.profession}</p>
                    {worker.isHighlighted ? (
                      <p className="font-semibold uppercase tracking-[0.18em] text-blue-600">
                        Focus selected
                      </p>
                    ) : null}
                    <p className="text-slate-600">Current Job: {worker.currentJob}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </Pane>

          <Pane name="command-pin" style={{ zIndex: 490 }}>
            <CircleMarker
              center={highlightedZone.center}
              radius={10}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip sticky className="rahi-mission-tooltip" direction="top">
                <div className="space-y-2 text-[11px]">
                  <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Selected market</p>
                  <p className="text-sm font-bold text-slate-900">{highlightedZone.label}</p>
                  <p className="text-slate-600">{highlightedZone.city} market focus</p>
                </div>
              </Tooltip>
            </CircleMarker>
            <Circle
              center={highlightedZone.center}
              radius={6800}
              pathOptions={{
                color: "#3b82f6",
                fillOpacity: 0,
                opacity: 0.35,
                weight: 1.2,
                dashArray: "6 12",
              }}
            />
          </Pane>
        </MapContainer>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white via-white/50 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-white via-white/60 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-[600]">
        <div className="absolute left-3 top-3 h-5 w-5 border-l border-t border-slate-300/90" />
        <div className="absolute right-3 top-3 h-5 w-5 border-r border-t border-slate-300/90" />
        <div className="absolute bottom-3 left-3 h-5 w-5 border-b border-l border-slate-300/90" />
        <div className="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-slate-300/90" />
        <div className="absolute left-4 top-4 rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] text-white shadow-[0_14px_32px_-20px_rgba(15,23,42,0.22)]">
          {marketBadgeLabel}
        </div>
        {!isLite ? (
          <div className="pointer-events-auto absolute right-4 top-4">
            <button
              type="button"
              onClick={() => setShowMapSettings((current) => !current)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.18)] transition hover:bg-slate-50"
            >
              Map Layers
            </button>

            {showMapSettings ? (
              <div className="mt-2 w-52 rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_22px_44px_-28px_rgba(15,23,42,0.26)]">
                <button
                  type="button"
                  onClick={() => {
                    setMapViewMode("road");
                    setShowSectorOverlays(true);
                    onMapStyleChange?.("road");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[11px] font-semibold transition",
                    mapViewMode === "road"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span>Standard Road</span>
                  {mapViewMode === "road" ? <span>On</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSectorOverlays((current) => !current);
                  }}
                  className={cn(
                    "mt-1 flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[11px] font-semibold transition",
                    showSectorOverlays ? "bg-sky-50 text-sky-700" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span>Sector Overlays</span>
                  <span>{showSectorOverlays ? "On" : "Off"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapViewMode("satellite");
                    setShowSectorOverlays(true);
                    onMapStyleChange?.("high-contrast");
                  }}
                  className={cn(
                    "mt-1 flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[11px] font-semibold transition",
                    mapViewMode === "satellite"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span>Satellite</span>
                  <span>{mapViewMode === "satellite" ? "Verification" : "Off"}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {!isLite ? (
          <div className="absolute bottom-4 right-4 rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_-20px_rgba(15,23,42,0.18)]">
            VIEWPORT: {(selectedMarket?.label || selectedGlobalCity?.label || highlightedZone.city || "Agra").toUpperCase()} // {viewportTelemetry.center[0].toFixed(4)}° N, {viewportTelemetry.center[1].toFixed(4)}° E
          </div>
        ) : null}
        {!isLite && seededDistricts.length > 0 ? (
          <div className="absolute bottom-4 left-4 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.18)]">
            District registry: {seededDistricts.length} zones
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MissionViewport({
  center,
  zoom,
  onViewportChange,
}: {
  center: [number, number];
  zoom: number;
  onViewportChange: (telemetry: ViewportTelemetry) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observedNode = container.parentElement ?? container;

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(observedNode);
    return () => observer.disconnect();
  }, [map]);

  useMapEvents({
    moveend() {
      const currentCenter = map.getCenter();
      onViewportChange({
        center: [Number(currentCenter.lat.toFixed(6)), Number(currentCenter.lng.toFixed(6))],
        zoom: Number(map.getZoom().toFixed(2)),
      });
    },
    zoomend() {
      const currentCenter = map.getCenter();
      onViewportChange({
        center: [Number(currentCenter.lat.toFixed(6)), Number(currentCenter.lng.toFixed(6))],
        zoom: Number(map.getZoom().toFixed(2)),
      });
    },
  });

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 2.5 });
    const syncViewport = () => {
      map.invalidateSize();
      const currentCenter = map.getCenter();
      onViewportChange({
        center: [Number(currentCenter.lat.toFixed(6)), Number(currentCenter.lng.toFixed(6))],
        zoom: Number(map.getZoom().toFixed(2)),
      });
    };

    const animationFrame = window.requestAnimationFrame(syncViewport);
    const shortTimer = window.setTimeout(syncViewport, 180);
    const entranceTimer = window.setTimeout(syncViewport, 420);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(entranceTimer);
    };
  }, [center, map, onViewportChange, zoom]);

  return null;
}
