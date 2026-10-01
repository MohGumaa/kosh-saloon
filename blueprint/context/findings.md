# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-20 [P3] open - Spec Verify step shows the joiner escapes as raw invisible characters

**File:** blueprint/context/current-feature.md:66
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** Verify step 3 tells the reader to confirm the name rule shows the two joiners as visible escapes, but the code span that should read `\u200c\u200d` holds the raw U+200C and U+200D characters instead, so the step renders as an empty pair of backticks and does not say what to look for. It is the same kind of invisible literal that F-18 removed from the source files, now in the spec that `/complete` archives. Confirmed by a byte scan of the file at `28cd612` (two format characters on line 66, none elsewhere). The code is not affected.
**Suggested fix:** Write the six-character escapes `\u200c\u200d` in that code span. This edits the spec, which changes the spec hash and makes the current review receipt stale, so the user may prefer to accept this entry instead; P3 does not block `/complete` either way.
**Resolution:** 2026-10-01 by /audit independent (target `e7805ad`): re-examined, still open. `blueprint/context/current-feature.md` now holds the roles and permissions spec and a scan of it finds no format characters, so the line reference above no longer applies. The raw U+200C and U+200D characters were archived unchanged with the earlier work item and are now at `blueprint/history/fixes/repair-review-findings-f-17-to-f-19.md:66` (also lines 86 and 102). That archive is outside the `7f149ad..e7805ad` delta, so this pass did not treat it as a new finding. No product code is affected. The user can fix the archive text or accept this entry; it does not block `/complete`.

### F-21 [P3] open - Audit before and after values are read outside the transaction that writes them

**File:** actions/permissions.ts:41
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `updateUserPermissions` reads the target's stored permission list (line 41), computes the `oldValue` and `newValue` lists from that read (lines 59 to 74), and only then opens the `db.$transaction([...])` that writes the change and its entry. `updateProfile` does the same with the stored name and phone (`actions/account.ts:43`). The change and its entry are saved together, as the spec requires, but the recorded before and after values are not tied to the rows the transaction actually changes. If two managers save the same user's permissions at the same moment, each entry records the list as that manager read it, so the last entry's `newValue` can differ from the list the user really ends up with (manager A adds X while manager B removes Y: B's entry says the result is empty, the stored result is X). The added and removed keys in each entry stay correct. For this feature the chance is very small and the spec asked for the array style, so this does not block. It matters more as a pattern: features 5 to 13 will copy it for invoice, expense, share percentage, and settlement entries, where a wrong recorded amount is harder to live with.
**Suggested fix:** No code change is required for this feature; the user may accept this entry. When a later feature logs financial before and after values, read the stored row inside an interactive transaction and pass that client to `recordAudit` (its second parameter already supports this), so the logged values come from the same transaction as the write. Changing the two existing actions the same way would go against the spec note "do not convert them to interactive transactions", so it needs the user's decision.
**Resolution:**

### F-22 [P3] open - The joiners in the shared single-line rule are raw invisible characters again

**File:** lib/auth/validation.ts:57
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** This feature moved the profile name rule into the exported `SINGLE_LINE_TEXT` constant, which the salon name, license number, address, and tax ID now share. At the base commit the rule held the six-character escapes `\u200c\u200d` (`lib/auth/validation.ts:63` at `6564056`). In the new constant the same class holds the raw U+200C and U+200D characters: a byte dump of line 57 shows `[` followed by `e2 80 8c e2 80 8d` and `]`, so the class reads as an empty `[]` in an editor and in review. This is the defect the closed finding F-18 repaired (archived as `repair-review-findings-f-17-to-f-19/F-18`), brought back by the refactor. Behavior is unchanged today and `lib/auth/validation.test.ts:66` would fail if a tool stripped the characters, so nothing is broken, but the rule now guards five fields instead of one and cannot be read.
**Suggested fix:** Write the class as `[\u200c\u200d]` again in `SINGLE_LINE_TEXT`. No behavior changes and no test changes are needed.
**Resolution:**

### F-23 [P3] open - The logo panel keeps a stale error after the other logo action succeeds, and two of its errors never receive focus

**File:** components/settings/LogoForm.tsx:32
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** Upload and Remove are two forms with two separate `useActionState` results, and the panel shows `uploadError ?? removeError` (lines 32, 33, 60). A failed result is only replaced by the next result of the same form. Reachable path: with a logo stored, choose a file that is not PNG, JPEG, or WebP and press Upload (the panel shows the `file_type` error), then press Remove. The removal succeeds and its toast shows, but `uploadState` is still the failure, so the red error stays next to the success toast until the page is reloaded. The reverse also holds: a failed Remove stays visible after a later successful Upload. The spec says errors clear on the next successful submit. Separately, `useFocusOnError` is given only `uploadState` (line 28), so a failed Remove and the client-side "file is larger than 1 MB" message (line 41) never move focus to the message, while the spec says a form-level error receives focus. Both are still announced through `role="alert"`. Found by reading the code; not observed in a browser.
**Suggested fix:** Show the error of whichever action finished last instead of `uploadError ?? removeError` (for example, keep one "last result" value that each action's result replaces, or clear the other form's error when one succeeds), and drive `useFocusOnError` from that same value so every form-level error in the panel receives focus.
**Resolution:**

### F-24 [P3] open - The image optimizer accepts any Vercel Blob store, not only this project's

**File:** next.config.ts:11
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `images.remotePatterns` allows `https://*.public.blob.vercel-storage.com` with no `pathname`. Per the installed Next.js docs (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md:569` and `:589`), `*` matches any single subdomain and an omitted `pathname` implies `**`. Every Vercel customer's public Blob store lives under that host, and `proxy.ts:18` leaves `/_next/image` outside the session check, so anyone on the internet can ask this deployment to fetch, resize, and serve an image from a store they control. The effect is limited to the optimizer's own guards (raster images only, SVG stays blocked), so this is not a data exposure: the cost is image-optimization usage on the salon's Vercel account and third-party images served from the app's origin. The app itself only ever renders the URL returned by its own `put` call.
**Suggested fix:** Once the Blob store exists, replace the wildcard with that store's exact hostname (`<store-id>.public.blob.vercel-storage.com`) and add `pathname: "/salon/**"`. If the hostname must stay configurable, read it from one environment variable in `next.config.ts`. No current requirement is lost. The user may also accept this entry until the store is created.
**Resolution:**

### F-25 [P3] open - The settings page copies the Panel component from the account page

**File:** app/(app)/settings/page.tsx:18
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `panelClass`, `PanelProps`, and `Panel` (lines 18 and 26 to 48) are a line-for-line copy of `app/(app)/account/page.tsx:32` to `:62`, and `panelClass` now exists a third time in `app/(app)/employees/[id]/page.tsx:18`. The spec lists the panel under "Reused as is", and features 20 and 21 add more settings tabs that will need the same panel, so a later change to the card header (spacing, heading level, theme tokens) has to be made in each copy and can drift.
**Suggested fix:** Move `Panel` and `panelClass` into one file under `components/layout/` and import it from the account and settings pages (and use the class in the employee page). Nothing else changes; no current requirement is lost.
**Resolution:**

### F-26 [P3] unverified - Two saves at the same moment can log a stale "before" value and leave one logo blob behind

**File:** actions/settings.ts:60
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `saveSettings` reads the row inside the transaction with a plain `findUnique` (through `getSalonSettings(tx)`), which takes no row lock. Under PostgreSQL's default isolation, two saves that overlap both read the same stored row before either writes. The spec accepts "last write wins" for the stored value, and that still holds. What it does not cover: (1) both audit entries record the same `oldValue`, so the later entry's "before" is not what the row held when it was overwritten (two managers changing the share from 50, one to 60 and one to 70, produce "50 to 60" and "50 to 70"); (2) two overlapping logo uploads both get the same previous URL back, so the first upload's new blob is never deleted and stays in the store. The chance is very small for a single-salon settings page. It is recorded because features 11 to 13 read the share percentage and will likely copy this write-and-audit shape for money values. Derived from the code; no concurrent run was made against a real database.
**Suggested fix:** No change is needed for this feature. If the audit trail must be exact, lock the row at the start of the transaction (for example `SELECT ... FOR UPDATE` on the settings row through `tx.$queryRaw`) so the second save reads the first save's result. To confirm, run two overlapping saves against a real database and compare the two audit entries.
**Resolution:**
