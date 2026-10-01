# Fix: Show save confirmations as toast notifications

**Type:** Fix
**Status:** verified
**Branch:** fix/show-save-confirmations-as-toast-notifications

## The problem

The three signed-in forms confirm a successful save with an inline
`FormMessage` box at the top of the form:

- `components/employees/PermissionsForm.tsx` (Permissions tab)
- `components/account/ProfileForm.tsx` (profile details)
- `components/auth/ChangePasswordForm.tsx` (change password)

On the Permissions tab the message appears far above the Save button, so it is
easy to miss, and it stays on screen after the user changes more boxes, which
wrongly suggests those changes are saved too. The coding standards already say
to show messages through a toast, but no toast component is installed.

## The fix

- Add the shadcn/ui toast component (Sonner) with
  `pnpm dlx shadcn@latest add sonner`. This adds the `sonner` dependency and
  `components/ui/sonner.tsx`.
- Mount one `<Toaster />` in `app/layout.tsx`, inside the existing
  `ThemeProvider`, so it follows the light, dark, and system themes. Pass it the
  layout's `dir` and use the `top-center` position, which reads the same in
  English and Arabic. Its screen-reader label comes from a new key in both
  locale files.
- On a successful save, each of the three forms shows a success toast with its
  existing translated success text and no longer renders the inline success
  box. A repeated save shows the toast again.
- Errors do not change: form-level and field errors stay inline next to the
  form, with the existing focus behaviour.

Must not break:

- The login, forgot-password, and reset-password pages keep their inline
  messages, including the inline success state on forgot-password.
- `FormMessage` keeps its `success` tone for those pages.
- The Permissions form keeps submitting through `onSubmit` (F-21 repair), and
  no Server Action changes.
- No new locale strings except the toaster's screen-reader label, added to both
  `locales/en.json` and `locales/ar.json`.

## Build steps

- [x] **1. Toaster in the root layout.** Add the Sonner component and mount it
  in `app/layout.tsx` with theme, direction, position, and translated label.
  **Done when:** `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass,
  and the EN and AR locale key sets still match.
- [x] **2. Success toasts on the three forms.** Replace the inline success box
  with a success toast in the Permissions, profile, and change-password forms,
  triggered each time the action returns success.
  **Done when:** in the browser, saving on each of the three forms shows a
  toast and no inline success box; saving twice shows it twice; a failed
  change-password attempt (wrong current password) still shows the inline
  error and no toast.
- [x] **3. Verify.** Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`,
  and `pnpm build`.
  **Done when:** all four pass.

## Verify

No Browser tests command is declared, so the browser steps are done by hand
with the user's dev server (`pnpm dev`), logged in as the admin:

1. Open the Test Staff user's Permissions tab, change a box, and press Save.
   Expect a toast at the top centre and no green box above the form. Press
   Save again and expect a second toast.
2. Open `/account`, change the name or phone, and save. Expect a toast.
3. Open `/account/password`, enter a wrong current password, and submit.
   Expect the inline error and no toast. Then change the password correctly
   and expect a toast.
4. Switch to Arabic and repeat step 1. Expect Arabic text reading right to
   left inside the toast.
5. Switch between light and dark themes and repeat step 1. Expect the toast to
   match the theme.

This change is display only (no logic, data, or authorization change), so it
adds no unit tests; the existing suite must stay green.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3826,"specSha256":"a77b4f9df74914cc9355438c5ac09b3036e9393cc0758120782cf1a9ad68f836","branch":"refs/heads/fix/show-save-confirmations-as-toast-notifications","head":"b85e8c5fa04efbaaae0f523ba9834eb43d5f21c0","baseRef":"refs/heads/main","baseCommit":"b85e8c5fa04efbaaae0f523ba9834eb43d5f21c0","sourceTree":"4e7752785326fa320cf650ad4d7c46430a672417","absentOptional":[]} -->
