import { describe, expect, it } from "vitest";
import { balances, convertAmount, formatMoney, inPoolCurrency, parseAmount, parseRate, roundRotation, settle, shares, SplitError, type Expense, type RoundRecord } from "./index";

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

describe("round rotation (N-18)", () => {
  const round = (payerId: string, memberIds: string[], at: number, partyId = "tonight"): RoundRecord => ({ payerId, memberIds, at, partyId });

  it("gives everyone one turn when nobody has paid yet, in a stable order", () => {
    const { order, standings } = roundRotation(["malik", "jade", "ines"], [], "tonight");
    expect(order).toEqual(["ines", "jade", "malik"]);
    expect(standings.every((s) => s.balance === 0 && s.nightsSincePaid === null)).toBe(true);
  });

  it("sends whoever received the most drinks without paying first", () => {
    const history = [round("jade", ["jade", "malik", "ines"], 1), round("malik", ["jade", "malik", "ines"], 2)];
    // Jade +2 -1, Malik +2 -1, Inès -2: Inès pays.
    expect(roundRotation(["jade", "malik", "ines"], history, "tonight").order[0]).toBe("ines");
    // Without Inès, Jade and Malik are even; Jade paid longer ago.
    expect(roundRotation(["jade", "malik"], history, "tonight").order[0]).toBe("jade");
  });

  it("counts drinks given, so a big round pushes its payer back several turns", () => {
    const five = ["a", "b", "c", "d", "e"];
    const { order, standings } = roundRotation(five, [round("a", five, 1)], "tonight");
    expect(standings.find((s) => s.userId === "a")!.balance).toBe(4);
    // Everyone else pays once, then the books are even and A comes back.
    expect(order).toEqual(["b", "c", "d", "e", "a"]);
  });

  it("lets someone far behind pay twice in a row", () => {
    const history = [round("jade", ["jade", "malik"], 1), round("jade", ["jade", "malik"], 2)];
    expect(roundRotation(["jade", "malik"], history, "tonight").order).toEqual(["malik", "malik"]);
  });

  it("credits every member when the payer did not drink", () => {
    const { standings } = roundRotation(["jade", "malik", "ines"], [round("jade", ["malik", "ines"], 1)], "tonight");
    expect(standings.map((s) => s.balance)).toEqual([2, -1, -1]);
  });

  it("counts the drinks received from people who are not here tonight", () => {
    const history = [round("theo", ["theo", "jade"], 1, "last-week")];
    const { order, standings } = roundRotation(["jade", "malik"], history, "tonight");
    expect(order).toEqual(["jade", "malik"]);
    expect(standings[0]!.balance).toBe(-1);
  });

  it("counts nights since someone last paid over the crew's nights with rounds", () => {
    const history = [
      round("ines", ["ines", "jade"], 1, "night-1"),
      round("jade", ["ines", "jade"], 2, "night-2"),
      round("ines", ["ines", "jade"], 3, "night-3"),
      round("malik", ["malik", "jade"], 4, "tonight"),
    ];
    const standings = roundRotation(["jade", "ines", "malik", "lea"], history, "tonight").standings;
    expect(standings.map((s) => s.nightsSincePaid)).toEqual([2, 1, 0, null]);
  });

  it("counts tonight as the next night when no round was logged yet", () => {
    const standings = roundRotation(["jade"], [round("jade", ["jade", "malik"], 1, "last-week")], "tonight").standings;
    expect(standings[0]!.nightsSincePaid).toBe(1);
  });

  it("breaks a tie by who paid longest ago, never paid first", () => {
    const history = [round("jade", ["jade", "ines"], 1), round("ines", ["jade", "ines"], 2)];
    expect(roundRotation(["ines", "jade", "lea"], history, "tonight").order).toEqual(["lea", "jade", "ines"]);
  });

  it("ignores duplicate ids and has no one to name when nobody is there", () => {
    expect(roundRotation(["jade", "jade"], [round("jade", ["jade", "jade", "malik"], 1)], "tonight").standings).toEqual([{ userId: "jade", balance: 1, nightsSincePaid: 0 }]);
    expect(roundRotation([], [], "tonight")).toEqual({ order: [], standings: [] });
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

describe("expenses in another currency (N-19)", () => {
  it("reads a typed rate with a comma or a point, and refuses zero or junk", () => {
    expect(parseRate("0,0061")).toBe("0.0061");
    expect(parseRate(" 163.50 ")).toBe("163.5");
    expect(parseRate("007")).toBe("7");
    expect(parseRate("0")).toBeNull();
    expect(parseRate("0.000")).toBeNull();
    expect(parseRate("-2")).toBeNull();
    expect(parseRate("1e3")).toBeNull();
  });
  it("converts in integers, rounding half up to the cent", () => {
    // 12 000 yen at 0.0061: 73.20 euros.
    expect(convertAmount(1_200_000, "0.0061")).toBe(7320);
    expect(convertAmount(1001, "0.5")).toBe(501);
    // A large amount at a rate with nine decimals stays exact.
    expect(convertAmount(100_000_000, "17345.123456789")).toBe(1_734_512_345_679);
    expect(() => convertAmount(100, "0")).toThrow(SplitError);
  });
  it("turns a split by amounts into weights once converted, so shares still add up", () => {
    const expense: Expense = { id: "e", payerId: "a", amount: 1000, currency: "GBP", split: { kind: "amounts", amounts: { a: 300, b: 700 } } };
    const converted = inPoolCurrency(expense, "EUR", 1171);
    expect(converted.currency).toBe("EUR");
    const owed = shares(converted);
    expect(owed.a! + owed.b!).toBe(1171);
    expect(balances([converted], [], "EUR")).toEqual({ a: 820, b: -820 });
    // Same currency or no conversion: untouched.
    expect(inPoolCurrency(expense, "GBP", null)).toBe(expense);
  });
});
