import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireBearer(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== env.API_BEARER_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-webhook-secret") !== env.WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return;
  }
  next();
}
