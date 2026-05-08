import type { SystemInsightsSummary } from "./systemInsights";

type YieldSnapshotInput = {
  avgTicket: number;
  commissionPerJob: number;
  marketingPerJob: number;
  incentivesPerJob: number;
  netProfitPerJob: number;
  totalCommission: number;
  completedCount: number;
};

type AssetYieldSnapshotInput = {
  monthlyJobsRunRate: number;
  monthlyNetProfit: number;
  annualizedNetProfit: number;
  regionalEntryBudget: number;
  roi12m: number;
};

export interface InvestorBriefPdfInput {
  fileName: string;
  generatedAt?: Date;
  marketPathLabel: string;
  viewportLabel: string;
  summary: SystemInsightsSummary;
  yieldSnapshot: YieldSnapshotInput;
  assetYield: AssetYieldSnapshotInput;
  verifiedWorkers: number;
  verifiedWorkerRate: number;
  totalWorkers: number;
}

const formatInr = (value: number) => `INR ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const formatCompactInr = (value: number) => {
  const normalizedValue = Math.round(Number(value || 0));
  if (normalizedValue >= 100000) {
    const lakhValue = normalizedValue / 100000;
    return `₹${Number.isInteger(lakhValue) ? lakhValue.toFixed(0) : lakhValue.toFixed(1)}L`;
  }

  if (normalizedValue >= 1000) {
    return `₹${Math.round(normalizedValue / 1000)}K`;
  }

  return `₹${normalizedValue}`;
};

const drawCard = (
  pdf: any,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill: [number, number, number];
    stroke?: [number, number, number];
  },
) => {
  pdf.setDrawColor(...(options.stroke || [226, 232, 240]));
  pdf.setFillColor(...options.fill);
  pdf.roundedRect(x, y, width, height, 5, 5, "FD");
};

const writeWrappedText = (
  pdf: any,
  value: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 5,
) => {
  const lines = pdf.splitTextToSize(value, width);
  pdf.text(lines, x, y, { baseline: "top" });
  return y + (lines.length * lineHeight);
};

const drawMetricTile = (
  pdf: any,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  tone: [number, number, number],
) => {
  drawCard(pdf, x, y, width, 20, { fill: [248, 250, 252] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(label.toUpperCase(), x + 4, y + 6.5);
  pdf.setTextColor(...tone);
  pdf.setFontSize(13);
  pdf.text(value, x + 4, y + 14.5);
};

export const downloadInvestorBriefPdf = async ({
  fileName,
  generatedAt = new Date(),
  marketPathLabel,
  viewportLabel,
  summary,
  yieldSnapshot,
  assetYield,
  verifiedWorkers,
  verifiedWorkerRate,
  totalWorkers,
}: InvestorBriefPdfInput) => {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);
  const metricWidth = (contentWidth - 9) / 4;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 36, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(191, 219, 254);
  pdf.text("KARIGAR 360 INSTITUTIONAL SCORECARD", margin, 10);

  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text("National Market Engine Brief", margin, 20.5);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(226, 232, 240);
  writeWrappedText(
    pdf,
    `${marketPathLabel} | ${viewportLabel}`,
    margin,
    25,
    contentWidth - 56,
    4.4,
  );

  drawCard(pdf, pageWidth - 56, 8, 42, 20, { fill: [255, 255, 255] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Projected ROI 12M", pageWidth - 52, 14.5);
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${assetYield.roi12m.toFixed(0)}%`, pageWidth - 52, 22.5);

  let cursorY = 44;

  drawMetricTile(pdf, margin, cursorY, metricWidth, "Density", summary.marketMetrics.density.toFixed(2), [15, 23, 42]);
  drawMetricTile(pdf, margin + metricWidth + 3, cursorY, metricWidth, "Yield / Job", formatInr(yieldSnapshot.netProfitPerJob), [5, 150, 105]);
  drawMetricTile(pdf, margin + (metricWidth + 3) * 2, cursorY, metricWidth, "Payback", `${summary.unitEconomics.paybackDays} days`, [2, 132, 199]);
  drawMetricTile(pdf, margin + (metricWidth + 3) * 3, cursorY, metricWidth, "Critical Bugs", `${summary.systemHealth.criticalBugs}`, [180, 83, 9]);

  cursorY += 28;

  drawCard(pdf, margin, cursorY, 88, 60, { fill: [255, 255, 255] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Unit Economics", margin + 4, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  writeWrappedText(
    pdf,
    "Net profit per job remains the core control metric for launch discipline and city-level expansion gating.",
    margin + 4,
    cursorY + 13,
    80,
    4.4,
  );
  drawMetricTile(pdf, margin + 4, cursorY + 24, 38, "Commission", formatInr(yieldSnapshot.commissionPerJob), [15, 23, 42]);
  drawMetricTile(pdf, margin + 46, cursorY + 24, 38, "Marketing CAC", formatInr(yieldSnapshot.marketingPerJob), [2, 132, 199]);
  drawMetricTile(pdf, margin + 4, cursorY + 46, 38, "Incentives", formatInr(yieldSnapshot.incentivesPerJob), [180, 83, 9]);
  drawMetricTile(pdf, margin + 46, cursorY + 46, 38, "Avg Ticket", formatInr(yieldSnapshot.avgTicket), [5, 150, 105]);

  drawCard(pdf, margin + 94, cursorY, 102, 60, { fill: [255, 255, 255] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Expansion Return Math", margin + 98, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  writeWrappedText(
    pdf,
    "Run-rate, CAC recovery, annualized profit, and revenue potential stay visible together so the board can compare launch confidence against capital efficiency.",
    margin + 98,
    cursorY + 13,
    94,
    4.4,
  );
  drawMetricTile(pdf, margin + 98, cursorY + 24, 45, "Monthly Run Rate", `${assetYield.monthlyJobsRunRate} jobs`, [15, 23, 42]);
  drawMetricTile(pdf, margin + 147, cursorY + 24, 45, "Monthly Net", formatInr(assetYield.monthlyNetProfit), [5, 150, 105]);
  drawMetricTile(pdf, margin + 98, cursorY + 46, 45, "Annualized Profit", formatInr(assetYield.annualizedNetProfit), [2, 132, 199]);
  drawMetricTile(pdf, margin + 147, cursorY + 46, 45, "Entry Budget", formatInr(assetYield.regionalEntryBudget), [180, 83, 9]);

  cursorY += 68;

  drawCard(pdf, margin, cursorY, contentWidth, 52, { fill: [248, 250, 252] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Market Entry Timeline", margin + 4, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text("Secondary strip for the North India expansion sequence.", margin + 4, cursorY + 13.5);

  const timelineCards = [
    {
      title: summary.marketMetrics.city,
      stage: summary.marketMetrics.isExistingMarket ? "Pilot Base" : "Active Market",
      detail: `Density ${summary.marketMetrics.density.toFixed(2)} | Yield ${formatInr(yieldSnapshot.netProfitPerJob)}`,
    },
    {
      title: summary.marketMetrics.city,
      stage: summary.unitEconomics.launchMode,
      detail: `Budget ${formatCompactInr(summary.unitEconomics.regionalEntryBudget)} | CAC INR ${summary.unitEconomics.launchCacPerWorker} | Payback ${summary.unitEconomics.paybackDays} days`,
    },
    {
      title: summary.marketMetrics.recommendedExpansionCity,
      stage: "Next launch lane",
      detail: `State ${summary.marketMetrics.state} | Revenue ${formatCompactInr(summary.unitEconomics.projectedFirstYearRevenue)} | Share ${summary.unitEconomics.marketShareCapture}%`,
    },
  ];

  const timelineWidth = (contentWidth - 16) / 3;
  timelineCards.forEach((card, index) => {
    const cardX = margin + 4 + (index * (timelineWidth + 4));
    drawCard(pdf, cardX, cursorY + 18, timelineWidth, 28, { fill: [255, 255, 255] });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(card.title, cardX + 3, cursorY + 24);
    pdf.setFontSize(7.8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(card.stage.toUpperCase(), cardX + 3, cursorY + 29);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.6);
    pdf.setTextColor(71, 85, 105);
    writeWrappedText(pdf, card.detail, cardX + 3, cursorY + 32, timelineWidth - 6, 3.7);
  });

  cursorY += 60;

  drawCard(pdf, margin, cursorY, contentWidth, 50, { fill: [255, 255, 255] });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Trust, Scalability, and Operating Guardrails", margin + 4, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  writeWrappedText(
    pdf,
    `Verified workers ${verifiedWorkers}/${Math.max(totalWorkers, 1)} (${verifiedWorkerRate}%). Uptime ${summary.systemHealth.uptime.toFixed(1)}%. Critical issue lead: ${summary.systemHealth.primaryCriticalBugCode || "No active critical blocker"}.`,
    margin + 4,
    cursorY + 13,
    contentWidth - 8,
    4.4,
  );
  writeWrappedText(
    pdf,
    `Scalability Forecast: every 100 additional workers expand net margin by ${summary.unitEconomics.marginExpansionPer100Workers.toFixed(1)}% through route optimization, with an operational efficiency gain of ${(summary.unitEconomics.operationalEfficiencyGain * 100).toFixed(1)}%.`,
    margin + 4,
    cursorY + 22.5,
    contentWidth - 8,
    4.4,
  );
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Generated ${generatedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    margin + 4,
    cursorY + 45,
  );
  pdf.text(
    `${marketPathLabel} | Regional Budget ${formatCompactInr(summary.unitEconomics.regionalEntryBudget)} | Revenue ${formatCompactInr(summary.unitEconomics.projectedFirstYearRevenue)} | Share ${summary.unitEconomics.marketShareCapture}% | ROI ${assetYield.roi12m.toFixed(0)}% | +${summary.unitEconomics.marginExpansionPer100Workers.toFixed(1)}% / 100 workers`,
    margin + 40,
    cursorY + 45,
  );

  pdf.save(fileName);
};
