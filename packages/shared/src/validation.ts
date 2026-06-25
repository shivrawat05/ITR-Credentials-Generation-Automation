import { z } from "zod";
import { jobPhases } from "./types.js";

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must match AAAAA9999A");

export const startJobSchema = z.object({
  pan: panSchema,
  runHeaded: z.boolean().optional().default(false)
});

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{4,8}$/, "OTP must be 4 to 8 digits")
});

export const eventIngestSchema = z.object({
  jobId: z.string().min(1),
  level: z.enum(["debug", "info", "warn", "error"]),
  phase: z.enum(jobPhases),
  step: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  requestId: z.string().min(1),
  data: z.record(z.unknown()).optional()
});

export const resultIngestSchema = z.object({
  jobId: z.string().min(1),
  requestId: z.string().min(1),
  userId: z.string().min(1),
  password: z.string().min(8),
  generatedAt: z.string().datetime()
});
