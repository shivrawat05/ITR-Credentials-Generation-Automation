import type { JobPhase, JobOutcome } from "@itr/shared";

export function OutcomePill({ outcome }: { outcome: JobOutcome }) {
  return <span className="pill">{outcome}</span>;
}

export function PhasePill({ phase }: { phase: JobPhase }) {
  return <span className="pill">{phase.replace("_", " ")}</span>;
}

export function formatDuration(ms = 0) {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
