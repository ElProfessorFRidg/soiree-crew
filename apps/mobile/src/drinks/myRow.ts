/**
 * The party screen's row of my drinks, ordered from my own history on this phone: what I usually
 * drink at this hour, on this night of the week, at this bar, and what I have had tonight. Pure, so
 * it runs on every render without a server round trip.
 */

import { currentName } from "./names";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** A night out belongs to the day it started: 1 am on Saturday is still Friday night. */
const NIGHT_SHIFT_MS = 6 * HOUR_MS;
/** How far back "tonight" reaches. */
const TONIGHT_MS = 8 * HOUR_MS;

export interface DrinkIdentity {
  presetId: string;
  kind: string;
  volumeMl: number;
  abv: number;
  name?: string;
}

/**
 * The same drink at the same size and strength is one entry of the row, however it was logged, and
 * under whichever name the catalogue gave it then ("Flash vodka" is the "Flash vodka Red Bull").
 */
export function drinkKey(drink: DrinkIdentity): string {
  const measure = `${Math.round(drink.volumeMl)}|${Math.round(drink.abv * 1000)}`;
  const name = currentName(drink);
  if (drink.kind === "custom" && name) return `n:${name.trim().toLowerCase()}|${measure}`;
  return `p:${drink.presetId}|${measure}`;
}

export interface PastDrink {
  key: string;
  consumedAt: number;
  /** The bar I was checked in at when I logged it, if any. */
  venueId: string | null;
}

export interface RowContext {
  now: number;
  /** The bar I am checked in at now. */
  venueId: string | null;
  /** Already one tap away elsewhere (the "Encore" button). */
  exclude?: string | null;
  /** Taken off the row by the user. */
  hidden?: ReadonlySet<string>;
}

const nightDay = (at: number) => new Date(at - NIGHT_SHIFT_MS).getDay();
const hourOfDay = (at: number) => {
  const date = new Date(at);
  return date.getHours() + date.getMinutes() / 60;
};

/** 1 at the same time of day, 0 three hours away or more, across midnight too. */
function hourCloseness(a: number, b: number): number {
  const diff = Math.abs(hourOfDay(a) - hourOfDay(b));
  return Math.max(0, 1 - Math.min(diff, 24 - diff) / 3);
}

/**
 * Keys best first. `saved` is "Mes boissons" in the user's order: they always appear, after what
 * the history says, so a new favourite shows before it was ever drunk.
 */
export function rankRow(history: readonly PastDrink[], saved: readonly string[], context: RowContext, limit = 12): string[] {
  const scores = new Map<string, number>();
  const add = (key: string, points: number) => scores.set(key, (scores.get(key) ?? 0) + points);
  const today = nightDay(context.now);
  for (const drink of history) {
    const age = context.now - drink.consumedAt;
    if (age < 0) continue;
    // Habits fade over a month; a bar's habit lasts a season.
    const recency = Math.exp(-age / (30 * DAY_MS));
    let points = recency * (1 + 1.5 * hourCloseness(drink.consumedAt, context.now) + (nightDay(drink.consumedAt) === today ? 1 : 0));
    if (context.venueId && drink.venueId === context.venueId) points += 2 * Math.exp(-age / (120 * DAY_MS));
    if (age < TONIGHT_MS) points += 5;
    add(drink.key, points);
  }
  saved.forEach((key, index) => add(key, 0.3 + 0.2 / (1 + index)));
  const savedIndex = new Map(saved.map((key, index) => [key, index]));
  return [...scores.entries()]
    .filter(([key]) => key !== context.exclude && !context.hidden?.has(key))
    .sort((a, b) => b[1] - a[1] || (savedIndex.get(a[0]) ?? 99) - (savedIndex.get(b[0]) ?? 99) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key);
}
