import type { AutomationEvent, JobSummary } from "@itr/shared";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const token = process.env.NEXT_PUBLIC_API_TOKEN ?? "";

console.log("NEXT_PUBLIC_API_TOKEN =", process.env.NEXT_PUBLIC_API_TOKEN);
console.log("NEXT_PUBLIC_API_BASE_URL =", process.env.NEXT_PUBLIC_API_BASE_URL);

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",

      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export function startJob(pan: string, runHeaded: boolean) {
  return api<{ id: string; requestId: string }>("/jobs", {
    method: "POST",
    headers: { "x-request-id": crypto.randomUUID() },
    body: JSON.stringify({ pan, runHeaded }),
  });
}

export function listJobs(params = "") {
  return api<{ jobs: JobSummary[] }>(`/jobs${params}`);
}

export function getMetrics() {
  return api<{
    totalRuns: number;
    successRate: number;
    failures: number;
    p50DurationMs: number;
    p99DurationMs: number;
  }>("/metrics");
}

export function getJob(jobId: string) {
  return api<{ job: JobSummary }>(`/jobs/${jobId}`);
}

export function getEvents(jobId: string) {
  return api<{ events: AutomationEvent[] }>(`/jobs/${jobId}/events`);
}

export function submitOtp(jobId: string, otp: string) {
  return api(`/jobs/${jobId}/otp`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export function cancelJob(jobId: string) {
  return api(`/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function streamEvents(
  jobId: string,
  after: number,
  onEvent: (event: AutomationEvent) => void,
  signal: AbortSignal,
) {
  const response = await fetch(
    `${baseUrl}/jobs/${jobId}/events/stream?after=${after}`,
    {
      headers: { authorization: `Bearer ${token}` },
      signal,
    },
  );
  if (!response.ok || !response.body)
    throw new Error("Unable to open event stream");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (dataLine) onEvent(JSON.parse(dataLine.slice(6)) as AutomationEvent);
    }
  }
}
