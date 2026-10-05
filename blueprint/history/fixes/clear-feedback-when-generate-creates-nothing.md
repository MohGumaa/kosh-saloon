# Fix: Clear feedback when Generate settlements creates nothing

**Type:** Fix
**Status:** verified
**Branch:** fix/clear-feedback-when-generate-creates-nothing

## The problem

On `/settlements`, pressing **Generate settlements** for a month with nothing to
create looks like nothing happened. Reproduced in the browser on September 2026
(all paid invoices and expenses are in October, the current month):

- `generateSettlements` (`actions/settlements.ts`) returns
  `{ success: true, created: 0 }` for two different cases: no employee had
  PAID revenue or employee expenses in the month, or every such employee already
  has a settlement.
- `GenerateSettlementsForm` shows one toast for both cases,
  `settlements.generate.nothing`: "Every employee with activity this month
  already has a settlement." In the first case that text is wrong.
- The toast closes after about 4 seconds at the top of the page, far from the
  button, so the user can miss it entirely. The page itself does not change.
- Nothing on the page says that the current month cannot be generated until it
  ends, so a user who just entered invoices does not know why last month is
  empty.

## The fix

- `generateSettlements` returns why nothing was created. The success state gains
  an optional `nothing?: "no_activity" | "already_settled"`, set only when
  `created` is 0: `no_activity` when the month has no PAID revenue and no
  employee expenses, and `already_settled` when every active employee already has
  a settlement. Permission, own-scope, month, transaction, and audit behavior do
  not change.
- `GenerateSettlementsForm`:
  - `created > 0` keeps the existing success toast.
  - `created === 0` shows no toast. Instead it shows an inline note below the
    button with `role="status"`, in muted text, with the reason's message. The
    note stays until the next submit replaces it. It is not styled as an error
    and does not take focus.
  - Errors stay as they are: inline `FormMessage` with focus.
- Strings in `en` and `ar` (replacing `generate.nothing`):
  - `generate.nothing.no_activity`: "Nothing to generate. No employee had paid
    invoices or deductions this month."
  - `generate.nothing.already_settled`: "Nothing new to generate. Every employee
    with activity this month already has a settlement."
  - `generate.hint` gains a second sentence: "The current month can be
    generated once it ends."

Must not break: the generate success toast, error messages and focus, the
STAFF view (no form), and the idempotent generate. No new component, dependency,
or tone is added; the note is a plain `<p role="status">`.

## Build steps

- [x] **1. Return the reason and show it inline.** Update `SettlementFormState`
  and `generateSettlements` in `actions/settlements.ts`, then
  `components/settlements/GenerateSettlementsForm.tsx` and both locale files.
  In `actions/settlements.test.ts`, assert `nothing: "no_activity"` for a month
  with no activity and `nothing: "already_settled"` when every active employee
  is settled, and that `nothing` is absent when settlements are created.
  **Done when** `pnpm test`, `pnpm lint`, and `pnpm exec tsc --noEmit` pass, and
  on `/settlements?month=2026-09` (no activity) pressing Generate shows the
  "No employee had paid invoices…" note under the button, which stays visible.

## Verify

1. Sign in as an ADMIN and open `/settlements` (September 2026, no activity).
   Press **Generate settlements**: the no-activity note appears under the
   button and stays; no toast appears.
2. Switch to Arabic: the note and the longer hint are translated and read
   right to left.
3. In a month that has activity (or with test data), Generate once: the
   "N settlements generated" toast appears and rows show. Generate again: the
   "Every employee with activity this month already has a settlement" note
   appears under the button.
4. As STAFF, the page still shows no Generate form.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3930,"specSha256":"87f6fa020fdecbde91b0fad73b110a4f1b2e583832d791f65a69faf2714da665","branch":"refs/heads/fix/clear-feedback-when-generate-creates-nothing","head":"813a563fa5661eda1616153764d12d7ad3d46e0e","baseRef":"refs/heads/main","baseCommit":"813a563fa5661eda1616153764d12d7ad3d46e0e","sourceTree":"838fb5dcf60852921216c7fc4fe29559f15a0e4d","absentOptional":[]} -->
