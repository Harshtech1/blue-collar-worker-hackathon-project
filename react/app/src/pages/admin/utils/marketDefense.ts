export type AdminCompetitorPressure = "watch" | "high";

export interface AdminCompetitorHotspot {
  id: string;
  stateSlug: string;
  citySlug: string;
  label: string;
  center: [number, number];
  pressure: AdminCompetitorPressure;
  note: string;
}

export interface AdminMapOverlays {
  showSectorOverlays: boolean;
  showMoatOverlay: boolean;
  showCompetitorOverlay: boolean;
}

const normalizeAreaLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const labelsOverlap = (left: string, right: string) => {
  const normalizedLeft = normalizeAreaLabel(left);
  const normalizedRight = normalizeAreaLabel(right);
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
};

export const MARKET_COMPETITOR_HOTSPOTS: AdminCompetitorHotspot[] = [
  {
    id: "chandigarh-sector-17",
    stateSlug: "punjab",
    citySlug: "chandigarh",
    label: "Sector 17",
    center: [30.7417, 76.7687],
    pressure: "high",
    note: "Dense aggregator overlap around premium dispatch lanes.",
  },
  {
    id: "chandigarh-industrial-area",
    stateSlug: "punjab",
    citySlug: "chandigarh",
    label: "Industrial Area",
    center: [30.6996, 76.8032],
    pressure: "watch",
    note: "Price-led competition around mixed trade demand.",
  },
  {
    id: "new-delhi-connaught-place",
    stateSlug: "delhi",
    citySlug: "new-delhi",
    label: "Connaught Place",
    center: [28.6315, 77.2167],
    pressure: "high",
    note: "Heavy incumbent density in central premium demand corridors.",
  },
  {
    id: "new-delhi-karol-bagh",
    stateSlug: "delhi",
    citySlug: "new-delhi",
    label: "Karol Bagh",
    center: [28.6517, 77.1909],
    pressure: "watch",
    note: "Discount-heavy service rivalry with moderate repeat demand.",
  },
  {
    id: "south-delhi-saket",
    stateSlug: "delhi",
    citySlug: "south-delhi",
    label: "Saket",
    center: [28.5245, 77.2066],
    pressure: "high",
    note: "Competitor cluster near affluent maintenance demand.",
  },
  {
    id: "north-delhi-model-town",
    stateSlug: "delhi",
    citySlug: "north-delhi",
    label: "Model Town",
    center: [28.7061, 77.1904],
    pressure: "watch",
    note: "Contested residential demand with high worker poaching risk.",
  },
  {
    id: "noida-sector-18",
    stateSlug: "uttar-pradesh",
    citySlug: "noida",
    label: "Sector 18",
    center: [28.5708, 77.3246],
    pressure: "high",
    note: "High-value retail and appliance corridor with active rivals.",
  },
];

export const getCompetitorHotspotsForMarket = (stateSlug?: string | null, citySlug?: string | null) => (
  MARKET_COMPETITOR_HOTSPOTS.filter((hotspot) => (
    (!stateSlug || hotspot.stateSlug === stateSlug)
    && (!citySlug || hotspot.citySlug === citySlug)
  ))
);

export const getPressureFactor = (pressure?: AdminCompetitorPressure | null) => (
  pressure === "high" ? 0.35 : 0.22
);

export const resolveCompetitorHotspot = ({
  stateSlug,
  citySlug,
  districtLabel,
  zoneLabel,
}: {
  stateSlug?: string | null;
  citySlug?: string | null;
  districtLabel?: string | null;
  zoneLabel?: string | null;
}) => {
  const hotspots = getCompetitorHotspotsForMarket(stateSlug, citySlug);
  if (hotspots.length === 0) return null;

  const labelsToMatch = [districtLabel, zoneLabel]
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  const matchedHotspot = hotspots.find((hotspot) => (
    labelsToMatch.some((label) => labelsOverlap(label, hotspot.label))
  ));
  if (matchedHotspot) return matchedHotspot;

  return [...hotspots].sort((left, right) => (
    (right.pressure === "high" ? 1 : 0) - (left.pressure === "high" ? 1 : 0)
    || left.label.localeCompare(right.label)
  ))[0] || null;
};
