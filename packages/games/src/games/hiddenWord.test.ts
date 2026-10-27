import { describe, expect, it } from "vitest";
import type { WordPairContent } from "../content/types";
import { seededRandom } from "../random";
import { players } from "../testing";
import {
  AGENT_COUNT,
  HIDDEN_WORD_SIPS,
  alivePlayers,
  cardFor,
  createHiddenWord,
  hiddenWordReducer,
  revealPlayer,
  type HiddenWordAction,
  type HiddenWordState,
} from "./hiddenWord";

const content: WordPairContent = {
  normal: [
    ["Beach", "Pool", "Vacation"],
    ["Pizza", "Tacos", "Takeout"],
  ],
  hard: [["Uber", "Lyft", "Rides"]],
  extreme: [["Rum", "Whiskey", "Liquor"]],
};
const rng = seededRandom(51);
const act = (state: HiddenWordState, ...actions: HiddenWordAction[]) => actions.reduce((s, a) => hiddenWordReducer(s, a, rng, content), state);
const start = (mode: HiddenWordState["mode"], count: number, level: HiddenWordState["level"] = "normal") =>
  createHiddenWord({ mode, players: players(count), level, content, rng: seededRandom(6) });

function revealAll(state: HiddenWordState): HiddenWordState {
  let next = state;
  while (next.phase === "reveal") next = act(next, { type: "peek" }, { type: "hide" }, { type: "pass" });
  return next;
}
const withRole = (state: HiddenWordState, role: string) => state.players.filter((p) => state.roles[p.id] === role);

describe("Odd One Out", () => {
  it("deals exactly one intruder, who gets no word and the category only at Normal", () => {
    const state = start("impostor", 5);
    const [impostor] = withRole(state, "impostor");
    expect(withRole(state, "impostor")).toHaveLength(1);
    expect(cardFor(state, impostor!.id)).toEqual({ word: null, hint: state.pair[2] });
    expect(cardFor(start("impostor", 5, "hard"), withRole(start("impostor", 5, "hard"), "impostor")[0]!.id).hint).toBeNull();
  });

  it("does not pass the phone before the card was seen", () => {
    const state = start("impostor", 4);
    expect(act(state, { type: "pass" })).toBe(state);
    const next = act(state, { type: "peek" }, { type: "hide" }, { type: "pass" });
    expect(revealPlayer(next)?.id).toBe(state.players[1]!.id);
  });

  it("goes from reveal to discussion to vote", () => {
    const state = act(revealAll(start("impostor", 4)), { type: "startVote" });
    expect(state.phase).toBe("vote");
  });

  it("lets a caught intruder guess the word, and charges the losing side", () => {
    let state = act(revealAll(start("impostor", 4)), { type: "startVote" });
    const impostor = withRole(state, "impostor")[0]!.id;
    state = act(state, { type: "accuse", playerId: impostor });
    expect(state.phase).toBe("lastGuess");
    const missed = act(state, { type: "guess", correct: false });
    expect(missed.outcome?.winner).toBe("crew");
    expect(missed.lastPenalties).toEqual([{ playerId: impostor, sips: HIDDEN_WORD_SIPS.impostorCaught.normal }]);
    const found = act(state, { type: "guess", correct: true });
    expect(found.outcome?.winner).toBe("impostor");
    expect(found.lastPenalties).toHaveLength(3);
  });

  it("has no last guess at Extreme", () => {
    let state = act(revealAll(start("impostor", 4, "extreme")), { type: "startVote" });
    state = act(state, { type: "accuse", playerId: withRole(state, "impostor")[0]!.id });
    expect(state.phase).toBe("roundEnd");
  });

  it("redeals without penalty when the intruder leaves", () => {
    let state = start("impostor", 5);
    const impostor = withRole(state, "impostor")[0]!.id;
    state = act(state, { type: "removePlayer", playerId: impostor });
    expect(state.phase).toBe("reveal");
    expect(withRole(state, "impostor")).toHaveLength(1);
    expect(state.ledger).toEqual({});
  });
});

describe("Moles", () => {
  it("needs five players", () => {
    expect(start("doubleAgent", 4).phase).toBe("end");
    expect(start("doubleAgent", 5).phase).toBe("reveal");
  });

  it("gives two players the other word; every card looks the same (a word, no hint)", () => {
    const state = start("doubleAgent", 6);
    const agents = withRole(state, "agent");
    expect(agents).toHaveLength(AGENT_COUNT);
    for (const p of state.players) {
      const card = cardFor(state, p.id);
      expect(card.word).not.toBeNull();
      expect(card.hint).toBeNull();
    }
    expect(cardFor(state, agents[0]!.id).word).toBe(state.pair[1]);
  });

  it("keeps voting after the first mole is caught, and the crew wins when both are out", () => {
    let state = act(revealAll(start("doubleAgent", 6)), { type: "startVote" });
    const [a, b] = withRole(state, "agent");
    state = act(state, { type: "accuse", playerId: a!.id });
    expect(state.phase).toBe("discuss");
    expect(state.lastAccused).toEqual({ playerId: a!.id, role: "agent" });
    state = act(state, { type: "startVote" }, { type: "accuse", playerId: b!.id });
    expect(state.outcome?.winner).toBe("crew");
    expect(state.ledger[a!.id]).toBe(HIDDEN_WORD_SIPS.agentCaught.normal);
  });

  it("lets the moles win once they match the crew in number", () => {
    let state = act(revealAll(start("doubleAgent", 5)), { type: "startVote" });
    const innocent = withRole(state, "crew")[0]!.id;
    state = act(state, { type: "accuse", playerId: innocent });
    expect(state.outcome?.winner).toBe("agents");
    expect(state.ledger[innocent]).toBe(HIDDEN_WORD_SIPS.innocentOut.normal);
    for (const p of alivePlayers(state).filter((p) => state.roles[p.id] === "crew")) {
      expect(state.ledger[p.id]).toBe(HIDDEN_WORD_SIPS.agentsWin.normal);
    }
  });

  it("moves to the next round with new roles", () => {
    let state = act(revealAll(start("doubleAgent", 6)), { type: "startVote" });
    state = act(state, { type: "accuse", playerId: withRole(state, "crew")[0]!.id }, { type: "startVote" });
    state = act(state, { type: "accuse", playerId: withRole(state, "agent")[0]!.id });
    while (state.phase !== "roundEnd") state = act(state, { type: "startVote" }, { type: "accuse", playerId: alivePlayers(state)[0]!.id });
    state = act(state, { type: "nextRound" });
    expect(state.round).toBe(2);
    expect(state.phase).toBe("reveal");
    expect(state.eliminated).toEqual([]);
  });

  it("ends when a departure leaves fewer than five players", () => {
    const state = act(start("doubleAgent", 5), { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("notEnoughPlayers");
  });
});
