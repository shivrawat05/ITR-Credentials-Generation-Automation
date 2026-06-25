import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

for (const envPath of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env")]) {
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

const schema = z.object({
  SERVICE_BASE_URL: z.string().url().default("http://localhost:4000"),
  WEBHOOK_SECRET: z.string().min(8),
  JOB_ID: z.string().min(1),
  PAN: z.string().min(10),
  REQUEST_ID: z.string().min(1),
  RUN_HEADED: z.coerce.boolean().default(false),
  AUTOMATION_DEMO_MODE: z.coerce.boolean().default(false),
  INCOME_TAX_PORTAL_URL: z.string().url().default("https://www.incometax.gov.in/iec/foportal/")
});

export const config = schema.parse(process.env);
