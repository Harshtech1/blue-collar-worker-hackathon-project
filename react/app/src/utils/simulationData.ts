import { faker } from "@faker-js/faker";

export const SIMULATION_TOTAL_POINTS = 400_000;
export const SIMULATION_BATCH_SIZE = 10_000;
export const SIMULATION_BATCH_COUNT = SIMULATION_TOTAL_POINTS / SIMULATION_BATCH_SIZE;
export const SIMULATION_SEED = 20260507;
export type SimulationScenario = "baseline" | "monsoon" | "supply_crunch" | "price_war";
export const SIMULATION_SCENARIOS: Array<{
  id: SimulationScenario;
  label: string;
  blurb: string;
}> = [
  {
    id: "baseline",
    label: "Baseline",
    blurb: "Normal operating conditions with standard workforce mobility and balanced service demand.",
  },
  {
    id: "monsoon",
    label: "Monsoon Stress Test",
    blurb: "Emergency repair demand surges while transport friction and burnout pressure hit the city.",
  },
  {
    id: "supply_crunch",
    label: "Supply Shortage",
    blurb: "Worker availability crashes while high-priority service demand doubles across the command zone.",
  },
  {
    id: "price_war",
    label: "Market Competition Stress",
    blurb: "A discount-heavy competitor spikes CAC, pushes churn upward, and forces a profitability-floor response.",
  },
];

export interface SectorSeed {
  id: string;
  label: string;
  city: string;
  latRange: [number, number];
  lngRange: [number, number];
  demandWeight: number;
  surgeAffinity: number;
  baseWorkers: number;
  marketingEffort: number;
  historicalTraffic: number;
  serviceMix: Array<{ type: string; weight: number }>;
}

export interface GlobalSimulationCity {
  id: string;
  label: string;
  country: string;
  stateName?: string;
  stateCode?: string;
  lat: number;
  lng: number;
  demandScale: number;
  workerScale: number;
  emergencyScale: number;
  marketingScale: number;
  historicalTraffic: number;
  serviceMix: Array<{ type: string; weight: number }>;
}

export type MarketTier = "pilot" | "tier_1" | "tier_2" | "tier_3" | "international";

export interface MarketAddressContext {
  cityName?: string;
  stateName?: string;
  stateCode?: string;
  country?: string;
  locality?: string;
  displayName?: string;
}

export interface SimulationGeoConfig {
  cityId: string;
  cityLabel: string;
  stateName: string;
  stateCode: string;
  country: string;
  marketLabel: string;
  marketContext: string;
  cityTier: MarketTier;
  isExistingMarket: boolean;
  hasHistoricalData: boolean;
  center: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  demandScale: number;
  workerScale: number;
  emergencyScale: number;
  marketingScale: number;
  historicalTraffic: number;
  serviceMix: Array<{ type: string; weight: number }>;
}

export interface SimulationBookingRequest {
  lat: number;
  lng: number;
  serviceType: string;
  timestamp: string;
  estimatedValue: number;
  areaSector: string;
  marketingEffort: number;
  activeWorkersHint: number;
  historicalTraffic: number;
  acquisitionCost: number;
  churnRisk: number;
  isEmergency: boolean;
}

const SERVICE_VALUE_BANDS: Record<string, [number, number]> = {
  Plumbing: [450, 1800],
  Electrical: [550, 2200],
  Roofing: [1100, 5200],
  Cleaning: [300, 1200],
  Carpentry: [650, 2600],
  Painting: [900, 4200],
  Appliance: [700, 3000],
  DeepCleaning: [1200, 4800],
  PestControl: [850, 2600],
};

const DEFAULT_SERVICE_MIX = [
  { type: "Plumbing", weight: 18 },
  { type: "Electrical", weight: 17 },
  { type: "Roofing", weight: 4 },
  { type: "Cleaning", weight: 19 },
  { type: "Carpentry", weight: 12 },
  { type: "Painting", weight: 9 },
  { type: "Appliance", weight: 12 },
  { type: "DeepCleaning", weight: 7 },
  { type: "PestControl", weight: 6 },
];

const MARKET_TIER_PROFILES: Record<MarketTier, {
  demandScale: number;
  workerScale: number;
  emergencyScale: number;
  marketingScale: number;
  historicalTraffic: number;
}> = {
  pilot: {
    demandScale: 0.92,
    workerScale: 0.84,
    emergencyScale: 0.11,
    marketingScale: 0.9,
    historicalTraffic: 0.93,
  },
  tier_1: {
    demandScale: 1.34,
    workerScale: 1.21,
    emergencyScale: 0.15,
    marketingScale: 1.38,
    historicalTraffic: 1.24,
  },
  tier_2: {
    demandScale: 1.12,
    workerScale: 1.03,
    emergencyScale: 0.13,
    marketingScale: 1.14,
    historicalTraffic: 1.08,
  },
  tier_3: {
    demandScale: 0.98,
    workerScale: 0.91,
    emergencyScale: 0.1,
    marketingScale: 0.98,
    historicalTraffic: 0.97,
  },
  international: {
    demandScale: 1.2,
    workerScale: 1.08,
    emergencyScale: 0.12,
    marketingScale: 1.2,
    historicalTraffic: 1.12,
  },
};

const TIER_ONE_CITY_NAMES = new Set([
  "ahmedabad",
  "bengaluru",
  "bangalore",
  "chennai",
  "delhi",
  "north delhi",
  "new delhi",
  "gurugram",
  "hyderabad",
  "kolkata",
  "mumbai",
  "new delhi municipal council",
  "noida",
  "pune",
  "south delhi",
]);

const TIER_TWO_CITY_NAMES = new Set([
  "amritsar",
  "bhopal",
  "chandigarh",
  "coimbatore",
  "indore",
  "jaipur",
  "kochi",
  "ludhiana",
  "lucknow",
  "nagpur",
  "patna",
  "surat",
  "vadodara",
  "visakhapatnam",
]);

const KNOWN_CITY_ALIASES: Record<string, string> = {
  "bangalore": "bengaluru",
  "bengaluru urban": "bengaluru",
  "calcutta": "kolkata",
  "capital region chandigarh": "chandigarh",
  "delhi": "new-delhi",
  "north delhi": "north-delhi",
  "south delhi": "south-delhi",
  "nct of delhi": "new-delhi",
  "new delhi": "new-delhi",
  "agra district": "agra",
  "madras": "chennai",
  "national capital region noida": "noida",
  "west bengal": "kolkata",
};

const INDIAN_STATE_CODES: Record<string, string> = {
  "andhra pradesh": "AP",
  "arunachal pradesh": "AR",
  "assam": "AS",
  "bihar": "BR",
  "chandigarh": "CH",
  "chhattisgarh": "CG",
  "dadra and nagar haveli and daman and diu": "DN",
  "delhi": "DL",
  "goa": "GA",
  "gujarat": "GJ",
  "haryana": "HR",
  "himachal pradesh": "HP",
  "jammu and kashmir": "JK",
  "jharkhand": "JH",
  "karnataka": "KA",
  "kerala": "KL",
  "ladakh": "LA",
  "madhya pradesh": "MP",
  "maharashtra": "MH",
  "manipur": "MN",
  "meghalaya": "ML",
  "mizoram": "MZ",
  "nagaland": "NL",
  "odisha": "OD",
  "orissa": "OD",
  "puducherry": "PY",
  "punjab": "PB",
  "rajasthan": "RJ",
  "sikkim": "SK",
  "tamil nadu": "TN",
  "telangana": "TS",
  "tripura": "TR",
  "uttar pradesh": "UP",
  "uttarakhand": "UK",
  "west bengal": "WB",
};

export const DEFAULT_SIMULATION_CITY_ID = "agra";

export const GLOBAL_SIMULATION_CITIES: GlobalSimulationCity[] = [
  {
    id: "agra",
    label: "Agra",
    country: "India",
    stateName: "Uttar Pradesh",
    stateCode: "UP",
    lat: 27.1767,
    lng: 78.0081,
    demandScale: 0.92,
    workerScale: 0.84,
    emergencyScale: 0.11,
    marketingScale: 0.9,
    historicalTraffic: 0.93,
    serviceMix: [
      { type: "Cleaning", weight: 19 },
      { type: "Plumbing", weight: 18 },
      { type: "Electrical", weight: 16 },
      { type: "DeepCleaning", weight: 14 },
      { type: "Appliance", weight: 12 },
      { type: "PestControl", weight: 11 },
      { type: "Carpentry", weight: 6 },
      { type: "Painting", weight: 4 },
    ],
  },
  {
    id: "chandigarh",
    label: "Chandigarh",
    country: "India",
    stateName: "Punjab",
    stateCode: "PB",
    lat: 30.7333,
    lng: 76.7794,
    demandScale: 1.12,
    workerScale: 1.01,
    emergencyScale: 0.12,
    marketingScale: 1.14,
    historicalTraffic: 1.09,
    serviceMix: [
      { type: "Cleaning", weight: 18 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 16 },
      { type: "Appliance", weight: 14 },
      { type: "DeepCleaning", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 7 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "amritsar",
    label: "Amritsar",
    country: "India",
    stateName: "Punjab",
    stateCode: "PB",
    lat: 31.634,
    lng: 74.8723,
    demandScale: 1.09,
    workerScale: 0.99,
    emergencyScale: 0.11,
    marketingScale: 1.08,
    historicalTraffic: 1.03,
    serviceMix: [
      { type: "Cleaning", weight: 17 },
      { type: "Plumbing", weight: 18 },
      { type: "Electrical", weight: 15 },
      { type: "Appliance", weight: 13 },
      { type: "DeepCleaning", weight: 12 },
      { type: "PestControl", weight: 10 },
      { type: "Carpentry", weight: 8 },
      { type: "Painting", weight: 7 },
    ],
  },
  {
    id: "ludhiana",
    label: "Ludhiana",
    country: "India",
    stateName: "Punjab",
    stateCode: "PB",
    lat: 30.9009,
    lng: 75.8573,
    demandScale: 1.11,
    workerScale: 1.02,
    emergencyScale: 0.11,
    marketingScale: 1.09,
    historicalTraffic: 1.05,
    serviceMix: [
      { type: "Cleaning", weight: 18 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 15 },
      { type: "Appliance", weight: 13 },
      { type: "DeepCleaning", weight: 12 },
      { type: "PestControl", weight: 10 },
      { type: "Carpentry", weight: 9 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "lucknow",
    label: "Lucknow",
    country: "India",
    stateName: "Uttar Pradesh",
    stateCode: "UP",
    lat: 26.8467,
    lng: 80.9462,
    demandScale: 1.1,
    workerScale: 1,
    emergencyScale: 0.11,
    marketingScale: 1.07,
    historicalTraffic: 1.02,
    serviceMix: [
      { type: "Cleaning", weight: 18 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 16 },
      { type: "DeepCleaning", weight: 13 },
      { type: "Appliance", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 8 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "noida",
    label: "Noida",
    country: "India",
    stateName: "Uttar Pradesh",
    stateCode: "UP",
    lat: 28.5355,
    lng: 77.391,
    demandScale: 1.33,
    workerScale: 1.22,
    emergencyScale: 0.14,
    marketingScale: 1.34,
    historicalTraffic: 1.24,
    serviceMix: [
      { type: "Appliance", weight: 18 },
      { type: "Electrical", weight: 17 },
      { type: "Cleaning", weight: 16 },
      { type: "DeepCleaning", weight: 14 },
      { type: "Plumbing", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 7 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "chennai",
    label: "Chennai",
    country: "India",
    stateName: "Tamil Nadu",
    stateCode: "TN",
    lat: 13.0827,
    lng: 80.2707,
    demandScale: 1.29,
    workerScale: 1.2,
    emergencyScale: 0.14,
    marketingScale: 1.31,
    historicalTraffic: 1.21,
    serviceMix: [
      { type: "Appliance", weight: 17 },
      { type: "Electrical", weight: 17 },
      { type: "Cleaning", weight: 16 },
      { type: "Plumbing", weight: 15 },
      { type: "DeepCleaning", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Painting", weight: 7 },
      { type: "Carpentry", weight: 6 },
    ],
  },
  {
    id: "bengaluru",
    label: "Bengaluru",
    country: "India",
    stateName: "Karnataka",
    stateCode: "KA",
    lat: 12.9716,
    lng: 77.5946,
    demandScale: 1.28,
    workerScale: 1.22,
    emergencyScale: 0.13,
    marketingScale: 1.32,
    historicalTraffic: 1.24,
    serviceMix: [
      { type: "Appliance", weight: 18 },
      { type: "Electrical", weight: 17 },
      { type: "Cleaning", weight: 16 },
      { type: "DeepCleaning", weight: 14 },
      { type: "Plumbing", weight: 14 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 7 },
      { type: "Painting", weight: 5 },
    ],
  },
  {
    id: "kolkata",
    label: "Kolkata",
    country: "India",
    stateName: "West Bengal",
    stateCode: "WB",
    lat: 22.5726,
    lng: 88.3639,
    demandScale: 1.24,
    workerScale: 1.14,
    emergencyScale: 0.13,
    marketingScale: 1.22,
    historicalTraffic: 1.18,
    serviceMix: [
      { type: "Cleaning", weight: 18 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 16 },
      { type: "Appliance", weight: 14 },
      { type: "DeepCleaning", weight: 12 },
      { type: "PestControl", weight: 9 },
      { type: "Painting", weight: 8 },
      { type: "Carpentry", weight: 6 },
    ],
  },
  {
    id: "mumbai",
    label: "Mumbai",
    country: "India",
    stateName: "Maharashtra",
    stateCode: "MH",
    lat: 19.076,
    lng: 72.8777,
    demandScale: 1.42,
    workerScale: 1.31,
    emergencyScale: 0.16,
    marketingScale: 1.46,
    historicalTraffic: 1.34,
    serviceMix: [
      { type: "Cleaning", weight: 19 },
      { type: "DeepCleaning", weight: 16 },
      { type: "Plumbing", weight: 16 },
      { type: "Electrical", weight: 15 },
      { type: "Appliance", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 7 },
      { type: "Painting", weight: 5 },
    ],
  },
  {
    id: "new-delhi",
    label: "New Delhi",
    country: "India",
    stateName: "Delhi",
    stateCode: "DL",
    lat: 28.6139,
    lng: 77.209,
    demandScale: 1.38,
    workerScale: 1.29,
    emergencyScale: 0.15,
    marketingScale: 1.4,
    historicalTraffic: 1.29,
    serviceMix: [
      { type: "Cleaning", weight: 17 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 16 },
      { type: "Appliance", weight: 14 },
      { type: "DeepCleaning", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 8 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "north-delhi",
    label: "North Delhi",
    country: "India",
    stateName: "Delhi",
    stateCode: "DL",
    lat: 28.7041,
    lng: 77.1025,
    demandScale: 1.35,
    workerScale: 1.25,
    emergencyScale: 0.14,
    marketingScale: 1.35,
    historicalTraffic: 1.25,
    serviceMix: [
      { type: "Cleaning", weight: 17 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 16 },
      { type: "Appliance", weight: 14 },
      { type: "DeepCleaning", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 8 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "south-delhi",
    label: "South Delhi",
    country: "India",
    stateName: "Delhi",
    stateCode: "DL",
    lat: 28.5355,
    lng: 77.241,
    demandScale: 1.34,
    workerScale: 1.24,
    emergencyScale: 0.14,
    marketingScale: 1.36,
    historicalTraffic: 1.26,
    serviceMix: [
      { type: "Cleaning", weight: 17 },
      { type: "Plumbing", weight: 16 },
      { type: "Electrical", weight: 17 },
      { type: "Appliance", weight: 14 },
      { type: "DeepCleaning", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 8 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "dubai",
    label: "Dubai",
    country: "United Arab Emirates",
    lat: 25.2048,
    lng: 55.2708,
    demandScale: 1.33,
    workerScale: 1.18,
    emergencyScale: 0.14,
    marketingScale: 1.37,
    historicalTraffic: 1.26,
    serviceMix: [
      { type: "Appliance", weight: 18 },
      { type: "Electrical", weight: 17 },
      { type: "DeepCleaning", weight: 15 },
      { type: "Cleaning", weight: 15 },
      { type: "Plumbing", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Painting", weight: 8 },
      { type: "Carpentry", weight: 5 },
    ],
  },
  {
    id: "singapore",
    label: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    demandScale: 1.18,
    workerScale: 1.12,
    emergencyScale: 0.1,
    marketingScale: 1.26,
    historicalTraffic: 1.22,
    serviceMix: [
      { type: "Cleaning", weight: 21 },
      { type: "Appliance", weight: 16 },
      { type: "Electrical", weight: 15 },
      { type: "Plumbing", weight: 13 },
      { type: "DeepCleaning", weight: 13 },
      { type: "PestControl", weight: 9 },
      { type: "Carpentry", weight: 7 },
      { type: "Painting", weight: 6 },
    ],
  },
  {
    id: "london",
    label: "London",
    country: "United Kingdom",
    lat: 51.5072,
    lng: -0.1276,
    demandScale: 1.21,
    workerScale: 1.08,
    emergencyScale: 0.12,
    marketingScale: 1.22,
    historicalTraffic: 1.16,
    serviceMix: [
      { type: "Plumbing", weight: 18 },
      { type: "Electrical", weight: 17 },
      { type: "Cleaning", weight: 16 },
      { type: "Appliance", weight: 15 },
      { type: "DeepCleaning", weight: 11 },
      { type: "Painting", weight: 9 },
      { type: "Carpentry", weight: 8 },
      { type: "PestControl", weight: 6 },
    ],
  },
  {
    id: "new-york",
    label: "New York",
    country: "United States",
    lat: 40.7128,
    lng: -74.006,
    demandScale: 1.35,
    workerScale: 1.15,
    emergencyScale: 0.15,
    marketingScale: 1.41,
    historicalTraffic: 1.31,
    serviceMix: [
      { type: "Cleaning", weight: 19 },
      { type: "Plumbing", weight: 17 },
      { type: "Electrical", weight: 16 },
      { type: "Appliance", weight: 14 },
      { type: "DeepCleaning", weight: 12 },
      { type: "PestControl", weight: 9 },
      { type: "Painting", weight: 7 },
      { type: "Carpentry", weight: 6 },
    ],
  },
  {
    id: "sao-paulo",
    label: "Sao Paulo",
    country: "Brazil",
    lat: -23.5505,
    lng: -46.6333,
    demandScale: 1.24,
    workerScale: 1.09,
    emergencyScale: 0.13,
    marketingScale: 1.18,
    historicalTraffic: 1.14,
    serviceMix: [
      { type: "Cleaning", weight: 18 },
      { type: "Electrical", weight: 16 },
      { type: "Plumbing", weight: 16 },
      { type: "Appliance", weight: 14 },
      { type: "Painting", weight: 11 },
      { type: "Carpentry", weight: 10 },
      { type: "PestControl", weight: 9 },
      { type: "DeepCleaning", weight: 6 },
    ],
  },
];

export const sectorSeeds: SectorSeed[] = [
  {
    id: "agra-cantt",
    label: "Agra Cantt",
    city: "Agra",
    latRange: [27.154, 27.174],
    lngRange: [77.978, 78.004],
    demandWeight: 1.3,
    surgeAffinity: 1.18,
    baseWorkers: 118,
    marketingEffort: 14800,
    historicalTraffic: 1.42,
    serviceMix: [
      { type: "Plumbing", weight: 22 },
      { type: "Electrical", weight: 18 },
      { type: "Cleaning", weight: 20 },
      { type: "DeepCleaning", weight: 15 },
      { type: "Appliance", weight: 12 },
      { type: "PestControl", weight: 13 },
    ],
  },
  {
    id: "taj-ganj",
    label: "Taj Ganj",
    city: "Agra",
    latRange: [27.162, 27.183],
    lngRange: [78.032, 78.06],
    demandWeight: 1.52,
    surgeAffinity: 1.26,
    baseWorkers: 132,
    marketingEffort: 17200,
    historicalTraffic: 1.56,
    serviceMix: [
      { type: "Cleaning", weight: 24 },
      { type: "DeepCleaning", weight: 20 },
      { type: "Plumbing", weight: 16 },
      { type: "Electrical", weight: 14 },
      { type: "Appliance", weight: 14 },
      { type: "PestControl", weight: 12 },
    ],
  },
  {
    id: "fatehabad-road",
    label: "Fatehabad Road",
    city: "Agra",
    latRange: [27.151, 27.196],
    lngRange: [78.028, 78.094],
    demandWeight: 1.22,
    surgeAffinity: 1.11,
    baseWorkers: 102,
    marketingEffort: 13600,
    historicalTraffic: 1.34,
    serviceMix: [
      { type: "Appliance", weight: 18 },
      { type: "Electrical", weight: 21 },
      { type: "Plumbing", weight: 16 },
      { type: "Carpentry", weight: 15 },
      { type: "Cleaning", weight: 18 },
      { type: "Painting", weight: 12 },
    ],
  },
  {
    id: "sikandra",
    label: "Sikandra",
    city: "Agra",
    latRange: [27.196, 27.229],
    lngRange: [77.936, 77.979],
    demandWeight: 0.86,
    surgeAffinity: 0.94,
    baseWorkers: 74,
    marketingEffort: 9200,
    historicalTraffic: 0.94,
    serviceMix: [
      { type: "Painting", weight: 18 },
      { type: "Carpentry", weight: 22 },
      { type: "Electrical", weight: 17 },
      { type: "Plumbing", weight: 16 },
      { type: "Cleaning", weight: 15 },
      { type: "PestControl", weight: 12 },
    ],
  },
  {
    id: "dayalbagh",
    label: "Dayal Bagh",
    city: "Agra",
    latRange: [27.221, 27.254],
    lngRange: [78.002, 78.038],
    demandWeight: 0.82,
    surgeAffinity: 0.88,
    baseWorkers: 68,
    marketingEffort: 8600,
    historicalTraffic: 0.88,
    serviceMix: [
      { type: "Cleaning", weight: 20 },
      { type: "Plumbing", weight: 18 },
      { type: "Electrical", weight: 15 },
      { type: "Carpentry", weight: 16 },
      { type: "Painting", weight: 17 },
      { type: "PestControl", weight: 14 },
    ],
  },
  {
    id: "civil-lines",
    label: "Civil Lines",
    city: "Agra",
    latRange: [27.187, 27.209],
    lngRange: [78.005, 78.03],
    demandWeight: 1.07,
    surgeAffinity: 1.04,
    baseWorkers: 82,
    marketingEffort: 11800,
    historicalTraffic: 1.16,
    serviceMix: [
      { type: "DeepCleaning", weight: 18 },
      { type: "Cleaning", weight: 17 },
      { type: "Electrical", weight: 18 },
      { type: "Appliance", weight: 18 },
      { type: "Plumbing", weight: 15 },
      { type: "PestControl", weight: 14 },
    ],
  },
  {
    id: "trans-yamuna",
    label: "Trans Yamuna",
    city: "Agra",
    latRange: [27.167, 27.22],
    lngRange: [78.07, 78.132],
    demandWeight: 0.72,
    surgeAffinity: 0.81,
    baseWorkers: 56,
    marketingEffort: 7200,
    historicalTraffic: 0.79,
    serviceMix: [
      { type: "Plumbing", weight: 19 },
      { type: "Cleaning", weight: 21 },
      { type: "Electrical", weight: 15 },
      { type: "PestControl", weight: 17 },
      { type: "Carpentry", weight: 15 },
      { type: "Painting", weight: 13 },
    ],
  },
  {
    id: "shamshabad-road",
    label: "Shamshabad Road",
    city: "Agra",
    latRange: [27.115, 27.17],
    lngRange: [77.97, 78.02],
    demandWeight: 0.69,
    surgeAffinity: 0.76,
    baseWorkers: 48,
    marketingEffort: 6400,
    historicalTraffic: 0.74,
    serviceMix: [
      { type: "Cleaning", weight: 18 },
      { type: "Plumbing", weight: 18 },
      { type: "Electrical", weight: 15 },
      { type: "Painting", weight: 17 },
      { type: "Carpentry", weight: 17 },
      { type: "PestControl", weight: 15 },
    ],
  },
];

const emergencyBiasByService: Record<string, number> = {
  Plumbing: 0.18,
  Electrical: 0.15,
  Roofing: 0.22,
  Cleaning: 0.05,
  Carpentry: 0.06,
  Painting: 0.04,
  Appliance: 0.11,
  DeepCleaning: 0.03,
  PestControl: 0.08,
};

const monsoonServiceMultiplier: Record<string, number> = {
  Plumbing: 2,
  Roofing: 2,
  Electrical: 2,
  Appliance: 1.2,
  PestControl: 1.12,
  Cleaning: 0.72,
  DeepCleaning: 0.66,
  Painting: 0.52,
  Carpentry: 0.82,
};

const supplyCrunchServiceMultiplier: Record<string, number> = {
  Plumbing: 2.2,
  Electrical: 2.05,
  Roofing: 1.9,
  Appliance: 1.8,
  PestControl: 1.45,
  DeepCleaning: 0.78,
  Cleaning: 0.74,
  Painting: 0.58,
  Carpentry: 0.72,
};

const priceWarServiceMultiplier: Record<string, number> = {
  Cleaning: 1.34,
  DeepCleaning: 1.48,
  Appliance: 1.22,
  PestControl: 1.16,
  Carpentry: 1.08,
  Plumbing: 0.96,
  Electrical: 0.94,
  Roofing: 0.84,
  Painting: 0.9,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeGeoToken = (value: string | undefined | null) => (
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
);

const slugifyMarketId = (value: string) => (
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "market"
);

const toTitleCase = (value: string) => (
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
);

const resolveIndianStateCode = (stateName: string, fallbackCode = "") => {
  const normalized = normalizeGeoToken(stateName);
  if (normalized && INDIAN_STATE_CODES[normalized]) {
    return INDIAN_STATE_CODES[normalized];
  }

  if (fallbackCode) {
    return fallbackCode.toUpperCase().replace(/^IN-/, "").slice(-2);
  }

  const initials = stateName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);

  return initials;
};

const resolveKnownSimulationCityByLabel = (cityName: string) => {
  const normalized = normalizeGeoToken(cityName);
  const aliasId = KNOWN_CITY_ALIASES[normalized];
  if (aliasId) {
    return getGlobalSimulationCity(aliasId);
  }

  return GLOBAL_SIMULATION_CITIES.find((city) => normalizeGeoToken(city.label) === normalized) || null;
};

const resolveMarketTier = (cityName: string, country: string, existingMarket: boolean): MarketTier => {
  if (existingMarket) return "pilot";

  const normalizedCity = normalizeGeoToken(cityName);
  if (normalizeGeoToken(country) !== "india") {
    return "international";
  }

  if (TIER_ONE_CITY_NAMES.has(normalizedCity)) {
    return "tier_1";
  }

  if (TIER_TWO_CITY_NAMES.has(normalizedCity)) {
    return "tier_2";
  }

  return "tier_3";
};

const buildMarketContext = ({
  cityName,
  stateName,
  stateCode,
  country,
  cityTier,
  isExistingMarket,
  hasHistoricalData,
  radiusKm,
}: {
  cityName: string;
  stateName: string;
  stateCode: string;
  country: string;
  cityTier: MarketTier;
  isExistingMarket: boolean;
  hasHistoricalData: boolean;
  radiusKm: number;
}) => {
  const operatingMode = isExistingMarket
    ? "Existing pilot optimization"
    : "Market entry expansion";
  const tierLabel = cityTier === "pilot"
    ? "pilot market"
    : cityTier === "tier_1"
      ? "Tier-1 metro"
      : cityTier === "tier_2"
        ? "Tier-2 growth market"
        : cityTier === "tier_3"
          ? "emerging market"
          : "international city";
  const historyLabel = hasHistoricalData
    ? "historical order density is available"
    : "historical orders are unavailable, so synthetic launch modeling must lead";
  const stateLabel = stateCode || stateName
    ? `${stateName}${stateCode ? ` (${stateCode})` : ""}`
    : country;

  return `${operatingMode}. ${toTitleCase(cityName)} in ${stateLabel} is being evaluated as a ${tierLabel} inside a ${radiusKm.toFixed(0)} km command radius, and ${historyLabel}.`;
};

interface VirtualSectorSeed {
  id: string;
  label: string;
  city: string;
  demandWeight: number;
  surgeAffinity: number;
  baseWorkers: number;
  marketingEffort: number;
  historicalTraffic: number;
  serviceMix: Array<{ type: string; weight: number }>;
  radiusBandKm: [number, number];
  bearingBand: [number, number];
}

const EARTH_RADIUS_KM = 6371;

const RING_BLUEPRINTS = [
  { id: "core", label: "Core", minFactor: 0, maxFactor: 0.34, demandWeight: 1.32, workerFactor: 1.18, marketingFactor: 1.22, historicalBoost: 0.08 },
  { id: "inner", label: "Inner Ring", minFactor: 0.34, maxFactor: 0.68, demandWeight: 1.05, workerFactor: 1, marketingFactor: 1, historicalBoost: 0.03 },
  { id: "outer", label: "Outer Ring", minFactor: 0.68, maxFactor: 1, demandWeight: 0.8, workerFactor: 0.78, marketingFactor: 0.84, historicalBoost: -0.04 },
] as const;

const DIRECTION_BLUEPRINTS = [
  { id: "n", label: "North", minBearing: 337.5, maxBearing: 22.5, demandWeight: 1.04 },
  { id: "ne", label: "North East", minBearing: 22.5, maxBearing: 67.5, demandWeight: 1.06 },
  { id: "e", label: "East", minBearing: 67.5, maxBearing: 112.5, demandWeight: 1.05 },
  { id: "se", label: "South East", minBearing: 112.5, maxBearing: 157.5, demandWeight: 1 },
  { id: "s", label: "South", minBearing: 157.5, maxBearing: 202.5, demandWeight: 0.97 },
  { id: "sw", label: "South West", minBearing: 202.5, maxBearing: 247.5, demandWeight: 0.94 },
  { id: "w", label: "West", minBearing: 247.5, maxBearing: 292.5, demandWeight: 0.98 },
  { id: "nw", label: "North West", minBearing: 292.5, maxBearing: 337.5, demandWeight: 1.02 },
] as const;

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const toRadians = (value: number) => value * (Math.PI / 180);
const toDegrees = (value: number) => value * (180 / Math.PI);

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

  return {
    lat: Number(toDegrees(nextLat).toFixed(6)),
    lng: Number((((toDegrees(nextLng) + 540) % 360) - 180).toFixed(6)),
  };
};

const getDefaultServiceMix = () => DEFAULT_SERVICE_MIX.map((service) => ({ ...service }));

const getScenarioServiceMix = (
  serviceMix: Array<{ type: string; weight: number }>,
  scenario: SimulationScenario,
) => {
  if (scenario === "baseline") {
    return serviceMix.map((service) => ({ ...service }));
  }

  if (scenario === "supply_crunch") {
    const weightedMix = serviceMix.map((service) => ({
      type: service.type,
      weight: Number((service.weight * (supplyCrunchServiceMultiplier[service.type] ?? 1)).toFixed(2)),
    }));

    if (!weightedMix.some((service) => service.type === "Roofing")) {
      weightedMix.push({ type: "Roofing", weight: 12 });
    }

    return weightedMix;
  }

  if (scenario === "price_war") {
    return serviceMix.map((service) => ({
      type: service.type,
      weight: Number((service.weight * (priceWarServiceMultiplier[service.type] ?? 1)).toFixed(2)),
    }));
  }

  const weightedMix = serviceMix.map((service) => ({
    type: service.type,
    weight: Number((service.weight * (monsoonServiceMultiplier[service.type] ?? 1)).toFixed(2)),
  }));

  if (!weightedMix.some((service) => service.type === "Roofing")) {
    weightedMix.push({ type: "Roofing", weight: 10 });
  }

  return weightedMix;
};

export const getGlobalSimulationCity = (cityId: string) => (
  GLOBAL_SIMULATION_CITIES.find((city) => city.id === cityId)
  || GLOBAL_SIMULATION_CITIES.find((city) => city.id === DEFAULT_SIMULATION_CITY_ID)
  || GLOBAL_SIMULATION_CITIES[0]
);

export const buildDynamicSimulationGeoConfig = ({
  center,
  radiusKm = 12,
  address,
  fallbackCityId,
}: {
  center: { lat: number; lng: number };
  radiusKm?: number;
  address?: MarketAddressContext;
  fallbackCityId?: string;
}): SimulationGeoConfig => {
  const fallbackCity = fallbackCityId ? getGlobalSimulationCity(fallbackCityId) : null;
  const resolvedCityName = address?.cityName?.trim()
    || fallbackCity?.label
    || "Command Market";
  const resolvedCountry = address?.country?.trim()
    || fallbackCity?.country
    || "India";
  const matchedKnownCity = resolveKnownSimulationCityByLabel(resolvedCityName);
  const matchedCity = matchedKnownCity
    || (!address?.cityName?.trim() ? fallbackCity : null);
  const isExistingMarket = matchedCity?.id === DEFAULT_SIMULATION_CITY_ID;
  const cityTier = resolveMarketTier(resolvedCityName, resolvedCountry, isExistingMarket);
  const profile = MARKET_TIER_PROFILES[cityTier];
  const stateName = address?.stateName?.trim()
    || matchedCity?.stateName
    || "";
  const stateCode = resolveIndianStateCode(
    stateName,
    address?.stateCode || matchedCity?.stateCode || "",
  );
  const cityId = matchedCity?.id
    || slugifyMarketId(`${resolvedCityName}-${stateCode || resolvedCountry}`);
  const cityLabel = matchedCity?.label || toTitleCase(resolvedCityName);
  const nextRadiusKm = clamp(Number(radiusKm.toFixed(1)), 1, 50);
  const demandScale = matchedCity?.demandScale ?? profile.demandScale;
  const workerScale = matchedCity?.workerScale ?? profile.workerScale;
  const emergencyScale = matchedCity?.emergencyScale ?? profile.emergencyScale;
  const marketingScale = matchedCity?.marketingScale ?? profile.marketingScale;
  const historicalTraffic = matchedCity?.historicalTraffic ?? profile.historicalTraffic;
  const serviceMix = matchedCity?.serviceMix?.length
    ? matchedCity.serviceMix.map((service) => ({ ...service }))
    : getDefaultServiceMix();
  const marketLabel = address?.displayName?.trim()
    || [cityLabel, stateCode || stateName, resolvedCountry].filter(Boolean).join(", ");

  return {
    cityId,
    cityLabel,
    stateName,
    stateCode,
    country: resolvedCountry,
    marketLabel,
    marketContext: buildMarketContext({
      cityName: cityLabel,
      stateName,
      stateCode,
      country: resolvedCountry,
      cityTier,
      isExistingMarket,
      hasHistoricalData: isExistingMarket,
      radiusKm: nextRadiusKm,
    }),
    cityTier,
    isExistingMarket,
    hasHistoricalData: isExistingMarket,
    center: {
      lat: Number(center.lat.toFixed(6)),
      lng: Number(center.lng.toFixed(6)),
    },
    radiusKm: nextRadiusKm,
    demandScale,
    workerScale,
    emergencyScale,
    marketingScale,
    historicalTraffic,
    serviceMix,
  };
};

export const buildSimulationGeoConfig = ({
  cityId = DEFAULT_SIMULATION_CITY_ID,
  center,
  radiusKm = 12,
}: {
  cityId?: string;
  center?: { lat: number; lng: number };
  radiusKm?: number;
} = {}): SimulationGeoConfig => {
  const city = getGlobalSimulationCity(cityId);

  return buildDynamicSimulationGeoConfig({
    center: {
      lat: center?.lat ?? city.lat,
      lng: center?.lng ?? city.lng,
    },
    radiusKm,
    fallbackCityId: city.id,
    address: {
      cityName: city.label,
      stateName: city.stateName,
      stateCode: city.stateCode,
      country: city.country,
      displayName: [city.label, city.stateCode || city.stateName, city.country].filter(Boolean).join(", "),
    },
  });
};

const buildVirtualSectors = (geoConfig: SimulationGeoConfig): VirtualSectorSeed[] => (
  RING_BLUEPRINTS.flatMap((ring) => (
    DIRECTION_BLUEPRINTS.map((direction) => ({
      id: `${geoConfig.cityId}-${ring.id}-${direction.id}`,
      label: `${geoConfig.cityLabel} ${ring.label} ${direction.label}`,
      city: geoConfig.cityLabel,
      demandWeight: geoConfig.demandScale * ring.demandWeight * direction.demandWeight,
      surgeAffinity: 1 + ((geoConfig.demandScale - 1) * 0.18) + ((ring.demandWeight - 1) * 0.16),
      baseWorkers: Math.max(18, Math.round((52 + (geoConfig.workerScale * 38)) * ring.workerFactor)),
      marketingEffort: Math.round((7800 + (geoConfig.marketingScale * 5200)) * ring.marketingFactor),
      historicalTraffic: Number((geoConfig.historicalTraffic + ring.historicalBoost).toFixed(3)),
      serviceMix: geoConfig.serviceMix.length > 0 ? geoConfig.serviceMix : getDefaultServiceMix(),
      radiusBandKm: [
        Number((geoConfig.radiusKm * ring.minFactor).toFixed(3)),
        Number((geoConfig.radiusKm * ring.maxFactor).toFixed(3)),
      ],
      bearingBand: [direction.minBearing, direction.maxBearing],
    }))
  ))
);

const pickWeighted = <T,>(items: Array<{ value: T; weight: number }>) => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let threshold = faker.number.float({ min: 0, max: totalWeight });

  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1]?.value ?? items[0]?.value;
};

const toEstimatedValue = (serviceType: string) => {
  const [min, max] = SERVICE_VALUE_BANDS[serviceType] ?? [450, 1400];
  return faker.number.int({ min, max });
};

const buildTimestamp = (batchIndex: number) => {
  const now = Date.now();
  const lookbackMs = 180 * 24 * 60 * 60 * 1000;
  const recencyBias = 1 - (batchIndex / SIMULATION_BATCH_COUNT) * 0.35;
  const timeOffset = faker.number.int({ min: 0, max: Math.round(lookbackMs * recencyBias) });
  const timestamp = new Date(now - timeOffset);
  timestamp.setHours(
    faker.number.int({ min: 6, max: 22 }),
    faker.number.int({ min: 0, max: 59 }),
    faker.number.int({ min: 0, max: 59 }),
    0,
  );

  return timestamp.toISOString();
};

const pickSector = (batchIndex: number) => {
  const wave = 1 + (Math.sin((batchIndex / SIMULATION_BATCH_COUNT) * Math.PI * 1.6) * 0.18);
  return pickWeighted(
    sectorSeeds.map((sector) => ({
      value: sector,
      weight: sector.demandWeight * (sector.surgeAffinity * wave),
    })),
  );
};

const pickVirtualSector = (batchIndex: number, sectors: VirtualSectorSeed[]) => {
  const wave = 1 + (Math.sin((batchIndex / SIMULATION_BATCH_COUNT) * Math.PI * 1.8) * 0.22);
  return pickWeighted(
    sectors.map((sector) => ({
      value: sector,
      weight: sector.demandWeight * (sector.surgeAffinity * wave),
    })),
  );
};

const randomBearingInBand = ([minBearing, maxBearing]: [number, number]) => {
  if (minBearing <= maxBearing) {
    return faker.number.float({ min: minBearing, max: maxBearing });
  }

  const wrapSpan = (360 - minBearing) + maxBearing;
  const offset = faker.number.float({ min: 0, max: wrapSpan });
  return offset <= (360 - minBearing)
    ? minBearing + offset
    : offset - (360 - minBearing);
};

const sampleGaussianUnit = () => {
  const u = faker.number.float({ min: 0.0001, max: 0.9999 });
  const v = faker.number.float({ min: 0.0001, max: 0.9999 });
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const sampleDistanceInBand = ([innerRadiusKm, outerRadiusKm]: [number, number]) => {
  const safeOuter = Math.max(innerRadiusKm + 0.05, outerRadiusKm);
  const bandWidth = safeOuter - innerRadiusKm;
  const meanDistance = innerRadiusKm + (bandWidth * 0.38);
  const deviation = Math.max(0.05, bandWidth * 0.24);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = meanDistance + (sampleGaussianUnit() * deviation);
    if (candidate >= innerRadiusKm && candidate <= safeOuter) {
      return candidate;
    }
  }

  return clamp(meanDistance + Math.abs(sampleGaussianUnit() * deviation), innerRadiusKm, safeOuter);
};

export const generateSimulationBatch = ({
  batchIndex,
  batchSize = SIMULATION_BATCH_SIZE,
  geoConfig,
  scenario = "baseline",
}: {
  batchIndex: number;
  batchSize?: number;
  geoConfig?: SimulationGeoConfig;
  scenario?: SimulationScenario;
}) => {
  const geoSeed = geoConfig
    ? hashString(`${geoConfig.cityId}:${geoConfig.center.lat.toFixed(4)}:${geoConfig.center.lng.toFixed(4)}:${geoConfig.radiusKm.toFixed(1)}:${scenario}`)
    : 0;
  faker.seed(SIMULATION_SEED + batchIndex + geoSeed);
  const isMonsoon = scenario === "monsoon";
  const isSupplyCrunch = scenario === "supply_crunch";
  const isPriceWar = scenario === "price_war";

  if (!geoConfig) {
    return Array.from({ length: batchSize }, () => {
      const sector = pickSector(batchIndex);
      const serviceMix = getScenarioServiceMix(sector.serviceMix, scenario);
      const serviceType = pickWeighted(
        serviceMix.map((service) => ({ value: service.type, weight: service.weight })),
      );
      const estimatedValue = toEstimatedValue(serviceType);
      const activeWorkersHint = Math.max(
        12,
        Math.round((sector.baseWorkers + faker.number.int({ min: -12, max: 16 })) * (isSupplyCrunch ? 0.52 : 1)),
      );
      const churnRisk = clamp(
        0.11
        + ((1.05 - sector.historicalTraffic) * 0.12)
        + faker.number.float({ min: -0.02, max: 0.07 })
        + (isMonsoon ? 0.03 : 0)
        + (isSupplyCrunch ? 0.08 : 0)
        + (isPriceWar ? 0.12 : 0),
        0.06,
        isPriceWar ? 0.68 : isSupplyCrunch ? 0.58 : isMonsoon ? 0.46 : 0.42,
      );
      const acquisitionCost = Math.round(
        (isPriceWar ? 2.75 : isSupplyCrunch ? 1.18 : isMonsoon ? 1.08 : 1) * (
          sector.marketingEffort / 110
        + estimatedValue * 0.045
        + faker.number.float({ min: 25, max: 95 })
        ),
      );
      const emergencyBias = clamp(
        (emergencyBiasByService[serviceType] ?? 0.06)
        + (isMonsoon ? 0.12 : 0)
        + (isSupplyCrunch ? 0.08 : 0),
        0.04,
        isSupplyCrunch ? 0.6 : 0.52,
      );

      return {
        lat: Number(faker.location.latitude({ min: sector.latRange[0], max: sector.latRange[1], precision: 4 })),
        lng: Number(faker.location.longitude({ min: sector.lngRange[0], max: sector.lngRange[1], precision: 4 })),
        serviceType,
        timestamp: buildTimestamp(batchIndex),
        estimatedValue,
        areaSector: sector.label,
        marketingEffort: Math.round((sector.marketingEffort + faker.number.int({ min: -450, max: 650 })) * (isPriceWar ? 1.55 : isSupplyCrunch ? 1.2 : isMonsoon ? 1.08 : 1)),
        activeWorkersHint,
        historicalTraffic: Number((sector.historicalTraffic + faker.number.float({ min: -0.08, max: 0.11 }) + (isMonsoon ? 0.04 : 0) + (isSupplyCrunch ? 0.06 : 0) + (isPriceWar ? 0.05 : 0)).toFixed(3)),
        acquisitionCost,
        churnRisk: Number(churnRisk.toFixed(3)),
        isEmergency: faker.number.float({ min: 0, max: 1 }) < emergencyBias,
      } satisfies SimulationBookingRequest;
    });
  }

  const virtualSectors = buildVirtualSectors(geoConfig);

  return Array.from({ length: batchSize }, () => {
    const sector = pickVirtualSector(batchIndex, virtualSectors);
    const serviceMix = getScenarioServiceMix(sector.serviceMix, scenario);
    const serviceType = pickWeighted(
      serviceMix.map((service) => ({ value: service.type, weight: service.weight })),
    );
    const estimatedValue = toEstimatedValue(serviceType);
    const activeWorkersHint = Math.max(
      18,
      Math.round((sector.baseWorkers + faker.number.int({ min: -14, max: 22 })) * (isSupplyCrunch ? 0.5 : 1)),
    );
    const distanceKm = sampleDistanceInBand(sector.radiusBandKm);
    const bearingDeg = randomBearingInBand(sector.bearingBand);
    const location = offsetCoordinate(geoConfig.center.lat, geoConfig.center.lng, distanceKm, bearingDeg);
    const churnRisk = clamp(
      0.1
      + ((1.08 - sector.historicalTraffic) * 0.12)
      + ((1.05 - geoConfig.workerScale) * 0.06)
      + faker.number.float({ min: -0.02, max: 0.08 })
      + (isMonsoon ? 0.03 : 0)
      + (isSupplyCrunch ? 0.08 : 0)
      + (isPriceWar ? 0.12 : 0),
      0.05,
      isPriceWar ? 0.68 : isSupplyCrunch ? 0.58 : 0.46,
    );
    const normalizedChurnRisk = clamp(
      churnRisk,
      0.05,
      isPriceWar ? 0.7 : isSupplyCrunch ? 0.6 : isMonsoon ? 0.5 : 0.46,
    );
    const acquisitionCost = Math.round(
      (isPriceWar ? 2.75 : isSupplyCrunch ? 1.18 : isMonsoon ? 1.08 : 1) * (
        (sector.marketingEffort / (115 + (geoConfig.workerScale * 18)))
      + (estimatedValue * 0.045)
      + faker.number.float({ min: 25, max: 105 })
      ),
    );
    const emergencyBias = clamp(
      (emergencyBiasByService[serviceType] ?? 0.06)
      + geoConfig.emergencyScale
      + (isMonsoon ? 0.14 : 0)
      + (isSupplyCrunch ? 0.1 : 0),
      0.04,
      isSupplyCrunch ? 0.62 : isMonsoon ? 0.58 : 0.34,
    );

    return {
      lat: location.lat,
      lng: location.lng,
      serviceType,
      timestamp: buildTimestamp(batchIndex),
      estimatedValue,
      areaSector: sector.label,
      marketingEffort: Math.round((sector.marketingEffort + faker.number.int({ min: -520, max: 760 })) * (isPriceWar ? 1.58 : isSupplyCrunch ? 1.22 : isMonsoon ? 1.08 : 1)),
      activeWorkersHint,
      historicalTraffic: Number((sector.historicalTraffic + faker.number.float({ min: -0.06, max: 0.1 }) + (isMonsoon ? 0.04 : 0) + (isSupplyCrunch ? 0.08 : 0) + (isPriceWar ? 0.05 : 0)).toFixed(3)),
      acquisitionCost,
      churnRisk: Number(normalizedChurnRisk.toFixed(3)),
      isEmergency: faker.number.float({ min: 0, max: 1 }) < emergencyBias,
    } satisfies SimulationBookingRequest;
  });
};
