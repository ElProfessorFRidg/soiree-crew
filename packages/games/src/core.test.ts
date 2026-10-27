import { describe, expect, it } from "vitest";
import { GAMES, filterGames, gameById, lockReason, typicalMinutes } from "./catalogue";
import { addPenalties, forfeitSize, mergePenalties, penaltyOffer, removeFromOrder, standings } from "./core";
import { distinctIndices, seededRandom, shuffle } from "./random";
import { players } from "./testing";

describe("penalty model", () => {
  it("always pairs sips with a forfeit", () => {
    expect(penaltyOffer({ noAlcohol: false }, 3)).toEqual({ kind: "sips_or_forfeit", sips: 3, forfeit: "medium" });
  });

  it("offers only a forfeit to a no-alcohol player", () => {
    expect(penaltyOffer({ noAlcohol: true }, 2)).toEqual({ kind: "forfeit", forfeit: "small" });
  });

  it("offers water or a forfeit at adaptive level 3, never sips", () => {
    const offer = penaltyOffer({ noAlcohol: false, wasted: true }, 6);
    expect(offer).toEqual({ kind: "water_or_forfeit", forfeit: "large" });
    expect("sips" in offer).toBe(false);
  });

  it("sizes forfeits by sips", () => {
    expect([1, 2, 3, 4, 5, 8].map(forfeitSize)).toEqual(["small", "small", "medium", "medium", "large", "large"]);
  });

  it("counts penalties and merges lines", () => {
    const ledger = addPenalties({}, [{ playerId: "a", sips: 2 }, { playerId: "b", sips: 0 }]);
    expect(addPenalties(ledger, [{ playerId: "a", sips: 1 }])).toEqual({ a: 3 });
    expect(mergePenalties([{ playerId: "a", sips: 1 }, { playerId: "b", sips: 2 }, { playerId: "a", sips: 2 }])).toEqual([
      { playerId: "a", sips: 3 },
      { playerId: "b", sips: 2 },
    ]);
  });

  it("ranks fewest penalties first", () => {
    const ps = players(3);
    expect(standings(ps, { p1: 4, p2: 1 }).map((s) => s.player.id)).toEqual(["p3", "p2", "p1"]);
  });
});

describe("turn order", () => {
  it("keeps the same player's turn when someone before them leaves", () => {
    const order = removeFromOrder({ players: players(4), turn: 2 }, "p1");
    expect(order.players[order.turn]?.id).toBe("p3");
  });

  it("gives the turn to the next player when the current one leaves", () => {
    const order = removeFromOrder({ players: players(4), turn: 3 }, "p4");
    expect(order.players[order.turn]?.id).toBe("p1");
  });
});

describe("random source", () => {
  it("replays the same sequence from the same seed", () => {
    expect(shuffle(seededRandom(7), [1, 2, 3, 4, 5])).toEqual(shuffle(seededRandom(7), [1, 2, 3, 4, 5]));
  });

  it("draws distinct indices", () => {
    const picked = distinctIndices(seededRandom(3), 25, 7);
    expect(new Set(picked).size).toBe(7);
  });
});

describe("catalogue", () => {
  it("lists the 15 games with sound player ranges", () => {
    expect(GAMES).toHaveLength(15);
    for (const game of GAMES) expect(game.minPlayers).toBeLessThanOrEqual(game.maxPlayers);
  });

  it("blocks the Moles below five players and says how many are missing", () => {
    expect(lockReason(gameById("doubleAgent"), 4)).toEqual({ kind: "needsPlayers", min: 5, missing: 1 });
    expect(lockReason(gameById("doubleAgent"), 5)).toBeNull();
    expect(lockReason(gameById("faceOff"), 3)).toEqual({ kind: "tooManyPlayers", max: 2 });
  });

  it("filters by play mode", () => {
    expect(filterGames("all")).toHaveLength(15);
    expect(filterGames("single_device")).toHaveLength(15);
    expect(filterGames("multi_device")).toHaveLength(0);
  });

  it("shows a typical duration only after three games, as a median", () => {
    expect(typicalMinutes([600_000, 900_000])).toBeNull();
    expect(typicalMinutes([600_000, 900_000, 3_000_000])).toBe(15);
  });
});
