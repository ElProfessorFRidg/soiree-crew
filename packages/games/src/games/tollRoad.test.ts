import { describe, expect, it } from "vitest";
import { drawFromShoe, fullDeck, type PlayingCard } from "../cards";
import { seededRandom } from "../random";
import { players } from "../testing";
import { CUSTOMS_INDEX, TOLL_MISS_CAP, createTollRoad, guessHits, tollRoadReducer, tollSips, type TollRoadState } from "./tollRoad";

const card = (rank: number, suit: PlayingCard["suit"] = "spades"): PlayingCard => ({ rank, suit });

/** A road with a fixed shoe so each guess has a known outcome. */
function rigged(cards: PlayingCard[], current: PlayingCard, level: TollRoadState["level"] = "normal", count = 2): TollRoadState {
  const state = createTollRoad({ players: players(count), level, rng: seededRandom(1) });
  return { ...state, current, shoe: { deck: cards, discard: [] } };
}
const rng = seededRandom(9);

describe("Toll Road", () => {
  it("uses a real 52-card deck", () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);
  });

  it("asks higher or lower, and red or black at customs (checkpoint 2)", () => {
    let state = rigged([card(10), card(5, "hearts")], card(7));
    state = tollRoadReducer(state, { type: "guess", guess: "red" }, rng);
    expect(state.phase).toBe("guess");
    state = tollRoadReducer(state, { type: "guess", guess: "higher" }, rng);
    expect(state.checkpoint).toBe(CUSTOMS_INDEX);
    state = tollRoadReducer(state, { type: "next" }, rng);
    expect(tollRoadReducer(state, { type: "guess", guess: "higher" }, rng)).toBe(state);
    state = tollRoadReducer(state, { type: "guess", guess: "red" }, rng);
    expect(state.lastResult?.hit).toBe(true);
  });

  it("shows the card guessed against and the drawn card, not the same card twice", () => {
    const state = tollRoadReducer(rigged([card(10)], card(7)), { type: "guess", guess: "higher" }, rng);
    expect(state.lastResult?.from).toEqual(card(7));
    expect(state.lastResult?.drawn).toEqual(card(10));
    expect(state.current).toEqual(card(10));
  });

  it("counts a tie as a miss", () => {
    expect(guessHits("higher", card(7), card(7, "hearts"))).toBe(false);
    expect(guessHits("lower", card(7), card(7, "hearts"))).toBe(false);
  });

  it("sends the driver back to checkpoint 1 with a penalty on a miss", () => {
    let state = rigged([card(10), card(2)], card(7));
    state = tollRoadReducer(state, { type: "guess", guess: "higher" }, rng);
    state = tollRoadReducer(state, { type: "next" }, rng);
    state = tollRoadReducer(state, { type: "guess", guess: "red" }, rng);
    expect(state.lastResult?.hit).toBe(false);
    expect(state.checkpoint).toBe(0);
    expect(state.ledger.p1).toBe(1);
  });

  it("costs more further down the road at Hard, double at customs at Extreme", () => {
    expect(tollSips("normal", 4)).toBe(1);
    expect(tollSips("hard", 3)).toBe(4);
    expect(tollSips("extreme", CUSTOMS_INDEX)).toBe(4);
  });

  it("hands the phone to the next driver after five checkpoints, then ends", () => {
    const road = [card(9), card(5, "hearts"), card(9), card(12), card(3)];
    let state = rigged([...road, ...road], card(7));
    const guesses = ["higher", "red", "higher", "higher", "lower"] as const;
    for (const guess of guesses) state = tollRoadReducer(tollRoadReducer(state, { type: "guess", guess }, rng), { type: "next" }, rng);
    expect(state.arrived).toEqual(["p1"]);
    expect(state.order.players[state.order.turn]?.id).toBe("p2");
    expect(state.checkpoint).toBe(0);
  });

  it("lifts the barrier after the miss cap so nobody is stuck all night", () => {
    const cap = TOLL_MISS_CAP.normal!;
    let state = rigged(Array.from({ length: cap }, () => card(2)), card(7));
    for (let i = 0; i < cap; i++) state = tollRoadReducer(tollRoadReducer(state, { type: "guess", guess: "higher" }, rng), { type: "next" }, rng);
    expect(state.arrived).toContain("p1");
  });

  it("reshuffles the discard pile when the deck runs out", () => {
    const { card: drawn, shoe } = drawFromShoe({ deck: [], discard: [card(4), card(5)] }, rng);
    expect([4, 5]).toContain(drawn.rank);
    expect(shoe.deck).toHaveLength(1);
  });

  it("goes on when the driver leaves: the next player starts their own road", () => {
    let state = rigged([card(10)], card(7), "normal", 3);
    state = tollRoadReducer(state, { type: "guess", guess: "higher" }, rng);
    state = tollRoadReducer(state, { type: "removePlayer", playerId: "p1" }, rng);
    expect(state.order.players[state.order.turn]?.id).toBe("p2");
    expect(state.checkpoint).toBe(0);
    expect(state.phase).toBe("guess");
  });

  it("ends when a single player is left", () => {
    const state = tollRoadReducer(rigged([], card(7)), { type: "removePlayer", playerId: "p2" }, rng);
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("notEnoughPlayers");
  });
});
