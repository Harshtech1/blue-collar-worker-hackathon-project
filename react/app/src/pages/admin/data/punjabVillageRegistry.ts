import rawPunjabVillageRegistry from "./punjabVillageRegistry.generated.json";

export interface PunjabVillageMetrics {
  popDensity: number;
  domesticPowerHours: number;
  hhSize: number;
  agriPowerHours: number;
  laborAvailabilityIndex: number;
  connectivityStability: number;
  infrastructureGapScore: number;
  villageReadinessScore: number;
  projectedCac: number;
  sanitationGap: number;
  openDrainage: boolean;
  wasteDisposalAvailable: boolean;
  biogasAvailable: boolean;
  vetHospitalAvailable: boolean;
  methaneIndex: number;
  methaneValue: number;
  wasteLoadingScore: number;
  agriEnergyProxy: number;
  deltas: {
    popDensity: number;
    domesticPowerHours: number;
    hhSize: number;
    laborAvailabilityIndex: number;
    connectivityStability: number;
    villageReadinessScore: number;
    projectedCac: number;
  };
}

export interface PunjabVillageEntry {
  id: string;
  villageCode: string;
  slug: string;
  label: string;
  districtSlug: string;
  districtLabel: string;
  centerCoords: [number, number];
  zoomLevel: number;
  readinessScore: number;
  metrics: PunjabVillageMetrics;
}

export interface PunjabDistrictEntry {
  slug: string;
  label: string;
  villageCount: number;
  centerCoords: [number, number];
  zoomLevel: number;
  readinessScore: number;
}

export interface PunjabVillageRegistry {
  meta: {
    slug: string;
    label: string;
    code: string;
    country: string;
    level2Label: string;
    level3Label: string;
    level2Kind: string;
    level3Kind: string;
    totalRows: number;
    totalDistricts: number;
    totalVillages: number;
    distinctNamedVillages: number;
    generatedAt: string;
    averages: {
      popDensity: number;
      domesticPowerHours: number;
      hhSize: number;
      agriPowerHours: number;
      sanitationGap: number;
      openDrainageShare: number;
      wasteDisposalCoverage: number;
      biogasAvailability: number;
    };
    ranges: {
      popDensity: { min: number; max: number };
      domesticPowerHours: { min: number; max: number };
      hhSize: { min: number; max: number };
    };
  };
  districts: PunjabDistrictEntry[];
  districtVillageIds: Record<string, string[]>;
  villages: PunjabVillageEntry[];
}

const toCoordinatePair = (coords: number[]): [number, number] => [
  Number(coords[0] ?? 0),
  Number(coords[1] ?? 0),
];

export const PUNJAB_VILLAGE_REGISTRY = {
  ...rawPunjabVillageRegistry,
  districts: rawPunjabVillageRegistry.districts.map((district) => ({
    ...district,
    centerCoords: toCoordinatePair(district.centerCoords),
  })),
  villages: rawPunjabVillageRegistry.villages.map((village) => ({
    ...village,
    centerCoords: toCoordinatePair(village.centerCoords),
  })),
} as unknown as PunjabVillageRegistry;
export const PUNJAB_STATE_AVERAGES = PUNJAB_VILLAGE_REGISTRY.meta.averages;

const districtMap = new Map(
  PUNJAB_VILLAGE_REGISTRY.districts.map((district) => [district.slug, district]),
);

const villageMap = new Map(
  PUNJAB_VILLAGE_REGISTRY.villages.map((village) => [village.slug, village]),
);

export const listPunjabDistrictEntries = () => PUNJAB_VILLAGE_REGISTRY.districts;

export const findPunjabDistrictEntry = (districtSlug?: string | null) => (
  districtSlug ? districtMap.get(districtSlug) || null : null
);

export const listPunjabVillageEntries = (districtSlug?: string | null) => {
  if (!districtSlug) return [];
  const ids = PUNJAB_VILLAGE_REGISTRY.districtVillageIds[districtSlug] || [];
  return ids
    .map((id) => villageMap.get(id))
    .filter((village): village is PunjabVillageEntry => Boolean(village));
};

export const findPunjabVillageEntry = (villageSlug?: string | null) => (
  villageSlug ? villageMap.get(villageSlug) || null : null
);

export const isPunjabDistrictSlug = (candidate?: string | null) => (
  Boolean(candidate && districtMap.has(candidate))
);
