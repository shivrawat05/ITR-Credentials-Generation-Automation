export const jobPhases = [
  "queued",
  "launching",
  "identity",
  "captcha",
  "otp_waiting",
  "otp_submitted",
  "password",
  "confirmation",
  "succeeded",
  "failed",
  "cancelled"
] as const;

export type JobPhase = (typeof jobPhases)[number];
export type JobOutcome = "running" | "success" | "failure" | "cancelled";
export type EventLevel = "debug" | "info" | "warn" | "error";

export type AutomationEvent = {
  id?: string;
  jobId: string;
  seq?: number;
  level: EventLevel;
  phase: JobPhase;
  step: string;
  message: string;
  timestamp: string;
  requestId: string;
  data?: Record<string, unknown>;
};

export type JobSummary = {
  id: string;
  requestId: string;
  panMasked: string;
  phase: JobPhase;
  outcome: JobOutcome;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs?: number;
};

export type CredentialResult = {
  userId: string;
  password: string;
  generatedAt: string;
};

export type OtpSubmission = {
  otp: string;
  submittedAt: string;
};
