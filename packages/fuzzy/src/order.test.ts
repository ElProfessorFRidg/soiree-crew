import { describe, expect, it } from "vitest";
import { catalogueDrink, DRINK_CATALOGUE, GROUP_SPECS, strengthFits, type DrinkGroup } from "./catalogue";
import { parseDrinkOrder, tokenize } from "./order";

// The app's metric presets, as the add sheet passes them: id, French and English labels, size, group.
const PRESETS = [
  { id: "m-demi", names: ["Demi", "Half"], volumeMl: 250, group: "beer" },
  { id: "m-beer", names: ["Bière", "Beer"], volumeMl: 330, group: "beer" },
  { id: "m-pint", names: ["Pinte", "Pint"], volumeMl: 500, group: "beer" },
  { id: "m-wine", names: ["Vin", "Wine"], volumeMl: 120, group: "wine" },
  { id: "m-shot", names: ["Shot", "Shot"], volumeMl: 30, group: "spirit" },
  { id: "m-cocktail", names: ["Cocktail"], volumeMl: 200, group: "cocktail" },
  { id: "m-cider", names: ["Cidre", "Cider"], volumeMl: 330, group: "cider" },
  { id: "m-soft", names: ["Soft"], volumeMl: 330, group: "soft" },
] as const;
const candidates = PRESETS.map((p) => ({ value: p.id as string, names: p.names }));
const byId = new Map(PRESETS.map((p) => [p.id as string, p]));
const parse = (text: string) =>
  parseDrinkOrder(text, candidates, {
    presetVolume: (id) => byId.get(id)!.volumeMl,
    presetGroup: (id) => byId.get(id)!.group as DrinkGroup,
  }).map((line) => ({ quantity: line.quantity, preset: line.preset, drink: line.drink?.id ?? null, volumeMl: line.volumeMl, abv: line.abv }));

describe("drink catalogue", () => {
  it("has the strengths printed on French labels", () => {
    const abv = (id: string) => catalogueDrink(id)!.abv;
    expect(abv("kronenbourg")).toBe(0.042);
    expect(abv("1664")).toBe(0.055);
    expect(abv("kasteel-rouge")).toBe(0.08);
    expect(abv("maximator")).toBe(0.116);
    expect(abv("poliakov")).toBe(0.375);
    expect(abv("ricard")).toBe(0.45);
    expect(catalogueDrink("ricard")!.volumeMl).toBe(20);
    expect(catalogueDrink("poliakov")!.volumeMl).toBe(200);
    expect(catalogueDrink("red-bull")!.abv).toBe(0);
  });

  it("keeps ids unique, strengths inside their group and every combo made of real drinks", () => {
    const ids = DRINK_CATALOGUE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const drink of DRINK_CATALOGUE) {
      expect(strengthFits(drink.group, drink.abv), drink.id).toBe(true);
      expect(drink.volumeMl).toBeGreaterThan(0);
      expect(Boolean(drink.brand) !== Boolean(drink.generic), drink.id).toBe(true);
      for (const part of drink.combo?.parts ?? []) expect(catalogueDrink(part), `${drink.id} → ${part}`).toBeDefined();
    }
  });

  it("never offers a 40 % beer or a strong soft drink", () => {
    expect(strengthFits("beer", 0.4)).toBe(false);
    expect(strengthFits("soft", 0.05)).toBe(false);
    expect(GROUP_SPECS.beer.strengths.every((abv) => strengthFits("beer", abv))).toBe(true);
    expect(GROUP_SPECS.soft.strengths).toEqual([]);
    expect(GROUP_SPECS.spirit.sizes.map((s) => s.volumeMl)).toEqual(expect.arrayContaining([200, 350]));
  });
});

describe("order parser with brands", () => {
  it("keeps tokens a person types as one: decimals, units, percent", () => {
    expect(tokenize("Pinte 8,5% et 50cl de Kro")).toEqual(["pinte", "8.5", "%", "et", "50", "cl", "de", "kro"]);
    expect(tokenize("Jäger 35°")).toEqual(["jager", "35", "%"]);
  });

  it("still reads generic orders", () => {
    expect(parse("2 pintes et un shot")).toEqual([
      { quantity: 2, preset: "m-pint", drink: null, volumeMl: null, abv: null },
      { quantity: 1, preset: "m-shot", drink: null, volumeMl: null, abv: null },
    ]);
  });

  it("reads brands by their nicknames, with a quantity", () => {
    expect(parse("2 castel")).toEqual([{ quantity: 2, preset: null, drink: "kasteel-rouge", volumeMl: null, abv: null }]);
    expect(parse("castel rouge")[0]!.drink).toBe("kasteel-rouge");
    expect(parse("une kro")[0]!.drink).toBe("kronenbourg");
    expect(parse("1664")[0]!.drink).toBe("1664");
    expect(parse("2 1664")).toEqual([{ quantity: 2, preset: null, drink: "1664", volumeMl: null, abv: null }]);
    expect(parse("jäger")[0]!.drink).toBe("jagermeister");
    expect(parse("un pastis")[0]!.drink).toBe("ricard");
    expect(parse("get 27")[0]!.drink).toBe("get-27");
    expect(parse("bavaria 8.6")[0]!.drink).toBe("bavaria-8-6");
  });

  it("reads a strength after a drink", () => {
    expect(parse("pinte 8")).toEqual([{ quantity: 1, preset: "m-pint", drink: null, volumeMl: null, abv: 0.08 }]);
    expect(parse("pinte à 6,5 %")[0]!.abv).toBe(0.065);
    expect(parse("2 pintes 8 et un shot")).toEqual([
      { quantity: 2, preset: "m-pint", drink: null, volumeMl: null, abv: 0.08 },
      { quantity: 1, preset: "m-shot", drink: null, volumeMl: null, abv: null },
    ]);
    // No beer is 40 %: the number is dropped, the pint stays.
    expect(parse("pinte 40")[0]).toMatchObject({ preset: "m-pint", abv: null });
  });

  it("puts a brand in the glass said with it", () => {
    expect(parse("demi kro")).toEqual([{ quantity: 1, preset: "m-demi", drink: "kronenbourg", volumeMl: 250, abv: null }]);
    expect(parse("une pinte de castel")[0]).toMatchObject({ drink: "kasteel-rouge", volumeMl: 500 });
    expect(parse("33 despe")).toEqual([{ quantity: 1, preset: null, drink: "desperados", volumeMl: 330, abv: null }]);
    expect(parse("despe 50cl")[0]).toMatchObject({ drink: "desperados", volumeMl: 500 });
    expect(parse("flash polia")).toEqual([{ quantity: 1, preset: null, drink: "poliakov", volumeMl: 200, abv: null }]);
    expect(parse("flasque de polia")[0]).toMatchObject({ drink: "poliakov", volumeMl: 350 });
    expect(parse("shot de jager")[0]).toMatchObject({ drink: "jagermeister", volumeMl: 30 });
    expect(parse("canette de maxi")[0]).toMatchObject({ drink: "maximator", volumeMl: 500 });
    // A pint is not a glass for a spirit: two drinks.
    expect(parse("pinte jager").map((l) => l.preset ?? l.drink)).toEqual(["m-pint", "jagermeister"]);
  });

  it("makes a spirit and its mixer one drink", () => {
    expect(parse("polia redbull")).toEqual([{ quantity: 1, preset: null, drink: "poliakov-red-bull", volumeMl: null, abv: null }]);
    expect(parse("poliakov avec red bull")[0]!.drink).toBe("poliakov-red-bull");
    // What people call it in France.
    expect(parse("2 flash vodka")).toEqual([{ quantity: 2, preset: null, drink: "poliakov-red-bull", volumeMl: null, abv: null }]);
    expect(parse("2 jager red bull")).toEqual([{ quantity: 2, preset: null, drink: "jagerbomb", volumeMl: null, abv: null }]);
    // "et" keeps them apart.
    expect(parse("polia et redbull").map((l) => l.drink)).toEqual(["poliakov", "red-bull"]);
  });

  it("prefers the catalogue's own strength to the generic preset when both fit", () => {
    expect(parse("un cidre")[0]!.drink).toBe("cider");
    expect(parse("vin")[0]!.preset).toBe("m-wine");
    expect(parse("un rouge")[0]!.drink).toBe("red-wine");
  });

  it("skips words it does not know and short words that only look alike", () => {
    expect(parse("bonjour la team")).toEqual([]);
    expect(parse("flash")).toEqual([]);
    expect(parse("la pinte")[0]!.preset).toBe("m-pint");
  });
});
