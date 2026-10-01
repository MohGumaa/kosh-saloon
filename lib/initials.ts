/** Up to two initials, from the first and last word of the name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // By code point, so a character outside the basic plane (an emoji) is not cut in half.
  const first = Array.from(words[0] ?? "")[0] ?? "";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toUpperCase();
}
