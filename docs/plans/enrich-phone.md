# Plan: Enrich phone (Temporal workflow)

- **Status:** Proposed
- **Date:** 2026-11-16
- **Scope:** README "Feature: Enrich phone", including the rate-limit nice-to-have.

## Goal

Find a lead's phone number by asking three providers in sequence and stopping at the
first hit. Order: **Orion Connect → Nimbus Lookup → Astra Dialer**. If none returns a
phone, mark the lead as **No data found**. Show progress to the user while it runs.

## What the providers actually do

Probed on 2026-11-16 with ~20 calls. Several findings differ from the README spec:

| Provider | Typical latency | Observed response                               | Notes                                                                  |
| -------- | --------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Orion    | ~4.2 s          | `{"phone":"1257790373"}`                        | ~50% `500` under concurrent calls; missing auth → `401 Unauthorized`.  |
| Nimbus   | ~2.2 s          | `{"phoneNmbr":8618439090,"countryCode":"ES"}`   | Spec says `number`, API returns `phoneNmbr` (numeric). Occasional 500. |
| Astra    | ~0.16 s         | `{"phoneNmbr":null}` or `{}`                    | Never returned a phone in the probes.                                  |

No rate-limit headers are sent yet. The latencies set the timeouts: a flat 1–2 s
`startToCloseTimeout` would time out every Orion call.

## Design

### 1. Provider abstraction (`backend/src/enrichment/providers/`)

Each provider is an adapter with three parts:

- **Request mapping:** builds the provider's request from a lead and declares which
  lead fields it needs. If a lead lacks them, the provider is **skipped** and the
  workflow moves on.
- **Authentication:** header or query parameter, as the provider requires.
- **Response parsing:** turns the response into one normalized result:
  `{ phone: string /* E.164 */ } | { phone: null }`.

Errors are classified:

| Response                       | Classification | Behaviour                                              |
| ------------------------------ | -------------- | ------------------------------------------------------ |
| 400 / 401 / 403                | non-retryable  | Fail the activity immediately (config or input error). |
| 5xx, timeout, network error    | retryable      | Retry with the activity retry policy.                  |
| 429                            | retryable      | Retry after `Retry-After` (`nextRetryDelay`).          |

Nimbus is parsed defensively (`number` **or** `phoneNmbr`) and its `countryCode` is
combined with the number into E.164 using `libphonenumber-js`.

Base URLs and API keys come from env vars validated in `config.ts` and documented in
`backend/.env.example`; nothing is hardcoded.

### 2. Temporal

**Activities**

- One activity per provider (`lookupPhoneOrion`, `lookupPhoneNimbus`,
  `lookupPhoneAstra`), so each is visible by name in the Temporal UI and has its own
  options.
- `loadLead(leadId)` – reads the lead (workflows can't do I/O).
- `setEnrichmentState(leadId, state)` – persists progress and the result. Idempotent
  (plain update), so retries are safe.

**Per-provider activity options** (all with exponential backoff, 3 attempts):

| Provider | `startToCloseTimeout` |
| -------- | --------------------- |
| Orion    | ~10 s                 |
| Nimbus   | ~5 s                  |
| Astra    | ~2 s                  |

**`enrichPhoneWorkflow(leadId)`**

1. Load the lead.
2. For each provider in order: persist "running (provider X)", call it; stop at the
   first phone.
3. If a provider still fails after its retries, **continue with the next one** — one
   flaky provider must not hide another's data.
4. Persist the outcome:
   - `FOUND` (+ which provider found it, and the phone),
   - `NOT_FOUND` — every provider answered and none had a number,
   - `FAILED` — no phone and at least one provider errored (worth retrying).

**Idempotency ("only one per lead")**

- Workflow ID `enrich-phone-<leadId>`.
- `workflowIdConflictPolicy: USE_EXISTING`: a duplicate request while a run is in
  progress attaches to it instead of starting a second one.
- A new run is allowed only after `FAILED` or `NOT_FOUND`.
- Leads that already have a phone are skipped, so imported data is never overwritten.

### 3. Rate limits (nice to have)

- Each provider's activities run on their **own task queue**
  (`<TEMPORAL_TASK_QUEUE>-provider-<name>`) served by its own worker in the same
  process.
- Throughput is capped per provider with `maxTaskQueueActivitiesPerSecond`, set from
  env (unset = unlimited). The Temporal server enforces it, so the cap holds across
  all workers, not just this process.
- Concurrency is capped per provider with `maxConcurrentActivityTaskExecutions`.
- 429s are retried after the provider's `Retry-After`.

When a provider announces limits, it's a config change, not a code change. This
decision gets its own ADR (0003).

### 4. API

- Schema: new `lead` columns `phoneEnrichmentStatus`, `phoneEnrichmentProvider`,
  `phoneEnrichedAt` + migration.
- `POST /leads/enrich-phones { leadIds }` **starts** workflows
  (`client.workflow.start`) and returns `202` with per-lead
  `started | alreadyRunning | skipped`. It does **not** wait for completion like
  `verify-emails` does: a full run can exceed 30 s.

### 5. Frontend

- "Enrich phone" bulk action next to "Verify emails".
- Phone cell shows the state:
  - running: "Searching… (Nimbus)",
  - found: the phone with a small provider badge,
  - "No data found",
  - "Failed — retry" as a clickable action.
- The leads query polls (`refetchInterval` ~2 s) only while some lead is pending or
  running, then stops.
- Toast confirms that enrichment started.

### 6. Tests

- Provider adapters: request mapping, response parsing (incl. the `phoneNmbr`
  mismatch) and error classification.
- Workflow with `@temporalio/testing` and mocked activities: early stop, fall-through
  on provider failure, `NOT_FOUND` vs `FAILED`, skipped providers.
- Frontend: phone cell states.
- `scripts/ci.sh` passes before every push.

## Task breakdown

One Conventional Commit each:

1. `feat(backend)`: provider config and adapters, with tests
2. `feat(backend)`: enrichment schema columns and migration
3. `feat(backend)`: activities, workflow and per-provider workers, with workflow tests
4. `feat(backend)`: `POST /leads/enrich-phones` endpoint
5. `feat(frontend)`: API types, bulk action, phone-cell status and polling, with tests
6. `docs`: ADR 0003 on provider rate limits

## Decisions (defaults taken, open to review)

1. **Orion needs `companyWebsite`, which leads don't have.** Derive it from the
   domain of the lead's work email; skip Orion for webmail domains (gmail.com, …).
   Alternative: a new `companyWebsite` lead field — it belongs to the "New lead
   fields" scope and would increase merge conflicts.
2. **Re-running.** One run per lead at a time; a new run only after `FAILED` or
   `NOT_FOUND`. Leads that already have a phone are skipped.
3. **Phone normalization.** Add `libphonenumber-js` for E.164 rather than a
   hand-written country-calling-code table (no dependency, but easier to get wrong).

## Conflict risk with "Feature: New lead fields"

Developed in parallel. Expected overlap: `prisma/schema.prisma` and the migration
order, `backend/src/index.ts`, `frontend/src/api/types/leads/getMany.ts`, and
`PhoneCell` in `LeadsList.tsx`. New code goes in new files where possible to keep
the overlap small.
