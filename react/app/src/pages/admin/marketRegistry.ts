import {
  buildDynamicSimulationGeoConfig,
  buildSimulationGeoConfig,
  GLOBAL_SIMULATION_CITIES,
  sectorSeeds,
  type GlobalSimulationCity,
  type MarketTier,
  type SimulationGeoConfig,
} from "@/utils/simulationData";

export type MarketLaunchStatus = "pilot" | "shadow-launch" | "expansion" | "international";
export type MarketDistrictKind = "seeded" | "synthetic";

export interface MarketState {
  slug: string;
  label: string;
  country: string;
  code: string;
  defaultCitySlug: string;
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
  punjab: "chandigarh",
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

const MARKET_CITIES: MarketCity[] = Array.from(
  [...GLOBAL_MARKET_CITIES, ...CURATED_MARKET_CITIES].reduce<Map<string, MarketCity>>((acc, city) => {
    acc.set(city.slug, city);
    return acc;
  }, new Map<string, MarketCity>()).values(),
).sort((left, right) => left.label.localeCompare(right.label));

const MARKET_STATES: MarketState[] = Object.values(
  MARKET_CITIES.reduce<Record<string, MarketState>>((acc, city) => {
    if (!acc[city.stateSlug]) {
      acc[city.stateSlug] = {
        slug: city.stateSlug,
        label: city.stateLabel,
        country: city.country,
        code: city.stateCode,
        defaultCitySlug: CURATED_STATE_DEFAULTS[city.stateSlug] || city.slug,
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

const AGRA_PRIORITY_DISTRICT_IDS = new Set(["agra-cantt", "dayal-bagh", "sikandra"]);
const agraSeededDistricts = sectorSeeds.filter((sector) => (
  sector.city.toLowerCase() === "agra"
  && (AGRA_PRIORITY_DISTRICT_IDS.has(sector.id) || AGRA_PRIORITY_DISTRICT_IDS.has(slugify(sector.label)))
));
const fallbackAgraDistricts = sectorSeeds.filter((sector) => sector.city.toLowerCase() === "agra");

const SEEDED_DISTRICTS: MarketDistrict[] = (agraSeededDistricts.length > 0 ? agraSeededDistricts : fallbackAgraDistricts)
  .map((sector) => ({
    slug: sector.id,
    label: sector.label,
    citySlug: "agra",
    stateSlug: "uttar-pradesh",
    kind: "seeded" as const,
  }));

export const listMarketStates = () => MARKET_STATES;

export const listMarketCities = (stateSlug?: string | null) => (
  stateSlug
    ? MARKET_CITIES.filter((city) => city.stateSlug === stateSlug)
    : MARKET_CITIES
);

export const findMarketState = (stateSlug?: string | null) => (
  MARKET_STATES.find((state) => state.slug === stateSlug) || null
);

export const findMarketCity = (citySlug?: string | null) => (
  MARKET_CITIES.find((city) => city.slug === citySlug || city.simulationCityId === citySlug) || null
);

export const buildSyntheticDistrictsForCity = (city: MarketCity): MarketDistrict[] => (
  SYNTHETIC_DISTRICT_BLUEPRINTS.map((blueprint) => ({
    slug: `${city.slug}${blueprint.suffix}`,
    label: `${city.label} ${blueprint.labelSuffix}`,
    citySlug: city.slug,
    stateSlug: city.stateSlug,
    kind: "synthetic" as const,
    landmarkLabel: blueprint.labelSuffix,
  }))
);

export const getMarketDistrictsForCity = (citySlug?: string | null): MarketDistrict[] => {
  const city = findMarketCity(citySlug);
  if (!city) return [];

  if (city.slug === "agra") {
    return SEEDED_DISTRICTS;
  }

  return buildSyntheticDistrictsForCity(city);
};

export const getMarketDistrictBySlug = (districtSlug?: string | null, citySlug?: string | null) => {
  if (!districtSlug) return null;

  const seeded = SEEDED_DISTRICTS.find((district) => district.slug === districtSlug);
  if (seeded && (!citySlug || seeded.citySlug === citySlug)) return seeded;

  for (const city of MARKET_CITIES) {
    if (citySlug && city.slug !== citySlug) continue;
    const synthetic = buildSyntheticDistrictsForCity(city).find((district) => district.slug === districtSlug);
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

  const context = resolveMarketContext(location.stateSlug, location.citySlug, location.districtSlug || null);
  return {
    stateSlug: context.state.slug,
    citySlug: context.city.slug,
    districtSlug: context.district?.slug || location.districtSlug || null,
  };
}

export const getDefaultCityForState = (stateSlug?: string | null) => {
  const state = findMarketState(stateSlug);
  if (!state) return findMarketCity(DEFAULT_MARKET_LOCATION.citySlug);
  return findMarketCity(state.defaultCitySlug);
};

export const getDefaultDistrictForCity = (citySlug?: string | null) => (
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
    district: getMarketDistrictBySlug(districtSlug || null),
  };
};

export const resolveMarketLabel = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
) => {
  const district = getMarketDistrictBySlug(districtSlug);
  if (district) return district.label;

  const context = resolveMarketContext(stateSlug, citySlug);
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

export const buildMarketBreadcrumb = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
) => {
  const context = resolveMarketContext(stateSlug, citySlug);
  const districtLabel = districtSlug ? getMarketDistrictBySlug(districtSlug)?.label : null;
  return districtLabel
    ? `Markets > ${context.state.label} > ${context.city.label} > ${districtLabel}`
    : `Markets > ${context.state.label} > ${context.city.label}`;
};

export const buildMarketGeoConfig = ({
  market,
  citySlug,
  center,
  radiusKm = 12,
}: {
  market?: MarketCity;
  citySlug?: string | null;
  districtSlug?: string | null;
  center?: { lat: number; lng: number };
  radiusKm?: number;
} = {}): SimulationGeoConfig => {
  const resolvedMarket = market
    || findMarketCity(citySlug)
    || findMarketCity(DEFAULT_MARKET_LOCATION.citySlug)
    || CURATED_MARKET_CITIES[0];
  const resolvedCenter = center || {
    lat: resolvedMarket.lat,
    lng: resolvedMarket.lng,
  };
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
      displayName: [resolvedMarket.label, resolvedMarket.stateLabel, resolvedMarket.country].join(", "),
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
