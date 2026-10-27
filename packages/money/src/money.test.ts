import { describe, expect, it } from "vitest";
import { balances, formatMoney, nextRoundPayer, parseAmount, settle, shares, SplitError, type Expense } from "./index";

const eur = (id: string, payerId: string, amount: number, split: Expense["split"]): Expense => ({ id, payerId, amount, currency: "EUR", split });

describe("splits (N-19)", () => {
  it("spreads cents so equal shares always add up", () => {
    const result = shares(eur("e", "a", 1000, { kind: "equal", members: ["a", "b", "c"] }));
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(1000);
    expect(Object.values(result).sort()).toEqual([333, 333, 334]);
  });
  it("splits by shares and by percentages", () => {
    expect(shares(eur("e", "a", 900, { kind: "shares", shares: { a: 2, b: 1 } }))).toEqual({ a: 600, b: 300 });
    expect(shares(eur("e", "a", 1000, { kind: "percent", percent: { a: 25, b: 75 } }))).toEqual({ a: 250, b: 750 });
  });
  it("refuses amounts that do not add up and percentages that are not 100", () => {
    expect(() => shares(eur("e", "a", 1000, { kind: "amounts", amounts: { a: 400, b: 500 } }))).toThrow(SplitError);
    expect(() => shares(eur("e", "a", 1000, { kind: "percent", percent: { a: 50, b: 40 } }))).toThrow(SplitError);
  });
});

describe("balances and settlement (O-70)", () => {
  it("settles a night out with the fewest transfers", () => {
    const expenses = [
      eur("1", "jade", 6000, { kind: "equal", members: ["jade", "malik", "ines"] }),
      eur("2", "malik", 3000, { kind: "equal", members: ["jade", "malik", "ines"] }),
    ];
    const balance = balances(expenses, [], "EUR");
    expect(balance).toEqual({ jade: 3000, malik: 0, ines: -3000 });
    expect(settle(balance)).toEqual([{ fromId: "ines", toId: "jade", amount: 3000 }]);
  });
  it("counts repayments already made", () => {
    const expenses = [eur("1", "jade", 2000, { kind: "equal", members: ["jade", "malik"] })];
    const balance = balances(expenses, [{ fromId: "malik", toId: "jade", amount: 1000, currency: "EUR" }], "EUR");
    expect(settle(balance)).toEqual([]);
  });
  it("needs at most n - 1 transfers", () => {
    const people = ["a", "b", "c", "d", "e"];
    const expenses = people.map((p, i) => eur(String(i), p, (i + 1) * 1337, { kind: "equal", members: people }));
    const transfers = settle(balances(expenses, [], "EUR"));
    expect(transfers.length).toBeLessThanOrEqual(people.length - 1);
    const after = balances(expenses, transfers.map((t) => ({ ...t, currency: "EUR" })), "EUR");
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
  it("keeps currencies apart on trips", () => {
    const expenses = [eur("1", "a", 1000, { kind: "equal", members: ["a", "b"] }), { ...eur("2", "b", 1000, { kind: "equal", members: ["a", "b"] }), currency: "GBP" }];
    expect(balances(expenses, [], "EUR")).toEqual({ a: 500, b: -500 });
  });
});

describe("rounds (N-18)", () => {
  it("picks whoever has paid the fewest rounds, then the least", () => {
    const history = [
      { payerId: "jade", amount: 2400, at: 1 },
      { payerId: "malik", amount: 1800, at: 2 },
    ];
    expect(nextRoundPayer(["jade", "malik", "ines"], history)).toBe("ines");
    expect(nextRoundPayer(["jade", "malik"], history)).toBe("malik");
  });
});

describe("amounts in the user's locale (QOL-08)", () => {
  it("parses a decimal comma or point", () => {
    expect(parseAmount("12,5")).toBe(1250);
    expect(parseAmount("1 234.56")).toBe(123456);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
  });
  it("formats large amounts with grouping", () => {
    expect(formatMoney(123456789, "EUR", "fr-FR").replace(/[  ]/g, " ")).toBe("1 234 567,89 €");
    expect(formatMoney(1250, "GBP", "en-GB")).toBe("£12.50");
  });
});
