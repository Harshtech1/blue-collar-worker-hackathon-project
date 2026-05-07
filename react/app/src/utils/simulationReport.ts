export interface SimulationReportSectorLine {
  sector: string;
  densityCluster: string;
  densityScore: number;
  salariedRatio: number;
  traditionalCost: number;
  optimizedCost: number;
  projectedRevenue: number;
}

export interface SimulationReportPayload {
  generatedAt: string;
  totalPoints: number;
  totalSectors: number;
  totalProjectedOrders: number;
  totalTraditionalCost: number;
  totalOptimizedCost: number;
  marginLift: number;
  averageSalariedRatio: number;
  hottestSector: string;
  sectors: SimulationReportSectorLine[];
}

const escapePdfText = (value: string) => (
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
);

const formatCurrency = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

const buildPdfBlob = (lines: string[]) => {
  const textCommands = lines
    .map((line, index) => `BT /F1 11 Tf 50 ${770 - (index * 18)} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");

  const stream = `${textCommands}\n`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}endstream\nendobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
};

export const downloadSimulationReport = (payload: SimulationReportPayload) => {
  const lines = [
    "RAHI Intelligence Simulation Report",
    `Generated: ${payload.generatedAt}`,
    `Synthetic traffic processed: ${payload.totalPoints.toLocaleString("en-IN")} booking requests`,
    `Sectors analyzed: ${payload.totalSectors}`,
    `Projected orders: ${payload.totalProjectedOrders.toLocaleString("en-IN")}`,
    `Traditional model cost: ${formatCurrency(payload.totalTraditionalCost)}`,
    `RAHI optimized cost: ${formatCurrency(payload.totalOptimizedCost)}`,
    `Margin lift unlocked: ${formatCurrency(payload.marginLift)}`,
    `Average salaried ratio: ${Math.round(payload.averageSalariedRatio)}%`,
    `Hottest sector: ${payload.hottestSector}`,
    "",
    "Top workforce recommendations:",
    ...payload.sectors.slice(0, 8).map((sector, index) => (
      `${index + 1}. ${sector.sector}: ${sector.densityCluster} | Density ${sector.densityScore.toFixed(2)} | `
      + `${Math.round(sector.salariedRatio)}% salaried | Burn ${formatCurrency(sector.traditionalCost)} -> ${formatCurrency(sector.optimizedCost)}`
    )),
  ];

  const blob = buildPdfBlob(lines);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rahi-intelligence-simulation-${Date.now()}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
};
