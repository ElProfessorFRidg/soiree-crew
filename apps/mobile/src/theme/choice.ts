// QOL-24: which theme the app wears. Pure, so the rule is tested without a phone.

export type ThemeChoice = "auto" | "dark" | "light";
export type ThemeName = "dark" | "light";

/** "Auto" turns light by day only, from 7 am to 7 pm: a night out always stays dark. */
export const DAY_FROM_HOUR = 7;
export const DAY_TO_HOUR = 19;

export const isDaytime = (hour: number): boolean => hour >= DAY_FROM_HOUR && hour < DAY_TO_HOUR;

/**
 * Night first (DESIGN.md §1). "Auto" follows the phone's appearance by day, so a daytime screen is
 * readable in sunlight, and keeps the dark theme in the evening and at night whatever the phone says.
 */
export function themeFor(choice: ThemeChoice, phone: string | null | undefined, daytime: boolean): ThemeName {
  if (choice !== "auto") return choice;
  return phone === "light" && daytime ? "light" : "dark";
}
