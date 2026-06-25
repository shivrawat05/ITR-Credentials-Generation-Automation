# Architecture

## Boundaries

The repository is split into four layers:

- `packages/shared` defines job phases, events, payload validation, secret masking, and state-machine transitions.
- `service` owns job lifecycle, persistence, authentication, webhook ingest, SSE replay, metrics, and OTP handoff.
- `automation` owns browser control and emits structured events back to the service.
- `ui` consumes the service API and gives operators a live console plus an admin run table.

Route handlers stay thin: they validate input, call a repository or domain service, and return transport responses. Mongo access is isolated in `JobRepository`; live fan-out is isolated in `EventBus`.

## State Model

The job state machine is explicit:

`queued -> launching -> identity -> captcha -> otp_waiting -> otp_submitted -> password -> confirmation -> succeeded`

Failure and cancellation are terminal exits available from active phases. CAPTCHA can loop back to `identity` for portal retries, and OTP can loop from `otp_submitted` back to `otp_waiting` for a wrong or expired OTP. Invalid transitions are rejected before event persistence so one noisy automation run cannot corrupt another run's state.

## Event Schema

Every automation event has:

- `jobId`
- `seq`, assigned by the service
- `level`
- `phase`
- `step`
- `message`
- `timestamp`
- `requestId`
- optional structured `data`

The automation worker sends events over an authenticated webhook. The service assigns the durable sequence number and persists the event before publishing it to connected SSE clients. PAN, OTP, and password-like fields are redacted in messages and payloads before storage.

## Streaming And Replay

The service is the source of truth. Automation never streams directly to the UI.

1. Bot posts `POST /webhooks/automation/events`.
2. Service validates, persists, updates the job phase, and publishes to `EventBus`.
3. UI opens `GET /jobs/:jobId/events/stream`.
4. On connect, the service replays persisted events after `after` or `Last-Event-Id`.
5. After replay, the connection joins the live tail.

This avoids gaps on reconnect and avoids duplicates because event ids are monotonic per job. Live fan-out uses a bounded ring buffer for recent events, while replay uses MongoDB rather than an unbounded process array.

## MongoDB Model

Jobs and events are separate collections.

`jobs` stores the current run summary, masked PAN, encrypted PAN, phase, outcome, timestamps, encrypted OTP handoff, and encrypted credential result. This makes the admin dashboard cheap because it reads one projected document per row.

`events` stores the append-only event stream with `{ jobId, seq }`. Events are not embedded in jobs because event streams can grow quickly and replay reads need cursor-style range queries.

Indexes:

- `events: { jobId: 1, seq: 1 }` unique for replay and no-duplicate guarantees
- `events: { jobId: 1, createdAt: 1 }` for history scans
- `jobs: { phase: 1, updatedAt: -1 }` for filtered admin lists
- `jobs: { outcome: 1, updatedAt: -1 }` for outcome filters
- `jobs: { updatedAt: -1 }` for the default run list

The dashboard uses projections so encrypted PII and result payloads are never fetched for table rows.

## Automation Flow

The Playwright worker launches per job, navigates to the Income Tax portal, enters the PAN, handles the CAPTCHA gate in headed mode, pauses at OTP, retrieves the operator-supplied OTP through a webhook-secret-protected internal endpoint, generates the password, posts the encrypted result, and exits. Browser cleanup runs in `finally`.

`AUTOMATION_DEMO_MODE=true` exists only to let reviewers run the full event pipeline locally without a real PAN or portal interaction. Production-like portal execution is enabled by setting `AUTOMATION_DEMO_MODE=false` and `RUN_HEADED=true`.

## Trade-Offs

SSE is used instead of WebSockets because the assignment asks for replayable server-to-browser event streaming and the dashboard only needs one-way live updates. The service uses Express for clarity and speed of review. OTP is encrypted at rest and consumed through an automation-only endpoint; it is never returned to the operator UI after submission.
