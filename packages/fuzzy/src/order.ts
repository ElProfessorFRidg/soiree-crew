import { catalogueNames, comboOf, DRINK_CATALOGUE, strengthFits, type CatalogueDrink, type DrinkGroup, type ServingId } from "./catalogue";
import { isEverydayWord, normalise, scoreNormalised, type Candidate } from "./match";

/**
 * ADP-05: one parser for everything typed in the add sheet. "2 pintes et un shoot" is two pints and
 * a shot; "2 castel" two Kasteel Rouge; "pinte 8" a pint at 8 %; "demi kro" a Kronenbourg in a demi;
 * "33 despe" a 33 cl Desperados; "polia redbull" one Flash Poliakov + Red Bull. Unknown words are
 * skipped, never guessed at random.
 */
export interface OrderLine<P> {
  quantity: number;
  /** The app's generic drink ("Pinte"), alone or as the size of a brand ("demi kro"). */
  preset: P | null;
  drink: CatalogueDrink | null;
  /** A size said in the text ("33", "50 cl", "flash", the preset under a brand), in ml. */
  volumeMl: number | null;
  /** A strength said in the text ("8", "8,5 %"), as a fraction; dropped when it cannot fit the drink. */
  abv: number | null;
  /** The drink was found despite a misspelling: the app shows "did you mean". */
  guess: boolean;
  /** The words that named the drink, as typed, so the app can learn a person's own spelling. */
  typed: string | null;
}

export interface OrderOptions<P> {
  /** Defaults to the French bar catalogue; pass [] to read generic drinks only. */
  catalogue?: readonly CatalogueDrink[];
  /** Translated names of a generic catalogue drink ("Виски" for whisky). */
  names?: (drink: CatalogueDrink) => readonly string[];
  /** The size a preset gives a brand said with it: "demi kro" is a Kronenbourg of the demi's size. */
  presetVolume?: (preset: P) => number;
  /** What kind of drink a preset is, so "pinte jager" stays two drinks and "pinte 40" no strength. */
  presetGroup?: (preset: P) => DrinkGroup | null;
  /**
   * How much to favour a brand between near ties, 0 to 0.3: the person's own habits and country.
   * It only breaks closeness; it never makes a far name match.
   */
  bonus?: (drink: CatalogueDrink) => number;
}

const NUMBER_WORDS: Record<string, number> = {
  // fr, en
  un: 1, une: 1, a: 1, an: 1, one: 1, deux: 2, two: 2, trois: 3, three: 3, quatre: 4, four: 4, cinq: 5, five: 5, six: 6,
  // es, it, pt
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, due: 2, tre: 3, quattro: 4, sei: 6, um: 1, uma: 1, dois: 2, duas: 2,
  // de (accents already folded: funf)
  ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6,
  // ru (normalise turns й into и)
  один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6,
};
/** Words between two drinks of an order: a new drink starts after them. */
const SEPARATORS = new Set(["et", "and", "puis", "then", "plus", "y", "e", "und", "и"]);
/** Words inside one drink: "pinte de kro", "polia avec redbull". */
const GLUE = new Set(["de", "des", "du", "d", "of", "avec", "with", "con", "mit", "с", "da", "di", "del", "en", "in", "au"]);
const UNITS = new Map<string, number>(Object.entries({ cl: 10, ml: 1, l: 1000, centilitre: 10, centilitres: 10, millilitre: 1, millilitres: 1 }));
const PERCENT = new Set(["%", "pourcent", "percent", "degre", "degres", "deg", "grad", "градус", "градуса", "градусов"]);
/** Sizes said as a bare number of centilitres: "33 despe", "kro 50". */
const CENTILITRE_SIZES = new Set([20, 25, 33, 35, 44, 50, 75, 100]);
const MAX_QUANTITY = 12;
/** The server refuses more in one drink. */
const MAX_VOLUME_ML = 3000;

interface ServingWord {
  serving: ServingId;
  names: readonly string[];
  volumeMl: Partial<Record<DrinkGroup, number>>;
}

/** Container words: they size the drink said with them, and mean nothing alone. */
const SERVING_WORDS: readonly ServingWord[] = [
  { serving: "flash", names: ["flash"], volumeMl: { spirit: 200 } },
  { serving: "flask", names: ["flasque", "flask"], volumeMl: { spirit: 350 } },
  { serving: "can", names: ["canette", "cannette", "can"], volumeMl: { beer: 330, cider: 330, cocktail: 330, soft: 330 } },
  { serving: "bottle", names: ["bouteille", "bottle", "teille"], volumeMl: { beer: 330, cider: 330, wine: 750, spirit: 700, soft: 500 } },
  { serving: "glass", names: ["verre", "glass"], volumeMl: { wine: 120, beer: 250, cider: 250, soft: 250 } },
  { serving: "largeGlass", names: ["grand verre", "large glass", "big glass"], volumeMl: { wine: 180, beer: 500, soft: 500 } },
  { serving: "double", names: ["double"], volumeMl: { spirit: 60 } },
  { serving: "dose", names: ["dose"], volumeMl: { spirit: 20 } },
  { serving: "litre", names: ["litre", "liter", "pichet", "pitcher"], volumeMl: { beer: 1000, cider: 1000, cocktail: 1000, soft: 1000 } },
  { serving: "demi", names: ["demi"], volumeMl: { beer: 250, cider: 250 } },
  { serving: "pint", names: ["pinte", "pint"], volumeMl: { beer: 500, cider: 500 } },
  { serving: "shot", names: ["shot", "shooter"], volumeMl: { spirit: 30 } },
];

/** Words kept as typed except accents and case; "8,5" stays one number, "50cl" becomes "50 cl". */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d)[.,](\d)/g, "$1.$2")
    .replace(/[%°]/g, " % ")
    .replace(/(\d)(cl|ml|l)(?!\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}.% ]+/gu, " ")
    .split(" ")
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

const isNumber = (word: string | undefined): word is string => word !== undefined && /^\d+(\.\d+)?$/.test(word);

type EntryBase<P> = { kind: "drink"; drink: CatalogueDrink } | { kind: "preset"; preset: P } | { kind: "serving"; serving: ServingWord };

type Entry<P> = EntryBase<P> & {
  /** Names after `normalise`, for scoring. */
  scored: string[];
  /** Names after `tokenize`, so a number in a phrase must be in the name: "get 27", "bavaria 8.6". */
  words: Set<string>;
  numericNames: Set<string>;
};

function entry<P>(base: EntryBase<P>, names: readonly string[]): Entry<P> {
  const tokens = names.map(tokenize);
  return {
    ...base,
    scored: names.map(normalise).filter(Boolean),
    words: new Set(tokens.flat()),
    numericNames: new Set(tokens.filter((t) => t.every((w) => isNumber(w))).map((t) => t.join(" "))),
  };
}

interface Draft<P> {
  quantity: number | null;
  preset: { value: P } | null;
  drink: CatalogueDrink | null;
  serving: ServingWord | null;
  volumeMl: number | null;
  abv: number | null;
  guess: boolean;
  typed: string | null;
}

const emptyDraft = <P>(): Draft<P> => ({ quantity: null, preset: null, drink: null, serving: null, volumeMl: null, abv: null, guess: false, typed: null });

export function parseDrinkOrder<P>(text: string, presets: readonly Candidate<P>[], options: OrderOptions<P> = {}): OrderLine<P>[] {
  const catalogue = options.catalogue ?? DRINK_CATALOGUE;
  // On a tie, a brand beats a generic preset, which beats a container word: "cidre" is the 4.5 % cider.
  const vocabulary: Entry<P>[] = [
    ...catalogue.map((drink) => entry<P>({ kind: "drink", drink }, catalogueNames(drink, options.names?.(drink) ?? []))),
    ...presets.map((c) => entry<P>({ kind: "preset", preset: c.value }, c.names)),
    ...SERVING_WORDS.map((serving) => entry<P>({ kind: "serving", serving }, serving.names)),
  ];
  const words = tokenize(text);
  const groupOfPreset = (preset: { value: P } | null): DrinkGroup | null => (preset && options.presetGroup ? options.presetGroup(preset.value) : null);
  const compatible = (a: DrinkGroup | null, b: DrinkGroup) => a === null || a === b;
  const boundary = (word: string) => SEPARATORS.has(word) || GLUE.has(word) || UNITS.has(word) || PERCENT.has(word) || Object.hasOwn(NUMBER_WORDS, word);

  // Longest phrase first: "grand verre de vin" before "verre", "castel rouge" before "rouge".
  const matchAt = (start: number): { entry: Entry<P>; span: number; guess: boolean; phrase: string } | null => {
    for (let span = Math.min(4, words.length - start); span >= 1; span--) {
      const slice = words.slice(start, start + span);
      if (boundary(slice[0]!) || boundary(slice[span - 1]!)) continue;
      const phrase = slice.join(" ");
      const numericOnly = slice.every((w) => isNumber(w));
      const query = normalise(phrase);
      let best: Entry<P> | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestExact = false;
      for (const candidate of vocabulary) {
        let score = Number.POSITIVE_INFINITY;
        if (numericOnly) {
          // "33" is a size and "2" a quantity, unless a drink is called exactly that ("1664").
          if (candidate.numericNames.has(phrase)) score = 0;
        } else if (slice.every((w) => !isNumber(w) || candidate.words.has(w))) {
          for (const name of candidate.scored) {
            const s = scoreNormalised(query, name);
            // One word with a typo only counts against a one-word name: "team" is not "Long Island Iced Tea".
            if (s === null || (span === 1 && s >= 1 && name.includes(" "))) continue;
            if (s < score) score = s;
          }
          // Two letters only count when exact: "la" is not La Chouffe.
          if (span === 1 && phrase.length < 3 && score > 0) score = Number.POSITIVE_INFINITY;
        }
        // On equal scores, a name said in full wins: "rouge" is red wine before Kasteel Rouge.
        const exact = candidate.scored.includes(query);
        // Habits and country tip a near tie only, never a match that is not there.
        if (Number.isFinite(score) && score > 0 && candidate.kind === "drink" && options.bonus) score = Math.max(0.01, score - Math.min(0.3, options.bonus(candidate.drink)));
        if (score < bestScore || (score === bestScore && exact && !bestExact)) {
          bestScore = score;
          best = candidate;
          bestExact = exact;
        }
      }
      // A phrase opened by an everyday word must be a name written exactly: "on se voit" is no Sex on the beach.
      if (best && span > 1 && isEverydayWord(slice[0]!) && !bestExact) continue;
      if (best && bestScore <= span) {
        // Exact or the start of a name is sure; anything reached through a misspelling is a guess.
        const guess = !bestExact && bestScore > 0 && !best.scored.some((name) => name.startsWith(query));
        return { entry: best, span, guess, phrase };
      }
    }
    return null;
  };

  const out: OrderLine<P>[] = [];
  let line = emptyDraft<P>();
  const hasItem = () => line.preset !== null || line.drink !== null;
  const flush = () => {
    const done = finish(line);
    if (done) out.push(done);
    line = emptyDraft<P>();
  };

  const finish = (draft: Draft<P>): OrderLine<P> | null => {
    if (!draft.preset && !draft.drink) return null;
    const group = draft.drink?.group ?? groupOfPreset(draft.preset);
    let volumeMl = draft.volumeMl;
    if (volumeMl === null && draft.serving && group) {
      volumeMl = draft.serving.serving === "can" && draft.drink?.can ? draft.drink.volumeMl : (draft.serving.volumeMl[group] ?? null);
    }
    if (volumeMl === null && draft.drink && draft.preset && options.presetVolume) volumeMl = options.presetVolume(draft.preset.value);
    if (volumeMl !== null && (volumeMl <= 0 || volumeMl > MAX_VOLUME_ML)) volumeMl = null;
    let abv = draft.abv;
    if (abv !== null && (group ? !strengthFits(group, abv) : abv > 0.8)) abv = null;
    return {
      quantity: Math.min(MAX_QUANTITY, Math.max(1, draft.quantity ?? 1)),
      preset: draft.preset ? draft.preset.value : null,
      drink: draft.drink,
      volumeMl,
      abv,
      guess: draft.guess,
      typed: draft.typed,
    };
  };

  const place = (found: Entry<P>) => {
    if (found.kind === "serving") {
      if ((line.serving || line.volumeMl !== null) && hasItem()) flush();
      line.serving = found.serving;
      return;
    }
    if (found.kind === "preset") {
      const preset = { value: found.preset };
      // "kro pinte", "polia shot": the preset is the brand's glass.
      if (line.drink && !line.preset && line.volumeMl === null && !line.serving && compatible(groupOfPreset(preset), line.drink.group)) {
        line.preset = preset;
        return;
      }
      if (hasItem()) flush();
      line.preset = preset;
      return;
    }
    const drink = found.drink;
    // "demi kro", "shot de jager": the brand fills the preset's glass.
    if (!line.drink && line.preset && compatible(groupOfPreset(line.preset), drink.group)) {
      line.drink = drink;
      return;
    }
    // "polia redbull": a spirit and its mixer are one drink.
    const combo = line.drink ? comboOf(line.drink, drink, catalogue) : undefined;
    if (combo) {
      line.drink = combo;
      return;
    }
    if (hasItem()) flush();
    line.drink = drink;
  };

  let i = 0;
  while (i < words.length) {
    const word = words[i]!;
    const next = words[i + 1];
    if (SEPARATORS.has(word)) {
      if (hasItem()) flush();
      i += 1;
      continue;
    }
    if (GLUE.has(word) || UNITS.has(word) || PERCENT.has(word)) {
      i += 1;
      continue;
    }
    const spelled = Object.hasOwn(NUMBER_WORDS, word) ? NUMBER_WORDS[word] : undefined;
    if (spelled !== undefined) {
      // "pinte à 8": the French "à" folds to "a", which is not "a pint" here.
      if (!(hasItem() && isNumber(next)) && next !== undefined) {
        if (hasItem()) flush();
        line.quantity = spelled;
      }
      i += 1;
      continue;
    }
    const found = matchAt(i);
    if (found) {
      place(found.entry);
      if (found.entry.kind !== "serving") {
        // The line now names this drink: remember how it was typed and whether it was a guess.
        if (found.entry.kind === "drink") line.typed = found.phrase;
        if (found.guess) line.guess = true;
      }
      i += found.span;
      continue;
    }
    if (isNumber(word)) {
      const value = Number(word);
      if (next !== undefined && UNITS.has(next)) {
        if (line.volumeMl !== null && hasItem()) flush();
        line.volumeMl = Math.round(value * UNITS.get(next)!);
        i += 2;
        continue;
      }
      if (next !== undefined && PERCENT.has(next)) {
        line.abv = value / 100;
        i += 2;
        continue;
      }
      const whole = Number.isInteger(value);
      const beforeItem = next !== undefined && matchAt(i + 1) !== null;
      if (whole && value >= 1 && value <= MAX_QUANTITY && beforeItem) {
        // "2 castel"; after a drink, "pinte 2 shots" starts the next one.
        if (hasItem()) flush();
        line.quantity = value;
      } else if (whole && CENTILITRE_SIZES.has(value) && (beforeItem || (hasItem() && line.volumeMl === null && !line.serving))) {
        line.volumeMl = value * 10;
      } else if (hasItem() && value > 0 && value <= 80) {
        // "pinte 8": a number after a drink is its strength.
        line.abv = value / 100;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  flush();
  return out;
}

/**
 * "2 pintes et un shoot" → [{ quantity: 2, value: pint }, { quantity: 1, value: shot }]: the same
 * parser with generic drinks only, for lists that have no brands.
 */
export function parseOrder<T>(text: string, candidates: readonly Candidate<T>[]): { quantity: number; value: T }[] {
  return parseDrinkOrder(text, candidates, { catalogue: [] }).flatMap((line) =>
    line.preset !== null && !line.drink ? [{ quantity: line.quantity, value: line.preset }] : [],
  );
}
