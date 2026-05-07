const createRegion = ({
  id,
  label,
  lat,
  lng,
  workerCount,
  activeJobs,
  completedJobs,
  revenue,
  avgResponseTime,
}) => ({
  id,
  label,
  lat,
  lng,
  workerCount,
  activeJobs,
  completedJobs,
  revenue,
  avgResponseTime,
});

const ADMIN_MARKETS = [
  {
    cityId: "agra",
    cityLabel: "Agra",
    state: "Uttar Pradesh",
    stateCode: "UP",
    country: "India",
    tier: "pilot",
    regionGroup: "North India",
    readiness: 97,
    zoom: 11.9,
    regions: [
      createRegion({ id: "agra-cantt", label: "Agra Cantt", lat: 27.1572, lng: 77.9981, workerCount: 9, activeJobs: 17, completedJobs: 41, revenue: 78100, avgResponseTime: 16 }),
      createRegion({ id: "civil-lines", label: "Civil Lines", lat: 27.2066, lng: 78.0035, workerCount: 7, activeJobs: 12, completedJobs: 28, revenue: 55800, avgResponseTime: 18 }),
      createRegion({ id: "sikandra", label: "Sikandra", lat: 27.2134, lng: 77.9502, workerCount: 6, activeJobs: 11, completedJobs: 24, revenue: 48400, avgResponseTime: 19 }),
      createRegion({ id: "dayal-bagh", label: "Dayal Bagh", lat: 27.2221, lng: 78.0208, workerCount: 5, activeJobs: 9, completedJobs: 18, revenue: 39600, avgResponseTime: 20 }),
      createRegion({ id: "taj-ganj", label: "Taj Ganj", lat: 27.1686, lng: 78.0421, workerCount: 8, activeJobs: 14, completedJobs: 31, revenue: 61200, avgResponseTime: 17 }),
    ],
  },
  {
    cityId: "new-delhi",
    cityLabel: "New Delhi",
    state: "Delhi",
    stateCode: "DL",
    country: "India",
    tier: "tier_1",
    regionGroup: "North India",
    readiness: 88,
    zoom: 11.3,
    regions: [
      createRegion({ id: "connaught-place", label: "Connaught Place", lat: 28.6315, lng: 77.2167, workerCount: 8, activeJobs: 16, completedJobs: 34, revenue: 62200, avgResponseTime: 17 }),
      createRegion({ id: "dwarka", label: "Dwarka", lat: 28.5921, lng: 77.0460, workerCount: 10, activeJobs: 19, completedJobs: 42, revenue: 69800, avgResponseTime: 16 }),
      createRegion({ id: "rohini", label: "Rohini", lat: 28.7495, lng: 77.0565, workerCount: 9, activeJobs: 15, completedJobs: 29, revenue: 57400, avgResponseTime: 18 }),
      createRegion({ id: "lajpat-nagar", label: "Lajpat Nagar", lat: 28.5677, lng: 77.2433, workerCount: 7, activeJobs: 14, completedJobs: 28, revenue: 54800, avgResponseTime: 19 }),
      createRegion({ id: "karol-bagh", label: "Karol Bagh", lat: 28.6519, lng: 77.1909, workerCount: 8, activeJobs: 13, completedJobs: 26, revenue: 51600, avgResponseTime: 18 }),
    ],
  },
  {
    cityId: "chandigarh",
    cityLabel: "Chandigarh",
    state: "Punjab",
    stateCode: "PB",
    country: "India",
    tier: "tier_2",
    regionGroup: "North India",
    readiness: 84,
    zoom: 11.1,
    regions: [
      createRegion({ id: "sector-17", label: "Sector 17", lat: 30.7413, lng: 76.7855, workerCount: 7, activeJobs: 11, completedJobs: 24, revenue: 41800, avgResponseTime: 19 }),
      createRegion({ id: "sector-22", label: "Sector 22", lat: 30.7364, lng: 76.7765, workerCount: 6, activeJobs: 9, completedJobs: 19, revenue: 36200, avgResponseTime: 20 }),
      createRegion({ id: "manimajra", label: "Manimajra", lat: 30.7261, lng: 76.8431, workerCount: 8, activeJobs: 12, completedJobs: 22, revenue: 39200, avgResponseTime: 18 }),
      createRegion({ id: "it-park", label: "IT Park", lat: 30.7122, lng: 76.8405, workerCount: 5, activeJobs: 8, completedJobs: 16, revenue: 34100, avgResponseTime: 22 }),
      createRegion({ id: "mohali-link", label: "Mohali Link", lat: 30.7046, lng: 76.7179, workerCount: 6, activeJobs: 10, completedJobs: 18, revenue: 35800, avgResponseTime: 21 }),
    ],
  },
  {
    cityId: "chennai",
    cityLabel: "Chennai",
    state: "Tamil Nadu",
    stateCode: "TN",
    country: "India",
    tier: "tier_1",
    regionGroup: "South India",
    readiness: 81,
    zoom: 11.1,
    regions: [
      createRegion({ id: "t-nagar", label: "T Nagar", lat: 13.0418, lng: 80.2337, workerCount: 9, activeJobs: 17, completedJobs: 38, revenue: 64100, avgResponseTime: 18 }),
      createRegion({ id: "anna-nagar", label: "Anna Nagar", lat: 13.0878, lng: 80.2101, workerCount: 8, activeJobs: 14, completedJobs: 31, revenue: 58400, avgResponseTime: 19 }),
      createRegion({ id: "velachery", label: "Velachery", lat: 12.9756, lng: 80.2206, workerCount: 7, activeJobs: 13, completedJobs: 27, revenue: 53300, avgResponseTime: 21 }),
      createRegion({ id: "omr", label: "OMR", lat: 12.9177, lng: 80.2306, workerCount: 10, activeJobs: 19, completedJobs: 36, revenue: 67600, avgResponseTime: 17 }),
      createRegion({ id: "mylapore", label: "Mylapore", lat: 13.0336, lng: 80.2697, workerCount: 6, activeJobs: 11, completedJobs: 22, revenue: 42400, avgResponseTime: 20 }),
    ],
  },
  {
    cityId: "kolkata",
    cityLabel: "Kolkata",
    state: "West Bengal",
    stateCode: "WB",
    country: "India",
    tier: "tier_1",
    regionGroup: "East India",
    readiness: 79,
    zoom: 11,
    regions: [
      createRegion({ id: "salt-lake", label: "Salt Lake", lat: 22.5867, lng: 88.4170, workerCount: 9, activeJobs: 15, completedJobs: 34, revenue: 60100, avgResponseTime: 19 }),
      createRegion({ id: "park-street", label: "Park Street", lat: 22.5536, lng: 88.3525, workerCount: 7, activeJobs: 12, completedJobs: 26, revenue: 48600, avgResponseTime: 21 }),
      createRegion({ id: "howrah", label: "Howrah", lat: 22.5958, lng: 88.2636, workerCount: 8, activeJobs: 13, completedJobs: 25, revenue: 46200, avgResponseTime: 22 }),
      createRegion({ id: "gariahat", label: "Gariahat", lat: 22.5186, lng: 88.3650, workerCount: 6, activeJobs: 10, completedJobs: 20, revenue: 40100, avgResponseTime: 23 }),
      createRegion({ id: "new-town", label: "New Town", lat: 22.5750, lng: 88.4790, workerCount: 10, activeJobs: 18, completedJobs: 37, revenue: 65800, avgResponseTime: 18 }),
    ],
  },
];

const slugify = (value = "") => (
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
);

const offsetCoordinate = (lat, lng, latOffset, lngOffset) => ({
  lat: Number((lat + latOffset).toFixed(5)),
  lng: Number((lng + lngOffset).toFixed(5)),
});

const regionCityLookup = new Map(
  ADMIN_MARKETS.flatMap((city) => city.regions.map((region) => [region.id, city.cityId])),
);

export const listAdminMarketCities = () => ADMIN_MARKETS.map((city) => ({
  cityId: city.cityId,
  label: city.cityLabel,
  state: city.state,
  stateCode: city.stateCode,
  regionGroup: city.regionGroup,
  readiness: city.readiness,
}));

export const findAdminMarketCity = (value) => {
  if (!value) return null;
  const normalized = slugify(value);
  return ADMIN_MARKETS.find((city) => city.cityId === normalized || slugify(city.cityLabel) === normalized) || null;
};

export const findAdminRegion = (cityId, regionId) => {
  const city = findAdminMarketCity(cityId);
  if (!city || !regionId) return null;
  return city.regions.find((region) => region.id === regionId || slugify(region.label) === slugify(regionId)) || null;
};

export const inferCityIdFromRegion = (regionId) => {
  if (!regionId) return null;
  return regionCityLookup.get(regionId) || null;
};

export const getAdminRegionOptionsForCity = (cityId) => {
  const city = findAdminMarketCity(cityId) || findAdminMarketCity("agra");
  return city.regions.map((region) => ({
    id: region.id,
    label: region.label,
    cityId: city.cityId,
    workerCount: region.workerCount,
    activeJobs: region.activeJobs,
    lat: region.lat,
    lng: region.lng,
    readiness: Math.min(99, Math.round((region.workerCount * 4.5) + (region.activeJobs * 1.2))),
  }));
};

const buildDemoWorkers = (city, regions, selectedRegion) => {
  const focusRegions = selectedRegion ? [selectedRegion] : regions.slice(0, 5);

  return focusRegions.flatMap((region, regionIndex) => (
    Array.from({ length: Math.min(4, Math.max(2, Math.round(region.workerCount / 3))) }).map((_, index) => {
      const offsetMatrix = [
        [-0.0052, -0.0041],
        [0.0047, -0.0021],
        [0.0038, 0.0039],
        [-0.0034, 0.0045],
        [0.0018, -0.0058],
        [-0.0014, 0.0054],
      ];
      const offset = offsetMatrix[(regionIndex * 4 + index) % offsetMatrix.length];
      const position = offsetCoordinate(region.lat, region.lng, offset[0], offset[1]);
      const qualityScore = Math.min(98, 82 + (((regionIndex * 4) + index) * 4) % 14);
      const availability = index % 4 !== 0;

      return {
        id: `${region.id}-worker-${index + 1}`,
        name: `${city.cityLabel} Worker ${index + 1}`,
        lat: position.lat,
        lng: position.lng,
        status: availability ? "online" : "busy",
        qualityScore,
        regionName: region.label,
        workerCount: region.workerCount,
        activeJobs: Math.max(1, Math.round(region.activeJobs / Math.max(1, region.workerCount))),
      };
    })
  ));
};

export const buildAdminDemoMarketSnapshot = ({ cityId, regionId }) => {
  const selectedCityId = cityId || inferCityIdFromRegion(regionId) || "agra";
  const city = findAdminMarketCity(selectedCityId) || findAdminMarketCity("agra");
  const regions = getAdminRegionOptionsForCity(city.cityId);
  const selectedRegion = regions.find((region) => region.id === regionId) || null;
  const focusRegion = selectedRegion || regions[0] || null;
  const regionStats = focusRegion
    ? city.regions.find((region) => region.id === focusRegion.id) || city.regions[0]
    : city.regions[0];

  const aggregate = city.regions.reduce((acc, region) => ({
    workerCount: acc.workerCount + region.workerCount,
    activeJobs: acc.activeJobs + region.activeJobs,
    completedJobs: acc.completedJobs + region.completedJobs,
    revenue: acc.revenue + region.revenue,
    avgResponseAccumulator: acc.avgResponseAccumulator + region.avgResponseTime,
  }), {
    workerCount: 0,
    activeJobs: 0,
    completedJobs: 0,
    revenue: 0,
    avgResponseAccumulator: 0,
  });

  return {
    market: {
      cityId: city.cityId,
      cityLabel: city.cityLabel,
      regionId: selectedRegion?.id || null,
      regionLabel: selectedRegion?.label || null,
      state: city.state,
      stateCode: city.stateCode,
      country: city.country,
      tier: city.tier,
      regionGroup: city.regionGroup,
      readiness: city.readiness,
      mapCenter: focusRegion
        ? { lat: focusRegion.lat, lng: focusRegion.lng }
        : { lat: city.regions[0].lat, lng: city.regions[0].lng },
      zoom: selectedRegion ? 12.3 : city.zoom,
    },
    stats: {
      workerCount: selectedRegion ? regionStats.workerCount : aggregate.workerCount,
      activeJobs: selectedRegion ? regionStats.activeJobs : aggregate.activeJobs,
      completedJobs: selectedRegion ? regionStats.completedJobs : aggregate.completedJobs,
      revenue: selectedRegion ? regionStats.revenue : aggregate.revenue,
      avgResponseTime: selectedRegion
        ? regionStats.avgResponseTime
        : Math.round(aggregate.avgResponseAccumulator / Math.max(1, city.regions.length)),
    },
    workers: buildDemoWorkers(city, city.regions, selectedRegion ? regionStats : null),
    regions,
    dataMode: "demo",
  };
};
