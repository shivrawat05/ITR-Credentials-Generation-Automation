import { ObjectId, type Collection, type Db, type Filter } from "mongodb";
import type { AutomationEvent, CredentialResult, JobOutcome, JobPhase, JobSummary, OtpSubmission } from "@itr/shared";
import { assertTransition, isTerminalPhase, maskPan, redactMessage, redactPayload } from "@itr/shared";
import { decryptJson, encryptJson } from "../domain/crypto.js";

type JobDoc = {
  _id: ObjectId;
  requestId: string;
  panMasked: string;
  panEncrypted: string;
  phase: JobPhase;
  outcome: JobOutcome;
  nextSeq: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  resultEncrypted?: string;
  otpEncrypted?: string;
  otpSubmittedAt?: Date;
  runHeaded: boolean;
};

type EventDoc = Omit<AutomationEvent, "timestamp"> & {
  timestamp: Date;
  createdAt: Date;
};

export class JobRepository {
  private jobs: Collection<JobDoc>;
  private events: Collection<EventDoc>;

  constructor(db: Db) {
    this.jobs = db.collection<JobDoc>("jobs");
    this.events = db.collection<EventDoc>("events");
  }

  async createJob(input: { pan: string; requestId: string; runHeaded: boolean }) {
    const now = new Date();
    const inserted = await this.jobs.insertOne({
      requestId: input.requestId,
      panMasked: maskPan(input.pan),
      panEncrypted: encryptJson({ pan: input.pan }),
      phase: "queued",
      outcome: "running",
      nextSeq: 1,
      startedAt: now,
      updatedAt: now,
      runHeaded: input.runHeaded
    } as JobDoc);
    return inserted.insertedId.toHexString();
  }

  async listJobs(query: { phase?: JobPhase; outcome?: JobOutcome; after?: string; limit: number }) {
    const filter: Filter<JobDoc> = {};
    if (query.phase) filter.phase = query.phase;
    if (query.outcome) filter.outcome = query.outcome;
    if (query.after) filter.updatedAt = { $lt: new Date(query.after) };
    const docs = await this.jobs
      .find(filter, { projection: { panEncrypted: 0, resultEncrypted: 0, otpEncrypted: 0 } })
      .sort({ updatedAt: -1 })
      .limit(query.limit)
      .toArray();
    return docs.map(toSummary);
  }

  async getJob(jobId: string) {
    const doc = await this.jobs.findOne({ _id: objectId(jobId) }, { projection: { panEncrypted: 0, resultEncrypted: 0, otpEncrypted: 0 } });
    return doc ? toSummary(doc) : null;
  }

  async appendEvent(raw: AutomationEvent) {
    const jobId = objectId(raw.jobId);
    const job = await this.jobs.findOne({ _id: jobId });
    if (!job) throw new Error("Job not found");
    if (!isTerminalPhase(job.phase) && raw.phase !== job.phase) assertTransition(job.phase, raw.phase);

    const seq = job.nextSeq;
    const event: EventDoc = {
      ...raw,
      seq,
      id: `${raw.jobId}:${seq}`,
      message: redactMessage(raw.message),
      data: redactPayload(raw.data),
      timestamp: new Date(raw.timestamp),
      createdAt: new Date()
    };

    await this.events.insertOne(event);
    const completedAt = isTerminalPhase(raw.phase) ? new Date() : undefined;
    await this.jobs.updateOne(
      { _id: jobId },
      {
        $set: {
          phase: raw.phase,
          outcome: outcomeFor(raw.phase, job.outcome),
          updatedAt: new Date(),
          ...(completedAt ? { completedAt } : {})
        },
        $inc: { nextSeq: 1 }
      }
    );
    const { createdAt: _createdAt, ...rest } = event;
    return { ...rest, timestamp: event.timestamp.toISOString() } as AutomationEvent;
  }

  async eventsAfter(jobId: string, afterSeq: number, limit = 1000): Promise<AutomationEvent[]> {
    const docs = await this.events
      .find({ jobId, seq: { $gt: afterSeq } }, { projection: { _id: 0, createdAt: 0 } })
      .sort({ seq: 1 })
      .limit(limit)
      .toArray();
    return docs.map((doc) => ({ ...doc, timestamp: doc.timestamp.toISOString() }));
  }

  async saveOtp(jobId: string, otp: string) {
    const submission: OtpSubmission = { otp, submittedAt: new Date().toISOString() };
    await this.jobs.updateOne(
      { _id: objectId(jobId), outcome: "running" },
      { $set: { otpEncrypted: encryptJson(submission), otpSubmittedAt: new Date(), updatedAt: new Date() } }
    );
  }

  async getOtpStatus(jobId: string) {
    const doc = await this.jobs.findOne({ _id: objectId(jobId) }, { projection: { otpSubmittedAt: 1, outcome: 1, phase: 1 } });
    return {
      hasOtp: Boolean(doc?.otpSubmittedAt),
      outcome: doc?.outcome,
      phase: doc?.phase
    };
  }

  async consumeOtp(jobId: string) {
    const doc = await this.jobs.findOne({ _id: objectId(jobId) }, { projection: { otpEncrypted: 1 } });
    if (!doc?.otpEncrypted) return null;
    const submission = decryptJson<OtpSubmission>(doc.otpEncrypted);
    await this.jobs.updateOne({ _id: objectId(jobId) }, { $unset: { otpEncrypted: "", otpSubmittedAt: "" } });
    return submission;
  }

  async cancel(jobId: string) {
    await this.jobs.updateOne(
      { _id: objectId(jobId), outcome: "running" },
      { $set: { phase: "cancelled", outcome: "cancelled", completedAt: new Date(), updatedAt: new Date() } }
    );
  }

  async saveResult(result: CredentialResult & { jobId: string }) {
    await this.jobs.updateOne(
      { _id: objectId(result.jobId) },
      {
        $set: {
          resultEncrypted: encryptJson({ userId: result.userId, password: result.password, generatedAt: result.generatedAt }),
          updatedAt: new Date()
        }
      }
    );
  }

  async metrics() {
    const docs = await this.jobs
      .find({}, { projection: { outcome: 1, startedAt: 1, completedAt: 1 } })
      .toArray();
    const finished = docs.filter((doc) => doc.completedAt);
    const durations = finished.map((doc) => doc.completedAt!.getTime() - doc.startedAt.getTime()).sort((a, b) => a - b);
    const successes = docs.filter((doc) => doc.outcome === "success").length;
    const failures = docs.filter((doc) => doc.outcome === "failure").length;
    return {
      totalRuns: docs.length,
      successRate: docs.length ? successes / docs.length : 0,
      failures,
      p50DurationMs: percentile(durations, 0.5),
      p99DurationMs: percentile(durations, 0.99)
    };
  }
}

function toSummary(doc: JobDoc): JobSummary {
  return {
    id: doc._id.toHexString(),
    requestId: doc.requestId,
    panMasked: doc.panMasked,
    phase: doc.phase,
    outcome: doc.outcome,
    startedAt: doc.startedAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    completedAt: doc.completedAt?.toISOString(),
    durationMs: doc.completedAt ? doc.completedAt.getTime() - doc.startedAt.getTime() : Date.now() - doc.startedAt.getTime()
  };
}

function outcomeFor(phase: JobPhase, previous: JobOutcome): JobOutcome {
  if (phase === "succeeded") return "success";
  if (phase === "failed") return "failure";
  if (phase === "cancelled") return "cancelled";
  return previous;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor(values.length * p))];
}

function objectId(id: string): ObjectId {
  return new ObjectId(id);
}
