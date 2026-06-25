import type { JobPhase } from "./types.js";

const transitions: Record<JobPhase, JobPhase[]> = {
  queued: ["launching", "cancelled", "failed"],
  launching: ["identity", "failed", "cancelled"],
  identity: ["captcha", "failed", "cancelled"],
  captcha: ["identity", "otp_waiting", "failed", "cancelled"],
  otp_waiting: ["otp_submitted", "failed", "cancelled"],
  otp_submitted: ["otp_waiting", "password", "failed", "cancelled"],
  password: ["confirmation", "failed", "cancelled"],
  confirmation: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: []
};

export function canTransition(from: JobPhase, to: JobPhase): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: JobPhase, to: JobPhase): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid job phase transition: ${from} -> ${to}`);
  }
}

export function isTerminalPhase(phase: JobPhase): boolean {
  return phase === "succeeded" || phase === "failed" || phase === "cancelled";
}
