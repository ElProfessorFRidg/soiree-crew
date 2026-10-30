import type { BacTrend } from "@crew/bac";

export type GreetingKey =
  | "greeting.lateNight"
  | "greeting.morning"
  | "greeting.afternoon"
  | "greeting.apero"
  | "greeting.evening"
  | "greeting.home"
  | "greeting.driver"
  | "greeting.firstRound"
  | "greeting.climbing";

export interface GreetingSituation {
  hour: number;
  bac: number;
  trend: BacTrend;
  drinksTonight: number;
  partyLive: boolean;
  designatedDriver: boolean;
  homeSafe: boolean;
}

/**
 * JOY-02: the Party screen header line follows the night, not only the clock. The situation wins
 * over the hour: home, driving, the first glass not logged yet, a fast climb, the small hours.
 */
export function greetingKey(s: GreetingSituation): GreetingKey {
  if (s.homeSafe) return "greeting.home";
  if (s.partyLive && s.designatedDriver) return "greeting.driver";
  if (s.partyLive && s.drinksTonight === 0) return "greeting.firstRound";
  if (s.trend === "rising" && s.bac >= 0.5) return "greeting.climbing";
  // "Still standing?" belongs to whoever is still out at 5 am, not to an early riser.
  if (s.hour < 5 || (s.hour < 7 && s.drinksTonight > 0)) return "greeting.lateNight";
  if (s.hour < 11) return "greeting.morning";
  if (s.hour < 17) return "greeting.afternoon";
  if (s.hour < 21) return "greeting.apero";
  return "greeting.evening";
}
