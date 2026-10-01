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
