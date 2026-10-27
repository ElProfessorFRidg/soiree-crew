/**
 * ADP-05, AI-01 fallback: forgiving text input for a drunk thumb. Accents, case and
 * small typos do not matter; "2 pintes et un shoot" becomes two pints and one shot.
 */

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Optimal string alignment distance (Damerau-Levenshtein without repeated edits). */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/** Typos allowed for a word of this length: none for short words, one, then two. */
function tolerance(length: number): number {
  return length <= 3 ? 0 : length <= 6 ? 1 : 2;
}

/** Plural and simple endings folded away so "pintes" finds "pinte" and "shots" finds "shot". */
function stem(word: string): string {
  return word.length > 3 ? word.replace(/(es|s|x)$/, "") : word;
}

export interface Candidate<T> {
  value: T;
  /** Every name the item answers to, in any language. */
  names: readonly string[];
}

/** How well `query` matches `name`: 0 is perfect, higher is worse, null is no match. */
export function matchScore(query: string, name: string): number | null {
  const q = normalise(query);
  const n = normalise(name);
  if (!q) return null;
  if (n === q) return 0;
  if (n.startsWith(q)) return 0.5;
  const qWords = q.split(" ").map(stem);
  const nWords = n.split(" ").map(stem);
  let total = 0;
  for (const qw of qWords) {
    let best = Number.POSITIVE_INFINITY;
    for (const nw of nWords) {
      if (nw.startsWith(qw) && qw.length >= 2) best = Math.min(best, 0.5);
      const dist = editDistance(qw, nw);
      if (dist <= tolerance(Math.max(qw.length, nw.length))) best = Math.min(best, dist);
    }
    if (!Number.isFinite(best)) return null;
    total += best;
  }
  return total;
}

export function search<T>(query: string, candidates: readonly Candidate<T>[], limit = 5): T[] {
  return candidates
    .map((c) => ({ value: c.value, score: Math.min(...c.names.map((n) => matchScore(query, n) ?? Number.POSITIVE_INFINITY)) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => c.value);
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, a: 1, an: 1, one: 1,
  deux: 2, two: 2, trois: 3, three: 3, quatre: 4, four: 4, cinq: 5, five: 5, six: 6,
};
const JOINERS = new Set(["et", "and", "puis", "then", "plus", "avec", "with", "de", "des", "of"]);

/**
 * "2 pintes et un shoot" → [{ quantity: 2, value: pint }, { quantity: 1, value: shot }].
 * Unknown words are skipped, never guessed at random.
 */
export function parseOrder<T>(text: string, candidates: readonly Candidate<T>[]): { quantity: number; value: T }[] {
  const words = normalise(text).split(" ").filter(Boolean);
  const out: { quantity: number; value: T }[] = [];
  let quantity = 1;
  let i = 0;
  while (i < words.length) {
    const word = words[i]!;
    const asNumber = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word];
    if (asNumber !== undefined && asNumber > 0 && asNumber <= 12 && i + 1 < words.length) {
      quantity = asNumber;
      i += 1;
      continue;
    }
    if (JOINERS.has(word)) {
      i += 1;
      continue;
    }
    // Longest phrase first: "grand verre de vin" before "verre".
    let matched = false;
    for (let span = Math.min(4, words.length - i); span >= 1; span--) {
      const phrase = words.slice(i, i + span).join(" ");
      const best = search(phrase, candidates, 1)[0];
      if (best !== undefined && Math.min(...candidates.find((c) => c.value === best)!.names.map((n) => matchScore(phrase, n) ?? 99)) <= span) {
        out.push({ quantity, value: best });
        quantity = 1;
        i += span;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return out;
}
