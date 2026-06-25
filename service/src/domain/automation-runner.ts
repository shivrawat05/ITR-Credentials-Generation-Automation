import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { logger } from "../infra/logger.js";

export function launchAutomation(input: { jobId: string; pan: string; requestId: string; runHeaded: boolean }) {
  const [command, ...args] = env.AUTOMATION_COMMAND.split(" ");
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: {
      ...process.env,
      JOB_ID: input.jobId,
      PAN: input.pan,
      REQUEST_ID: input.requestId,
      RUN_HEADED: String(input.runHeaded),
      SERVICE_BASE_URL: env.PUBLIC_BASE_URL
    }
  });

  child.stdout.on("data", (chunk) => logger.info({ jobId: input.jobId, output: String(chunk) }, "automation stdout"));
  child.stderr.on("data", (chunk) => logger.warn({ jobId: input.jobId, output: String(chunk) }, "automation stderr"));
  child.on("exit", (code) => logger.info({ jobId: input.jobId, code }, "automation exited"));
  child.on("error", (error) => logger.error({ jobId: input.jobId, error }, "automation failed to launch"));
}
