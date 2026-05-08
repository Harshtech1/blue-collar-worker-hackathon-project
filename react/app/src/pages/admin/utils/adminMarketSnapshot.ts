import {
  buildSimulationGeoConfig,
  getGlobalSimulationCity,
  GLOBAL_SIMULATION_CITIES,
  sectorSeeds,
} from "@/utils/simulationData";
import {
  findMarketCity,
  getMarketDistrictBySlug,
  getMarketDistrictMetrics,
  getMarketHierarchyMeta,
  listMarketCities,
  resolveMarketContext,
} from "../marketRegistry";
import {
  findPunjabDistrictEntry,
  findPunjabVillageEntry,
  isPunjabDistrictSlug,
  listPunjabDistrictEntries,
  PUNJAB_VILLAGE_REGISTRY,
} from "../data/punjabVillageRegistry";

export type AdminMarketSnapshotWorker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "online" | "busy";
  qualityScore: number;
  regionName: string;
  workerCount: number;
  activeJobs: number;
};

export type AdminRegionOption = {
  id: string;
  label: string;
  cityId: string;
  workerCount: number;
  activeJobs: number;
  lat: number;
  lng: number;
  readiness: number;
  villageCode?: string;
  projectedCac?: number;
  laborAvailabilityIndex?: number;
  connectivityStability?: number;
};

export type AdminMarketSnapshot = {
  market: {
    cityId: string;
    cityLabel: string;
    regionId: string | null;
    regionLabel: string | null;
    level2Label: string;
    level3Label: string;
    level2Kind: string;
    level3Kind: string;
    state: string;
    stateCode: string;
    country: string;
    tier: "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";
    regionGroup: string;
    readiness: number;
    mapCenter: {
      lat: number;
      lng: number;
    };
    zoom: number;
    villageMetrics?: {
      laborAvailabilityIndex: number;
      connectivityStability: number;
      infrastructureGapScore: number;
      villageReadinessScore: number;
      projectedCac: number;
      popDensity: number;
      domesticPowerHours: number;
      hhSize: number;
      agriPowerHours: number;
      villageCode: string;
    } | null;
  };
  stats: {
    workerCount: number;
    activeJobs: number;
    completedJobs: number;
    revenue: number;
    avgResponseTime: number;
  };
  workers: AdminMarketSnapshotWorker[];
  regions: AdminRegionOption[];
  dataMode: "demo" | "live";
};

type RegionPreset = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  workerCount: number;
  activeJobs: number;
  completedJobs: number;
  revenue: number;
  avgResponseTime: number;
};

type CityPreset = {
  cityId: string;
  label: string;
  state: string;
  stateCode: string;
  country: string;
  tier: "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";
  regionGroup: string;
  readiness: number;
  zoom: number;
  regions: RegionPreset[];
};

export type AdminMarketCityOption = {
  cityId: string;
  label: string;
  state: string;
  stateCode: string;
  regionGroup: string;
  readiness: number;
};

const slugify = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
);

const offsetCoordinate = (lat: number, lng: number, latOffset: number, lngOffset: number) => ({
  lat: Number((lat + latOffset).toFixed(5)),
  lng: Number((lng + lngOffset).toFixed(5)),
});

const buildPresetFromGlobalCity = (
  cityId: string,
  config: {
    regionGroup: string;
    readiness: number;
    zoom?: number;
    regions: Array<Omit<RegionPreset, "id"> & { id?: string }>;
  },
): CityPreset => {
  const city = getGlobalSimulationCity(cityId);

  return {
    cityId: city.id,
    label: city.label,
    state: city.stateName || city.stateCode || city.country,
    stateCode: city.stateCode || "",
    country: city.country,
    tier: city.id === "agra" ? "pilot" : city.id === "chandigarh" ? "tier_2" : "tier_1",
    regionGroup: config.regionGroup,
    readiness: config.readiness,
    zoom: config.zoom ?? (city.id === "agra" ? 11.7 : 11.1),
    regions: config.regions.map((region) => ({
      ...region,
      id: region.id || slugify(`${city.id}-${region.label}`),
    })),
  };
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => (values.length > 0 ? sum(values) / values.length : 0);

const agraRegions: RegionPreset[] = sectorSeeds.map((seed, index) => ({
  id: seed.id,
  label: seed.label,
  lat: Number((((seed.latRange[0] + seed.latRange[1]) / 2)).toFixed(5)),
  lng: Number((((seed.lngRange[0] + seed.lngRange[1]) / 2)).toFixed(5)),
  workerCount: Math.max(4, seed.baseWorkers),
  activeJobs: Math.max(3, Math.round(seed.historicalTraffic * 10 + seed.demandWeight * 2)),
  completedJobs: Math.max(10, Math.round(seed.historicalTraffic * 20 + (index * 3))),
  revenue: Math.round((seed.historicalTraffic * 18000) + (seed.demandWeight * 6200)),
  avgResponseTime: Math.max(12, Math.round(24 - (seed.demandWeight * 5))),
}));

const PRESET_MARKETS: CityPreset[] = [
  {
    cityId: "agra",
    label: "Agra",
    state: "Uttar Pradesh",
    stateCode: "UP",
    country: "India",
    tier: "pilot",
    regionGroup: "North India",
    readiness: 97,
    zoom: 11.9,
    regions: agraRegions,
  },
  buildPresetFromGlobalCity("new-delhi", {
    regionGroup: "North India",
    readiness: 88,
    regions: [
      { label: "Connaught Place", lat: 28.6315, lng: 77.2167, workerCount: 8, activeJobs: 16, completedJobs: 34, revenue: 62200, avgResponseTime: 17 },
      { label: "Dwarka", lat: 28.5921, lng: 77.0460, workerCount: 10, activeJobs: 19, completedJobs: 42, revenue: 69800, avgResponseTime: 16 },
      { label: "Rohini", lat: 28.7495, lng: 77.0565, workerCount: 9, activeJobs: 15, completedJobs: 29, revenue: 57400, avgResponseTime: 18 },
      { label: "Lajpat Nagar", lat: 28.5677, lng: 77.2433, workerCount: 7, activeJobs: 14, completedJobs: 28, revenue: 54800, avgResponseTime: 19 },
      { label: "Karol Bagh", lat: 28.6519, lng: 77.1909, workerCount: 8, activeJobs: 13, completedJobs: 26, revenue: 51600, avgResponseTime: 18 },
    ],
  }),
  buildPresetFromGlobalCity("chandigarh", {
    regionGroup: "North India",
    readiness: 84,
    regions: [
      { label: "Sector 17", lat: 30.7413, lng: 76.7855, workerCount: 7, activeJobs: 11, completedJobs: 24, revenue: 41800, avgResponseTime: 19 },
      { label: "Sector 22", lat: 30.7364, lng: 76.7765, workerCount: 6, activeJobs: 9, completedJobs: 19, revenue: 36200, avgResponseTime: 20 },
      { label: "Manimajra", lat: 30.7261, lng: 76.8431, workerCount: 8, activeJobs: 12, completedJobs: 22, revenue: 39200, avgResponseTime: 18 },
      { label: "IT Park", lat: 30.7122, lng: 76.8405, workerCount: 5, activeJobs: 8, completedJobs: 16, revenue: 34100, avgResponseTime: 22 },
      { label: "Mohali Link", lat: 30.7046, lng: 76.7179, workerCount: 6, activeJobs: 10, completedJobs: 18, revenue: 35800, avgResponseTime: 21 },
    ],
  }),
  buildPresetFromGlobalCity("chennai", {
    regionGroup: "South India",
    readiness: 81,
    regions: [
      { label: "T Nagar", lat: 13.0418, lng: 80.2337, workerCount: 9, activeJobs: 17, completedJobs: 38, revenue: 64100, avgResponseTime: 18 },
      { label: "Anna Nagar", lat: 13.0878, lng: 80.2101, workerCount: 8, activeJobs: 14, completedJobs: 31, revenue: 58400, avgResponseTime: 19 },
      { label: "Velachery", lat: 12.9756, lng: 80.2206, workerCount: 7, activeJobs: 13, completedJobs: 27, revenue: 53300, avgResponseTime: 21 },
      { label: "OMR", lat: 12.9177, lng: 80.2306, workerCount: 10, activeJobs: 19, completedJobs: 36, revenue: 67600, avgResponseTime: 17 },
      { label: "Mylapore", lat: 13.0336, lng: 80.2697, workerCount: 6, activeJobs: 11, completedJobs: 22, revenue: 42400, avgResponseTime: 20 },
    ],
  }),
  buildPresetFromGlobalCity("kolkata", {
    regionGroup: "East India",
    readiness: 79,
    regions: [
      { label: "Salt Lake", lat: 22.5867, lng: 88.4170, workerCount: 9, activeJobs: 15, completedJobs: 34, revenue: 60100, avgResponseTime: 19 },
      { label: "Park Street", lat: 22.5536, lng: 88.3525, workerCount: 7, activeJobs: 12, completedJobs: 26, revenue: 48600, avgResponseTime: 21 },
      { label: "Howrah", lat: 22.5958, lng: 88.2636, workerCount: 8, activeJobs: 13, completedJobs: 25, revenue: 46200, avgResponseTime: 22 },
      { label: "Gariahat", lat: 22.5186, lng: 88.3650, workerCount: 6, activeJobs: 10, completedJobs: 20, revenue: 40100, avgResponseTime: 23 },
      { label: "New Town", lat: 22.5750, lng: 88.4790, workerCount: 10, activeJobs: 18, completedJobs: 37, revenue: 65800, avgResponseTime: 18 },
    ],
  }),
];

const CITY_PRESET_MAP = new Map(PRESET_MARKETS.map((city) => [city.cityId, city]));
const REGION_CITY_LOOKUP = new Map(
  PRESET_MARKETS.flatMap((city) => city.regions.map((region) => [region.id, city.cityId] as const)),
);
const PUNJAB_DISTRICT_CITY_OPTIONS: AdminMarketCityOption[] = listPunjabDistrictEntries().map((district) => ({
  cityId: district.slug,
  label: district.label,
  state: "Punjab",
  stateCode: "PB",
  regionGroup: "Punjab District Grid",
  readiness: district.readinessScore,
}));
const PUNJAB_DISTRICT_CITY_LOOKUP = new Map(
  PUNJAB_DISTRICT_CITY_OPTIONS.map((district) => [district.cityId, district]),
);

const isPunjabDistrictCityId = (cityId?: string | null) => Boolean(cityId && isPunjabDistrictSlug(cityId));

const buildPunjabVillageWorkers = (region: AdminRegionOption, districtLabel: string): AdminMarketSnapshotWorker[] => {
  const workerSlots = Math.min(4, Math.max(2, Math.round(region.workerCount / 3)));
  return Array.from({ length: workerSlots }).map((_, index) => {
    const offset = [
      [-0.0038, -0.0026],
      [0.0031, -0.0018],
      [0.0024, 0.0034],
      [-0.0026, 0.0032],
    ][index % 4];
    const position = offsetCoordinate(region.lat, region.lng, offset[0], offset[1]);
    return {
      id: `${region.id}-worker-${index + 1}`,
      name: `${districtLabel} Worker ${index + 1}`,
      lat: position.lat,
      lng: position.lng,
      status: index % 3 === 0 ? "busy" : "online",
      qualityScore: Math.min(97, 80 + (region.readiness % 12) + index * 2),
      regionName: region.label,
      workerCount: region.workerCount,
      activeJobs: Math.max(1, Math.round(region.activeJobs / Math.max(1, region.workerCount))),
    };
  });
};

const buildPunjabRegionOption = (villageId: string): AdminRegionOption | null => {
  const village = findPunjabVillageEntry(villageId);
  if (!village) return null;

  const workerCount = Math.max(4, Math.round((village.metrics.laborAvailabilityIndex / 12) + (village.metrics.hhSize / 2.3)));
  const activeJobs = Math.max(2, Math.round((village.metrics.connectivityStability / 18) + (village.metrics.popDensity * 0.45)));

  return {
    id: village.id,
    label: village.label,
    cityId: village.districtSlug,
    workerCount,
    activeJobs,
    lat: village.centerCoords[0],
    lng: village.centerCoords[1],
    readiness: village.metrics.villageReadinessScore,
    villageCode: village.villageCode,
    projectedCac: village.metrics.projectedCac,
    laborAvailabilityIndex: village.metrics.laborAvailabilityIndex,
    connectivityStability: village.metrics.connectivityStability,
  };
};

const buildPunjabMarketSnapshot = ({
  cityId,
  regionId,
}: {
  cityId: string;
  regionId?: string | null;
}): AdminMarketSnapshot => {
  const district = findPunjabDistrictEntry(cityId) || findPunjabDistrictEntry("gurdaspur")!;
  const regions = (PUNJAB_VILLAGE_REGISTRY.districtVillageIds[district.slug] || [])
    .map((villageId) => buildPunjabRegionOption(villageId))
    .filter((region): region is AdminRegionOption => Boolean(region));
  const selectedRegion = regions.find((region) => region.id === regionId) || null;
  const focusRegion = selectedRegion || regions[0] || null;
  const village = focusRegion ? findPunjabVillageEntry(focusRegion.id) : null;
  const stats = {
    workerCount: selectedRegion
      ? selectedRegion.workerCount
      : regions.reduce((sum, region) => sum + region.workerCount, 0),
    activeJobs: selectedRegion
      ? selectedRegion.activeJobs
      : regions.reduce((sum, region) => sum + region.activeJobs, 0),
    completedJobs: selectedRegion
      ? Math.max(selectedRegion.activeJobs * 2, 6)
      : Math.max(regions.reduce((sum, region) => sum + region.activeJobs, 0) * 2, 24),
    revenue: selectedRegion
      ? Math.max(9800, Math.round((selectedRegion.activeJobs * 2600) + (selectedRegion.readiness * 70)))
      : Math.max(42000, Math.round(
        regions.reduce((total, region) => total + (region.activeJobs * 2200) + (region.readiness * 42), 0),
      )),
    avgResponseTime: selectedRegion
      ? Math.max(12, 28 - Math.round((selectedRegion.connectivityStability || 50) / 8))
      : Math.max(
        12,
        28 - Math.round(
          (
            regions.reduce((total, region) => total + (region.connectivityStability || 50), 0)
            / Math.max(1, regions.length)
          ) / 8,
        ),
      ),
  };

  return {
    market: {
      cityId: district.slug,
      cityLabel: district.label,
      regionId: selectedRegion?.id || null,
      regionLabel: selectedRegion?.label || null,
      level2Label: "District",
      level3Label: "Village",
      level2Kind: "district",
      level3Kind: "village",
      state: "Punjab",
      stateCode: "PB",
      country: "India",
      tier: "tier_2",
      regionGroup: "Punjab Rural Command",
      readiness: focusRegion?.readiness || district.readinessScore,
      mapCenter: focusRegion
        ? { lat: focusRegion.lat, lng: focusRegion.lng }
        : { lat: district.centerCoords[0], lng: district.centerCoords[1] },
      zoom: selectedRegion ? 15 : district.zoomLevel,
      villageMetrics: village
        ? {
            laborAvailabilityIndex: village.metrics.laborAvailabilityIndex,
            connectivityStability: village.metrics.connectivityStability,
            infrastructureGapScore: village.metrics.infrastructureGapScore,
            villageReadinessScore: village.metrics.villageReadinessScore,
            projectedCac: village.metrics.projectedCac,
            popDensity: village.metrics.popDensity,
            domesticPowerHours: village.metrics.domesticPowerHours,
            hhSize: village.metrics.hhSize,
            agriPowerHours: village.metrics.agriPowerHours,
            villageCode: village.villageCode,
          }
        : null,
    },
    stats,
    workers: (selectedRegion ? [selectedRegion] : regions.slice(0, 5))
      .flatMap((region) => buildPunjabVillageWorkers(region, district.label)),
    regions,
    dataMode: "demo",
  };
};

const buildWorkerMarker = (
  city: CityPreset,
  region: RegionPreset,
  index: number,
): AdminMarketSnapshotWorker => {
  const workerIndex = index + 1;
  const offset = [
    [-0.0052, -0.0041],
    [0.0047, -0.0021],
    [0.0038, 0.0039],
    [-0.0034, 0.0045],
    [0.0018, -0.0058],
    [-0.0014, 0.0054],
  ][index % 6];
  const position = offsetCoordinate(region.lat, region.lng, offset[0], offset[1]);
  const qualityScore = Math.min(98, 82 + ((index * 4) % 14));
  const availability = index % 4 !== 0;

  return {
    id: `${region.id}-worker-${workerIndex}`,
    name: `${city.label} Worker ${workerIndex}`,
    lat: position.lat,
    lng: position.lng,
    status: availability ? "online" : "busy",
    qualityScore,
    regionName: region.label,
    workerCount: region.workerCount,
    activeJobs: Math.max(1, Math.round(region.activeJobs / Math.max(1, region.workerCount))),
  };
};

export const getAdminMarketCityOptions = (): AdminMarketCityOption[] => (
  [
    ...PRESET_MARKETS.map((city) => ({
      cityId: city.cityId,
      label: city.label,
      state: city.state,
      stateCode: city.stateCode,
      regionGroup: city.regionGroup,
      readiness: city.readiness,
    })),
    ...PUNJAB_DISTRICT_CITY_OPTIONS,
  ]
);

export const findAdminMarketCity = (value?: string | null): AdminMarketCityOption | null => {
  if (!value) return null;
  const normalized = slugify(value);
  const punjabDistrict = PUNJAB_DISTRICT_CITY_OPTIONS.find((district) => (
    district.cityId === normalized
    || slugify(district.label) === normalized
  ));
  if (punjabDistrict) {
    return punjabDistrict;
  }

  const preset = PRESET_MARKETS.find((city) => (
    city.cityId === normalized
    || slugify(city.label) === normalized
  ));

  return preset
    ? {
        cityId: preset.cityId,
        label: preset.label,
        state: preset.state,
        stateCode: preset.stateCode,
        regionGroup: preset.regionGroup,
        readiness: preset.readiness,
      }
    : null;
};

export const inferAdminCityIdFromRegion = (regionId?: string | null) => {
  if (!regionId) return null;
  return REGION_CITY_LOOKUP.get(regionId) || null;
};

export const getAdminRegionOptionsForCity = (cityId?: string | null): AdminRegionOption[] => {
  if (isPunjabDistrictCityId(cityId)) {
    return (PUNJAB_VILLAGE_REGISTRY.districtVillageIds[cityId || ""] || [])
      .map((villageId) => buildPunjabRegionOption(villageId))
      .filter((region): region is AdminRegionOption => Boolean(region));
  }

  const resolvedCityId = cityId || "agra";
  const preset = CITY_PRESET_MAP.get(resolvedCityId) || CITY_PRESET_MAP.get("agra");

  return (preset?.regions || []).map((region) => ({
    id: region.id,
    label: region.label,
    cityId: preset?.cityId || resolvedCityId,
    workerCount: region.workerCount,
    activeJobs: region.activeJobs,
    lat: region.lat,
    lng: region.lng,
    readiness: Math.min(99, Math.round((region.workerCount * 4.5) + (region.activeJobs * 1.2))),
  }));
};

export const buildDemoMarketSnapshot = ({
  cityId,
  regionId,
}: {
  cityId?: string | null;
  regionId?: string | null;
}): AdminMarketSnapshot => {
  if (isPunjabDistrictCityId(cityId)) {
    return buildPunjabMarketSnapshot({
      cityId: cityId || "gurdaspur",
      regionId,
    });
  }

  const selectedCityId = cityId || inferAdminCityIdFromRegion(regionId) || "agra";
  const preset = CITY_PRESET_MAP.get(selectedCityId) || CITY_PRESET_MAP.get("agra")!;
  const geoConfig = buildSimulationGeoConfig({ cityId: preset.cityId });
  const regions = getAdminRegionOptionsForCity(preset.cityId);
  const selectedRegion = regions.find((region) => region.id === regionId) || null;
  const focusRegion = selectedRegion || regions[0] || null;
  const regionStats = focusRegion
    ? preset.regions.find((region) => region.id === focusRegion.id) || preset.regions[0]
    : preset.regions[0];
  const totalWorkerCount = preset.regions.reduce((sum, region) => sum + region.workerCount, 0);
  const totalActiveJobs = preset.regions.reduce((sum, region) => sum + region.activeJobs, 0);
  const totalCompletedJobs = preset.regions.reduce((sum, region) => sum + region.completedJobs, 0);
  const totalRevenue = preset.regions.reduce((sum, region) => sum + region.revenue, 0);
  const center = focusRegion
    ? { lat: focusRegion.lat, lng: focusRegion.lng }
    : { lat: geoConfig.center.lat, lng: geoConfig.center.lng };
  const hierarchyMeta = getMarketHierarchyMeta(findMarketCity(preset.cityId)?.stateSlug, preset.cityId);

  return {
    market: {
      cityId: preset.cityId,
      cityLabel: preset.label,
      regionId: selectedRegion?.id || null,
      regionLabel: selectedRegion?.label || null,
      level2Label: hierarchyMeta.level2Label,
      level3Label: hierarchyMeta.level3Label,
      level2Kind: hierarchyMeta.level2Kind,
      level3Kind: hierarchyMeta.level3Kind,
      state: preset.state,
      stateCode: preset.stateCode,
      country: preset.country,
      tier: preset.tier,
      regionGroup: preset.regionGroup,
      readiness: preset.readiness,
      mapCenter: center,
      zoom: selectedRegion ? 12.4 : preset.zoom,
    },
    stats: {
      workerCount: selectedRegion ? regionStats.workerCount : totalWorkerCount,
      activeJobs: selectedRegion ? regionStats.activeJobs : totalActiveJobs,
      completedJobs: selectedRegion ? regionStats.completedJobs : totalCompletedJobs,
      revenue: selectedRegion ? regionStats.revenue : totalRevenue,
      avgResponseTime: selectedRegion ? regionStats.avgResponseTime : Math.round(
        preset.regions.reduce((sum, region) => sum + region.avgResponseTime, 0) / Math.max(1, preset.regions.length),
      ),
    },
    workers: (selectedRegion ? [regionStats] : preset.regions.slice(0, 5))
      .flatMap((region, regionIndex) => (
        Array.from({ length: Math.min(4, Math.max(2, Math.round(region.workerCount / 3))) }).map((_, index) => (
          buildWorkerMarker(preset, region, (regionIndex * 4) + index)
        ))
      )),
    regions,
    dataMode: "demo",
  };
};

export const resolveMarketSelectionFromPath = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin-portal-2026");
  const marketSegments = adminIndex >= 0 ? segments.slice(adminIndex + 1) : segments;
  const mission = marketSegments[0];

  if (mission !== "war-room" && mission !== "intelligence") {
    return { cityId: null, regionId: null };
  }

  if (marketSegments.length >= 3) {
    const cityCandidate = slugify(marketSegments[2]);
    if (isPunjabDistrictCityId(cityCandidate)) {
      return {
        cityId: cityCandidate,
        regionId: marketSegments[3] ? slugify(marketSegments[3]) : null,
      };
    }

    if (CITY_PRESET_MAP.has(cityCandidate)) {
      return { cityId: cityCandidate, regionId: null };
    }
  }

  const zoneId = marketSegments[1];
  if (!zoneId) {
    return { cityId: null, regionId: null };
  }

  if (CITY_PRESET_MAP.has(zoneId)) {
    return { cityId: zoneId, regionId: null };
  }

  const inferredCityId = inferAdminCityIdFromRegion(zoneId);
  if (inferredCityId) {
    return { cityId: inferredCityId, regionId: zoneId };
  }

  return { cityId: null, regionId: null };
};

export const getAdminMarketBreadcrumb = (snapshot: AdminMarketSnapshot) => (
  [
    "Markets",
    snapshot.market.state || snapshot.market.regionGroup || "India",
    snapshot.market.cityLabel,
    snapshot.market.regionLabel || "City Overview",
  ].join(" > ")
);

export const isKnownAdminMarketCity = (value?: string | null) => Boolean(
  value && CITY_PRESET_MAP.has(value),
);

export const getAdminMarketSearchSuggestions = () => (
  GLOBAL_SIMULATION_CITIES
    .filter((city) => CITY_PRESET_MAP.has(city.id))
    .map((city) => ({
      cityId: city.id,
      label: city.label,
      stateCode: city.stateCode || "",
    }))
);
