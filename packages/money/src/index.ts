// Amounts are integers in minor units (cents) with their currency code (PREF-06). No floats ever
// reach a balance: remainders are spread one cent at a time, so the shares always add up.

export type Split =
  | { kind: "equal"; members: readonly string[] }
  | { kind: "shares"; shares: Readonly<Record<string, number>> }
  | { kind: "amounts"; amounts: Readonly<Record<string, number>> }
  | { kind: "percent"; percent: Readonly<Record<string, number>> };

export interface Expense {
  id: string;
  payerId: string;
  amount: number;
  currency: string;
  split: Split;
}

export interface Repayment {
  fromId: string;
  toId: string;
  amount: number;
  currency: string;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

export class SplitError extends Error {}

/** Spreads `total` over weights; the cents left by rounding go to the largest remainders, ties by id. */
function apportion(total: number, weights: Readonly<Record<string, number>>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  if (!entries.length || sum <= 0) throw new SplitError("empty_split");
  const raw = entries.map(([id, w]) => ({ id, exact: (total * w) / sum }));
  const result: Record<string, number> = {};
  let assigned = 0;
  for (const r of raw) {
    result[r.id] = Math.floor(r.exact);
    assigned += result[r.id]!;
  }
  const order = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || a.id.localeCompare(b.id));
  for (let i = 0; assigned < total; i = (i + 1) % order.length) {
    result[order[i]!.id]! += 1;
    assigned += 1;
  }
  return result;
}

/** Who owes how much of one expense (N-19: equal, shares, amounts, percentages). */
export function shares(expense: Expense): Record<string, number> {
  if (!Number.isInteger(expense.amount) || expense.amount <= 0) throw new SplitError("invalid_amount");
  const split = expense.split;
  switch (split.kind) {
    case "equal":
      return apportion(expense.amount, Object.fromEntries(split.members.map((id) => [id, 1])));
    case "shares":
      return apportion(expense.amount, split.shares);
    case "percent": {
      const total = Object.values(split.percent).reduce((s, p) => s + p, 0);
      if (Math.abs(total - 100) > 0.001) throw new SplitError("percent_not_100");
      return apportion(expense.amount, split.percent);
    }
    case "amounts": {
      const total = Object.values(split.amounts).reduce((s, a) => s + a, 0);
      if (total !== expense.amount) throw new SplitError("amounts_mismatch");
      return { ...split.amounts };
    }
  }
}

/** Net balance per member in one currency: positive means the group owes them. */
export function balances(expenses: readonly Expense[], repayments: readonly Repayment[], currency: string): Record<string, number> {
  const balance: Record<string, number> = {};
  const add = (id: string, amount: number) => {
    balance[id] = (balance[id] ?? 0) + amount;
  };
  for (const expense of expenses) {
    if (expense.currency !== currency) continue;
    add(expense.payerId, expense.amount);
    for (const [id, owed] of Object.entries(shares(expense))) add(id, -owed);
  }
  for (const r of repayments) {
    if (r.currency !== currency) continue;
    add(r.fromId, r.amount);
    add(r.toId, -r.amount);
  }
  return balance;
}

/**
 * Transfers that settle the balances (O-70 "minimum number of transfers"). Greedy on the largest
 * debtor and creditor: at most n - 1 transfers, and an exact match is used first so pairs that
 * cancel out settle in one transfer.
 */
export function settle(balance: Readonly<Record<string, number>>): Transfer[] {
  const debtors = Object.entries(balance)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amount: -v }));
  const creditors = Object.entries(balance)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amount: v }));
  const transfers: Transfer[] = [];

  // Exact matches first: one transfer clears two people.
  for (const debtor of debtors) {
    const match = creditors.find((c) => c.amount === debtor.amount && c.amount > 0);
    if (match && debtor.amount > 0) {
      transfers.push({ fromId: debtor.id, toId: match.id, amount: debtor.amount });
      match.amount = 0;
      debtor.amount = 0;
    }
  }
  for (;;) {
    const debtor = debtors.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))[0];
    const creditor = creditors.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))[0];
    if (!debtor || !creditor) break;
    const amount = Math.min(debtor.amount, creditor.amount);
    transfers.push({ fromId: debtor.id, toId: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
  }
  return transfers;
}

/**
 * N-18 fair rotation: among the people present, who pays the next round. Fewest rounds paid
 * first, then the smallest total paid, then whoever paid least recently.
 */
export function nextRoundPayer(
  present: readonly string[],
  history: readonly { payerId: string; amount: number; at: number }[],
): string | null {
  if (!present.length) return null;
  const stats = new Map(present.map((id) => [id, { rounds: 0, total: 0, last: 0 }]));
  for (const round of history) {
    const s = stats.get(round.payerId);
    if (!s) continue;
    s.rounds += 1;
    s.total += round.amount;
    s.last = Math.max(s.last, round.at);
  }
  return [...stats.entries()].sort(([a, x], [b, y]) => x.rounds - y.rounds || x.total - y.total || x.last - y.last || a.localeCompare(b))[0]![0];
}

/** Parses a typed amount in the user's locale ("12,50" or "12.50") into minor units. */
export function parseAmount(input: string, fractionDigits = 2): number | null {
  const cleaned = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 10 ** fractionDigits + Number((frac + "00").slice(0, fractionDigits));
}

/** Formats minor units for display; large amounts keep their grouping (O-70 "large amounts displayed correctly"). */
export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 100);
}
