# RegisterKaro ITR Credentials Generation Automation

Full-stack implementation of the RegisterKaro take-home assignment: a Playwright automation worker, a Node/Mongo event pipeline, and a Next.js operations dashboard for live run monitoring.

## Stack

- `automation/`: Playwright + Chromium worker
- `service/`: Express HTTP service, MongoDB repositories, webhook ingest, SSE fan-out
- `ui/`: Next.js 15 dashboard with React and Phosphor icons
- `packages/shared/`: shared job/event shapes, validation, masking, and state machine

## Prerequisites

- Node.js 20+
- pnpm 9+
- MongoDB running locally or reachable via `MONGODB_URI`
- Playwright browser install: `pnpm --filter @itr/automation exec playwright install chromium`

## Setup

```bash
pnpm install
cp .env.example .env
```

Create a 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the value in `CREDENTIAL_ENCRYPTION_KEY_BASE64`, then set matching secrets:

```env
API_BEARER_TOKEN=local-operator-token
WEBHOOK_SECRET=local-webhook-secret
NEXT_PUBLIC_API_TOKEN=local-operator-token
```

## Run Locally

Start MongoDB, then run each layer:

```bash
pnpm dev:service
pnpm dev:ui
```

The service launches the automation worker when a job is created. For a local dry run without touching the live portal, keep:

```env
AUTOMATION_DEMO_MODE=true
```

For the real Income Tax portal flow:

```env
AUTOMATION_DEMO_MODE=false
RUN_HEADED=true
```

Open `http://localhost:3000`, enter a PAN you control, start a run, watch events stream, and submit the OTP when the run reaches `otp_waiting`.

## API

- `POST /jobs`: start a run
- `GET /jobs`: list runs, filter by `phase` or `outcome`
- `GET /jobs/:jobId`: run status
- `GET /jobs/:jobId/events`: event history
- `GET /jobs/:jobId/events/stream`: SSE stream with replay from `after` or `Last-Event-Id`
- `POST /jobs/:jobId/otp`: supply OTP
- `POST /jobs/:jobId/cancel`: cancel run
- `GET /metrics`: dashboard metrics
- `POST /webhooks/automation/events`: authenticated automation event ingest
- `POST /webhooks/automation/results`: authenticated credential result ingest

Mutating operator routes require `Authorization: Bearer $API_BEARER_TOKEN`. Automation webhooks require `X-Webhook-Secret: $WEBHOOK_SECRET`.

## Tests

```bash
pnpm test
```

The focused tests cover the shared state machine, validation, and replay buffer behavior.

## Notes

Real PAN, OTP, and password values must stay in local environment/runtime only. Events and logs mask PAN, OTP, and passwords, and generated credentials are encrypted before persistence.
