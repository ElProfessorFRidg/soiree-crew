import { describe, expect, it } from "vitest";
import { anniversary, byMonth, byWeekday, crewStreak, isoWeek, milestoneMoments, milestones } from "./stats";

describe("crew statistics helpers (N-14, JOY-06, JOY-08)", () => {
  it("knows ISO weeks across a year boundary", () => {
    expect(isoWeek("2026-11-07")).toBe("2026-W45");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
    expect(isoWeek("2027-01-04")).toBe("2027-W01");
  });

  it("counts a streak of weeks, the current week not breaking it yet", () => {
    const nights = ["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07"];
    expect(crewStreak(nights, "2026-11-08")).toEqual({ current: 4, best: 4, frozenWeeks: [], freezeAvailable: true });
    // Monday of the next week, nothing yet: the streak still holds.
    expect(crewStreak(nights, "2026-11-09").current).toBe(4);
    // Two whole weeks without a night: broken, freeze or not.
    expect(crewStreak(nights, "2026-11-24").current).toBe(0);
    expect(crewStreak(["2026-09-05", "2026-09-12", "2026-10-31"], "2026-11-01")).toMatchObject({ current: 1, best: 2 });
  });

  it("freezes one quiet week a month instead of breaking the streak (JOY-06)", () => {
    // W43, W44, W45 out; W46 quiet; this is W47.
    const nights = ["2026-10-24", "2026-10-31", "2026-11-07"];
    const frozen = crewStreak(nights, "2026-11-17");
    expect(frozen).toEqual({ current: 3, best: 3, frozenWeeks: ["2026-W46"], freezeAvailable: false });
    // The run picks up again: the frozen week does not count, the next one does.
    expect(crewStreak([...nights, "2026-11-21"], "2026-11-22")).toMatchObject({ current: 4, frozenWeeks: ["2026-W46"] });
    // A second quiet week in the same month breaks it.
    expect(crewStreak([...nights, "2026-11-21"], "2026-12-01").current).toBe(0);
    expect(crewStreak(["2026-10-31", "2026-11-14", "2026-11-28"], "2026-11-29")).toMatchObject({ current: 1, frozenWeeks: [] });
    // A new month brings a new freeze.
    expect(crewStreak(["2026-11-21", "2026-12-05"], "2026-12-06")).toMatchObject({ current: 2, frozenWeeks: ["2026-W48"], freezeAvailable: true });
  });

  it("finds anniversaries and milestone moments (JOY-08)", () => {
    expect(anniversary("2025-11-07", "2026-11-06")).toEqual({ years: 0, night: null });
    expect(anniversary("2025-11-07", "2026-11-07")).toEqual({ years: 1, night: "2026-11-07" });
    expect(anniversary("2024-02-29", "2025-03-01")).toEqual({ years: 1, night: "2025-02-28" });
    const nights = Array.from({ length: 10 }, (_, i) => `2026-0${1 + Math.floor(i / 3)}-1${i % 3}`);
    const moments = milestoneMoments(nights, "2025-06-01", "2026-07-01");
    expect(moments.map((m) => m.id)).toEqual(["nights-1", "nights-10", "anniversary-1"]);
    expect(moments[1]!.night).toBe("2026-04-10");
  });

  it("reaches milestones and names the next one", () => {
    expect(milestones(12)).toEqual({ reached: [1, 10], next: 25 });
    expect(milestones(0)).toEqual({ reached: [], next: 1 });
  });

  it("groups nights by weekday and by month", () => {
    expect(byWeekday(["2026-11-06", "2026-11-07", "2026-10-31"])).toEqual([0, 0, 0, 0, 1, 2, 0]);
    const months = byMonth(["2026-11-07", "2026-10-31", "2025-11-20"], "2026-11-08");
    expect(months).toHaveLength(12);
    expect(months.at(-1)).toEqual({ month: "2026-11", count: 1 });
    expect(months[0]).toEqual({ month: "2025-12", count: 0 });
  });
});
