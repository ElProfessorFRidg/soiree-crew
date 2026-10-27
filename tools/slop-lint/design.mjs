// SLOP-08: the visual tells of an AI-made app (PROMPT.md <design_patterns>, DESIGN.md) that a
// static read of the UI code can catch. What it cannot see (cards in cards, identical grids)
// stays with the anti-slop review.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The prototype's only functional gradients (DESIGN.md): SOS ring, roulette and wheel, BAC curve,
 * plus the recipe drawings, where the gradient is the drink's own light (O-66, asked for explicitly).
 */
const GRADIENT_ALLOWED = [/sos/i, /roulette/i, /wheel/i, /curve/i, /RecipeArt/];
/** Repeating motion is allowed where it shows a state that is really changing. */
const REPEAT_ALLOWED = [/Skeleton/, /sos/i, /fuse/i, /bomb/i, /timer/i, /roulette/i, /wheel/i, /Spinner/i];

function hexToHsl(hex) {
  const full = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : hex.slice(0, 7);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/** @typedef {{ rule: string, match: string, severity?: "warn" }} Finding */

/** @returns {Finding[]} */
export function checkSource(text, file) {
  /** @type {Finding[]} */
  const out = [];
  const add = (rule, match, severity) => out.push({ rule, match, ...(severity ? { severity } : {}) });

  if (/from "expo-blur"|<BlurView\b|backdropFilter/.test(text)) add("D-02 glassmorphism", "blur behind content");
  if (/<RadialGradient\b|radial-gradient\(/.test(text)) add("D-01 radial halo", "radial gradient");
  if (/from "expo-linear-gradient"|<LinearGradient\b|linear-gradient\(/.test(text) && !GRADIENT_ALLOWED.some((re) => re.test(file)))
    add("D-01 decorative gradient", "linear gradient outside the SOS ring, wheels and BAC curve");
  if (/textShadow(Radius|Color)|text-shadow/.test(text)) add("D-03 glow", "text shadow");
  for (const m of text.matchAll(/shadowRadius:\s*(\d+)/g)) if (Number(m[1]) > 16) add("D-03 wide shadow", m[0], "warn");
  for (const m of text.matchAll(/fontFamily:\s*["'`]([^"'`]+)["'`]/g)) if (/\b(Inter|Geist)\b/.test(m[1])) add("D-05 default font", m[1]);
  if (/textTransform:\s*["']uppercase["']/.test(text)) add("D-06 all caps", "textTransform uppercase");
  if (/fontStyle:\s*["']italic["']/.test(text)) add("D-07 italic", "fontStyle italic", "warn");
  for (const m of text.matchAll(/borderRadius:\s*(\d+)/g)) {
    const r = Number(m[1]);
    if (r > 28 && r < 99) add("D-04 huge radius", m[0], "warn");
  }
  // A finite repeat is a shake or a nod; an endless one (-1) is a loop that needs a live state behind it.
  if (/withRepeat\([\s\S]{0,200}?,\s*-1/.test(text) && !REPEAT_ALLOWED.some((re) => re.test(file))) add("D-08 looping motion", "endless withRepeat outside a live state", "warn");
  for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    const { h, s, l } = hexToHsl(m[0]);
    if (s > 0.4 && l > 0.2 && l < 0.85 && h >= 235 && h <= 290) add("D-09 AI palette", `${m[0]} violet or indigo`);
    if (s > 0.6 && l > 0.45 && h >= 175 && h <= 195) add("D-09 AI palette", `${m[0]} bright cyan`);
  }
  // Emojis as icons: in UI code, outside the reaction and content lists that are user-facing on purpose.
  if (!/reaction|emoji|content/i.test(file)) {
    const jsx = text.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
    for (const m of jsx.matchAll(/>\s*(\p{Extended_Pictographic})\s*</gu)) add("D-10 emoji as icon", m[1]);
  }
  return out;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "i18n") continue;
      yield* walk(path);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

/** Every UI source file plus the design tokens. */
export function* designFindings(roots) {
  for (const root of roots) {
    for (const file of walk(root)) {
      const rel = relative(process.cwd(), file).split(sep).join("/");
      for (const finding of checkSource(readFileSync(file, "utf8"), rel)) yield [rel, finding];
    }
  }
}
