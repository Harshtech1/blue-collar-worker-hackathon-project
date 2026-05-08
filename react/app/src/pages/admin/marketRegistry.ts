import {
  buildDynamicSimulationGeoConfig,
  buildSimulationGeoConfig,
  GLOBAL_SIMULATION_CITIES,
  sectorSeeds,
  type GlobalSimulationCity,
  type MarketTier,
  type SimulationGeoConfig,
} from "@/utils/simulationData";
import {
  findPunjabDistrictEntry,
  isPunjabDistrictSlug,
  listPunjabDistrictEntries,
  PUNJAB_VILLAGE_REGISTRY,
  type PunjabVillageMetrics,
} from "./data/punjabVillageRegistry";

export type MarketLaunchStatus = "pilot" | "shadow-launch" | "expansion" | "international";
export type MarketDistrictKind = "seeded" | "synthetic" | "registry";
export type MarketHierarchyKind = "city" | "region" | "district" | "village";

export interface MarketState {
  slug: string;
  label: string;
  country: string;
  code: string;
  defaultCitySlug: string;
  level2Label: string;
  level3Label: string;
  level2Kind: MarketHierarchyKind;
  level3Kind: MarketHierarchyKind;
}

export interface MarketCity {
  slug: string;
  label: string;
  stateSlug: string;
  stateLabel: string;
  stateCode: string;
  country: string;
  lat: number;
  lng: number;
  zoomLevel?: number;
  tier: MarketTier;
  launchStatus: MarketLaunchStatus;
  simulationCityId: string;
  hiddenFromSelector?: boolean;
}

export interface MarketDistrict {
  slug: string;
  label: string;
  citySlug: string;
  stateSlug: string;
  kind: MarketDistrictKind;
  centerCoords?: [number, number];
  readinessScore?: number;
  zoomLevel?: number;
  landmarkLabel?: string;
  aliases?: string[];
  villageCode?: string;
  hierarchyKind?: MarketHierarchyKind;
  metrics?: PunjabVillageMetrics;
}

export interface MarketLocation {
  stateSlug: string;
  citySlug: string;
  districtSlug?: string | null;
}

export interface MarketContext {
  state: MarketState;
  city: MarketCity;
  districts: MarketDistrict[];
  district: MarketDistrict | null;
}

const DEFAULT_MARKET_LOCATION: MarketLocation = {
  stateSlug: "uttar-pradesh",
  citySlug: "agra",
  districtSlug: "agra-cantt",
};

const CITY_STATE_OVERRIDES: Record<string, { stateSlug: string; stateLabel: string; stateCode: string }> = {
  agra: { stateSlug: "uttar-pradesh", stateLabel: "Uttar Pradesh", stateCode: "UP" },
  chandigarh: { stateSlug: "punjab", stateLabel: "Punjab", stateCode: "PB" },
  "new-delhi": { stateSlug: "delhi", stateLabel: "Delhi", stateCode: "DL" },
  "north-delhi": { stateSlug: "delhi", stateLabel: "Delhi", stateCode: "DL" },
  "south-delhi": { stateSlug: "delhi", stateLabel: "Delhi", stateCode: "DL" },
  lucknow: { stateSlug: "uttar-pradesh", stateLabel: "Uttar Pradesh", stateCode: "UP" },
  noida: { stateSlug: "uttar-pradesh", stateLabel: "Uttar Pradesh", stateCode: "UP" },
  amritsar: { stateSlug: "punjab", stateLabel: "Punjab", stateCode: "PB" },
  ludhiana: { stateSlug: "punjab", stateLabel: "Punjab", stateCode: "PB" },
};

const CITY_LAUNCH_STATUS_OVERRIDES: Partial<Record<string, MarketLaunchStatus>> = {
  agra: "pilot",
  chandigarh: "shadow-launch",
  amritsar: "shadow-launch",
  ludhiana: "shadow-launch",
  lucknow: "shadow-launch",
  noida: "shadow-launch",
  "new-delhi": "shadow-launch",
  "north-delhi": "shadow-launch",
  "south-delhi": "shadow-launch",
  chennai: "expansion",
  bengaluru: "expansion",
  kolkata: "expansion",
  mumbai: "expansion",
};

const CURATED_STATE_DEFAULTS: Record<string, string> = {
  "uttar-pradesh": "agra",
  punjab: "gurdaspur",
  delhi: "new-delhi",
};

const CURATED_MARKET_CITIES: MarketCity[] = [
  {
    slug: "agra",
    label: "Agra",
    stateSlug: "uttar-pradesh",
    stateLabel: "Uttar Pradesh",
    stateCode: "UP",
    country: "India",
    lat: 27.1767,
    lng: 78.0081,
    tier: "pilot",
    launchStatus: "pilot",
    simulationCityId: "agra",
  },
  {
    slug: "lucknow",
    label: "Lucknow",
    stateSlug: "uttar-pradesh",
    stateLabel: "Uttar Pradesh",
    stateCode: "UP",
    country: "India",
    lat: 26.8467,
    lng: 80.9462,
    tier: "tier_2",
    launchStatus: "shadow-launch",
    simulationCityId: "lucknow",
  },
  {
    slug: "noida",
    label: "Noida",
    stateSlug: "uttar-pradesh",
    stateLabel: "Uttar Pradesh",
    stateCode: "UP",
    country: "India",
    lat: 28.5355,
    lng: 77.391,
    tier: "tier_1",
    launchStatus: "shadow-launch",
    simulationCityId: "noida",
  },
  {
    slug: "chandigarh",
    label: "Chandigarh",
    stateSlug: "punjab",
    stateLabel: "Punjab",
    stateCode: "PB",
    country: "India",
    lat: 30.7333,
    lng: 76.7794,
    tier: "tier_2",
    launchStatus: "shadow-launch",
    simulationCityId: "chandigarh",
  },
  {
    slug: "amritsar",
    label: "Amritsar",
    stateSlug: "punjab",
    stateLabel: "Punjab",
    stateCode: "PB",
    country: "India",
    lat: 31.634,
    lng: 74.8723,
    tier: "tier_2",
    launchStatus: "shadow-launch",
    simulationCityId: "amritsar",
  },
  {
    slug: "ludhiana",
    label: "Ludhiana",
    stateSlug: "punjab",
    stateLabel: "Punjab",
    stateCode: "PB",
    country: "India",
    lat: 30.9009,
    lng: 75.8573,
    tier: "tier_2",
    launchStatus: "shadow-launch",
    simulationCityId: "ludhiana",
  },
  {
    slug: "new-delhi",
    label: "New Delhi",
    stateSlug: "delhi",
    stateLabel: "Delhi",
    stateCode: "DL",
    country: "India",
    lat: 28.6139,
    lng: 77.209,
    tier: "tier_1",
    launchStatus: "shadow-launch",
    simulationCityId: "new-delhi",
  },
  {
    slug: "north-delhi",
    label: "North Delhi",
    stateSlug: "delhi",
    stateLabel: "Delhi",
    stateCode: "DL",
    country: "India",
    lat: 28.7041,
    lng: 77.1025,
    tier: "tier_1",
    launchStatus: "shadow-launch",
    simulationCityId: "north-delhi",
  },
  {
    slug: "south-delhi",
    label: "South Delhi",
    stateSlug: "delhi",
    stateLabel: "Delhi",
    stateCode: "DL",
    country: "India",
    lat: 28.5355,
    lng: 77.241,
    tier: "tier_1",
    launchStatus: "shadow-launch",
    simulationCityId: "south-delhi",
  },
];

const TIER_ORDER: Record<MarketTier, number> = {
  pilot: 0,
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
  international: 4,
};

const SYNTHETIC_DISTRICT_BLUEPRINTS = [
  { suffix: "", labelSuffix: "Core" },
  { suffix: "-north", labelSuffix: "North" },
  { suffix: "-east", labelSuffix: "East" },
  { suffix: "-south", labelSuffix: "South" },
  { suffix: "-west", labelSuffix: "West" },
  { suffix: "-orbit", labelSuffix: "Orbit" },
] as const;

const CURATED_DISTRICT_BLUEPRINTS: Partial<Record<string, Array<{
  slug: string;
  label: string;
  centerCoords: [number, number];
  readinessScore: number;
  zoomLevel: number;
  landmarkLabel: string;
}>>> = {
  chandigarh: [
    { slug: "sector-17", label: "Sector 17", centerCoords: [30.7392, 76.7821], readinessScore: 88, zoomLevel: 14.1, landmarkLabel: "CBD / retail grid" },
    { slug: "industrial-area-phase-1", label: "Industrial Area Phase I", centerCoords: [30.7064, 76.8022], readinessScore: 81, zoomLevel: 13.7, landmarkLabel: "industrial cluster" },
    { slug: "manimajra", label: "Manimajra", centerCoords: [30.7256, 76.8428], readinessScore: 84, zoomLevel: 13.5, landmarkLabel: "residential spine" },
  ],
  "new-delhi": [
    { slug: "connaught-place", label: "Connaught Place", centerCoords: [28.6315, 77.2167], readinessScore: 92, zoomLevel: 14.2, landmarkLabel: "commercial hub" },
    { slug: "dwarka-sector-12", label: "Dwarka Sector 12", centerCoords: [28.5927, 77.046], readinessScore: 83, zoomLevel: 13.7, landmarkLabel: "residential catchment" },
    { slug: "karol-bagh", label: "Karol Bagh", centerCoords: [28.6511, 77.1904], readinessScore: 87, zoomLevel: 13.8, landmarkLabel: "mixed retail market" },
  ],
  chennai: [
    { slug: "t-nagar", label: "T Nagar", centerCoords: [13.0418, 80.2341], readinessScore: 85, zoomLevel: 14, landmarkLabel: "high-density retail" },
    { slug: "perungudi-omr", label: "Perungudi OMR", centerCoords: [12.9654, 80.2451], readinessScore: 81, zoomLevel: 13.5, landmarkLabel: "tech corridor" },
    { slug: "anna-nagar", label: "Anna Nagar", centerCoords: [13.0849, 80.2101], readinessScore: 83, zoomLevel: 13.8, landmarkLabel: "residential cluster" },
  ],
  bengaluru: [
    { slug: "koramangala", label: "Koramangala", centerCoords: [12.9352, 77.6245], readinessScore: 87, zoomLevel: 14, landmarkLabel: "startup and retail mix" },
    { slug: "whitefield", label: "Whitefield", centerCoords: [12.9698, 77.75], readinessScore: 84, zoomLevel: 13.2, landmarkLabel: "distributed tech hub" },
    { slug: "indiranagar", label: "Indiranagar", centerCoords: [12.9719, 77.6412], readinessScore: 89, zoomLevel: 13.8, landmarkLabel: "lifestyle catchment" },
  ],
  kolkata: [
    { slug: "salt-lake-sector-v", label: "Salt Lake Sector V", centerCoords: [22.5797, 88.4317], readinessScore: 84, zoomLevel: 13.7, landmarkLabel: "office district" },
    { slug: "park-street", label: "Park Street", centerCoords: [22.551, 88.3527], readinessScore: 86, zoomLevel: 14, landmarkLabel: "retail and dining belt" },
    { slug: "new-town-action-area-i", label: "New Town Action Area I", centerCoords: [22.5756, 88.4791], readinessScore: 82, zoomLevel: 13.3, landmarkLabel: "planned growth zone" },
  ],
  mumbai: [
    { slug: "powai", label: "Powai", centerCoords: [19.1187, 72.906], readinessScore: 84, zoomLevel: 13.7, landmarkLabel: "mixed residential-tech zone" },
    { slug: "andheri-west", label: "Andheri West", centerCoords: [19.1364, 72.8274], readinessScore: 88, zoomLevel: 13.9, landmarkLabel: "dense service corridor" },
    { slug: "lower-parel", label: "Lower Parel", centerCoords: [18.9984, 72.8266], readinessScore: 90, zoomLevel: 14, landmarkLabel: "premium business district" },
  ],
};

const slugify = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
);

const toTitleCase = (value: string) => (
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
);

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const EARTH_RADIUS_KM = 6371;

const offsetMarketCoordinate = (
  lat: number,
  lng: number,
  distanceKm: number,
  bearingDeg: number,
): [number, number] => {
  if (distanceKm === 0) {
    return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
  }

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
  ];
};

const inferStateMeta = (city: GlobalSimulationCity) => {
  const override = CITY_STATE_OVERRIDES[city.id];
  if (override) return override;

  const normalizedState = city.stateName?.trim() || city.country.trim();
  const slug = slugify(normalizedState);
  const code = city.stateCode
    || normalizedState
      .split(/\s+/)
      .map((token) => token[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 3)
    || city.country.slice(0, 2).toUpperCase();

  return {
    stateSlug: slug,
    stateLabel: normalizedState,
    stateCode: code,
  };
};

const getHierarchyMetaForState = (
  stateSlug: string,
): Pick<MarketState, "level2Label" | "level3Label" | "level2Kind" | "level3Kind"> => {
  if (stateSlug === "punjab") {
    return {
      level2Label: PUNJAB_VILLAGE_REGISTRY.meta.level2Label,
      level3Label: PUNJAB_VILLAGE_REGISTRY.meta.level3Label,
      level2Kind: "district" as const,
      level3Kind: "village" as const,
    };
  }

  return {
    level2Label: "City",
    level3Label: "Region",
    level2Kind: "city" as const,
    level3Kind: "region" as const,
  };
};

const inferLaunchStatus = (city: GlobalSimulationCity): MarketLaunchStatus => {
  if (city.country !== "India") return "international";
  return CITY_LAUNCH_STATUS_OVERRIDES[city.id] || "expansion";
};

const inferTier = (city: GlobalSimulationCity): MarketTier => {
  if (city.country !== "India") return "international";
  if (city.id === "agra") return "pilot";
  if (city.demandScale >= 1.3) return "tier_1";
  if (city.demandScale >= 1.08) return "tier_2";
  return "tier_3";
};

const GLOBAL_MARKET_CITIES: MarketCity[] = GLOBAL_SIMULATION_CITIES.map((city) => {
  const stateMeta = inferStateMeta(city);
  return {
    slug: city.id,
    label: city.label,
    stateSlug: stateMeta.stateSlug,
    stateLabel: stateMeta.stateLabel,
    stateCode: stateMeta.stateCode,
    country: city.country,
    lat: city.lat,
    lng: city.lng,
    tier: inferTier(city),
    launchStatus: inferLaunchStatus(city),
    simulationCityId: city.id,
  };
});

const PUNJAB_DISTRICT_CITIES: MarketCity[] = listPunjabDistrictEntries().map((district) => ({
  slug: district.slug,
  label: district.label,
  stateSlug: "punjab",
  stateLabel: "Punjab",
  stateCode: "PB",
  country: "India",
  lat: district.centerCoords[0],
  lng: district.centerCoords[1],
  zoomLevel: district.zoomLevel,
  tier: "tier_2" as const,
  launchStatus: "shadow-launch" as const,
  simulationCityId: "chandigarh",
  hiddenFromSelector: true,
}));

const PUNJAB_VILLAGE_DISTRICTS: MarketDistrict[] = PUNJAB_VILLAGE_REGISTRY.villages.map((village) => ({
  slug: village.slug,
  label: village.label,
  citySlug: village.districtSlug,
  stateSlug: "punjab",
  kind: "registry" as const,
  centerCoords: village.centerCoords,
  readinessScore: village.readinessScore,
  zoomLevel: village.zoomLevel,
  landmarkLabel: `${village.districtLabel} village grid`,
  aliases: [
    village.label.toLowerCase(),
    village.slug.replace(/-/g, " "),
    village.villageCode,
  ],
  villageCode: village.villageCode,
  hierarchyKind: "village",
  metrics: village.metrics,
}));

const MARKET_CITIES: MarketCity[] = Array.from(
  [...PUNJAB_DISTRICT_CITIES, ...GLOBAL_MARKET_CITIES, ...CURATED_MARKET_CITIES].reduce<Map<string, MarketCity>>((acc, city) => {
    acc.set(city.slug, city);
    return acc;
  }, new Map<string, MarketCity>()).values(),
).sort((left, right) => left.label.localeCompare(right.label));

const MARKET_STATES: MarketState[] = Object.values(
  MARKET_CITIES.reduce<Record<string, MarketState>>((acc, city) => {
    if (!acc[city.stateSlug]) {
      const hierarchyMeta = getHierarchyMetaForState(city.stateSlug);
      acc[city.stateSlug] = {
        slug: city.stateSlug,
        label: city.stateLabel,
        country: city.country,
        code: city.stateCode,
        defaultCitySlug: CURATED_STATE_DEFAULTS[city.stateSlug] || city.slug,
        ...hierarchyMeta,
      };
      return acc;
    }

    if (CURATED_STATE_DEFAULTS[city.stateSlug]) {
      acc[city.stateSlug].defaultCitySlug = CURATED_STATE_DEFAULTS[city.stateSlug];
      return acc;
    }

    const currentDefault = MARKET_CITIES.find((entry) => entry.slug === acc[city.stateSlug].defaultCitySlug);
    if (!currentDefault) {
      acc[city.stateSlug].defaultCitySlug = city.slug;
      return acc;
    }

    const prefersCity = (
      (city.launchStatus === "pilot" && currentDefault.launchStatus !== "pilot")
      || (city.launchStatus === "shadow-launch" && currentDefault.launchStatus === "expansion")
      || (TIER_ORDER[city.tier] < TIER_ORDER[currentDefault.tier])
      || (TIER_ORDER[city.tier] === TIER_ORDER[currentDefault.tier] && city.label.localeCompare(currentDefault.label) < 0)
    );

    if (prefersCity) {
      acc[city.stateSlug].defaultCitySlug = city.slug;
    }

    return acc;
  }, {}),
).sort((left, right) => left.label.localeCompare(right.label));

const fallbackAgraDistricts = sectorSeeds.filter((sector) => sector.city.toLowerCase() === "agra");

const SEEDED_DISTRICTS: MarketDistrict[] = fallbackAgraDistricts
  .map((sector) => ({
    slug: sector.id,
    label: sector.id === "dayalbagh" ? "Dayal Bagh" : sector.label,
    citySlug: "agra",
    stateSlug: "uttar-pradesh",
    kind: "seeded" as const,
    centerCoords: [
      Number((((sector.latRange[0] + sector.latRange[1]) / 2)).toFixed(6)),
      Number((((sector.lngRange[0] + sector.lngRange[1]) / 2)).toFixed(6)),
    ],
    readinessScore: Math.max(68, Math.min(97, Math.round((sector.demandWeight * 34) + (sector.historicalTraffic * 30) + 18))),
    zoomLevel: 13.8,
    landmarkLabel: `${sector.label} service zone`,
    aliases: sector.id === "dayalbagh" ? ["dayal-bagh", "dayal bagh"] : [],
  }));

export const listMarketStates = () => MARKET_STATES;

export const listMarketCities = (
  stateSlug?: string | null,
  options: { includeHidden?: boolean } = {},
) => (
  (stateSlug
    ? MARKET_CITIES.filter((city) => city.stateSlug === stateSlug)
    : MARKET_CITIES)
    .filter((city) => options.includeHidden || !city.hiddenFromSelector)
);

export const findMarketState = (stateSlug?: string | null) => (
  MARKET_STATES.find((state) => state.slug === stateSlug) || null
);

export const findMarketCity = (citySlug?: string | null) => {
  if (!citySlug) return null;
  return MARKET_CITIES.find((city) => city.slug === citySlug)
    || MARKET_CITIES.find((city) => city.simulationCityId === citySlug)
    || null;
};

export const buildSyntheticDistrictsForCity = (city: MarketCity): MarketDistrict[] => {
  const curatedBlueprints = CURATED_DISTRICT_BLUEPRINTS[city.slug];
  if (curatedBlueprints?.length) {
    return curatedBlueprints.map((district) => ({
      slug: district.slug,
      label: district.label,
      citySlug: city.slug,
      stateSlug: city.stateSlug,
      kind: "synthetic" as const,
      centerCoords: district.centerCoords,
      readinessScore: district.readinessScore,
      zoomLevel: district.zoomLevel,
      landmarkLabel: district.landmarkLabel,
      aliases: [district.label.toLowerCase(), district.slug.replace(/-/g, " ")],
    }));
  }

  return SYNTHETIC_DISTRICT_BLUEPRINTS.map((blueprint, index) => {
    const districtProfile = blueprint.suffix === ""
      ? { distanceKm: 0, bearingDeg: 0, readinessScore: 92, zoomLevel: 12.9 }
      : blueprint.suffix === "-north"
        ? { distanceKm: 4.1, bearingDeg: 0, readinessScore: 84, zoomLevel: 12.5 }
        : blueprint.suffix === "-east"
          ? { distanceKm: 4.3, bearingDeg: 90, readinessScore: 82, zoomLevel: 12.4 }
          : blueprint.suffix === "-south"
            ? { distanceKm: 4.2, bearingDeg: 180, readinessScore: 79, zoomLevel: 12.3 }
            : blueprint.suffix === "-west"
              ? { distanceKm: 4.1, bearingDeg: 270, readinessScore: 80, zoomLevel: 12.3 }
              : { distanceKm: 5.6, bearingDeg: 45 + (index * 8), readinessScore: 76, zoomLevel: 12.1 };

    return {
      slug: `${city.slug}${blueprint.suffix}`,
      label: `${city.label} ${blueprint.labelSuffix}`,
      citySlug: city.slug,
      stateSlug: city.stateSlug,
      kind: "synthetic" as const,
      centerCoords: offsetMarketCoordinate(city.lat, city.lng, districtProfile.distanceKm, districtProfile.bearingDeg),
      readinessScore: districtProfile.readinessScore,
      zoomLevel: districtProfile.zoomLevel,
      landmarkLabel: blueprint.labelSuffix,
      aliases: [`${city.label} ${blueprint.labelSuffix}`.toLowerCase(), `${city.slug}${blueprint.suffix}`.replace(/-/g, " ")],
    };
  })
};

export const getMarketDistrictsForCity = (citySlug?: string | null): MarketDistrict[] => {
  const city = findMarketCity(citySlug);
  if (!city) return [];

  if (city.stateSlug === "punjab" && isPunjabDistrictSlug(city.slug)) {
    return PUNJAB_VILLAGE_DISTRICTS.filter((district) => district.citySlug === city.slug);
  }

  if (city.slug === "agra") {
    return SEEDED_DISTRICTS;
  }

  return buildSyntheticDistrictsForCity(city);
};

export const getMarketDistrictBySlug = (
  districtSlug?: string | null,
  citySlug?: string | null,
): MarketDistrict | null => {
  if (!districtSlug) return null;
  const normalizedDistrictSlug = slugify(districtSlug);

  const punjabVillage: MarketDistrict | null = PUNJAB_VILLAGE_DISTRICTS.find((district) => (
    district.slug === normalizedDistrictSlug
    || district.villageCode === normalizedDistrictSlug
    || slugify(district.label) === normalizedDistrictSlug
    || district.aliases?.some((alias) => slugify(alias) === normalizedDistrictSlug)
  )) || null;
  if (punjabVillage && (!citySlug || punjabVillage.citySlug === citySlug)) {
    return punjabVillage;
  }

  const seeded = SEEDED_DISTRICTS.find((district) => (
    district.slug === normalizedDistrictSlug
    || slugify(district.label) === normalizedDistrictSlug
    || district.aliases?.some((alias) => slugify(alias) === normalizedDistrictSlug)
  ));
  if (seeded && (!citySlug || seeded.citySlug === citySlug)) return seeded;

  for (const city of MARKET_CITIES) {
    if (citySlug && city.slug !== citySlug) continue;
    const synthetic = buildSyntheticDistrictsForCity(city).find((district) => (
      district.slug === normalizedDistrictSlug
      || slugify(district.label) === normalizedDistrictSlug
      || district.aliases?.some((alias) => slugify(alias) === normalizedDistrictSlug)
    ));
    if (synthetic) return synthetic;
  }

  return null;
};

export const getDefaultMarketLocation = (): MarketLocation => ({ ...DEFAULT_MARKET_LOCATION });

export function resolveMarketLocation(location?: Partial<MarketLocation> | null): MarketLocation;
export function resolveMarketLocation(
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
): MarketLocation;
export function resolveMarketLocation(
  locationOrState?: Partial<MarketLocation> | string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
): MarketLocation {
  if (!locationOrState) return { ...DEFAULT_MARKET_LOCATION };

  const location = typeof locationOrState === "string"
    ? {
        stateSlug: locationOrState,
        citySlug,
        districtSlug,
      }
    : locationOrState;

  const hasExplicitDistrict = Object.prototype.hasOwnProperty.call(location, "districtSlug");
  const context = resolveMarketContext(location.stateSlug, location.citySlug, location.districtSlug || null);
  const normalizedDistrictSlug = hasExplicitDistrict
    ? (
      location.districtSlug
        ? getMarketDistrictBySlug(location.districtSlug, context.city.slug)?.slug
          || getDefaultDistrictForCity(context.city.slug)?.slug
          || null
        : null
    )
    : context.district?.slug || getDefaultDistrictForCity(context.city.slug)?.slug || null;

  return {
    stateSlug: context.state.slug,
    citySlug: context.city.slug,
    districtSlug: normalizedDistrictSlug,
  };
}

export const getDefaultCityForState = (stateSlug?: string | null) => {
  const state = findMarketState(stateSlug);
  if (!state) return findMarketCity(DEFAULT_MARKET_LOCATION.citySlug);
  const defaultCity = findMarketCity(state.defaultCitySlug);
  if (defaultCity && !defaultCity.hiddenFromSelector) {
    return defaultCity;
  }

  return listMarketCities(state.slug)[0] || defaultCity || null;
};

export const getDefaultDistrictForCity = (citySlug?: string | null): MarketDistrict | null => (
  getMarketDistrictsForCity(citySlug)[0] || null
);

export const resolveMarketContext = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
): MarketContext => {
  const fallbackState = findMarketState(DEFAULT_MARKET_LOCATION.stateSlug)!;
  const fallbackCity = findMarketCity(DEFAULT_MARKET_LOCATION.citySlug)!;

  const city = findMarketCity(citySlug) || fallbackCity;
  const state = findMarketState(stateSlug) || findMarketState(city.stateSlug) || fallbackState;
  const normalizedCity = city.stateSlug === state.slug ? city : getDefaultCityForState(state.slug) || fallbackCity;

  return {
    state,
    city: normalizedCity,
    districts: getMarketDistrictsForCity(normalizedCity.slug),
    district: getMarketDistrictBySlug(districtSlug || null, normalizedCity.slug) || getDefaultDistrictForCity(normalizedCity.slug),
  };
};

export const resolveMarketLabel = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
) => {
  const district = getMarketDistrictBySlug(districtSlug, citySlug);
  if (district) return district.label;

  const context = resolveMarketContext(stateSlug, citySlug, districtSlug);
  return context.city.label;
};

export const resolveLegacyMarketTarget = (target?: string | null): MarketLocation | null => {
  if (!target) return null;

  const normalized = slugify(target);
  const district = getMarketDistrictBySlug(normalized);
  if (district) {
    return {
      stateSlug: district.stateSlug,
      citySlug: district.citySlug,
      districtSlug: district.slug,
    };
  }

  const directCity = findMarketCity(normalized);
  if (directCity) {
    return {
      stateSlug: directCity.stateSlug,
      citySlug: directCity.slug,
    };
  }

  const seed = sectorSeeds.find((sector) => sector.id === normalized);
  if (seed) {
    const city = MARKET_CITIES.find((entry) => entry.label.toLowerCase() === seed.city.toLowerCase());
    if (city) {
      return {
        stateSlug: city.stateSlug,
        citySlug: city.slug,
        districtSlug: normalized,
      };
    }
  }

  if (normalized === "delhi") {
    return {
      stateSlug: "delhi",
      citySlug: "new-delhi",
    };
  }

  return null;
};

export const getMarketHierarchyMeta = (stateSlug?: string | null, citySlug?: string | null) => {
  const state = findMarketState(stateSlug) || findMarketState(DEFAULT_MARKET_LOCATION.stateSlug)!;
  const resolvedCity = findMarketCity(citySlug);
  if (state.slug === "punjab" && citySlug && resolvedCity && !resolvedCity.hiddenFromSelector) {
    return {
      level2Label: "City",
      level3Label: "Region",
      level2Kind: "city",
      level3Kind: "region",
    };
  }

  return {
    level2Label: state.level2Label,
    level3Label: state.level3Label,
    level2Kind: state.level2Kind,
    level3Kind: state.level3Kind,
  };
};

export const getMarketDistrictMetrics = (districtSlug?: string | null, citySlug?: string | null) => (
  getMarketDistrictBySlug(districtSlug, citySlug)?.metrics || null
);

export const buildMarketBreadcrumb = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
) => {
  const context = resolveMarketContext(stateSlug, citySlug, districtSlug);
  const districtLabel = districtSlug ? getMarketDistrictBySlug(districtSlug, context.city.slug)?.label : context.district?.label || null;
  return districtLabel
    ? `Markets > ${context.state.label} > ${context.city.label} > ${districtLabel}`
    : `Markets > ${context.state.label} > ${context.city.label}`;
};

export const buildMarketGeoConfig = ({
  market,
  stateSlug,
  citySlug,
  districtSlug,
  center,
  radiusKm = 12,
}: {
  market?: MarketCity;
  stateSlug?: string | null;
  citySlug?: string | null;
  districtSlug?: string | null;
  center?: { lat: number; lng: number };
  radiusKm?: number;
} = {}): SimulationGeoConfig => {
  const resolvedMarket = market
    || findMarketCity(citySlug)
    || getDefaultCityForState(stateSlug)
    || findMarketCity(DEFAULT_MARKET_LOCATION.citySlug)
    || CURATED_MARKET_CITIES[0];
  const resolvedDistrict = getMarketDistrictBySlug(districtSlug, resolvedMarket.slug);
  const resolvedCenter = center || (resolvedDistrict?.centerCoords
    ? {
        lat: resolvedDistrict.centerCoords[0],
        lng: resolvedDistrict.centerCoords[1],
      }
    : {
        lat: resolvedMarket.lat,
        lng: resolvedMarket.lng,
      });
  const isKnownGlobalMarket = GLOBAL_SIMULATION_CITIES.some((entry) => entry.id === resolvedMarket.simulationCityId);

  if (isKnownGlobalMarket) {
    return buildSimulationGeoConfig({
      cityId: resolvedMarket.simulationCityId,
      center: resolvedCenter,
      radiusKm,
    });
  }

  return buildDynamicSimulationGeoConfig({
    center: resolvedCenter,
    radiusKm,
    fallbackCityId: resolvedMarket.stateSlug === "delhi"
      ? "new-delhi"
      : resolvedMarket.stateSlug === "punjab"
        ? "chandigarh"
        : "agra",
    address: {
      cityName: resolvedMarket.label,
      stateName: resolvedMarket.stateLabel,
      stateCode: resolvedMarket.stateCode,
      country: resolvedMarket.country,
      displayName: [resolvedDistrict?.label, resolvedMarket.label, resolvedMarket.stateLabel, resolvedMarket.country]
        .filter(Boolean)
        .join(", "),
    },
  });
};

export const listStateReadiness = (stateSlug?: string | null) => {
  const cities = listMarketCities(stateSlug);
  const pilotCities = cities.filter((city) => city.launchStatus === "pilot").length;
  const expansionCities = cities.filter((city) => city.launchStatus !== "pilot").length;
  const recommendedFocus = cities
    .slice()
    .sort((left, right) => {
      const launchWeight = left.launchStatus === right.launchStatus
        ? 0
        : left.launchStatus === "shadow-launch"
          ? -1
          : right.launchStatus === "shadow-launch"
            ? 1
            : left.launchStatus === "pilot"
              ? -1
              : 1;

      if (launchWeight !== 0) return launchWeight;
      if (TIER_ORDER[left.tier] !== TIER_ORDER[right.tier]) {
        return TIER_ORDER[left.tier] - TIER_ORDER[right.tier];
      }

      return left.label.localeCompare(right.label);
    })[0] || null;

  return {
    totalCities: cities.length,
    pilotCities,
    expansionCities,
    recommendedFocus: recommendedFocus?.label || "No focus city",
  };
};

export const humanizeMarketLocation = (location: MarketLocation) => {
  const context = resolveMarketContext(location.stateSlug, location.citySlug);
  const districtLabel = location.districtSlug ? getMarketDistrictBySlug(location.districtSlug)?.label : null;
  return districtLabel ? `${districtLabel}, ${context.city.label}` : `${context.city.label}, ${context.state.label}`;
};

export const getInitialsForState = (stateSlug?: string | null) => {
  const state = findMarketState(stateSlug);
  return state?.code || toTitleCase((stateSlug || "rahi").slice(0, 2));
};
