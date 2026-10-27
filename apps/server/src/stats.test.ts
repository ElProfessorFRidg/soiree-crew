import { describe, expect, it } from "vitest";
import { byMonth, byWeekday, crewStreak, isoWeek, milestones } from "./stats";

describe("crew statistics helpers (N-14, JOY-06, JOY-08)", () => {
  it("knows ISO weeks across a year boundary", () => {
    expect(isoWeek("2026-11-07")).toBe("2026-W45");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
    expect(isoWeek("2027-01-04")).toBe("2027-W01");
  });

  it("counts a streak of weeks, the current week not breaking it yet", () => {
    const nights = ["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07"];
    expect(crewStreak(nights, "2026-11-08")).toEqual({ current: 4, best: 4 });
    // Monday of the next week, nothing yet: the streak still holds.
    expect(crewStreak(nights, "2026-11-09").current).toBe(4);
    // A whole week without a night: broken.
    expect(crewStreak(nights, "2026-11-17").current).toBe(0);
    expect(crewStreak(["2026-09-05", "2026-09-12", "2026-10-31"], "2026-11-01")).toEqual({ current: 1, best: 2 });
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
