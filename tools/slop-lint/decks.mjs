// R-20 game deck rules (SLOP.md §10.2), run per content file: one locale, one game.
// Thresholds are the starting values of SLOP.md, to tune with the crew panel (A-VOICE-3).

const OPENING_SHARE = 0.05;
const OPENING_MAX = 15;
const TWO_WORD_SHARE = 0.12;
const MIN_LENGTH_CV = 0.35;
const NEAR_DUPLICATE = 0.8;
const TRIAD_SHARE = 0.1;

const L = "(?<![\\p{L}\\p{N}_])";
const R = "(?![\\p{L}\\p{N}_])";
const MORALISING = new RegExp(
  `${L}(?:remember\\s+to|don'?t\\s+forget\\s+to|stay\\s+safe|drink\\s+responsibly|n'oublie\\s+pas\\s+de|pense\\s+à\\s+boire|avec\\s+modération)${R}`,
  "iu",
);
const TRIAD = /\p{L}+,\s+\p{L}+,?\s+(?:or|and|ou|et)\s+\p{L}+/u;

/** Lowercase words without placeholders or punctuation. */
export function words(text) {
  return text
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\{[^}]+\}/g, " ")
    .replace(/[^\p{L}\p{N}'’\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function opening(text, count) {
  return words(text).slice(0, count).join(" ");
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let common = 0;
  for (const w of setA) if (setB.has(w)) common += 1;
  const union = setA.size + setB.size - common;
  return union === 0 ? 0 : common / union;
}

function countBy(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

/**
 * @param {string[]} cards
 * @param {{ lengthSpread?: boolean, openings?: boolean }} options
 * @returns {{ rule: string, severity: "error" | "warn", match: string }[]}
 */
export function checkDeck(cards, options = {}) {
  const { lengthSpread = true, openings = true } = options;
  const findings = [];
  if (cards.length === 0) return findings;

  if (openings && cards.length >= 10) {
    const cap = Math.min(OPENING_MAX, Math.floor(cards.length * OPENING_SHARE));
    for (const [prefix, n] of countBy(cards.map((c) => opening(c, 4)).filter((p) => p.split(" ").length === 4))) {
      if (n > Math.max(1, cap)) findings.push({ rule: "GC-01 opening cap", severity: "error", match: `${n} cards open with "${prefix}" (cap ${cap})` });
    }
    const twoCap = Math.floor(cards.length * TWO_WORD_SHARE);
    for (const [prefix, n] of countBy(cards.map((c) => opening(c, 2)))) {
      if (n > twoCap) findings.push({ rule: "GC-01 two-word opening", severity: "warn", match: `${n} cards open with "${prefix}" (cap ${twoCap})` });
    }
  }

  if (lengthSpread && cards.length >= 10) {
    const lengths = cards.map((c) => c.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
    const cv = sd / mean;
    if (cv < MIN_LENGTH_CV) findings.push({ rule: "GC-04 length spread", severity: "error", match: `coefficient of variation ${cv.toFixed(2)} < ${MIN_LENGTH_CV}` });
  }

  const tokenised = cards.map(words);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = tokenised[i];
      const b = tokenised[j];
      const same = cards[i].trim().toLocaleLowerCase() === cards[j].trim().toLocaleLowerCase();
      if (same || (a.length >= 3 && b.length >= 3 && jaccard(a, b) >= NEAR_DUPLICATE)) {
        findings.push({ rule: "GC-10 near duplicate", severity: "error", match: `"${cards[i]}" / "${cards[j]}"` });
      }
    }
  }

  for (const card of cards) {
    const moral = card.match(MORALISING);
    if (moral) findings.push({ rule: "GC-09 moralising", severity: "error", match: moral[0] });
  }

  const triads = cards.filter((c) => TRIAD.test(c)).length;
  if (cards.length >= 10 && triads > cards.length * TRIAD_SHARE) {
    findings.push({ rule: "GC-08 triads", severity: "warn", match: `${triads} of ${cards.length} cards list exactly three items` });
  }
  return findings;
}

/** FO-09: one apostrophe convention per locale file. */
export function mixedApostrophes(texts) {
  const straight = texts.some((t) => /(?<=\p{L})'(?=\p{L})/u.test(t));
  const curly = texts.some((t) => /(?<=\p{L})’(?=\p{L})/u.test(t));
  return straight && curly;
}
