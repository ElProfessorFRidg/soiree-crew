/**
 * ADP-05, AI-01 fallback: forgiving text matching for a drunk thumb. Accents, case and small typos
 * do not matter.
 */

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Letters and digits of any script stay (Cyrillic included); the rest is a word break.
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
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

/**
 * Keys next to each other on AZERTY and QWERTY phones: hitting the neighbour is the commonest slip
 * of a thumb (and of a drunk one), so it costs half a typo. Built once from the two layouts' rows.
 */
const ROWS = ["azertyuiop", "qsdfghjklm", "wxcvbn", "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const NEIGHBOURS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const row of ROWS) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) link(row[i]!, row[i - 1]!);
      if (i < row.length - 1) link(row[i]!, row[i + 1]!);
    }
  }
  // Rows above and below, offset as on the keyboard: a key touches the two under it.
  for (const [top, bottom] of [["azertyuiop", "qsdfghjklm"], ["qsdfghjklm", "wxcvbn"], ["qwertyuiop", "asdfghjkl"], ["asdfghjkl", "zxcvbnm"]] as const) {
    for (let i = 0; i < bottom.length; i++) {
      for (const j of [i, i + 1]) {
        const above = top[j];
        if (!above) continue;
        link(bottom[i]!, above);
        link(above, bottom[i]!);
      }
    }
  }
  return map;
})();

export function adjacentKeys(a: string, b: string): boolean {
  return NEIGHBOURS.get(a)?.has(b) ?? false;
}

/**
 * Edit distance where a neighbouring key, a doubled letter ("jaggermeister") or a dropped double
 * ("guines") costs half a typo. Transpositions ("pitne") cost one, as before.
 */
export function typoDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i]![0] = i;
  for (let j = 0; j < cols; j++) d[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const ca = a[i - 1]!;
      const cb = b[j - 1]!;
      const sub = ca === cb ? 0 : adjacentKeys(ca, cb) ? 0.5 : 1;
      // An extra copy of the letter just before (in a) or a missing one (in b) is a stutter.
      const del = i > 1 && a[i - 2] === ca ? 0.5 : 1;
      const ins = j > 1 && b[j - 2] === cb ? 0.5 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + del, d[i]![j - 1]! + ins, d[i - 1]![j - 1]! + sub);
      if (i > 1 && j > 1 && ca === b[j - 2] && a[i - 2] === cb) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Typos allowed for a word of this length: none up to three letters (vin and gin are neighbours on
 * the keyboard, and both are drinks), then one, then two. Neighbour keys and stutters cost half.
 */
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
  return scoreNormalised(normalise(query), normalise(name));
}

/** `matchScore` for strings already passed through `normalise`, so a long word list is normalised once. */
export function scoreNormalised(q: string, n: string): number | null {
  if (!q) return null;
  if (n === q) return 0;
  if (n.startsWith(q)) return 0.5;
  // Spaces typed or forgotten: "redbull" is "red bull", "jager bomb" is "jagerbomb".
  const qJoined = q.replace(/ /g, "");
  const nJoined = n.replace(/ /g, "");
  if (qJoined === nJoined) return 0.25;
  if (qJoined.length >= 4 && nJoined.startsWith(qJoined)) return 0.75;
  if (q.includes(" ") !== n.includes(" ")) {
    const joined = typoDistance(qJoined, nJoined);
    if (joined <= tolerance(Math.max(qJoined.length, nJoined.length))) return joined + 0.25;
  }
  const qWords = q.split(" ").map(stem);
  const nWords = n.split(" ").map(stem);
  let total = 0;
  for (const qw of qWords) {
    let best = Number.POSITIVE_INFINITY;
    for (const nw of nWords) {
      if (nw.startsWith(qw) && qw.length >= 2) best = Math.min(best, 0.5);
      const dist = typoDistance(qw, nw);
      if (dist <= tolerance(Math.max(qw.length, nw.length))) best = Math.min(best, dist);
    }
    if (!Number.isFinite(best)) return null;
    total += best;
  }
  return total;
}

/** The best score of a candidate over all its names, or infinity when none matches. */
export function bestScore(query: string, names: readonly string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const name of names) {
    const score = matchScore(query, name);
    if (score !== null && score < best) best = score;
  }
  return best;
}

export function search<T>(query: string, candidates: readonly Candidate<T>[], limit = 5): T[] {
  return candidates
    .map((c) => ({ value: c.value, score: bestScore(query, c.names) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => c.value);
}
