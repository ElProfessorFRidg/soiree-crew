import { describe, expect, it } from "vitest";
import { glassIcons } from "@crew/design-tokens";
import { CUSTOM_ICONS, guessIcon, moveInOrder } from "./customOrder";

const drinks = [
  { id: "a", order: 0 },
  { id: "b", order: 1 },
  { id: "c", order: 2 },
];

describe("custom drink order (O-21)", () => {
  it("swaps a drink with its neighbour and returns only what changed", () => {
    expect(moveInOrder(drinks, "c", -1)).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
    expect(moveInOrder(drinks, "a", 1)).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
    ]);
  });

  it("does nothing at either end or for an unknown drink", () => {
    expect(moveInOrder(drinks, "a", -1)).toEqual([]);
    expect(moveInOrder(drinks, "c", 1)).toEqual([]);
    expect(moveInOrder(drinks, "z", 1)).toEqual([]);
  });

  it("renumbers duplicate orders left by an older version", () => {
    const messy = [
      { id: "a", order: 3 },
      { id: "b", order: 3 },
      { id: "c", order: 7 },
    ];
    const changed = moveInOrder(messy, "c", -1);
    const result = messy.map((d) => changed.find((c) => c.id === d.id) ?? d).sort((x, y) => x.order - y.order);
    expect(result.map((d) => d.id)).toEqual(["a", "c", "b"]);
    expect(result.map((d) => d.order)).toEqual([0, 1, 2]);
  });
});

describe("custom drink icon (O-21)", () => {
  it("offers only glasses that exist", () => {
    for (const icon of CUSTOM_ICONS) expect(glassIcons[icon]).toBeTruthy();
  });

  it("guesses a glass from size and strength", () => {
    expect(guessIcon(40, 0.4)).toBe("shot");
    expect(guessIcon(500, 0.05)).toBe("pint");
    expect(guessIcon(200, 0.1)).toBe("cocktail");
    expect(guessIcon(330, 0)).toBe("soft");
  });
});
