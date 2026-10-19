# Operations runbook

How to deploy, configure, monitor, back up, and roll back Kosh CRM in production.
Kosh CRM runs on **Vercel** with **Prisma Postgres** (Vercel integration) for
the database, **Vercel Blob** for images, and **Resend** for email.
Access rules and their verification are in [security.md](security.md).

## Vercel project setup

1. Import the Git repository into Vercel. The framework preset is **Next.js**.
2. Vercel detects pnpm from `pnpm-lock.yaml` and the `packageManager` field.
   Use Node.js 20 or later (Project Settings > Build and Deployment).
3. Leave the build command as it is. The committed `vercel.json` sets it:

   ```sh
   if [ "$VERCEL_ENV" = "production" ]; then pnpm exec prisma migrate deploy; fi && pnpm build
   ```

   Production deployments apply pending migrations before building. Preview
   deployments only build. If a migration fails, the build fails and the
   deployment is not promoted.
4. Installing dependencies runs `prisma generate` (`postinstall`), so the Prisma
   client is always built from the committed schema.

## Integrations

- **Prisma Postgres:** add it from Vercel > Storage. It injects the
  connection string as `kosh_DATABASE_URL` (the `kosh_` prefix is chosen when
  connecting). Connect the production database to the **Production**
  environment only. Give Preview its own database, or none. Preview builds
  skip migrations, so a preview pointed at the production database could run
  new code against an old schema.
- **Vercel Blob:** add a Blob store from Vercel > Storage. It injects
  `BLOB_READ_WRITE_TOKEN`. The salon logo and employee profile images are
  stored there.
- **Resend:** create an API key and verify the sending domain in Resend, then
  set `EMAIL_API_KEY` and `EMAIL_FROM` yourself.

## Environment variables

Set these in Vercel > Project Settings > Environment Variables. `.env.example`
lists the same names for local development.

| Name | Production | Preview | Purpose |
| --- | --- | --- | --- |
| `kosh_DATABASE_URL` | Required | Required (separate database) | PostgreSQL connection string used by Prisma and migrations |
| `APP_URL` | Required | Optional | Absolute base URL for links in emails (password reset, login notifications) |
| `EMAIL_API_KEY` | Required | Optional | Resend API key. Without it production sends no email and logs an error |
| `EMAIL_FROM` | Required | Optional | Sender, for example `Kosh CRM <no-reply@your-domain>` |
| `BLOB_READ_WRITE_TOKEN` | Required | Optional | Vercel Blob token. Without it image uploads report that storage is not configured |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_USERNAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Seeding only | No | First admin account. Remove after seeding |

There is no auth secret: sessions are stored in the database.

When a production server starts, it logs one line naming any required variable
that is missing (names only, never values):

```text
[env] Missing required environment variables: APP_URL, EMAIL_API_KEY
```

## First deploy

1. Set the environment variables above for Production.
2. Deploy to production. The build applies all migrations to the empty
   database.
3. Create the first admin once, from a machine with the production connection
   string. Put `kosh_DATABASE_URL` and the four `SEED_ADMIN_*` values in a local
   `.env`, then run:

   ```sh
   pnpm exec prisma db seed
   ```

   The seed does nothing when an ADMIN already exists. The password must be
   8 to 128 characters.
4. Remove the `SEED_ADMIN_*` values and the production connection string from
   that local `.env`.
5. Sign in, then set the salon information, currency, tax rate, and employee
   share percentage in Settings.

## Migration policy

- Migrations are forward-only. Create them locally with
  `pnpm exec prisma migrate dev` and commit the generated folder under
  `prisma/migrations/`.
- Before merging, run `pnpm exec prisma migrate status` and make sure the schema
  and migrations agree.
- Never edit a migration that has already been applied in production. Fix it
  with a new migration.
- Production deploys apply pending migrations automatically. You can also apply
  them by hand with `pnpm exec prisma migrate deploy`.
- Take a manual backup (see below) before a migration that drops or rewrites
  data.

## Backups and restore

### Provider backups

Prisma Postgres has its own backups, and you restore from them in the Prisma
Console. How often they run and how long they are kept depends on your plan.
**Check the current backup and restore options for your plan in the Prisma
Console.** Don't assume a retention period.

### Manual backup

Before risky migrations, and on a regular schedule you choose, take a logical
backup with PostgreSQL's `pg_dump`. Install a client version that matches or is
newer than the server.

```sh
pg_dump "$kosh_DATABASE_URL" --format=custom --no-owner --file=kosh-$(date +%Y%m%d-%H%M).dump
```

Backup files contain all financial and personal data. Store them encrypted and
outside the repository. `.gitignore` does not cover `*.dump`.

### Restore

Restore into a **new, empty** database rather than over the live one. Check the
data, then point `kosh_DATABASE_URL` at it and redeploy.

```sh
pg_restore --no-owner --dbname="$NEW_DATABASE_URL" kosh-YYYYMMDD-HHMM.dump
```

For a plain SQL dump (`--format=plain`), use `psql "$NEW_DATABASE_URL" -f backup.sql`.

### Blob assets

The salon logo and employee profile images live in Vercel Blob, not in the
database. A database backup keeps only their URLs. Keep the Blob store when you
restore. If you need a copy, download the files from Vercel > Storage > Blob.

## Monitoring

- **Runtime logs:** see Vercel > Project > Logs. Filter for these prefixes:
  - `[request-error]`: one JSON line per unhandled server error. It has the
    message, digest, method, path (query string removed), and route.
  - `[env]`: required environment variables missing at server start.
  - `[health]`: a failed database health check.
  - Area prefixes such as `[auth]`, `[invoices]`, `[settlements]`,
    `[settings]`, and `[employees]`: failures those Server Actions caught and
    reported to the user as a generic error. Examples are a failed email send
    or an image upload without Blob storage.
- **Health check:** `GET /api/health` needs no sign-in. It returns `200
  {"status":"ok"}` when the database answers and `503 {"status":"unavailable"}`
  when it does not, and is never cached. Point any uptime monitor at
  `https://<your-domain>/api/health` to get alerts.

## Rollback

- **Code:** use Vercel Instant Rollback (Deployments > choose a previous
  production deployment > Promote / Instant Rollback). It is immediate and
  rebuilds nothing.
- **Database:** a code rollback does **not** undo migrations that were applied.
  Migrations are additive in this project, so older code usually still runs
  against a newer schema. If a schema change has to be reversed, write a new
  forward migration, or restore a backup into a new database as described
  above.
