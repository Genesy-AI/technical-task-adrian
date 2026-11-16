# ADR 0002: Lead template fields: one static list per app, aligned by CI

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Message templates use `{fieldName}` variables that refer to lead fields. Both apps
need to know which variables exist:

- the **backend** (`messageGenerator.ts`) resolves them and rejects unknown ones;
- the **frontend** (`MessageTemplateModal.tsx`) offers them in the composer and should
  flag unknown ones before the request is sent.

Up to now each app kept its own hand-written list, and nothing checked that they
matched. The "New lead fields" feature adds three fields (phone number, years at
company, LinkedIn URL), and the README says the list will keep growing. Every new
field would have to be added in both places, and the build would not notice if one
were forgotten. The user would then get a variable the backend rejects, or never see
a variable the backend supports.

`backend/` and `frontend/` are independent pnpm packages with no root workspace, so
there is currently no place for code that both apps share.

## Decision

1. **The list is static and lives in each app.** Each app has a pure-data module:
   `backend/src/leadTemplateFields.ts` and `frontend/src/leadTemplateFields.ts`. Each
   exports `LEAD_TEMPLATE_FIELDS`, an `as const` array of `{ key, label }` entries in
   display order, plus the type derived from it
   (`LeadTemplateFieldKey = (typeof LEAD_TEMPLATE_FIELDS)[number]['key']`). Because
   the list is known at compile time, both apps can type against it. For example, the
   backend checks with `satisfies` that every key is a property of the Prisma `lead`
   model. There is **no runtime endpoint** that serves the list.

2. **Both files must stay identical in content, and CI enforces it.** The two
   modules hold only data and types, with no imports and no logic. That lets Node load
   them directly (`node --experimental-strip-types`, Node ≥ 22.6) without either
   package's toolchain. `scripts/check-lead-template-fields.mjs` imports both and
   compares the arrays deeply (keys, labels and order). On a mismatch it fails and
   prints the difference. The check is wired in the usual way:
   - a `contracts` target in `scripts/ci.sh` with a `lead-template-fields` check
     (`scripts/ci.sh contracts lead-template-fields`);
   - a `Contracts` job in `.github/workflows/ci.yml` with a single step calling it.
     It needs Node only, with no dependency install.

3. **Logic stays out of the shared list.** What each app does with a field (how the
   backend formats a value, how the frontend renders a picker item) lives in that
   app's code and is keyed by `LeadTemplateFieldKey`. Only the contract, meaning which
   variables exist and how they are named, is duplicated.

## Consequences

- Adding a template field means editing both `leadTemplateFields.ts` files in the same
  PR. If you forget one, the `Contracts` CI check fails with a readable diff, and
  `scripts/ci.sh` catches it before pushing.
- Both apps keep full static typing over the field keys, and the frontend needs no
  extra request or loading state before it can show the composer.
- The duplication is intentional and limited to two small files. The header comment
  in each file points to the other file and to this ADR.
- The check guards only this list. Other duplicated contracts (API request/response
  types, CSV and country-code validation) are still kept in sync by hand. Fixing that
  in general is the job of the monorepo work below.
- The data modules have to stay loadable by Node's type stripping: no enums, no
  namespaces, no runtime imports. The check fails loudly if this rule is broken.

## Alternatives considered

- **Serve the list at runtime (`GET /leads/template-fields`):** a single source of
  truth, but the frontend only learns the fields at runtime. It can't type against
  them, and it needs a request and loading/error states before the composer works.
  Rejected because we want both apps to know the fields statically.
- **A monorepo with a shared package** (pnpm workspace, e.g. `packages/lead-domain`
  holding the field list, validators and API types): the right long-term answer, and
  it removes this duplication along with the others. It means restructuring both
  packages, their lockfiles, the CI, the worktree setup script and the Orca
  hooks, which is too much risk to bundle into a feature. Deferred. When it happens,
  it supersedes this ADR.
- **Generate one file from the other** (a codegen step that writes the frontend copy
  from the backend): no drift by construction, but it adds a generation step that
  must be re-run, and generated output that must be committed or built in CI. For two
  small data files, a check is simpler than a generator.
- **Copy the list with no check:** this is how things were before this ADR, and nothing
  stopped the two lists from drifting apart. Rejected.
