/**
 * ADP-05, AI-01 fallback: forgiving text matching for a drunk thumb. Three measures, the kindest
 * wins: an edit distance that knows the phone keyboard (a neighbouring key is half a typo), a
 * Jaro-Winkler similarity that rewards a right beginning ("zubrikov" for Żubrówka), and the sound
 * of the word through Double Metaphone ("jeger" sounds like "jager"). Accents and case never count.
 */
import { doubleMetaphone } from "double-metaphone";

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
 * Jaro-Winkler similarity, 0 to 1: how many letters two words share in roughly the same places,
 * with a bonus for the same first letters, where people rarely get it wrong.
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array<boolean>(a.length).fill(false);
  const bHit = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - window); j <= Math.min(b.length - 1, i + window); j++) {
      if (bHit[j] || a[i] !== b[j]) continue;
      aHit[i] = bHit[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  let swaps = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) swaps++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - swaps / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

const sounds = new Map<string, readonly string[]>();
/** Double Metaphone keys of a Latin-script word (cached: the catalogue's names come back often). */
export function soundOf(word: string): readonly string[] {
  let keys = sounds.get(word);
  if (!keys) {
    keys = /^[a-z]+$/.test(word) ? [...new Set(doubleMetaphone(word))].filter(Boolean) : [];
    if (sounds.size > 5000) sounds.clear();
    sounds.set(word, keys);
  }
  return keys;
}

/** Same first letter, or two that sound the same at the start of a word (c/k/q, f/ph, g/j, i/y, s/z/c). */
function sameStart(a: string, b: string): boolean {
  if (a[0] === b[0]) return true;
  const group = (c: string) => ("ckq".includes(c) ? "k" : "sz".includes(c) ? "s" : "iy".includes(c) ? "i" : "gj".includes(c) ? "j" : c);
  if (group(a[0]!) === group(b[0]!)) return true;
  return (a.startsWith("ph") && b[0] === "f") || (b.startsWith("ph") && a[0] === "f");
}

/**
 * Everyday words of the app's seven languages that are never a drink: they match a name only when
 * written exactly. They are what a person types around an order ("bonjour la team, 2 kro stp"), and
 * keeping them out is what lets the rest of the matching be generous.
 */
const EVERYDAY = new Set(
  [
    // fr
    "bonjour bonsoir salut coucou merci beaucoup stp svp demain aujourd hui ce soir cette nuit avec pour dans sur chez moi toi nous vous eux elle il ils elles on ca va bien tres trop encore aussi mais donc oui non team ok bon bonne soiree maison ici la le les des du au aux et ou je tu mon ma mes ton ta tes son sa ses notre votre leur qui que quoi quand comment pourquoi tout tous toute rien plus moins peu petit petite puis apres avant deja jamais toujours vite allez allons viens venez faut veux voulez peux pote potes mec meuf frere soeur copain copine gars se te me voit vois voir lundi mardi mercredi jeudi vendredi samedi dimanche matin midi heure heures minute minutes",
    // en
    "hello hi hey thanks thank please you the and with for tonight tomorrow today my your our their team guys mate mates good great very too also just then now here there what when how why yes yeah no nope all more less some monday tuesday wednesday thursday friday saturday sunday see",
    // es, it, pt
    "hola gracias manana noche esta este con para por muy bien que vamos amigo amigos ciao grazie domani sera stasera molto bene per andiamo amici ola obrigado obrigada amanha noite hoje com muito bem vamos",
    // de
    "hallo danke bitte morgen heute abend mit fur sehr gut und noch auch los freunde montag dienstag mittwoch donnerstag freitag samstag sonntag",
    // ru
    "привет спасибо пожалуиста завтра сегодня вечер очень хорошо даваи еще тоже друзья",
  ]
    .join(" ")
    .split(/\s+/),
);

export function isEverydayWord(word: string): boolean {
  return EVERYDAY.has(word);
}

/** Two Double Metaphone keys of the same name: equal, or one a final sound longer ("SPRK", "SPRKF"). */
function soundsClose(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.some((y) => x === y || (Math.min(x.length, y.length) >= 4 && Math.abs(x.length - y.length) <= 1 && (x.startsWith(y) || y.startsWith(x)))));
}

/** Below four letters, likeness and sound say nothing: "vin" and "gin" are both drinks. */
const LIKENESS_MIN = 4;
/** Jaro-Winkler from which two words are the same name misspelled. */
const LIKENESS = 0.86;

/**
 * How far one typed word is from one name word: 0 is the same, null is a different word. The
 * kindest of the keyboard distance, the likeness of the spelling and the sound.
 */
export function wordScore(typed: string, name: string): number | null {
  // An everyday word is never one word of a longer name: "on" is not in Sex on the beach for this.
  // The whole name typed exactly is matched before words are compared.
  if (EVERYDAY.has(typed)) return null;
  if (typed === name) return 0;
  let best = Number.POSITIVE_INFINITY;
  if (name.startsWith(typed) && typed.length >= 2) best = 0.5;
  const distance = typoDistance(typed, name);
  if (distance <= tolerance(Math.max(typed.length, name.length))) best = Math.min(best, distance);
  // Likeness and sound only between words that start alike: people get the first letter right,
  // and "team" must not become Damm because both end in a hum.
  if (Math.min(typed.length, name.length) >= LIKENESS_MIN && sameStart(typed, name)) {
    const likeness = jaroWinkler(typed, name);
    // 0.86 reads as 0.7, 0.9 as 0.5, 0.95 as 0.25: as good as one or half a typo.
    if (likeness >= LIKENESS) best = Math.min(best, (1 - likeness) * 5);
    if (soundsClose(soundOf(typed), soundOf(name))) best = Math.min(best, 0.75);
  } else if (Math.min(typed.length, name.length) >= LIKENESS_MIN + 2) {
    // The first letter missed ("xubrowka", "habsolut"): the rest of the word decides, at a cost,
    // smaller when the wrong key sits next to the right one.
    const miss = adjacentKeys(typed[0]!, name[0]!) ? 0.25 : 0.5;
    const restTyped = typed.slice(1);
    const restName = name.slice(1);
    const likeness = jaroWinkler(restTyped, restName);
    if (likeness >= LIKENESS + 0.04) best = Math.min(best, miss + (1 - likeness) * 5);
    if (soundsClose(soundOf(restTyped), soundOf(restName))) best = Math.min(best, miss + 0.75);
  }
  return Number.isFinite(best) ? best : null;
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
  // Not for bits of chatter: "ca va" is not Cava.
  if (qJoined === nJoined && qJoined.length >= 5) return 0.25;
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
      const score = wordScore(qw, nw);
      if (score !== null) best = Math.min(best, score);
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
