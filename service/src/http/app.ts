import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eventIngestSchema, jobPhases, otpSchema, resultIngestSchema, startJobSchema } from "@itr/shared";
import { requireBearer, requireWebhookSecret } from "../auth/auth.js";
import { EventBus, writeSse } from "../domain/event-bus.js";
import { launchAutomation } from "../domain/automation-runner.js";
import { env } from "../config/env.js";
import { logger } from "../infra/logger.js";
import type { JobRepository } from "../infra/repositories.js";

export function createApp(repo: JobRepository, bus: EventBus) {
  const app = express();
  app.use(cors({ origin: env.UI_ORIGIN, credentials: false }));
  app.use(express.json({ limit: "128kb" }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info({ method: req.method, path: req.path, statusCode: res.statusCode, durationMs: Date.now() - started }, "http request");
    });
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/jobs", requireBearer, async (req, res, next) => {
    try {
      const parsed = startJobSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid job payload", details: parsed.error.flatten() });
        return;
      }
      const requestId = req.header("x-request-id") ?? randomUUID();
      res.setHeader("x-request-id", requestId);
      const jobId = await repo.createJob({ pan: parsed.data.pan, requestId, runHeaded: parsed.data.runHeaded });
      launchAutomation({ jobId, pan: parsed.data.pan, requestId, runHeaded: parsed.data.runHeaded });
      res.status(201).json({ id: jobId, requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/jobs", requireBearer, async (req, res, next) => {
    try {
      const schema = z.object({
        phase: z.enum(jobPhases).optional(),
        outcome: z.enum(["running", "success", "failure", "cancelled"]).optional(),
        after: z.string().datetime().optional(),
        limit: z.coerce.number().min(1).max(100).default(50)
      });
      const query = schema.parse(req.query) as z.infer<typeof schema>;
      res.json({ jobs: await repo.listJobs(query) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/jobs/:jobId", requireBearer, async (req, res, next) => {
    try {
      const job = await repo.getJob(req.params.jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json({ job });
    } catch (error) {
      next(error);
    }
  });

  app.get("/jobs/:jobId/events", requireBearer, async (req, res, next) => {
    try {
      const after = Number(req.query.after ?? 0);
      res.json({ events: await repo.eventsAfter(req.params.jobId, Number.isFinite(after) ? after : 0) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/jobs/:jobId/events/stream", requireBearer, async (req, res, next) => {
    try {
      const after = Number(req.query.after ?? req.header("last-event-id") ?? 0);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      });
      for (const event of await repo.eventsAfter(req.params.jobId, Number.isFinite(after) ? after : 0)) {
        writeSse(res, event);
      }
      const remove = bus.addClient(req.params.jobId, res);
      req.on("close", remove);
    } catch (error) {
      next(error);
    }
  });

  app.post("/jobs/:jobId/otp", requireBearer, async (req, res, next) => {
    try {
      const parsed = otpSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid OTP payload", details: parsed.error.flatten() });
        return;
      }
      await repo.saveOtp(req.params.jobId, parsed.data.otp);
      res.status(202).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/jobs/:jobId/cancel", requireBearer, async (req, res, next) => {
    try {
      await repo.cancel(req.params.jobId);
      res.status(202).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/metrics", requireBearer, async (_req, res, next) => {
    try {
      res.json(await repo.metrics());
    } catch (error) {
      next(error);
    }
  });

  app.post("/webhooks/automation/events", requireWebhookSecret, async (req, res, next) => {
    try {
      const parsed = eventIngestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid event payload", details: parsed.error.flatten() });
        return;
      }
      const event = await repo.appendEvent(parsed.data);
      bus.publish(event);
      res.status(202).json({ seq: event.seq });
    } catch (error) {
      next(error);
    }
  });

  app.post("/webhooks/automation/results", requireWebhookSecret, async (req, res, next) => {
    try {
      const parsed = resultIngestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid result payload", details: parsed.error.flatten() });
        return;
      }
      await repo.saveResult(parsed.data);
      res.status(202).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/automation/jobs/:jobId/otp-status", requireWebhookSecret, async (req, res, next) => {
    try {
      res.json(await repo.getOtpStatus(req.params.jobId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/automation/jobs/:jobId/consume-otp", requireWebhookSecret, async (req, res, next) => {
    try {
      const submission = await repo.consumeOtp(req.params.jobId);
      if (!submission) {
        res.status(404).json({ error: "OTP not available" });
        return;
      }
      res.json({ otp: submission.otp, submittedAt: submission.submittedAt });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ error }, "request failed");
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
