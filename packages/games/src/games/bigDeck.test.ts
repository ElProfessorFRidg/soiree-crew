import { describe, expect, it } from "vitest";
import type { BigDeckContent } from "../content/types";
import { seededRandom } from "../random";
import { players } from "../testing";
import { BIG_DECK_SIPS, bigDeckReducer, createBigDeck, type BigDeckAction, type BigDeckState } from "./bigDeck";

const leveled = (prefix: string) => ({
  normal: [`${prefix} n1 {other}`, `${prefix} n2`, `${prefix} n3`],
  hard: [`${prefix} h1`, `${prefix} h2`],
  extreme: [`${prefix} e1`],
});
const content: BigDeckContent = { dare: leveled("dare"), rule: leveled("rule"), vote: leveled("vote"), minigame: leveled("mini") };

function start(size = 8, count = 3): BigDeckState {
  return createBigDeck({ players: players(count), level: "normal", content, size, rng: seededRandom(1) });
}
const rng = seededRandom(2);
const act = (state: BigDeckState, ...actions: BigDeckAction[]) => actions.reduce((s, a) => bigDeckReducer(s, a, rng), state);

/** Resolves whatever card is up in the simplest valid way. */
function resolve(state: BigDeckState): BigDeckState {
  const kind = state.current?.card.kind;
  if (kind === "vote" || kind === "minigame") return act(state, { type: "designate", playerIds: [state.order.players[0]!.id] });
  return act(state, { type: "done" });
}

describe("The Big Deck", () => {
  it("builds a finite deck from the chosen level only at Normal", () => {
    const state = start(8);
    expect(state.deck).toHaveLength(8);
    expect(state.deck.every((c) => c.level === "normal")).toBe(true);
    expect(new Set(state.deck.map((c) => `${c.kind}${c.id}`)).size).toBe(8);
  });

  it("deals to players in order and passes the turn after each card", () => {
    let state = act(start(), { type: "draw" });
    expect(state.current?.playerId).toBe("p1");
    state = act(resolve(state), { type: "draw" });
    expect(state.current?.playerId).toBe("p2");
  });

  it("charges a refused dare to the player who drew it", () => {
    let state = start(12);
    // Draw until a dare comes up.
    for (let i = 0; i < 12; i++) {
      state = act(state, { type: "draw" });
      if (state.current?.card.kind === "dare") break;
      state = resolve(state);
    }
    const drawer = state.current!.playerId;
    const before = state.ledger[drawer] ?? 0;
    state = act(state, { type: "refuse" });
    expect(state.ledger[drawer]).toBe(before + BIG_DECK_SIPS.dare.normal);
    expect(state.lastPenalties).toEqual([{ playerId: drawer, sips: BIG_DECK_SIPS.dare.normal }]);
  });

  it("names another player than the drawer for {other}", () => {
    let state = start(12);
    for (let i = 0; i < 12 && state.phase !== "end"; i++) {
      state = act(state, { type: "draw" });
      if (state.current?.card.text.includes("{other}")) {
        expect(state.current.otherId).not.toBeNull();
        expect(state.current.otherId).not.toBe(state.current.playerId);
      }
      state = resolve(state);
    }
  });

  it("ends on the last card", () => {
    let state = start(4);
    for (let i = 0; i < 4; i++) state = resolve(act(state, { type: "draw" }));
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("completed");
    expect(state.deck).toHaveLength(0);
  });

  it("keeps a rule active until the next rule, and charges breaking it", () => {
    let state = start(12);
    for (let i = 0; i < 12 && !state.activeRule; i++) state = resolve(act(state, { type: "draw" }));
    expect(state.activeRule?.card.kind).toBe("rule");
    state = act(state, { type: "ruleBroken", playerId: "p3" });
    expect(state.ledger.p3).toBe(BIG_DECK_SIPS.ruleBroken.normal);
  });

  it("goes on when the drawer leaves: their card is set aside", () => {
    let state = act(start(8, 4), { type: "draw" });
    const left = state.deck.length;
    state = act(state, { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("draw");
    expect(state.current).toBeNull();
    expect(state.order.players.map((p) => p.id)).toEqual(["p2", "p3", "p4"]);
    expect(act(state, { type: "draw" }).current?.playerId).toBe("p2");
    expect(state.deck.length).toBe(left);
  });

  it("ends when fewer than two players are left, and keeps everyone's score", () => {
    let state = act(start(8, 2), { type: "draw" }, { type: "done" });
    state = act(state, { type: "removePlayer", playerId: "p2" });
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("notEnoughPlayers");
    expect(state.roster).toHaveLength(2);
  });

  it("ignores actions that do not fit the phase", () => {
    const state = start();
    expect(act(state, { type: "refuse" })).toBe(state);
    expect(act(state, { type: "done" })).toBe(state);
  });
});
