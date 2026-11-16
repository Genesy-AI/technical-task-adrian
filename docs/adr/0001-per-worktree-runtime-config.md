# ADR 0001: Per-worktree runtime configuration

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

We develop with several git worktrees of this repo open at once, managed by
[Orca](https://orca.dev), often with one coding agent per worktree. Every worktree must
be able to run the full stack (API + Temporal worker, frontend) at the same time as the
others.

The app hardcoded every pointer to a backing service: API port `4000`, Vite's default
port, `VITE_API_URL=http://localhost:4000`, and Temporal at `localhost:7233` in namespace
`default` on task queue `myQueue`. Two worktrees running at once would either fail to
start (`EADDRINUSE`), or, worse, silently interfere: a Temporal worker polls a task
queue, so with a shared queue worktree A's worker can pick up a workflow started by
worktree B and run it with A's code against A's database.

## Decision

1. **12-factor config.** Every backing-service pointer and port is an environment
   variable, read and validated at startup in `backend/src/config.ts` (`PORT`,
   `DATABASE_URL`, `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE`) and
   in Vite (`VITE_API_URL`, `VITE_PORT`). None of them has a code default: a missing
   value stops the process with a clear error. A silent fallback to the shared
   `default` namespace would bring back exactly the cross-talk described above.
   Values come from `backend/.env` and `frontend/.env.local` (both gitignored). The
   real process environment takes precedence.

2. **One shared Temporal dev server, one namespace per worktree.** The Temporal CLI dev
   server could run once per worktree on different ports, but one shared server is
   simpler to operate and is what Temporal recommends for local development.
   Namespaces isolate workflow executions, workflow IDs, task queues and the UI list,
   so the task queue name (`tinyenginy`) can stay the same everywhere. The namespace is
   `tinyenginy-<worktree-dir>`, or `tinyenginy-main` for the main checkout.
   `pnpm dev` creates it if it's missing (`backend/scripts/ensure-temporal-namespace.sh`),
   because the dev server keeps namespaces in memory unless started with `--db-filename`.

3. **A setup script allocates per-worktree values.** `scripts/worktree-setup.sh`:
   - picks free API/web ports. The main checkout gets 4000/5173; other worktrees count
     up from 4001/5174 and skip ports already claimed in other worktrees' env files
     (found via `git worktree list`) or currently in use.
   - writes the env files and creates the namespace.
   - installs dependencies.

   It is idempotent and never overwrites existing env files, so a worktree keeps its
   ports for life. A lock in the git common dir serializes worktrees being created at
   the same moment. `scripts/worktree-teardown.sh` deletes the namespace again.

4. **Orca runs them.** `orca.yaml` wires the two scripts to Orca's `setup` and `archive`
   hooks. Outside Orca, run `scripts/worktree-setup.sh` by hand.

5. **SQLite stays a committed file per checkout.** Each worktree's checkout already has
   its own `backend/prisma/dev.db`, so databases are isolated without extra work. Running
   the app modifies the file. To keep history clean, it is committed only on schema
   changes or when explicitly asked (see `CLAUDE.md`).

## Consequences

- Any number of worktrees run in parallel with no manual configuration, and each one's
  Temporal activity can be inspected on its own in the Temporal UI (namespace switcher).
- One more prerequisite step: a fresh clone runs `scripts/worktree-setup.sh` (or copies
  `backend/.env.example`) before `pnpm dev`. The startup error says so.
- The Temporal CLI must be installed wherever `pnpm dev` runs, which it already had to be
  for the dev server.
- Orca reads `orca.yaml` from the new worktree's checkout, so hooks apply only to
  worktrees branched from a commit that contains them.
- Ports are allocated, not derived, so a worktree's URLs live in its env files, and the
  setup script prints them. Orca's `orca ports` also lists them.
- The archive hook can only clean up the namespace while the Temporal server is running.
  Leftover namespaces on a dev server are harmless.
- Production is unaffected: it gets the same variables from its real environment.

## Alternatives considered

- **A dev server per worktree** (`--port`/`--ui-port`): full isolation, but N servers to
  start and keep track of, plus ports to allocate for each.
- **Shared namespace, task queue per worktree:** prevents task stealing, but workflow IDs
  and the UI list are still shared across worktrees.
- **Ports derived from a hash of the worktree name:** stateless, but collisions are
  possible and silent.
- **A gitignored per-worktree copy of `dev.db`:** keeps git status clean, but adds a
  second database file to explain. We chose the simpler convention above.
