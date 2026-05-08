import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_CSV_PATH = path.resolve(__dirname, "../../..", "village_methane_features.csv");
const OUTPUT_JSON_PATH = path.resolve(
  __dirname,
  "../src/pages/admin/data/punjabVillageRegistry.generated.json",
);

const STATE_META = {
  slug: "punjab",
  label: "Punjab",
  code: "PB",
  country: "India",
  level2Label: "District",
  level3Label: "Village",
  level2Kind: "district",
  level3Kind: "village",
};

const slugify = (value) => (
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
);

const titleCase = (value) => (
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ")
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const roundTo = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const parseBoolean = (value) => (
  String(value || "").trim().toLowerCase() === "true"
  || String(value || "").trim() === "1"
);

const parseNumber = (value) => {
  const numeric = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const escapedQuote = inQuotes && line[index + 1] === "\"";
      if (escapedQuote) {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const scaleToScore = (value, min, max) => {
  if (!Number.isFinite(value)) return 1;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 50;
  const normalized = clamp((value - min) / (max - min), 0, 1);
  return Math.round(1 + (normalized * 99));
};

const average = (values) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

const sum = (values) => values.reduce((total, value) => total + value, 0);

const buildVillageSlug = ({ villageCode, label, districtSlug }) => {
  const villageLabelSlug = slugify(label) || districtSlug || villageCode;
  return `${villageCode}-${villageLabelSlug}`;
};

const main = async () => {
  const csv = await fs.readFile(SOURCE_CSV_PATH, "utf8");
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine).map((header) => header.trim());

  const rows = dataLines.map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });

  const districtBuckets = new Map();
  const popDensityValues = [];
  const domesticPowerValues = [];
  const hhSizeValues = [];
  const agriPowerValues = [];
  const sanitationGapValues = [];

  for (const row of rows) {
    const districtLabel = titleCase(row.District);
    const districtSlug = slugify(districtLabel);
    const villageCode = String(row.VillageCode || "").trim();
    const trimmedVillageLabel = String(row.Village || "").trim();
    const villageLabel = trimmedVillageLabel || villageCode;
    const centerCoords = [roundTo(parseNumber(row.latitude), 6), roundTo(parseNumber(row.longitude), 6)];
    const popDensity = parseNumber(row.pop_density);
    const domesticPowerHours = parseNumber(row.domestic_power_hrs);
    const hhSize = parseNumber(row.hh_size);
    const agriPowerHours = parseNumber(row.agri_power_hrs);
    const sanitationGap = parseNumber(row.sanitation_gap);
    const openDrainage = parseBoolean(row.open_drainage);
    const wasteDisposalAvailable = parseBoolean(row.waste_disposal_available);
    const biogasAvailable = parseBoolean(row.biogas_available);
    const vetHospitalAvailable = parseBoolean(row.vet_hospital_available);
    const methaneIndex = parseNumber(row.methane_index);
    const methaneValue = parseNumber(row.CH4_value);
    const wasteLoadingScore = parseNumber(row.waste_loading_score);
    const agriEnergyProxy = parseNumber(row.agri_energy_proxy);

    const record = {
      id: villageCode,
      villageCode,
      slug: buildVillageSlug({
        villageCode,
        label: villageLabel,
        districtSlug,
      }),
      label: villageLabel,
      rawVillageLabel: trimmedVillageLabel,
      districtSlug,
      districtLabel,
      centerCoords,
      zoomLevel: 15,
      popDensity,
      domesticPowerHours,
      hhSize,
      agriPowerHours,
      sanitationGap,
      openDrainage,
      wasteDisposalAvailable,
      biogasAvailable,
      vetHospitalAvailable,
      methaneIndex,
      methaneValue,
      wasteLoadingScore,
      agriEnergyProxy,
    };

    if (!districtBuckets.has(districtSlug)) {
      districtBuckets.set(districtSlug, {
        slug: districtSlug,
        label: districtLabel,
        villages: [],
      });
    }

    districtBuckets.get(districtSlug).villages.push(record);
    popDensityValues.push(popDensity);
    domesticPowerValues.push(domesticPowerHours);
    hhSizeValues.push(hhSize);
    agriPowerValues.push(agriPowerHours);
    sanitationGapValues.push(sanitationGap);
  }

  const logPopMin = Math.log1p(Math.min(...popDensityValues));
  const logPopMax = Math.log1p(Math.max(...popDensityValues));
  const domesticPowerMin = Math.min(...domesticPowerValues);
  const domesticPowerMax = Math.max(...domesticPowerValues);
  const sanitationGapMin = Math.min(...sanitationGapValues);
  const sanitationGapMax = Math.max(...sanitationGapValues);

  const averages = {
    popDensity: roundTo(average(popDensityValues), 4),
    domesticPowerHours: roundTo(average(domesticPowerValues), 2),
    hhSize: roundTo(average(hhSizeValues), 2),
    agriPowerHours: roundTo(average(agriPowerValues), 2),
    sanitationGap: roundTo(average(sanitationGapValues), 4),
    openDrainageShare: roundTo(average(rows.map((row) => (parseBoolean(row.open_drainage) ? 1 : 0))), 4),
    wasteDisposalCoverage: roundTo(average(rows.map((row) => (parseBoolean(row.waste_disposal_available) ? 1 : 0))), 4),
    biogasAvailability: roundTo(average(rows.map((row) => (parseBoolean(row.biogas_available) ? 1 : 0))), 4),
  };

  const villages = [];
  const districtVillageIds = {};

  for (const district of Array.from(districtBuckets.values()).sort((left, right) => left.label.localeCompare(right.label))) {
    districtVillageIds[district.slug] = [];

    for (const village of district.villages) {
      const logPopValue = Math.log1p(village.popDensity);
      const laborAvailabilityIndex = scaleToScore(logPopValue, logPopMin, logPopMax);
      const connectivityStability = scaleToScore(village.domesticPowerHours, domesticPowerMin, domesticPowerMax);
      const sanitationGapNormalized = clamp(
        (village.sanitationGap - sanitationGapMin) / Math.max(sanitationGapMax - sanitationGapMin, 0.0001),
        0,
        1,
      );
      const infraGapNormalized = clamp(
        (sanitationGapNormalized * 0.4)
          + ((village.openDrainage ? 1 : 0) * 0.25)
          + ((village.wasteDisposalAvailable ? 0 : 1) * 0.2)
          + ((village.biogasAvailable ? 0 : 1) * 0.15),
        0,
        1,
      );
      const infrastructureGapScore = Math.round(1 + (infraGapNormalized * 99));
      const villageReadinessScore = Math.round(
        (laborAvailabilityIndex * 0.45)
          + (connectivityStability * 0.35)
          + ((101 - infrastructureGapScore) * 0.2),
      );
      const projectedCac = clamp(
        Math.round(
          165
          - ((laborAvailabilityIndex - 50) * 0.45)
          - ((connectivityStability - 50) * 0.35)
          + ((infrastructureGapScore - 50) * 0.4),
        ),
        90,
        185,
      );

      const villageRecord = {
        id: village.slug,
        villageCode: village.villageCode,
        slug: village.slug,
        label: village.label,
        districtSlug: village.districtSlug,
        districtLabel: village.districtLabel,
        centerCoords: village.centerCoords,
        zoomLevel: village.zoomLevel,
        readinessScore: villageReadinessScore,
        metrics: {
          popDensity: roundTo(village.popDensity, 4),
          domesticPowerHours: roundTo(village.domesticPowerHours, 2),
          hhSize: roundTo(village.hhSize, 2),
          agriPowerHours: roundTo(village.agriPowerHours, 2),
          laborAvailabilityIndex,
          connectivityStability,
          infrastructureGapScore,
          villageReadinessScore,
          projectedCac,
          sanitationGap: roundTo(village.sanitationGap, 4),
          openDrainage: village.openDrainage,
          wasteDisposalAvailable: village.wasteDisposalAvailable,
          biogasAvailable: village.biogasAvailable,
          vetHospitalAvailable: village.vetHospitalAvailable,
          methaneIndex: roundTo(village.methaneIndex, 4),
          methaneValue: roundTo(village.methaneValue, 4),
          wasteLoadingScore: roundTo(village.wasteLoadingScore, 4),
          agriEnergyProxy: roundTo(village.agriEnergyProxy, 4),
          deltas: {
            popDensity: roundTo(village.popDensity - averages.popDensity, 4),
            domesticPowerHours: roundTo(village.domesticPowerHours - averages.domesticPowerHours, 2),
            hhSize: roundTo(village.hhSize - averages.hhSize, 2),
            laborAvailabilityIndex: Math.round(laborAvailabilityIndex - scaleToScore(Math.log1p(averages.popDensity), logPopMin, logPopMax)),
            connectivityStability: Math.round(connectivityStability - scaleToScore(averages.domesticPowerHours, domesticPowerMin, domesticPowerMax)),
            villageReadinessScore: Math.round(villageReadinessScore - 60),
            projectedCac: Math.round(projectedCac - 150),
          },
        },
      };

      villages.push(villageRecord);
      districtVillageIds[district.slug].push(villageRecord.id);
    }
  }

  const villageLookup = new Map(villages.map((village) => [village.id, village]));
  const districts = Array.from(districtBuckets.values())
    .map((district) => {
      const districtVillages = districtVillageIds[district.slug]
        .map((villageId) => villageLookup.get(villageId))
        .filter(Boolean);
      const centerLat = average(districtVillages.map((village) => village.centerCoords[0]));
      const centerLng = average(districtVillages.map((village) => village.centerCoords[1]));
      const readinessScore = Math.round(average(districtVillages.map((village) => village.metrics.villageReadinessScore)));

      return {
        slug: district.slug,
        label: district.label,
        villageCount: districtVillages.length,
        centerCoords: [roundTo(centerLat, 6), roundTo(centerLng, 6)],
        zoomLevel: 10.8,
        readinessScore,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  const payload = {
    meta: {
      ...STATE_META,
      totalRows: rows.length,
      totalDistricts: districts.length,
      totalVillages: villages.length,
      distinctNamedVillages: new Set(villages.map((village) => village.label).filter(Boolean)).size,
      generatedAt: new Date().toISOString(),
      averages,
      ranges: {
        popDensity: {
          min: roundTo(Math.min(...popDensityValues), 6),
          max: roundTo(Math.max(...popDensityValues), 6),
        },
        domesticPowerHours: {
          min: roundTo(domesticPowerMin, 2),
          max: roundTo(domesticPowerMax, 2),
        },
        hhSize: {
          min: roundTo(Math.min(...hhSizeValues), 2),
          max: roundTo(Math.max(...hhSizeValues), 2),
        },
      },
    },
    districts,
    districtVillageIds,
    villages,
  };

  await fs.mkdir(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_JSON_PATH, JSON.stringify(payload, null, 2));

  const verification = {
    rows: rows.length,
    districts: districts.length,
    villages: villages.length,
    uniqueVillageCodes: new Set(villages.map((village) => village.villageCode)).size,
    blankVillageFallbacks: villages.filter((village) => village.label === village.villageCode).length,
  };

  console.log("[punjab-registry] generated", JSON.stringify(verification));
};

main().catch((error) => {
  console.error("[punjab-registry] failed", error);
  process.exitCode = 1;
});
