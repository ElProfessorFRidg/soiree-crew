import { describe, expect, it } from "vitest";
import { drinkKey, rankRow, type PastDrink } from "./myRow";
import { catalogueName, currentName } from "./names";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Friday 6 November 2026, 23:00 local time.
const NOW = new Date(2026, 10, 6, 23, 0).getTime();
const at = (daysAgo: number, hour: number) => {
  const date = new Date(NOW - daysAgo * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};
const past = (key: string, consumedAt: number, venueId: string | null = null): PastDrink => ({ key, consumedAt, venueId });

describe("my drinks row", () => {
  it("keys a drink by what it is, size and strength included", () => {
    expect(drinkKey({ presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 })).toBe("p:m-pint|500|50");
    expect(drinkKey({ presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.08 })).not.toBe(drinkKey({ presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }));
    // A saved drink and the entries logged from it share a key, whatever their ids.
    expect(drinkKey({ presetId: "custom:1", kind: "custom", volumeMl: 330, abv: 0.08, name: "Kasteel Rouge" })).toBe(
      drinkKey({ presetId: "cat:kasteel-rouge", kind: "custom", volumeMl: 330, abv: 0.08, name: "kasteel rouge " }),
    );
  });

  it("keeps one entry for a drink logged under its older catalogue names", () => {
    const flash = (name: string) => drinkKey({ presetId: "cat:poliakov-red-bull", kind: "custom", volumeMl: 200, abv: 0.375, name });
    expect(flash("Flash Poliakov + Red Bull")).toBe(flash("Flash vodka Red Bull"));
    expect(flash("Flash vodka")).toBe(flash("Flash vodka Red Bull"));
    // A saved drink of my own called "Flash vodka" stays mine.
    expect(currentName({ id: "custom:1", kind: "custom", name: "Flash vodka" })).toBe("Flash vodka");
  });

  it("finds the short name of a catalogue drink, logged or saved", () => {
    expect(catalogueName({ presetId: "cat:poliakov-red-bull", kind: "custom", name: "Flash Poliakov + Red Bull" })).toEqual({ name: "Flash vodka Red Bull", short: "Flash vodka" });
    expect(catalogueName({ id: "custom:2", kind: "custom", name: "Johnnie Walker Red Label" })?.short).toBe("Red Label");
    expect(catalogueName({ presetId: "cat:shandy", kind: "custom", name: "Panaché" })?.short).toBe("Panaché");
    expect(catalogueName({ presetId: "m-pint", kind: "pint" })).toBeNull();
    expect(catalogueName({ id: "custom:3", kind: "custom", name: "Mon mélange" })).toBeNull();
  });

  it("puts what I drink on Friday nights above what I drink on Tuesday afternoons", () => {
    const history = [
      ...[7, 14, 21].map((d) => past("friday-pint", at(d, 23))),
      ...[3, 10, 17, 24].map((d) => past("tuesday-coffee", at(d, 15))),
    ];
    expect(rankRow(history, [], { now: NOW, venueId: null })).toEqual(["friday-pint", "tuesday-coffee"]);
  });

  it("knows the bar: what I order here comes first while I am checked in", () => {
    const history = [past("spritz", at(7, 23), "zinc"), past("spritz", at(14, 23), "zinc"), ...[7, 14, 21].map((d) => past("pint", at(d, 23), "quai"))];
    expect(rankRow(history, [], { now: NOW, venueId: "zinc" })[0]).toBe("spritz");
    expect(rankRow(history, [], { now: NOW, venueId: "quai" })[0]).toBe("pint");
  });

  it("lifts what I had tonight, but leaves out the drink the Encore button already repeats", () => {
    const history = [...[7, 14, 21].map((d) => past("pint", at(d, 23))), past("shot", NOW - HOUR), past("cider", NOW - 2 * HOUR)];
    expect(rankRow(history, [], { now: NOW, venueId: null }).slice(0, 2).sort()).toEqual(["cider", "shot"]);
    expect(rankRow(history, [], { now: NOW, venueId: null, exclude: "shot" })).not.toContain("shot");
  });

  it("always shows saved drinks, in my order, and never a hidden one", () => {
    const history = [past("pint", at(7, 23))];
    const row = rankRow(history, ["new-favourite", "other"], { now: NOW, venueId: null, hidden: new Set(["other"]) });
    expect(row).toEqual(["pint", "new-favourite"]);
    expect(rankRow([], ["b", "a"], { now: NOW, venueId: null })).toEqual(["b", "a"]);
  });

  it("ignores drinks in the future and stops at the limit", () => {
    const history = [past("later", NOW + HOUR), ...Array.from({ length: 20 }, (_, i) => past(`d${i}`, at(i + 1, 22)))];
    const row = rankRow(history, [], { now: NOW, venueId: null }, 12);
    expect(row).toHaveLength(12);
    expect(row).not.toContain("later");
  });
});
