export type AgenticTone = "navy" | "emerald" | "sky" | "amber";

export type ObservabilityIssueCode =
  | "PAYMENT_FAILURE"
  | "BOOKING_ERROR"
  | "OTP_TIMEOUT"
  | "PROOF_VERIFICATION_REJECTED"
  | "ASSIGNMENT_TIMEOUT"
  | "LLM_FALLBACK"
  | "UPLOAD_LATENCY";

export type ObservabilityIssue = {
  id: string;
  code: ObservabilityIssueCode;
  domain: string;
  severity: "critical" | "watch" | "stable";
  message: string;
  tone: AgenticTone;
  impact: string;
  recommendedAction: string;
};

export const ADMIN_ISSUE_SEVERITY_WEIGHT: Record<ObservabilityIssueCode, number> = {
  PAYMENT_FAILURE: 100,
  BOOKING_ERROR: 95,
  OTP_TIMEOUT: 90,
  PROOF_VERIFICATION_REJECTED: 85,
  ASSIGNMENT_TIMEOUT: 80,
  LLM_FALLBACK: 35,
  UPLOAD_LATENCY: 25,
};

export const ADMIN_OBSERVABILITY_ISSUES: ObservabilityIssue[] = [
  {
    id: "issue-payment-failure",
    code: "PAYMENT_FAILURE",
    domain: "Payments",
    severity: "critical",
    message: "Settlement callback mismatch detected in Chandigarh. Two paid jobs are awaiting ledger reconciliation.",
    tone: "amber",
    impact: "Revenue is at risk until callbacks are reconciled.",
    recommendedAction: "Freeze duplicate retries, verify the callback signature, and re-run settlement sync for the affected jobs.",
  },
  {
    id: "issue-booking-error",
    code: "BOOKING_ERROR",
    domain: "Bookings",
    severity: "critical",
    message: "Three high-value bookings failed to confirm after customer payment authorization in the last 30 minutes.",
    tone: "amber",
    impact: "Paid demand can leak before it reaches worker assignment.",
    recommendedAction: "Replay booking confirmation from the payment success event and verify the booking-write queue.",
  },
  {
    id: "issue-otp-timeout",
    code: "OTP_TIMEOUT",
    domain: "Verification",
    severity: "critical",
    message: "Start-job OTP delivery crossed the timeout threshold for seven field visits during the evening surge.",
    tone: "amber",
    impact: "Workers can stall on-site and completion trust drops immediately.",
    recommendedAction: "Switch to the backup SMS rail and extend the active OTP window for the current surge cycle.",
  },
  {
    id: "issue-proof-rejected",
    code: "PROOF_VERIFICATION_REJECTED",
    domain: "Trust",
    severity: "critical",
    message: "Proof-of-work verification rejected media on two completed jobs because the upload token expired mid-submit.",
    tone: "amber",
    impact: "Proof coverage weakens and payout approval can be delayed.",
    recommendedAction: "Refresh signed upload tokens for active sessions and retry verification from the stored proof queue.",
  },
  {
    id: "issue-assignment-timeout",
    code: "ASSIGNMENT_TIMEOUT",
    domain: "Dispatch",
    severity: "critical",
    message: "Worker assignment timed out in one high-demand pocket after the matching queue exceeded its SLA.",
    tone: "amber",
    impact: "Customers wait longer and marketplace trust degrades in the highest-value zone.",
    recommendedAction: "Open overflow capacity in the affected zone and force-rerun matching with the standby worker pool.",
  },
  {
    id: "issue-llm-fallback",
    code: "LLM_FALLBACK",
    domain: "AI",
    severity: "watch",
    message: "Provider fallback engaged for one strategy request during the last sampling window.",
    tone: "amber",
    impact: "Executive guidance remains available, but deep reasoning quality can step down.",
    recommendedAction: "Review provider health and keep local guidance active until quota stabilizes.",
  },
  {
    id: "issue-upload-latency",
    code: "UPLOAD_LATENCY",
    domain: "Verification",
    severity: "stable",
    message: "Signed worker documents are available and protected by time-limited URLs.",
    tone: "emerald",
    impact: "Trust coverage is stable and no escalation is required.",
    recommendedAction: "Monitor only.",
  },
];

export const humanizeIssueCode = (code: string) => (
  String(code || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
);
