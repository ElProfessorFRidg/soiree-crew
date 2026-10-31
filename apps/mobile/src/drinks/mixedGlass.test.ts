import { describe, expect, it } from "vitest";
import { ML_PER_US_FL_OZ } from "@crew/units";
import { defaultMix, halfAndHalf, mixToParts, mixTotals, nameFromParts, newPour, partsToMix, readParts, recipeText, type DrinkPart, type Mix } from "./mixedGlass";

const labels = { unnamed: "Alcool", soft: "Soft" };
const whiskyRumCola: DrinkPart[] = [
  { name: "Whisky", volumeMl: 40, abv: 0.4 },
  { name: "Rhum", volumeMl: 40, abv: 0.4 },
  { name: "Cola", volumeMl: 200, abv: 0 },
];
/** Grams of ethanol, the way the estimate reads an entry: volume × strength × 0.789. */
const grams = (drink: { volumeMl: number; abv: number }) => drink.volumeMl * drink.abv * 0.789;

describe("a mixed glass", () => {
  it("adds the pours up and keeps the pure alcohol of each", () => {
    const totals = mixTotals(whiskyRumCola);
    expect(totals.volumeMl).toBe(280);
    expect(totals.abv).toBeCloseTo(32 / 280, 5);
    // The entry logged from it holds exactly the alcohol of the two 4 cl pours.
    expect(grams(totals)).toBeCloseTo(grams({ volumeMl: 80, abv: 0.4 }), 2);
  });

  it("mixes different strengths", () => {
    const totals = mixTotals([
      { name: "Gin", volumeMl: 50, abv: 0.375 },
      { name: "Tonic", volumeMl: 150, abv: 0 },
    ]);
    expect(totals).toEqual({ volumeMl: 200, abv: 0.09375 });
  });

  it("is 0 % without spirit and empty without pours", () => {
    expect(mixTotals([{ name: "Cola", volumeMl: 330, abv: 0 }])).toEqual({ volumeMl: 330, abv: 0 });
    expect(mixTotals([])).toEqual({ volumeMl: 0, abv: 0 });
  });

  it("reads the editor in cl into millilitres, the soft included", () => {
    const mix: Mix = { pours: [{ ...newPour("cl"), name: " Whisky ", volume: 4, abvTenths: 400 }, { ...newPour("cl"), name: "Rhum", volume: 4, abvTenths: 400 }], softName: "Cola", softVolume: 20 };
    expect(mixToParts(mix, "cl")).toEqual(whiskyRumCola);
  });

  it("reads ounces too, and leaves out a soft of 0", () => {
    const mix: Mix = { pours: [{ ...newPour("us_fl_oz"), name: "Bourbon", volume: 1.5, abvTenths: 450 }], softName: "", softVolume: 0 };
    const parts = mixToParts(mix, "us_fl_oz");
    expect(parts).toEqual([{ name: "Bourbon", volumeMl: Math.round(1.5 * ML_PER_US_FL_OZ), abv: 0.45 }]);
    expect(mixTotals(parts).volumeMl).toBe(44);
  });

  it("opens a saved recipe in the user's unit, on the stepper's grid", () => {
    const inCl = partsToMix(whiskyRumCola, "cl");
    expect(inCl.pours.map((p) => [p.name, p.volume, p.abvTenths])).toEqual([
      ["Whisky", 4, 400],
      ["Rhum", 4, 400],
    ]);
    expect([inCl.softName, inCl.softVolume]).toEqual(["Cola", 20]);
    const inOz = partsToMix(whiskyRumCola, "us_fl_oz");
    // 40 ml is 1.35 oz: half-ounce steps make it 1.5; 200 ml is 6.76 oz, so 7.
    expect(inOz.pours.map((p) => p.volume)).toEqual([1.5, 1.5]);
    expect(inOz.softVolume).toBe(7);
    expect(partsToMix(whiskyRumCola, "ml").pours.map((p) => p.volume)).toEqual([40, 40]);
  });

  it("round-trips a recipe through the editor unchanged in cl and ml", () => {
    for (const unit of ["cl", "ml"] as const) expect(mixToParts(partsToMix(whiskyRumCola, unit), unit)).toEqual(whiskyRumCola);
  });

  it("starts from one spirit pour and a long drink's soft", () => {
    const mix = defaultMix("cl");
    expect(mix.pours.map((p) => [p.volume, p.abvTenths])).toEqual([[4, 400]]);
    expect(mix.softVolume).toBe(20);
    expect(defaultMix("us_fl_oz").pours[0]!.volume).toBe(1.5);
    // A spirit picked before switching to a mix becomes its first pour.
    expect(defaultMix("cl", { name: "Vodka", volumeMl: 50, abv: 0.375 }).pours[0]).toMatchObject({ name: "Vodka", volume: 5, abvTenths: 375 });
  });

  it("half and half: a second pour as big as the first, or the first two sharing what was poured", () => {
    const one = defaultMix("cl", { name: "Whisky", volumeMl: 40, abv: 0.4 });
    const halved = halfAndHalf(one, "cl");
    expect(halved.pours.map((p) => [p.name, p.volume, p.abvTenths])).toEqual([
      ["Whisky", 4, 400],
      ["", 4, 400],
    ]);
    expect(halved.pours[1]!.key).not.toBe(halved.pours[0]!.key);
    const uneven: Mix = { ...one, pours: [{ ...one.pours[0]!, volume: 3 }, { ...newPour("cl"), name: "Rhum", volume: 5 }] };
    expect(halfAndHalf(uneven, "cl").pours.map((p) => p.volume)).toEqual([4, 4]);
    const oz: Mix = { ...one, pours: [{ ...one.pours[0]!, volume: 1 }, { ...newPour("us_fl_oz"), volume: 2 }] };
    expect(halfAndHalf(oz, "us_fl_oz").pours.map((p) => p.volume)).toEqual([1.5, 1.5]);
  });

  it("writes the recipe in the user's unit", () => {
    expect(recipeText(whiskyRumCola, "cl", "fr-FR", labels)).toBe("Whisky 4 cl, Rhum 4 cl, Cola 20 cl");
    expect(recipeText(whiskyRumCola, "us_fl_oz", "en-US", labels)).toBe("Whisky 1.4 oz, Rhum 1.4 oz, Cola 6.8 oz");
    expect(recipeText([{ name: "", volumeMl: 40, abv: 0.4 }, { name: "", volumeMl: 200, abv: 0 }], "cl", "fr-FR", labels)).toBe("Alcool 4 cl, Soft 20 cl");
    expect(nameFromParts(whiskyRumCola)).toBe("Whisky + Rhum + Cola");
  });
});

describe("custom drinks saved before mixed glasses", () => {
  // As persisted in AsyncStorage and in the Keychain copy by 0.1.6: no `parts`.
  const stored = JSON.parse('{"id":"7d1c2a40-8b7e-4c1e-9a55-0d4b3f2e1a10","name":"Spritz maison","volumeMl":250,"abv":0.11,"icon":"wine","order":0}') as { parts?: unknown };

  it("open as one drink, with no recipe", () => {
    expect(readParts(stored)).toBeNull();
  });

  it("keep a recipe only when every pour makes sense", () => {
    expect(readParts({ parts: whiskyRumCola })).toEqual(whiskyRumCola);
    expect(readParts({ parts: [] })).toBeNull();
    expect(readParts({ parts: "Whisky" })).toBeNull();
    expect(readParts({ parts: [{ name: "Cola", volumeMl: 200, abv: 0 }] })).toBeNull();
    expect(readParts({ parts: [{ name: "Gin", volumeMl: -4, abv: 0.4 }] })).toBeNull();
    expect(readParts({ parts: [{ name: "Gin", volumeMl: 40, abv: 40 }] })).toBeNull();
    expect(readParts({ parts: [{ volumeMl: 40, abv: 0.4 }] })).toBeNull();
  });
});
