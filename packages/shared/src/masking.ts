const PAN_RE = /[A-Z]{5}[0-9]{4}[A-Z]/gi;
const OTP_RE = /\b\d{4,8}\b/g;

export function maskPan(pan: string): string {
  const normalized = pan.trim().toUpperCase();
  if (normalized.length < 10) return "****";
  return `${normalized.slice(0, 2)}***${normalized.slice(5, 7)}**${normalized.slice(-1)}`;
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

export function redactMessage(input: string): string {
  return input
    .replace(PAN_RE, (match) => maskPan(match))
    .replace(OTP_RE, (match) => (match.length >= 4 ? "****" : match));
}

export function redactPayload<T extends Record<string, unknown> | undefined>(payload: T): T {
  if (!payload) return payload;
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/pan|otp|password|secret/i.test(key)) {
      clone[key] = typeof value === "string" ? maskSecret(value) : "[redacted]";
    } else {
      clone[key] = value;
    }
  }
  return clone as T;
}
