import { z } from "zod";
import { HttpError } from "./context";

/** O-02: nobody under this age gets an account, whatever the country (the app also asks 21 in the US, on the phone). */
export const MINIMUM_AGE = 18;

/** A real calendar day written YYYY-MM-DD. */
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (text) => {
      const [y, m, d] = text.split("-").map(Number) as [number, number, number];
      const date = new Date(Date.UTC(y, m - 1, d));
      return y >= 1900 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    },
    { message: "date" },
  );

/** Whole years on the day `now`. */
export function ageOn(birthDate: string, now: number): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  const today = new Date(now);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age -= 1;
  return age;
}

/** Refuses a date under the minimum age (or in the future), with one plain error the phone can show. */
export function assertOldEnough(birthDate: string, now: number): number {
  const age = ageOn(birthDate, now);
  if (age < MINIMUM_AGE) throw new HttpError(403, "under_age");
  return age;
}
