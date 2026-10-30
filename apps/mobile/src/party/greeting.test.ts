import { describe, expect, it } from "vitest";
import { greetingKey, type GreetingSituation } from "./greeting";

const base: GreetingSituation = { hour: 22, bac: 0, trend: "steady", drinksTonight: 2, partyLive: true, designatedDriver: false, homeSafe: false };

describe("greeting line (JOY-02)", () => {
  it("follows the situation before the hour", () => {
    expect(greetingKey({ ...base, homeSafe: true })).toBe("greeting.home");
    expect(greetingKey({ ...base, designatedDriver: true })).toBe("greeting.driver");
    expect(greetingKey({ ...base, drinksTonight: 0 })).toBe("greeting.firstRound");
    expect(greetingKey({ ...base, trend: "rising", bac: 0.6 })).toBe("greeting.climbing");
  });

  it("says 'still standing' at 5 am only to someone still out", () => {
    expect(greetingKey({ ...base, hour: 5 })).toBe("greeting.lateNight");
    expect(greetingKey({ ...base, hour: 5, drinksTonight: 0, partyLive: false })).toBe("greeting.morning");
  });

  it("falls back to the hour", () => {
    expect(greetingKey({ ...base, partyLive: false, hour: 19 })).toBe("greeting.apero");
    expect(greetingKey({ ...base, partyLive: false, hour: 14 })).toBe("greeting.afternoon");
  });
});
