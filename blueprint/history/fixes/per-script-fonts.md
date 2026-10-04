# Fix: Per-script fonts

**Type:** Fix
**Status:** verified
**Branch:** fix/per-script-fonts

## The problem

Each language page uses a different font stack, so text in the other script
gets the wrong font:

- **English pages:** `--font-body` in `app/globals.css` is
  `var(--font-inter), system-ui, …`. It has no Tajawal, so Arabic text, such as
  a service's Arabic name, renders in a system font.
- **Arabic pages:** `:root:lang(ar)` starts the stack with Tajawal. Tajawal also
  has Latin glyphs, so English text, such as emails, usernames, and English
  service names, renders in Tajawal instead of Inter.

**Wanted:** Latin text always uses Inter and Arabic text always uses Tajawal,
whichever language the page is in.

## The fix

Use one stack for both languages, with Inter first. Inter has no Arabic glyphs,
and its `next/font` faces have no Arabic `unicode-range`, so the browser falls
through to Tajawal for Arabic characters only.

`next/font` puts a metric fallback after each font: `'Inter', 'Inter Fallback'`.
`Inter Fallback` is `local(Arial)`, which has Arabic glyphs. A plain
`var(--font-inter), var(--font-tajawal)` stack would therefore draw Arabic in
Arial. `adjustFontFallback: false` does not remove this fallback in this
Turbopack build; that was tried and confirmed.

So `app/layout.tsx` builds the stack from each font's `style.fontFamily`:
first both real fonts, then both fallbacks, then the system fonts. The result
is `'Inter', 'Tajawal', 'Inter Fallback', 'Tajawal Fallback', system-ui, …`.
The layout sets that stack as `--font-body` in the `<html>` inline style.
`app/globals.css` keeps a plain default `--font-body` and drops the
`:root:lang(ar)` override.

**This fix must not break:**

- `--font-sans` and `--font-heading` still resolve through `--font-body`.
- Inter keeps its layout-shift fallback.
- `lang`, `dir`, and RTL behavior are unchanged.

**Known effect:** digits and Latin punctuation inside Arabic sentences render
in Inter, because they are Latin-range characters. Arabic punctuation, such as
`،` and `؟`, stays in Tajawal.

The code is already in the working tree on `main`, uncommitted, from the chat
request. `/implement` moves it onto the fix branch and verifies it. It writes
no new code unless verification fails.

## Build steps

- [x] 1. **One per-script font stack.** Add the `bodyFontStack` helper and the
  inline `--font-body` to `app/layout.tsx`. In `app/globals.css`, set the
  default stack and remove the `:root:lang(ar)` override.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass, and
  the built server bundle shows the font families `'Inter', 'Inter Fallback'`
  and `'Tajawal', 'Tajawal Fallback'`. The helper relies on that shape.

## Verification

Run on `fix/per-script-fonts`, all passing:

- `pnpm exec tsc --noEmit` (no errors) and `pnpm lint` (no warnings).
- `pnpm test` (21 files, 268 tests).
- `pnpm build` (compiled). The server bundle holds
  `'Inter', 'Inter Fallback'` and `'Tajawal', 'Tajawal Fallback'`, so the
  layout produces `'Inter', 'Tajawal', 'Inter Fallback', 'Tajawal Fallback',
  system-ui, …`.

Not run: no browser was used, so the rendered fonts in the manual steps below
are unobserved.

## Verify

Automated: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
`pnpm build`.

Manual, in a browser:

1. With the language set to English, open `/services`. The Arabic name column
   should render in Tajawal, and the English text in Inter.
2. Switch to Arabic and open `/employees`. Usernames and emails should render
   in Inter, and the Arabic labels in Tajawal.
3. In DevTools, open Computed → Rendered Fonts on an Arabic cell. It should
   list Tajawal, not Arial.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3708,"specSha256":"21e54f20db11dea2c0ca820cbb311f569fd379f5ee72f121600c23f7997608bc","branch":"refs/heads/fix/per-script-fonts","head":"f908c04e4db9f33e9588ec21596ffe8d61c7e608","baseRef":"refs/heads/main","baseCommit":"f908c04e4db9f33e9588ec21596ffe8d61c7e608","sourceTree":"1e7207971d2032bd08bc8eef258563b30f9ef7e7","absentOptional":[]} -->
