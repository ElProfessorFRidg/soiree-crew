import {
  territoryTitles, describe, expect, it } from "vitest";
import { challengers, countedCheckIns, resolveBoss, scoreSeason, seasonBounds, seasonKey, territoryTitles, timePoints, weekKey, type CountedCheckIn } from "./index";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 6, 21, 0); // Fri 6 Nov 2026, 22:00 in Paris
let seq = 0;

function checkIn(memberId: string, venueId: string, minutes: number, extra: Partial<CountedCheckIn> = {}): CountedCheckIn {
  seq += 1;
  const at = extra.at ?? T0;
  return {
    id: `c${seq}`,
    memberId,
    venueId,
    partyId: "p1",
    at,
    endedAt: at + minutes * MIN,
    lastProofAt: at + minutes * MIN,
    corroborated: true,
    night: "2026-11-06",
    week: "2026-W45",
    ...extra,
  };
}

const base = { parties: [], games: [], discoveredBefore: new Set(["Z", "C", "Q"]), workplaceExclusions: new Set<string>(), now: T0 + 12 * 60 * MIN };

describe("time curve (research/territories.md §3.2)", () => {
  it("matches the reference values", () => {
    expect(timePoints(14)).toBe(0);
    expect(timePoints(45)).toBe(6);
    expect(timePoints(60)).toBe(9);
    expect(timePoints(90)).toBe(12);
    expect(timePoints(120)).toBe(15);
    expect(timePoints(150)).toBe(16);
    expect(timePoints(180)).toBe(18);
    expect(timePoints(400)).toBe(18);
  });
});

describe("worked example, Fri 6 at Le Zinc", () => {
  it("gives Inès 40, Hugo 31, Malik 30, Sam 28, Jade 22 and the crown to Inès", () => {
    const [z] = scoreSeason({
      ...base,
      checkIns: [
        checkIn("ines", "Z", 180),
        checkIn("hugo", "Z", 150),
        checkIn("malik", "Z", 120),
        checkIn("sam", "Z", 180),
        checkIn("jade", "Z", 90),
      ],
      parties: [{ id: "p1", organiserId: "ines" }],
      games: [
        { memberId: "hugo", venueId: "Z", night: "2026-11-06", participants: 5 },
        { memberId: "malik", venueId: "Z", night: "2026-11-06", participants: 5 },
      ],
    });
    const points = Object.fromEntries(z!.scores.map((s) => [s.memberId, s.points]));
    expect(points).toEqual({ ines: 40, hugo: 31, malik: 30, sam: 28, jade: 22 });
    expect(z!.bossId).toBe("ines");
  });

  it("caps solo time at 60 min: Jade alone 120 min scores 19", () => {
    const [q] = scoreSeason({ ...base, checkIns: [checkIn("jade", "Q", 120, { corroborated: false })] });
    expect(q!.scores[0]!.points).toBe(19);
  });

  it("shares the first discovery within 15 min: Jade organiser at Chez Odette scores 60", () => {
    const [o] = scoreSeason({
      ...base,
      checkIns: [
        checkIn("jade", "O", 180),
        checkIn("ines", "O", 150, { at: T0 + 5 * MIN }),
        checkIn("lea", "O", 120, { at: T0 + 10 * MIN }),
        checkIn("sam", "O", 90, { at: T0 + 14 * MIN }),
      ],
      parties: [{ id: "p1", organiserId: "jade" }],
    });
    const points = Object.fromEntries(o!.scores.map((s) => [s.memberId, s.points]));
    expect(points.jade).toBe(60);
    expect(points.sam).toBe(42);
  });
});

describe("limits that stop farming (TER-03, §3.7 A)", () => {
  it("counts one check-in per venue per night", () => {
    const kept = countedCheckIns([checkIn("malik", "Z", 30), checkIn("malik", "Z", 30, { at: T0 + 2 * 60 * MIN })]);
    expect(kept).toHaveLength(1);
  });
  it("needs 20 min between two counted check-ins", () => {
    const kept = countedCheckIns([checkIn("malik", "Z", 10), checkIn("malik", "C", 60, { at: T0 + 10 * MIN })]);
    expect(kept.map((c) => c.venueId)).toEqual(["Z"]);
  });
  it("counts solo check-ins on 2 nights a week at most", () => {
    const nights = ["2026-11-02", "2026-11-03", "2026-11-04"];
    const kept = countedCheckIns(
      nights.map((night, i) => checkIn("jade", "Q", 60, { night, corroborated: false, at: T0 + i * 24 * 60 * MIN })),
    );
    expect(kept).toHaveLength(2);
  });
  it("credits time only up to the last proof plus 20 min", () => {
    const [z] = scoreSeason({ ...base, checkIns: [checkIn("hugo", "Z", 300, { lastProofAt: T0 + 40 * MIN })] });
    // 60 credited minutes = 10 + 9.
    expect(z!.scores[0]!.points).toBe(19);
  });
  it("gives nothing before 15 min of vesting", () => {
    const standings = scoreSeason({ ...base, checkIns: [checkIn("hugo", "Z", 10)] });
    expect(standings).toEqual([]);
  });
  it("gives a member who works at the venue nothing there (TER-11)", () => {
    const standings = scoreSeason({ ...base, checkIns: [checkIn("sam", "Z", 180)], workplaceExclusions: new Set(["Z:sam"]) });
    expect(standings).toEqual([]);
  });
  it("needs 3 people at the venue for the organiser bonus", () => {
    const [z] = scoreSeason({ ...base, checkIns: [checkIn("ines", "Z", 180), checkIn("hugo", "Z", 180)], parties: [{ id: "p1", organiserId: "ines" }] });
    expect(z!.scores.find((s) => s.memberId === "ines")!.points).toBe(28);
  });
});

describe("boss and alerts", () => {
  it("leaves a venue up for grabs below 15 points", () => {
    const [z] = scoreSeason({ ...base, checkIns: [checkIn("hugo", "Z", 16)] });
    expect(z!.scores[0]!.points).toBe(10);
    expect(z!.bossId).toBeNull();
  });
  it("lets the incumbent keep the crown on a full tie", () => {
    const [z] = scoreSeason({ ...base, checkIns: [checkIn("malik", "Z", 180), checkIn("sam", "Z", 180)] });
    expect(resolveBoss(z!, "sam").bossId).toBe("sam");
    expect(resolveBoss(z!, null).takenFrom).toBeNull();
  });
  it("reports who took the venue", () => {
    const [z] = scoreSeason({ ...base, checkIns: [checkIn("malik", "Z", 180), checkIn("sam", "Z", 60)] });
    expect(resolveBoss(z!, "sam")).toEqual({ bossId: "malik", takenFrom: "sam" });
  });
  it("lists challengers within 10 points", () => {
    const [z] = scoreSeason({ ...base, checkIns: [checkIn("malik", "Z", 180), checkIn("sam", "Z", 120), checkIn("jade", "Z", 30)] });
    expect(challengers(z!).map((s) => s.memberId)).toEqual(["sam"]);
  });
});

describe("seasons", () => {
  it("starts a season at 06:00 on the 1st, local time", () => {
    expect(seasonKey(Date.UTC(2026, 10, 1, 4, 0), 60)).toBe("2026-10");
    expect(seasonKey(Date.UTC(2026, 10, 1, 6, 0), 60)).toBe("2026-11");
    const { start, end } = seasonBounds("2026-11", 60);
    expect(start).toBe(Date.UTC(2026, 10, 1, 5, 0));
    expect(end).toBe(Date.UTC(2026, 11, 1, 5, 0));
  });
  it("computes ISO weeks", () => {
    expect(weekKey("2026-11-06")).toBe("2026-W45");
    expect(weekKey("2026-01-01")).toBe("2026-W01");
  });
});

describe("territory titles (TER-06)", () => {
  const ci = (venueId: string, night: string, thisSeason = true) => ({ venueId, night, thisSeason });
  it("gives mayor per venue held, conqueror from 3, explorer from 8 venues, nomad from 3 venues in a night", () => {
    const [jade, malik] = territoryTitles([
      { memberId: "malik", ruled: ["a"], checkIns: [ci("a", "2026-11-07"), ci("b", "2026-11-07"), ci("c", "2026-11-07")] },
      {
        memberId: "jade",
        ruled: ["a", "b", "c"],
        checkIns: ["a", "b", "c", "d", "e", "f", "g", "h"].map((v, i) => ci(v, `2026-10-0${(i % 4) + 1}`, false)),
      },
    ]);
    expect(jade!.memberId).toBe("jade");
    expect(jade!.titles.map((t) => t.kind)).toEqual(["mayor", "mayor", "mayor", "conqueror", "explorer"]);
    expect(malik!.titles.map((t) => t.kind)).toEqual(["mayor", "nomad"]);
    expect(malik!.visited).toBe(3);
  });
});
