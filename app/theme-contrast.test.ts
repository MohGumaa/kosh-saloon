import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards WCAG 2.x contrast for the theme tokens in globals.css: 4.5:1 for text,
 * 3:1 for focus indicators. Alpha tokens are composited over the surface they sit on.
 */

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in globals.css`);
  const body = css.slice(start, css.indexOf("}", start));
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
  return tokens;
}

type Rgba = [number, number, number, number];

function parse(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  throw new Error(`Unsupported colour: ${value}`);
}

function composite([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(foreground: string, background: string): number {
  const bg = parse(background);
  const fg = composite(parse(foreground), bg);
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(":root");
const themes = { light, dark: { ...light, ...block(".dark") } };

const TEXT = 4.5;
const NON_TEXT = 3;

/** [foreground token, background token, minimum ratio] */
const PAIRS: [string, string, number][] = [
  ["foreground", "background", TEXT],
  ["foreground", "card", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "card", TEXT],
  ["destructive", "background", TEXT],
  ["destructive", "card", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["primary-foreground", "primary-hover", TEXT],
  ["primary-text", "background", TEXT],
  ["primary-text", "card", TEXT],
  ["ring", "background", NON_TEXT],
  ["ring", "card", NON_TEXT],
  ["ring", "popover", NON_TEXT],
  ["sidebar-foreground", "sidebar", TEXT],
  ["sidebar-ring", "sidebar", NON_TEXT],
];

describe.each(Object.entries(themes))("%s theme contrast", (_name, tokens) => {
  it.each(PAIRS)("--%s on --%s is at least %s:1", (fg, bg, min) => {
    expect(tokens[fg], `--${fg} is defined`).toBeDefined();
    expect(tokens[bg], `--${bg} is defined`).toBeDefined();
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
  });
});
