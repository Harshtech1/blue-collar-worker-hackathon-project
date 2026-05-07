import { faker } from "@faker-js/faker";

export const SIMULATION_TOTAL_POINTS = 400_000;
export const SIMULATION_BATCH_SIZE = 10_000;
export const SIMULATION_BATCH_COUNT = SIMULATION_TOTAL_POINTS / SIMULATION_BATCH_SIZE;
export const SIMULATION_SEED = 20260507;

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
  Cleaning: [300, 1200],
  Carpentry: [650, 2600],
  Painting: [900, 4200],
  Appliance: [700, 3000],
  DeepCleaning: [1200, 4800],
  PestControl: [850, 2600],
};

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
  Cleaning: 0.05,
  Carpentry: 0.06,
  Painting: 0.04,
  Appliance: 0.11,
  DeepCleaning: 0.03,
  PestControl: 0.08,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

export const generateSimulationBatch = ({
  batchIndex,
  batchSize = SIMULATION_BATCH_SIZE,
}: {
  batchIndex: number;
  batchSize?: number;
}) => {
  faker.seed(SIMULATION_SEED + batchIndex);

  return Array.from({ length: batchSize }, () => {
    const sector = pickSector(batchIndex);
    const serviceType = pickWeighted(
      sector.serviceMix.map((service) => ({ value: service.type, weight: service.weight })),
    );
    const estimatedValue = toEstimatedValue(serviceType);
    const activeWorkersHint = Math.max(
      12,
      sector.baseWorkers + faker.number.int({ min: -12, max: 16 }),
    );
    const churnRisk = clamp(
      0.11 + ((1.05 - sector.historicalTraffic) * 0.12) + faker.number.float({ min: -0.02, max: 0.07 }),
      0.06,
      0.42,
    );
    const acquisitionCost = Math.round(
      sector.marketingEffort / 110
      + estimatedValue * 0.045
      + faker.number.float({ min: 25, max: 95 }),
    );
    const emergencyBias = emergencyBiasByService[serviceType] ?? 0.06;

    return {
      lat: Number(faker.location.latitude({ min: sector.latRange[0], max: sector.latRange[1], precision: 0.0001 })),
      lng: Number(faker.location.longitude({ min: sector.lngRange[0], max: sector.lngRange[1], precision: 0.0001 })),
      serviceType,
      timestamp: buildTimestamp(batchIndex),
      estimatedValue,
      areaSector: sector.label,
      marketingEffort: sector.marketingEffort + faker.number.int({ min: -450, max: 650 }),
      activeWorkersHint,
      historicalTraffic: Number((sector.historicalTraffic + faker.number.float({ min: -0.08, max: 0.11 })).toFixed(3)),
      acquisitionCost,
      churnRisk: Number(churnRisk.toFixed(3)),
      isEmergency: faker.number.float({ min: 0, max: 1 }) < emergencyBias,
    } satisfies SimulationBookingRequest;
  });
};
