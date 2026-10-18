/** The next-themes values the switcher uses. */
export const THEME_VALUES = ["light", "dark", "system"] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

/** The stored `User.theme` enum. */
export type StoredTheme = "LIGHT" | "DARK" | "SYSTEM";

export function isThemeValue(value: unknown): value is ThemeValue {
  return typeof value === "string" && (THEME_VALUES as readonly string[]).includes(value);
}

export function toStoredTheme(value: ThemeValue): StoredTheme {
  return value.toUpperCase() as StoredTheme;
}

export function fromStoredTheme(value: StoredTheme): ThemeValue {
  return value.toLowerCase() as ThemeValue;
}
