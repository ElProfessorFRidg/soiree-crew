import { describe, expect, it } from "vitest";
import { badgeKey, badgesShown, badgesToCelebrate } from "./badgeUnlocks";
import { PULL_DISTANCE, pullProgress } from "./pullProgress";

describe("pull to refresh glass (MOT-10)", () => {
  it("fills with the pull past the top and caps at full", () => {
    expect(pullProgress(0)).toBe(0);
    expect(pullProgress(120)).toBe(0);
    expect(pullProgress(-PULL_DISTANCE / 2)).toBeCloseTo(0.5);
    expect(pullProgress(-PULL_DISTANCE * 3)).toBe(1);
    expect(pullProgress(Number.NaN)).toBe(0);
  });
});

describe("badge unlock moments (MOT-10)", () => {
  const honours = [
    { userId: "me", badges: ["organiser"] },
    { userId: "lea", badges: ["boss", "homeSafe"] },
  ];

  it("on a first visit, celebrates only the viewer's own badges", () => {
    expect(badgesToCelebrate(new Set(), "crew", "me", honours)).toEqual([badgeKey("crew", "me", "organiser")]);
  });

  it("afterwards, celebrates every badge not shown yet, once", () => {
    const seen = new Set(badgesShown("crew", [{ userId: "me", badges: ["organiser"] }, { userId: "lea", badges: ["boss"] }]));
    expect(badgesToCelebrate(seen, "crew", "me", honours)).toEqual([badgeKey("crew", "lea", "homeSafe")]);
    const all = new Set(badgesShown("crew", honours));
    expect(badgesToCelebrate(all, "crew", "me", honours)).toEqual([]);
  });

  it("counts an empty first visit as a visit", () => {
    const seen = new Set(badgesShown("crew", []));
    expect(badgesToCelebrate(seen, "crew", "me", honours)).toHaveLength(3);
    // Another crew is still a first visit.
    expect(badgesToCelebrate(seen, "other", "me", honours)).toHaveLength(1);
  });
});
