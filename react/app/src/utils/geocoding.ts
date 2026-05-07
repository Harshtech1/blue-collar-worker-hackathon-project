import {
  buildDynamicSimulationGeoConfig,
  type MarketAddressContext,
  type SimulationGeoConfig,
} from "./simulationData";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  region?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  road?: string;
  hamlet?: string;
  country?: string;
  country_code?: string;
  [key: string]: string | undefined;
}

interface NominatimEntry {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
}

export interface GeocodedMarketResult {
  lat: number;
  lng: number;
  label: string;
  cityName: string;
  stateName: string;
  stateCode: string;
  country: string;
  locality: string;
  geoConfig: SimulationGeoConfig;
}

const resolveCityName = (address: NominatimAddress = {}) => (
  address.city
  || address.town
  || address.municipality
  || address.village
  || address.county
  || address.state_district
  || "Command Market"
);

const resolveLocality = (address: NominatimAddress = {}) => (
  address.quarter
  || address.suburb
  || address.neighbourhood
  || address.road
  || address.hamlet
  || ""
);

const resolveStateCode = (address: NominatimAddress = {}) => {
  const isoCode = address["ISO3166-2-lvl4"] || address["ISO3166-2-lvl6"];
  if (isoCode) {
    return isoCode.replace(/^IN-/, "").slice(-2).toUpperCase();
  }

  return "";
};

const buildAddressContext = (entry: NominatimEntry): MarketAddressContext => {
  const address = entry.address || {};
  const cityName = resolveCityName(address);
  const stateName = address.state || address.region || "";
  const stateCode = resolveStateCode(address);
  const locality = resolveLocality(address);
  const country = address.country || "India";

  return {
    cityName,
    stateName,
    stateCode,
    country,
    locality,
    displayName: entry.display_name || [locality, cityName, stateName, country].filter(Boolean).join(", "),
  };
};

const toGeocodedMarketResult = (entry: NominatimEntry, radiusKm: number): GeocodedMarketResult => {
  const lat = Number.parseFloat(entry.lat);
  const lng = Number.parseFloat(entry.lon);
  const addressContext = buildAddressContext(entry);
  const geoConfig = buildDynamicSimulationGeoConfig({
    center: { lat, lng },
    radiusKm,
    address: addressContext,
  });

  return {
    lat,
    lng,
    label: addressContext.displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    cityName: geoConfig.cityLabel,
    stateName: geoConfig.stateName,
    stateCode: geoConfig.stateCode,
    country: geoConfig.country,
    locality: addressContext.locality || "",
    geoConfig,
  };
};

const fetchNominatim = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed with ${response.status}`);
  }

  return response.json();
};

export const searchGeocodedMarkets = async (
  query: string,
  options: {
    limit?: number;
    radiusKm?: number;
    signal?: AbortSignal;
  } = {},
): Promise<GeocodedMarketResult[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), 8);
  const radiusKm = options.radiusKm ?? 12;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const data = await fetchNominatim(url.toString(), options.signal) as NominatimEntry[];
  return data
    .filter((entry) => entry?.lat && entry?.lon)
    .map((entry) => toGeocodedMarketResult(entry, radiusKm));
};

export const reverseGeocodeMarket = async (
  lat: number,
  lng: number,
  options: {
    radiusKm?: number;
    signal?: AbortSignal;
  } = {},
): Promise<GeocodedMarketResult> => {
  const radiusKm = options.radiusKm ?? 12;
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const entry = await fetchNominatim(url.toString(), options.signal) as NominatimEntry;
  return toGeocodedMarketResult({
    ...entry,
    lat: String(lat),
    lon: String(lng),
  }, radiusKm);
};
