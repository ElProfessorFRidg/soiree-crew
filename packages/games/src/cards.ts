import { shuffle, type Random } from "./random";

export type Suit = "hearts" | "diamonds" | "spades" | "clubs";
export const SUITS: readonly Suit[] = ["hearts", "diamonds", "spades", "clubs"];

/** A real playing card. Rank 2 to 14, the ace is 14 (high). */
export interface PlayingCard {
  rank: number;
  suit: Suit;
}

export function fullDeck(): PlayingCard[] {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ rank: i + 2, suit })));
}

export function shuffledDeck(rng: Random): PlayingCard[] {
  return shuffle(rng, fullDeck());
}

export function isRed(card: PlayingCard): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}

export function sameCard(a: PlayingCard, b: PlayingCard): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** A deck with its discard pile: drawing from an empty deck reshuffles the discard. */
export interface Shoe {
  deck: PlayingCard[];
  discard: PlayingCard[];
}

export function drawFromShoe(shoe: Shoe, rng: Random): { card: PlayingCard; shoe: Shoe } {
  let { deck, discard } = shoe;
  if (deck.length === 0) {
    deck = discard.length > 0 ? shuffle(rng, discard) : shuffledDeck(rng);
    discard = [];
  }
  const [card, ...rest] = deck;
  return { card: card as PlayingCard, shoe: { deck: rest, discard } };
}
