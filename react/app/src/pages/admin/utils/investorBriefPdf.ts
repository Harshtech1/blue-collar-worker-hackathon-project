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
  if (normalizedValue >= 10000000) {
    const croreValue = normalizedValue / 10000000;
    return `INR ${Number.isInteger(croreValue) ? croreValue.toFixed(0) : croreValue.toFixed(1)}Cr`;
  }

  if (normalizedValue >= 100000) {
    const lakhValue = normalizedValue / 100000;
    return `INR ${Number.isInteger(lakhValue) ? lakhValue.toFixed(0) : lakhValue.toFixed(1)}L`;
  }

  if (normalizedValue >= 1000) {
    return `INR ${Math.round(normalizedValue / 1000)}K`;
  }

  return `INR ${normalizedValue}`;
};

const drawCard = (
  pdf: any,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: [number, number, number],
) => {
  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(...fill);
  pdf.roundedRect(x, y, width, height, 5, 5, "FD");
};

const writeWrappedText = (
  pdf: any,
  value: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4.6,
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
  drawCard(pdf, x, y, width, 20, [248, 250, 252]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(label.toUpperCase(), x + 4, y + 6.5);
  pdf.setTextColor(...tone);
  pdf.setFontSize(12.5);
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
  const marketReadiness = summary.marketReadiness;
  const executiveSummaryText = marketReadiness
    ? `National hierarchy: ${marketPathLabel}. ${summary.unitEconomics.launchMode} is active with projected CAC of ${formatInr(marketReadiness.projectedCac)} and a readiness score of ${marketReadiness.villageReadinessScore}/100. Labor availability is ${marketReadiness.laborAvailabilityIndex}/100, connectivity stability is ${marketReadiness.connectivityStability}/100, and digital reliability holds at ${marketReadiness.domesticPowerHours.toFixed(1)} hours per day. ${marketReadiness.comparisonNarrative}`
    : `National hierarchy: ${marketPathLabel}. Expansion budget is ${formatInr(summary.unitEconomics.regionalEntryBudget)} under the ${summary.unitEconomics.launchMode} posture. Revenue projection is ${formatInr(summary.unitEconomics.projectedFirstYearRevenue)} in Year-1 with ${summary.unitEconomics.marketShareCapture}% share capture, ${summary.unitEconomics.roi12m.toFixed(0)}% projected ROI, and a ${summary.unitEconomics.marginExpansionPer100Workers.toFixed(1)}% unit-economic multiplier per 100 workers. The teal moat highlights captured neighborhoods while competitor red zones mark the burn battles RAHI is intentionally avoiding.`;

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
    4.3,
  );

  drawCard(pdf, pageWidth - 56, 8, 42, 20, [255, 255, 255]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Projected ROI 12M", pageWidth - 52, 14.5);
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${summary.unitEconomics.roi12m.toFixed(0)}%`, pageWidth - 52, 22.5);

  let cursorY = 44;

  drawMetricTile(pdf, margin, cursorY, metricWidth, "Density", summary.marketMetrics.density.toFixed(2), [15, 23, 42]);
  drawMetricTile(pdf, margin + metricWidth + 3, cursorY, metricWidth, "Yield / Job", formatInr(yieldSnapshot.netProfitPerJob), [5, 150, 105]);
  drawMetricTile(pdf, margin + (metricWidth + 3) * 2, cursorY, metricWidth, "Year-1 Revenue", formatCompactInr(summary.unitEconomics.projectedFirstYearRevenue), [2, 132, 199]);
  drawMetricTile(pdf, margin + (metricWidth + 3) * 3, cursorY, metricWidth, "Share Capture", `${Math.round(summary.unitEconomics.marketShareCapture)}%`, [15, 23, 42]);

  let metricSectionHeight = 28;
  if (marketReadiness) {
    const readinessRowY = cursorY + 24;
    drawMetricTile(pdf, margin, readinessRowY, metricWidth, "Labor Index", `${marketReadiness.laborAvailabilityIndex}/100`, [15, 23, 42]);
    drawMetricTile(pdf, margin + metricWidth + 3, readinessRowY, metricWidth, "Connectivity", `${marketReadiness.connectivityStability}/100`, [5, 150, 105]);
    drawMetricTile(pdf, margin + (metricWidth + 3) * 2, readinessRowY, metricWidth, "Village Readiness", `${marketReadiness.villageReadinessScore}/100`, [2, 132, 199]);
    drawMetricTile(pdf, margin + (metricWidth + 3) * 3, readinessRowY, metricWidth, "Projected CAC", formatInr(marketReadiness.projectedCac), [180, 83, 9]);
    metricSectionHeight += 24;
  }

  cursorY += metricSectionHeight;

  drawCard(pdf, margin, cursorY, contentWidth, 24, [248, 250, 252]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Executive Summary", margin + 4, cursorY + 7.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.setTextColor(71, 85, 105);
  writeWrappedText(
    pdf,
    executiveSummaryText,
    margin + 4,
    cursorY + 11.5,
    contentWidth - 8,
    4.1,
  );

  cursorY += 30;

  drawCard(pdf, margin, cursorY, 88, 60, [255, 255, 255]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Unit Economics", margin + 4, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  writeWrappedText(
    pdf,
    "Net profit per job remains the control metric for launch discipline, payout quality, and city-level scaling confidence.",
    margin + 4,
    cursorY + 13,
    80,
    4.4,
  );
  drawMetricTile(pdf, margin + 4, cursorY + 24, 38, "Commission", formatInr(yieldSnapshot.commissionPerJob), [15, 23, 42]);
  drawMetricTile(pdf, margin + 46, cursorY + 24, 38, "Marketing CAC", formatInr(yieldSnapshot.marketingPerJob), [2, 132, 199]);
  drawMetricTile(pdf, margin + 4, cursorY + 46, 38, "Incentives", formatInr(yieldSnapshot.incentivesPerJob), [180, 83, 9]);
  drawMetricTile(pdf, margin + 46, cursorY + 46, 38, "Avg Ticket", formatInr(yieldSnapshot.avgTicket), [5, 150, 105]);

  drawCard(pdf, margin + 94, cursorY, 102, 60, [255, 255, 255]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Expansion Return Math", margin + 98, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  writeWrappedText(
    pdf,
    "Run-rate, CAC recovery, annualized profit, and revenue potential stay visible together so the board can compare confidence against capital efficiency.",
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

  drawCard(pdf, margin, cursorY, contentWidth, 52, [248, 250, 252]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Market Entry Timeline", margin + 4, cursorY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text("Secondary strip for Chandigarh and New Delhi launch sequencing.", margin + 4, cursorY + 13.5);

  const timelineCards = [
    {
      title: summary.marketMetrics.zoneLabel,
      stage: "Current command lane",
      detail: `Hierarchy ${summary.marketMetrics.city}, ${summary.marketMetrics.state} | Yield ${formatInr(yieldSnapshot.netProfitPerJob)}`,
    },
    {
      title: "Chandigarh",
      stage: "Shadow Launch",
      detail: "Budget INR 90K | Payback 18 days | Revenue INR 72L",
    },
    {
      title: "New Delhi",
      stage: "Tier-1 scale lane",
      detail: "Budget INR 3L | Payback 18 days | Revenue INR 3.6Cr",
    },
  ];

  const timelineWidth = (contentWidth - 16) / 3;
  timelineCards.forEach((card, index) => {
    const cardX = margin + 4 + (index * (timelineWidth + 4));
    drawCard(pdf, cardX, cursorY + 18, timelineWidth, 28, [255, 255, 255]);
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

  drawCard(pdf, margin, cursorY, contentWidth, 62, [255, 255, 255]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Trust, Scalability, and Risk & Resilience", margin + 4, cursorY + 8);
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
    `Scalability forecast: every ${Math.round(summary.unitEconomics.scalabilityNewWorkers)} additional workers expand net margin by ${summary.unitEconomics.marginExpansionPer100Workers.toFixed(1)}% through route optimization. Delta Profit = (New Workers x Efficiency Gain) x Current Margin, which currently adds ${formatCompactInr(summary.unitEconomics.scalabilityDeltaProfit)} monthly and ${formatCompactInr(summary.unitEconomics.scalabilityDeltaProfitAnnualized)} annualized.`,
    margin + 4,
    cursorY + 22.5,
    contentWidth - 8,
    4.4,
  );
  writeWrappedText(
    pdf,
    `Risk & Resilience: ${summary.marketDefense.targetHotspot?.label || summary.marketMetrics.zoneLabel} can trigger a ${(summary.marketDefense.loyaltyMultiplier * 100).toFixed(0)}% loyalty multiplier. Churn prevention cost is ${formatCompactInr(summary.marketDefense.churnPreventionCost)} versus ${formatCompactInr(summary.marketDefense.replacementCac)} replacement CAC, preserving about ${summary.marketDefense.protectedMarketShare}% market capture and ${formatCompactInr(summary.marketDefense.projectedSavings)} in modeled savings.`,
    margin + 4,
    cursorY + 32,
    contentWidth - 8,
    4.4,
  );
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Generated ${generatedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    margin + 4,
    cursorY + 57,
  );
  pdf.text(
    `${marketPathLabel} | Budget ${formatCompactInr(summary.unitEconomics.regionalEntryBudget)} | Revenue ${formatCompactInr(summary.unitEconomics.projectedFirstYearRevenue)} | Share ${summary.unitEconomics.marketShareCapture}% | ROI ${summary.unitEconomics.roi12m.toFixed(0)}% | Defense savings ${formatCompactInr(summary.marketDefense.projectedSavings)}`,
    margin + 40,
    cursorY + 57,
  );

  pdf.save(fileName);
};
