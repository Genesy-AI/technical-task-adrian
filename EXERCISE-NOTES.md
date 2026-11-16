## Exercise notes

### Preparation

- [x] try API key
- [x] try Cap
- [x] pre-run security audit (Fable)
- [x] first run
- [x] get familiar with the codebase &amp; exercise
  - [ ] custom message generation? (ui-wireframes.png; vs excalidraw)
- [ ] setup
  - [x] agents setup
  - [x] Temporal skill: [https://www.skills.sh/temporalio/skill-temporal-developer/temporal-developer](https://www.skills.sh/temporalio/skill-temporal-developer/temporal-developer)
  - [x] ..configure worktrees in Orca
  - [x] configure API key in Orca
  - [x] ...CI: build, test + use TDD
  - [x] (opt) commitlint &amp; commitizen, also in PR titles
  - [ ] the backend has no ESLint setup,

### Cleanup

- [ ] remove Cap.os

---

### Exercise

- [x] Intro
- [x] ..[p1] Bug: Email verification stalls
- [x] [p2] Bug: CSV country codes
- [ ] ...[p1 !!] Feature: Enrich phone
- [x] ..[p2] Feature: New lead fields
  - [ ] add fields
  - [ ] improve UX
  - [ ] Optional: a live preview rendered against the first selected lead.

- [x] PR review
- [x] Codebase Analysis &amp; Roadmap
- [ ] Closing

---

### Improvement ideas

- [ ] to review
  - [ ] /leads/bulk
    - [ ] WEAK: existingLeads is based on name, email woudl be better (vs probability, e.g. jev)
    - [ ] TO REVIEW: not transactional (ok?) + await inside loop
  - [ ] /leads/verify-emails
    - [ ] WEAK: await inside loop
- [ ] bugs:
  - [x] mismatch found by Claude, on CLAUDE.md
- [ ] basics
  - [x] CI/CD
  - [ ] the backend has no ESLint setup,
  - [ ] authentication -&gt; ok for an exercise?
  - [ ] types &amp; validation on endpoints (e.g. zod schemas) &amp; contracts (monorepo?)
  - [ ] error handling (e.g. status codes)
  - [ ] tests: unit, e2e
  - [x] hardcoded config: 'localhost:7233'
- [ ] docs
  - [ ] changelog
  - [ ] ADRs
  - [ ] glossary
- [ ] architecture
  - [ ] background jobs
  - [ ] ~~temporal out of backend/ ?~~
  - [ ] business logic on backend/index.ts
- [ ] o11y
  - [ ] logs
- [ ] DevEx
  - [ ] API docs (OpenAPI)
- [ ] Compliance
  - [ ] PPI data in errors (/leads/generate-messages)
  - [ ] Strict ISO list. UK (should be GB) and XK (Kosovo, not an official ISO code) are rejected. One existing seed lead in dev.db (Emily Johnson) has UK. I didn't touch existing data; only new imports are checked.
  - [ ] (o be revisited on Feat2) Phone values are messy: so converting them all to one standard format (E.164) isn't reliable.
- [ ] UX:
  - [ ] (to confirm) show which leads failed on /leads/generate-messages
  - [ ] **Optional: a live preview rendered against the first selected lead.**
  - [ ] waiting... (in all operations)
  - [ ] sort &amp; hide columns
  - [ ] **confirmation modal when deleting a lead**
  - [ ] after verifying a failing email the toast is still green, also when they're not verified (i.e. workflow failed)
  - [ ] ~~show which leads were invalidLeads in /leads/bulk, not just the count~~
- [ ] dependency updates:
  - [ ] Prisma 6.15.0 -&gt; 8.0.0-rc.33 -&gt; major update!
  - [ ] 29 packages have known advisories
- [ ] style
  - [ ] for vs functional



&nbsp;

 

