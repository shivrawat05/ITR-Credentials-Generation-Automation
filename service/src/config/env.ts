import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { z } from "zod";

for (const envPath of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env")]) {
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

const envSchema = z.object({
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/itr_credentials"),
  PORT: z.coerce.number().default(4000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:4000"),
  UI_ORIGIN: z.string().default("http://localhost:3000"),
  API_BEARER_TOKEN: z.string().min(8),
  WEBHOOK_SECRET: z.string().min(8),
  CREDENTIAL_ENCRYPTION_KEY_BASE64: z.string().optional(),
  AUTOMATION_COMMAND: z.string().default("pnpm --filter @itr/automation start"),
});

export const env = envSchema.parse(process.env);

export function encryptionKey(): Buffer {
  if (!env.CREDENTIAL_ENCRYPTION_KEY_BASE64) {
    return randomBytes(32);
  }
  const key = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY_BASE64, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  }
  return key;
}
