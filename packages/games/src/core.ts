// Shared frame for every game: levels, players, the penalty model (research/games.md §2.0).

export type GameLevel = "normal" | "hard" | "extreme";
export const GAME_LEVELS: readonly GameLevel[] = ["normal", "hard", "extreme"];

export interface Player {
  id: string;
  name: string;
  /** This player never gets sips: the forfeit is the only offer. */
  noAlcohol: boolean;
  /**
   * The player's adaptive UI level is 3 right now. They are offered water or a forfeit, never sips.
   * Read at display time, so it can change during a game.
   */
  wasted?: boolean;
}

/** Sips owed by one player after a round. Never logged as a drink: only the add-drink button logs drinks. */
export interface PenaltyLine {
  playerId: string;
  sips: number;
}

export type ForfeitSize = "small" | "medium" | "large";

export type PenaltyOffer =
  | { kind: "sips_or_forfeit"; sips: number; forfeit: ForfeitSize }
  | { kind: "water_or_forfeit"; forfeit: ForfeitSize }
  | { kind: "forfeit"; forfeit: ForfeitSize };

export function forfeitSize(sips: number): ForfeitSize {
  if (sips <= 2) return "small";
  if (sips <= 4) return "medium";
  return "large";
}

/** What the screen offers for a penalty. Nobody is ever told to drink: sips always come with a forfeit. */
export function penaltyOffer(player: Pick<Player, "noAlcohol" | "wasted">, sips: number): PenaltyOffer {
  const forfeit = forfeitSize(sips);
  if (player.wasted) return { kind: "water_or_forfeit", forfeit };
  if (player.noAlcohol) return { kind: "forfeit", forfeit };
  return { kind: "sips_or_forfeit", sips, forfeit };
}

/** Penalty counter (O-49): units owed per player, whatever form they took. */
export type PenaltyLedger = Readonly<Record<string, number>>;

export function addPenalties(ledger: PenaltyLedger, lines: readonly PenaltyLine[]): PenaltyLedger {
  const next: Record<string, number> = { ...ledger };
  for (const line of lines) {
    if (line.sips <= 0) continue;
    next[line.playerId] = (next[line.playerId] ?? 0) + line.sips;
  }
  return next;
}

/** Merges lines for the same player, drops empty ones, keeps first-seen order. */
export function mergePenalties(lines: readonly PenaltyLine[]): PenaltyLine[] {
  const order: string[] = [];
  const total = new Map<string, number>();
  for (const line of lines) {
    if (line.sips <= 0) continue;
    if (!total.has(line.playerId)) order.push(line.playerId);
    total.set(line.playerId, (total.get(line.playerId) ?? 0) + line.sips);
  }
  return order.map((playerId) => ({ playerId, sips: total.get(playerId) ?? 0 }));
}

export interface TurnOrder {
  players: Player[];
  /** Index of the player whose turn it is. */
  turn: number;
}

/**
 * Removes a player without breaking the rotation (O-47): if it was their turn, the next player plays;
 * otherwise the same player keeps the turn.
 */
export function removeFromOrder(order: TurnOrder, playerId: string): TurnOrder {
  const index = order.players.findIndex((p) => p.id === playerId);
  if (index < 0) return order;
  const players = order.players.filter((p) => p.id !== playerId);
  if (players.length === 0) return { players, turn: 0 };
  let turn = order.turn;
  if (index < order.turn) turn -= 1;
  return { players, turn: turn % players.length };
}

/** A player joining mid-game goes to the end of the order. */
export function addToOrder(order: TurnOrder, player: Player): TurnOrder {
  if (order.players.some((p) => p.id === player.id)) return order;
  return { players: [...order.players, player], turn: order.turn };
}

/** Adds a player to the list of everyone who played, once. */
export function withPlayer(roster: readonly Player[], player: Player): Player[] {
  return roster.some((p) => p.id === player.id) ? [...roster] : [...roster, player];
}

export function nextTurn(order: TurnOrder): TurnOrder {
  if (order.players.length === 0) return order;
  return { ...order, turn: (order.turn + 1) % order.players.length };
}

export function currentPlayer(order: TurnOrder): Player | undefined {
  return order.players[order.turn];
}

export function playerById(players: readonly Player[], id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

/** Players sorted by penalty count, fewest first, for the end screen. Ties keep the play order. */
export function standings(players: readonly Player[], ledger: PenaltyLedger): { player: Player; penalties: number }[] {
  return players
    .map((player, index) => ({ player, penalties: ledger[player.id] ?? 0, index }))
    .sort((a, b) => a.penalties - b.penalties || a.index - b.index)
    .map(({ player, penalties }) => ({ player, penalties }));
}

/** Why a game ended: the deck ran out, the set rounds were played, someone stopped it, or too few players were left. */
export type EndReason = "completed" | "stopped" | "notEnoughPlayers";
