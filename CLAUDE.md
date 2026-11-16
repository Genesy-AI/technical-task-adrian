# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

"TinyEnginy" take-home exercise: a lead-management app (Express + Prisma/SQLite + Temporal backend, React/Vite frontend). `README.md` holds the task list (CSV country-code bug, email-verification hang, new lead fields, Temporal phone-enrichment workflow with three providers, PR review, `IMPROVEMENTS.md` roadmap) and the provider API specs. Read it before working on any of those tasks. The README asks that the code be treated as production code.

`backend/` and `frontend/` are independent pnpm packages with no root workspace. Run commands from inside each directory, and use the Node version in each `.nvmrc`.

## Running in parallel worktrees

This repo is developed in several git worktrees at once (via Orca), so every port and backing-service pointer comes from env vars. Each worktree gets its own values; never hardcode them. See `docs/adr/0001-per-worktree-runtime-config.md`.
- `scripts/worktree-setup.sh` (run automatically by Orca through `orca.yaml`, or by hand) writes `backend/.env` and `frontend/.env.local`, creates the worktree's Temporal namespace, enables the repo git hooks (`.githooks/`) and installs dependencies. Read those two files for this worktree's API/web ports. They are gitignored, and new variables go in `backend/.env.example` too.
- A single Temporal dev server on `localhost:7233` is shared by all worktrees. Each worktree uses its own namespace `tinyenginy-<worktree-dir>`, which isolates workflows and task queues. Don't start another dev server.
- **`backend/prisma/dev.db` is committed, and running the app modifies it. Commit it only when a migration changes the schema or the user asks; otherwise leave it out of commits (`git restore backend/prisma/dev.db` to discard local data).**

## CI and commits

- **Before every push, run `scripts/ci.sh` and push only if it passes.** It runs exactly what `.github/workflows/ci.yml` runs on a PR: Conventional Commits check of the branch, then for each package a frozen-lockfile install, `format:check`, `lint` (frontend), `build` and the tests. `scripts/ci.sh backend` (or `frontend`, `commits`) runs one part. Fix failures properly instead of loosening the checks. If a check changes, change it in `scripts/ci.sh` so CI and local runs stay identical.
- **Every commit message and every PR title follows [Conventional Commits](https://www.conventionalcommits.org):** `<type>(<optional scope>)!: <description>`, header ≤ 100 chars. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Use `backend`, `frontend`, `ci`, … as scopes, and `!` plus a `BREAKING CHANGE:` footer for breaking changes. The rules live in `scripts/check-commit-msg.sh`. The `.githooks/commit-msg` hook (enabled by `scripts/worktree-setup.sh` via `core.hooksPath`) and CI both call it. Never bypass the hook with `--no-verify`. CI rejects non-conventional commits anywhere in the PR, including `fixup!` ones, so squash them before pushing.

## Commands

Backend (`cd backend`):
- `temporal server start-dev`: local Temporal on `localhost:7233`, shared by all worktrees. It must be running before the API starts, because the API process also boots the worker.
- `pnpm dev`: ensures the Temporal namespace exists (`pnpm temporal:namespace`), then starts the API on `$PORT` (nodemon + ts-node).
- `pnpm migrate:dev`: apply or create Prisma migrations after editing `prisma/schema.prisma`. Follow with `pnpm gen:prisma` if the client is stale.
- `pnpm test`: vitest (node env). Single file: `pnpm vitest run src/utils/messageGenerator.test.ts`. Single test: add `-t "<name>"`.
- `pnpm build`, `pnpm format` / `pnpm format:check` (prettier).

Frontend (`cd frontend`):
- `pnpm dev`: Vite dev server on `$VITE_PORT` (strict). `VITE_API_URL`/`VITE_PORT` defaults are in `frontend/.env`; the worktree's overrides are in `frontend/.env.local`.
- `pnpm test`: vitest (jsdom, setup in `src/test/setup.ts`). Single file: `pnpm vitest run src/utils/csvParser.test.ts`.
- `pnpm lint` (eslint flat config in `eslint.config.js`, zero warnings allowed), `pnpm build` (`tsc -b` + vite), `pnpm format` / `pnpm format:check`.

## Architecture

### Backend
- `src/index.ts` contains every Express route in one file, calls Prisma directly, and sets CORS by hand. At the bottom it also calls `runTemporalWorker()` (`src/worker.ts`), so the API server and the Temporal worker run in one process. Runtime config (port, DB, Temporal address/namespace/task queue) is read and validated in `src/config.ts`.
- Temporal layout: workflows go in `src/workflows/workflows.ts` (re-exported from `src/workflows/index.ts`, which the worker loads via `workflowsPath`). Activities go in `src/workflows/activities/` and are re-exported from `activities/index.ts`. Workflow code runs in Temporal's deterministic sandbox, so it must not do I/O or import Prisma or Node APIs. That work belongs in activities called via `proxyActivities`.
- `POST /leads/verify-emails` opens a new Temporal client connection per request and `await`s `client.workflow.execute` for each lead one after another, so the HTTP request blocks until every workflow finishes.
- `src/utils/messageGenerator.ts` fills in `{fieldName}` templates from a hardcoded `availableFields` map. Any template variable that is unknown or empty throws, and that lead is reported as a per-lead error.
- Prisma uses SQLite via `DATABASE_URL` (`file:./dev.db`, relative to `prisma/`). `dev.db` is committed (see the commit rule above).

### Frontend
- API layer in `src/api/`: `modules/leads.ts` declares endpoints with the typed `endpoint<Output, Input>(method, path)` helper from `api/utils.ts`. The request/response types for each endpoint live by hand in `api/types/leads/*.ts`; nothing is generated from the backend.
- Server state comes from TanStack Query under the query key `['leads', 'getMany']`. Components call `useMutation` directly and invalidate that key afterwards. `useApiMutation` (`api/mutations/useApiMutation.ts`) is a typed wrapper around a central options registry (it currently holds only `leads.create`, with an optimistic update).
- UI: `LeadsList.tsx` (table, selection, bulk actions), `CsvImportModal.tsx` (parses CSV on the client with `utils/csvParser.ts` and Papaparse, then POSTs `/leads/bulk`), `MessageTemplateModal.tsx`. Styling is Tailwind v4. Notifications use react-hot-toast.

### Adding a lead field touches all of these
`prisma/schema.prisma` + migration → `POST /leads/bulk` mapping in `index.ts` → `availableFields` in `messageGenerator.ts` → `api/types/leads/*.ts` → `csvParser.ts` (`CsvLead` + header mapping) → `LeadsList.tsx` columns → the optimistic lead in `useApiMutation.ts` → `MessageTemplateModal.tsx`.

### Known frontend/backend mismatches
- The frontend `update` endpoint sends `PUT /leads/:id`, but the backend only defines `PATCH`.
- `POST /leads` reads `name` rather than `firstName`.

### Sample data
`docs/` contains sample CSVs for import testing (including some with errors or missing fields) and UI wireframes.
