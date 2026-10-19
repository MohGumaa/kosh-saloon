# Fix: Invoice edit date picker

**Type:** Fix
**Status:** verified
**Branch:** fix/invoice-edit-date-picker

## The problem

The invoice edit form ([components/invoices/InvoiceFields.tsx](../../components/invoices/InvoiceFields.tsx))
shows the invoice date as a native `<input type="datetime-local">`. Every other
date field in the app (expense and employee-expense forms, filters, reports)
uses the themed shadcn `DatePicker` ([components/ui/date-picker.tsx](../../components/ui/date-picker.tsx)),
so this one field looks and behaves differently: browser-native popup that
ignores the light/dark theme and the Arabic calendar locale, and no "max today"
limit in the picker itself.

## The fix

Replace the native field with two controls inside one labelled group:

- **Date** - the existing `DatePicker`, defaulting to the date part
  (`YYYY-MM-DD`) of `values.date`, with `max` set to the salon's today.
- **Time** - the shadcn `Input` ([components/ui/input.tsx](../../components/ui/input.tsx))
  with `type="time"`, `dir="ltr"`, defaulting to the `HH:mm` part.
- **Combined value** - one hidden `<input name="date">` holding
  `` `${day}T${time}` ``, the exact `YYYY-MM-DDTHH:mm` string the field submits
  today. The `DatePicker` gets a non-submitted name (or an `onChange` hook) so it
  does not post a second `date` value; add the smallest change to `DatePicker`
  needed for that (an optional `onValueChange` callback), without changing its
  behavior for existing callers.

Salon "today":

- Compute it on the server with the existing `salonToday()` from `lib/expenses.ts`
  in `app/(app)/transactions/[id]/page.tsx`, pass it through `InvoiceEditForm`
  to `InvoiceFields` as `today`, exactly as the expense forms do.

Must not break:

- `actions/invoices.ts`, `invoiceDateSchema`, `parseSalonDateTime`, and
  `salonDateTimeInput` stay unchanged. The server still rejects invalid and
  future times (the picker's `max` only blocks future days; a future time on
  today is still caught server-side).
- After a failed submit, `failure.values.date` (the combined string) re-seeds
  both controls via the existing remount `key`.
- Error display: `errors.date` shows under the group, both controls get
  `aria-invalid`, and the hint (`invoices.fields.dateHint`) stays linked by
  `aria-describedby`.
- The create form passes no `date` and must still render no date field.
- RTL/Arabic and dark theme: the picker already handles both; the time input
  stays `dir="ltr"`.
- Add one `invoices.fields.time` label in `locales/en.json` and `locales/ar.json`
  only if the time input needs its own visible or `aria-label`; no other copy
  changes.

## Build steps

- [x] 1. **Swap the field.** Add `today` plumbing (page -> `InvoiceEditForm` ->
   `InvoiceFields`), the optional `DatePicker` change, and the date + time
   group with the combined hidden `date` input.
   *Done when:* the edit form shows the themed calendar and a time input,
   future days are disabled in the calendar, saving a new date and time moves
   the invoice exactly as before, and `pnpm exec tsc --noEmit`, `pnpm lint`,
   and `pnpm test` pass.

## Verify

- Open an invoice at `/transactions/<id>` as an admin: the date shows the stored
  salon day in the calendar picker and the stored time in the time input.
- Pick an earlier day and time, save: success toast, the detail panel shows the
  new date/time.
- Days after today are disabled in the calendar. Choose today with a time later
  than now: the server returns the existing "future" date error under the field,
  and both controls keep the submitted values.
- Clear the time and save: the existing invalid-date error shows.
- Switch to Arabic and dark theme: the calendar is localized and themed, layout
  is correct in RTL.
- The new-invoice form is unchanged (no date field).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3811,"specSha256":"772109bc2ebd49a1e09d4194398c0d288565c496e854ef255688471e80d461ae","branch":"refs/heads/fix/invoice-edit-date-picker","head":"f91440aa38bc3dd47ce2fd13bd53d0035ee8bab7","baseRef":"refs/heads/main","baseCommit":"f91440aa38bc3dd47ce2fd13bd53d0035ee8bab7","sourceTree":"439030aee6b0601adc821550fd70e861c106bea3","absentOptional":[]} -->
