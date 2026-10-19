# Feature: Production deployment & database operations

**From build-plan:** feature 27
**Build attempt:** 1
**Branch:** feature/production-deployment-database-operations
**Status:** verified (automated). Live runtime checks in steps 2-3 are pending `/check`.

## Goal

Make Kosh CRM ready to run on Vercel in production. Migrations should apply
safely on production deploys, missing configuration should be easy to spot,
server errors and database health should show up where an operator can see them,
and there should be a written runbook for environment setup, first deploy,
backups, restore, and rollback. This feature prepares the repository. It does
not deploy anything.

## In scope

- **Migrations on deploy:** a committed `vercel.json` `buildCommand` that runs
  `prisma migrate deploy` before `pnpm build` only when
  `VERCEL_ENV=production`. Preview and local builds skip migrations. If a
  migration fails, the build fails and the deployment is not promoted.
- **Environment check:** at server start in production (Node.js runtime), log
  one `console.error` line that names every required variable that is missing.
  It never logs values and never throws, because email and Blob already degrade
  gracefully. Required: `kosh_DATABASE_URL`, `APP_URL`, `EMAIL_API_KEY`,
  `EMAIL_FROM`, `BLOB_READ_WRITE_TOKEN`.
- **Error monitoring:** `instrumentation.ts` `onRequestError` writes one
  structured, redacted JSON log line per server error. Vercel Runtime Logs
  collects it, so no new service or dependency is needed.
- **Health endpoint:** `GET /api/health` checks the database with `SELECT 1` and
  returns `200` or `503`. It is reachable without a session so an uptime checker
  can poll it.
- **Operations runbook:** `docs/operations.md` covers the Vercel project and
  integrations, the env var matrix per environment, the first deploy and admin
  seed, the migration policy, database backups and restore, Blob assets,
  monitoring, and rollback.
- **README refresh:** fix the stale status, feature list, env section, and
  deployment section, and link the runbook. Clarify the comments in
  `.env.example` about which variables production requires.

## Out of scope

- Actually deploying, linking a Vercel project, or changing remote env vars,
  integrations, or databases. That is `/release`, and it needs a separate yes in
  chat.
- Third-party error tracking (Sentry and similar), analytics, or alerting
  services.
- In-app backup or export UI. The Settings Backup tab is listed as future in the
  overview.
- Scheduled jobs or cron. The overview has none in V1.
- `app/global-error.tsx`, loading and empty state polish, and the broader error
  UX. Those belong to feature 29.
- Security and permission testing (feature 28).
- Connection pool tuning, caching, or a CDN beyond Vercel defaults.
- Running `prisma migrate deploy` or `db seed` against any real database from
  this feature.

## Build loop

`workflow.stepReview: "feature"` means the agent implements all steps, keeps
each one working, and presents one review packet at the end.
`checkpointCommits: "disabled"` means no step commits. `/complete` creates the
single feature commit.

## Build steps

1. [x] **Ops helpers + tests.** Add `lib/ops.ts` with two pure functions:
   - `missingRequiredEnv(env: Record<string, string | undefined>): string[]`
     returns the names from the required list whose values are missing or blank
     (whitespace only), in list order.
   - `requestErrorLog(error: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string; renderSource?: string }): Record<string, string | undefined>`
     returns `{ message, digest, method, path, routePath, routeType, renderSource }`.
     `path` is stripped of its query string and hash, because reset-password
     links carry a token in the query. `message` falls back to
     `String(error)` for non-Error values. `digest` is read only when present.
     Headers, cookies, and bodies are never included.
   Add `lib/ops.test.ts` to cover: all present, missing, blank, and whitespace
   values; a path with `?token=â€¦` and `#â€¦` stripped; a non-Error throwable; and
   output that has no header or cookie keys.
   **Done when:** `pnpm test` passes, including the new tests.

2. [x] **Instrumentation.** Add a root `instrumentation.ts`:
   - `register()`: when `process.env.NEXT_RUNTIME === "nodejs"` and
     `NODE_ENV === "production"`, call `missingRequiredEnv(process.env)`. If the
     list isn't empty, log
     `console.error("[env] Missing required environment variables: A, B")`.
   - `onRequestError(err, request, context)`: log
     `console.error("[request-error]", JSON.stringify(requestErrorLog(...)))`.
   Confirm the signature against
   `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`.
   **Done when:** `pnpm exec tsc --noEmit` and `pnpm build` succeed. With
   `pnpm start` and a blank `APP_URL` override, the `[env]` line names
   `APP_URL` and no values appear in the output.

3. [x] **Health endpoint.** Add `app/api/health/route.ts` with `GET` only:
   - It runs `db.$queryRaw\`SELECT 1\``.
   - On success it returns `200` with `{"status":"ok"}`. On any error it
     returns `503` with `{"status":"unavailable"}` and logs
     `console.error("[health] database check failed", error.message)`. No error
     details go into the response.
   - Both responses carry `Cache-Control: no-store`, and the handler is never
     statically cached. Check that against the route handler docs in
     `node_modules/next/dist/docs/`.
   - Add `api/health` to the `proxy.ts` matcher exclusions so the endpoint
     isn't redirected to `/login`.
   Add `app/api/health/route.test.ts` with `@/lib/db` mocked. It covers the 200
   body and header, and the 503 body and header when the query rejects.
   **Done when:** the tests pass. In a running app, `GET /api/health` returns
   `200 {"status":"ok"}` without a cookie (not a redirect to `/login`), and
   other routes still redirect to `/login` without a session.

4. [x] **Production migrations on deploy.** Add `vercel.json`:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "buildCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then pnpm exec prisma migrate deploy; fi && pnpm build"
   }
   ```
   Keep `package.json` `build` unchanged so local builds never migrate.
   **Done when:** `vercel.json` is valid JSON. In Git Bash with `VERCEL_ENV`
   unset, the build command runs only `pnpm build` and succeeds.
   `pnpm exec prisma migrate status` (read-only) reports the local database
   schema is up to date. Do not run the production branch locally.

5. [x] **Runbook, README, and `.env.example`.** Write `docs/operations.md` with
   these sections:
   - Vercel project setup: framework preset, pnpm, Node 20+, the committed
     build command.
   - Integrations: Prisma Postgres and Blob. Recommend connecting the production
     database only to the Production environment and using a separate database
     (or none) for Preview, because preview builds skip migrations.
   - An env var table: name, required in which environments, and purpose.
   - First deploy: deploy, then run the admin seed once with `SEED_ADMIN_*`, then
     remove those variables.
   - Migration policy: forward-only, `prisma migrate status` before merging,
     applied automatically on production deploy.
   - Backups: the provider's automatic backups and restore from the Prisma
     Console (tell the reader to confirm their plan's retention), a manual
     `pg_dump` before risky migrations, and restoring with `pg_restore` or
     `psql` into a new database. Note that Blob assets (logo, profile images)
     are not in the database backup.
   - Monitoring: Vercel Runtime Logs, filtering for `[request-error]`, `[env]`,
     and `[health]`, plus pointing an uptime checker at `/api/health`.
   - Rollback: Vercel Instant Rollback for code. A schema change needs a new
     forward migration, because rolling back code does not undo applied
     migrations.

   Update `README.md`: the status line, feature lists (move shipped features to
   "Available"), the full env var list, a Deployment section that links
   `docs/operations.md`, and the project structure (`docs/`). Update the
   `.env.example` comments to mark which variables production requires. Keep the
   variable names as they are.
   **Done when:** every env var named in code (`kosh_DATABASE_URL`, `APP_URL`,
   `EMAIL_API_KEY`, `EMAIL_FROM`, `BLOB_READ_WRITE_TOKEN`, `SEED_ADMIN_*`)
   appears in the runbook table and in `.env.example`, and the README no longer
   says only Feature 1 is done.

6. [x] **Final verification.** Run `pnpm exec tsc --noEmit`, `pnpm lint`,
   `pnpm test`, `pnpm exec prisma validate`, `pnpm exec prisma migrate status`,
   and `pnpm build`.
   **Done when:** all of them pass, and the review packet lists observed results.

## Files / areas

- New: `lib/ops.ts`, `lib/ops.test.ts`, `instrumentation.ts`,
  `app/api/health/route.ts`, `app/api/health/route.test.ts`, `vercel.json`,
  `docs/operations.md`
- Changed: `proxy.ts` (matcher), `README.md`, `.env.example` (comments only)
- Read-only references: `lib/db.ts`, `lib/email.ts`, `actions/settings.ts`,
  `actions/employees.ts`, `prisma.config.ts`, `prisma/migrations/`

## Data / contracts

- `GET /api/health` is unauthenticated and GET-only.
  - `200` returns `{"status":"ok"}`. `503` returns `{"status":"unavailable"}`.
  - Responses are JSON with `Cache-Control: no-store`.
  - No version, environment, timing, or error detail appears in the body.
- The `[request-error]` log line is a JSON object with string fields `message`,
  `digest?`, `method`, `path` (no query or hash), `routePath?`, `routeType?`,
  and `renderSource?`. It never includes headers, cookies, a body, or env
  values.
- The `[env]` log line contains only variable names.
- There are no schema or migration changes.

## Testing

- Vitest unit tests: `lib/ops.test.ts` and `app/api/health/route.test.ts`
  (mocked database).
- `pnpm build` proves `instrumentation.ts`, the route, and the proxy matcher
  compile.
- A manual local run checks the health endpoint and the proxy exclusion (step
  3) and the env warning (step 2).
- Nothing can verify the Vercel production build branch locally. Report it as
  unverified until `/release` or a real deploy runs it. No browser test command
  exists, so no browser tests are added.

## Notes for the AI

- These choices were made without asking because they are reversible and need
  no new service. Call them out in the review packet:
  - Monitoring uses Vercel Runtime Logs plus a health endpoint, with no Sentry.
  - Migrations run on production deploys only.
  - Backups are a documented runbook with no in-app tool.
- Do not state Prisma Postgres backup retention, frequency, or plan details as
  fact. Tell the reader to confirm them in the Prisma Console.
- Never run `prisma migrate deploy`, `prisma migrate reset`, `db seed`,
  `vercel` CLI commands, or anything that touches a remote service. Only
  `prisma migrate status` is allowed, and it is read-only.
- Next.js 16 differs from older versions. Read the bundled docs before writing
  `instrumentation.ts` and the route handler.
- Do not log `error.stack` with request data. The message and digest are enough
  to correlate with Vercel logs.
- Match the existing `[area]` console prefix style used in `actions/settings.ts`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11492,"specSha256":"86effa9e3a9a6394b359806cb866d73343e418196775d61fc6d050389a36db7d","branch":"refs/heads/feature/production-deployment-database-operations","head":"3d6bfd7d063045249380209de0919c95e2cb8a46","baseRef":"refs/heads/main","baseCommit":"bec7aa177678ab3692843261b61b1ef22697b3b9","sourceTree":"4ed7755102cb4a488c09ace78943c6eb4ce9b863","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 3d6bfd7d063045249380209de0919c95e2cb8a46
**Base commit:** bec7aa177678ab3692843261b61b1ef22697b3b9
**Base ref:** main
**Spec hash:** 86effa9e3a9a6394b359806cb866d73343e418196775d61fc6d050389a36db7d
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-19T00:36:08Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-19T00:41:40Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `bec7aa177678ab3692843261b61b1ef22697b3b9..3d6bfd7d063045249380209de0919c95e2cb8a46` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (all match the request; only `review.md` modified)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (731 tests)
- `pnpm exec prisma validate`: pass
- `pnpm exec prisma migrate status`: pass (12 migrations, local schema up to date)
- `vercel.json` `buildCommand` run under `sh` with `VERCEL_ENV` unset: pass (ran only `pnpm build`; `/api/health` built as dynamic `ƒ`)
- `sh -c 'if true; then false; fi && echo REACHED'`: confirmed a failing migrate step short-circuits the build

## Evidence

- All 12 changed files in `bec7aa1..3d6bfd7` reviewed: `lib/ops.ts`, `lib/ops.test.ts`, `instrumentation.ts`, `app/api/health/route.ts`, `app/api/health/route.test.ts`, `proxy.ts`, `vercel.json`, `.env.example`, `README.md`, `docs/operations.md`, `blueprint/build-plan.md`, `blueprint/context/current-feature.md`.
- `requestErrorLog` drops query and hash and includes no headers, cookies, or body; `[env]` line logs names only; health responses carry `Cache-Control: no-store` and no error detail.
- Proxy matcher exclusion matches `/api/health`; the page/action session checks are unchanged.
- Runbook env table matches every `process.env` name used in app code; no `DROP` in `prisma/migrations`, supporting the "additive" claim; log prefixes cited in the runbook exist in `actions/`.

## Findings

- F-59 [P2] open: build plan checks off features 22, 23, 25 outside this spec with no history archive
- F-60 [P3] unverified: `[request-error]` raw message may echo submitted values for some Prisma errors

## Remaining risk

- The production branch of the `vercel.json` build command (`prisma migrate deploy` on Vercel) cannot be verified locally; unverified until a real deploy or `/release`.
- Live runtime checks in spec steps 2 and 3 (`pnpm start` env warning, unauthenticated `GET /api/health` and proxy redirects) were not run in this review; `/check` was not required.
- `/api/health` is unauthenticated and runs one DB query per request with no rate limit or query timeout; acceptable for V1 but a hung database holds the request until the function timeout.
- No browser test command exists.
