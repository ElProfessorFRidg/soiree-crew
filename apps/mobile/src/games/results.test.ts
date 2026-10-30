import { describe, expect, it } from "vitest";
import { buildGameResult } from "./results";
import type { TablePlayer } from "./store";

const player = (id: string, crewMemberId: string | null): TablePlayer => ({ id, name: id, noAlcohol: false, guest: crewMemberId === null, crewMemberId });

const crews = [
  { id: "crew-a", members: [{ id: "u-jade" }, { id: "u-malik" }] },
  { id: "crew-b", members: [{ id: "u-jade" }, { id: "u-ines" }, { id: "u-theo" }] },
];

describe("game result sent to the crew (TER-02, N-24)", () => {
  const players = [player("jade", "u-jade"), player("ines", "u-ines"), player("theo", "u-theo"), player("lou", null), player("malik", "u-malik")];
  const penalties = new Map([
    ["jade", 2],
    ["ines", 0],
    ["theo", 4],
    ["lou", 1],
    ["malik", 3],
  ]);

  it("picks the crew holding most of the table and sends everyone else as unnamed guests", () => {
    const result = buildGameResult({ id: "r1", gameId: "fuse", playedAt: 1, players, penalties, record: { key: "records.fuse", playerId: "lou", count: 4 }, crews, liveParty: null })!;
    expect(result.crewId).toBe("crew-b");
    expect(result.partyId).toBeNull();
    expect(result.members).toEqual([
      { userId: "u-jade", penalties: 2 },
      { userId: "u-ines", penalties: 0 },
      { userId: "u-theo", penalties: 4 },
    ]);
    expect(result.guests).toEqual([1, 3]);
    // A guest's record stays on the phone.
    expect(result.record).toBeNull();
    expect(JSON.stringify(result)).not.toContain("lou");
  });

  it("follows the live party's crew", () => {
    const result = buildGameResult({ id: "r2", gameId: "fuse", playedAt: 1, players, penalties, record: { key: "records.fuse", playerId: "malik", count: 2 }, crews, liveParty: { id: "p1", crewId: "crew-a" } })!;
    expect(result).toMatchObject({ crewId: "crew-a", partyId: "p1", record: { userId: "u-malik", count: 2 } });
    expect(result.members.map((m) => m.userId)).toEqual(["u-jade", "u-malik"]);
  });

  it("sends nothing when no crew member played", () => {
    expect(buildGameResult({ id: "r3", gameId: "fuse", playedAt: 1, players: [player("lou", null), player("sam", null)], penalties, record: null, crews, liveParty: null })).toBeNull();
  });
});
