import type {
  AutomationEvent,
  CredentialResult,
  EventLevel,
  JobPhase,
} from "@itr/shared";
import { redactMessage, redactPayload } from "@itr/shared";
import { config } from "./config.js";

export async function emitEvent(input: {
  level?: EventLevel;
  phase: JobPhase;
  step: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  const payload: AutomationEvent = {
    jobId: config.JOB_ID,
    requestId: config.REQUEST_ID,
    level: input.level ?? "info",
    phase: input.phase,
    step: input.step,
    message: redactMessage(input.message),
    data: redactPayload(input.data),
    timestamp: new Date().toISOString(),
  };
  await postWithRetry("/webhooks/automation/events", payload);
}

export async function sendResult(result: CredentialResult) {
  await postWithRetry("/webhooks/automation/results", {
    jobId: config.JOB_ID,
    requestId: config.REQUEST_ID,
    ...result,
  });
}

export async function waitForOtp() {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${config.SERVICE_BASE_URL}/automation/jobs/${config.JOB_ID}/otp-status`,
      {
        headers: { "x-webhook-secret": config.WEBHOOK_SECRET },
      },
    );
    if (!response.ok) throw new Error(`OTP status failed: ${response.status}`);
    const body = (await response.json()) as {
      hasOtp: boolean;
      outcome?: string;
      phase?: string;
    };
    if (body.outcome === "cancelled")
      throw new Error("Job cancelled while waiting for OTP");
    if (body.hasOtp) {
      const response = await fetch(
        `${config.SERVICE_BASE_URL}/automation/jobs/${config.JOB_ID}/consume-otp`,
        {
          method: "POST",
          headers: { "x-webhook-secret": config.WEBHOOK_SECRET },
        },
      );
      if (!response.ok)
        throw new Error(`OTP consume failed: ${response.status}`);
      const consumed = (await response.json()) as { otp: string };
      return consumed.otp;
    }
    await sleep(2000);
  }
  throw new Error("Timed out waiting for OTP");
}

async function postWithRetry(path: string, payload: unknown) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${config.SERVICE_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": config.WEBHOOK_SECRET,
          "x-request-id": config.REQUEST_ID,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) return;
      lastError = new Error(`Webhook ${path} failed with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(300 * attempt);
  }
  throw lastError;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
