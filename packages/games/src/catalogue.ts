// The 15 games of the catalogue (O-44). Names, descriptions and rules live in the app's catalogues;
// this file only holds the facts the app computes with.

export type GameId =
  | "bigDeck"
  | "tollRoad"
  | "faceOff"
  | "pointBlank"
  | "fuse"
  | "wheel"
  | "neverEver"
  | "verdict"
  | "truthDare"
  | "minefield"
  | "fingerPick"
  | "impostor"
  | "doubleAgent"
  | "quickDraw"
  | "crash";

export type GameTag =
  | "group"
  | "dares"
  | "strategy"
  | "bluff"
  | "duel"
  | "vote"
  | "reflex"
  | "luck"
  | "confessions"
  | "drawing"
  | "nerve";

/** Where a game is played. Every game ships on one phone; `multi_device` waits for the real-time transport. */
export type PlayMode = "single_device" | "multi_device";

export interface GameDefinition {
  id: GameId;
  /** The PROMPT.md feature ID, for FEATURES.md evidence. */
  feature: string;
  minPlayers: number;
  maxPlayers: number;
  playModes: readonly PlayMode[];
  tags: readonly GameTag[];
  /** Offers the per-round timer of O-47 in setup. */
  roundTimer: boolean;
  /** Flat colour of the catalogue card (design/tokens.json avatar palette). */
  colour: string;
  /**
   * O-48: opens once the player knows this many people through the app (crew mates and friends,
   * each counted once). Bluff games need a group that knows each other; they come with it.
   */
  unlockAtFriends?: number;
}

const amber = "#F4B33D";
const mint = "#9BD8A8";
const water = "#8CCBEA";
const peach = "#F2C6A0";
const lavender = "#D6C8F2";
const coral = "#FF9C8A";
const cream = "#E8E3D2";

export const GAMES: readonly GameDefinition[] = [
  { id: "bigDeck", feature: "O-50", minPlayers: 2, maxPlayers: 16, playModes: ["single_device"], tags: ["group", "dares"], roundTimer: true, colour: amber },
  { id: "tollRoad", feature: "O-51", minPlayers: 2, maxPlayers: 10, playModes: ["single_device"], tags: ["strategy", "luck"], roundTimer: false, colour: mint },
  { id: "faceOff", feature: "O-52", minPlayers: 2, maxPlayers: 2, playModes: ["single_device"], tags: ["duel"], roundTimer: false, colour: coral },
  { id: "pointBlank", feature: "O-53", minPlayers: 3, maxPlayers: 16, playModes: ["single_device"], tags: ["group", "vote"], roundTimer: true, colour: water },
  { id: "fuse", feature: "O-54", minPlayers: 2, maxPlayers: 16, playModes: ["single_device"], tags: ["reflex"], roundTimer: false, colour: coral },
  { id: "wheel", feature: "O-55", minPlayers: 2, maxPlayers: 12, playModes: ["single_device"], tags: ["luck"], roundTimer: false, colour: lavender },
  { id: "neverEver", feature: "O-56", minPlayers: 3, maxPlayers: 16, playModes: ["single_device"], tags: ["group", "confessions"], roundTimer: true, colour: peach },
  { id: "verdict", feature: "O-57", minPlayers: 3, maxPlayers: 12, playModes: ["single_device"], tags: ["vote"], roundTimer: true, colour: mint },
  { id: "truthDare", feature: "O-58", minPlayers: 2, maxPlayers: 12, playModes: ["single_device"], tags: ["dares", "confessions"], roundTimer: true, colour: amber },
  { id: "minefield", feature: "O-59", minPlayers: 2, maxPlayers: 16, playModes: ["single_device"], tags: ["luck", "nerve"], roundTimer: false, colour: water },
  { id: "fingerPick", feature: "O-60", minPlayers: 2, maxPlayers: 10, playModes: ["single_device"], tags: ["luck"], roundTimer: false, colour: cream },
  { id: "impostor", feature: "O-61", minPlayers: 4, maxPlayers: 12, playModes: ["single_device"], tags: ["bluff"], roundTimer: true, colour: lavender, unlockAtFriends: 3 },
  { id: "doubleAgent", feature: "O-62", minPlayers: 5, maxPlayers: 12, playModes: ["single_device"], tags: ["bluff"], roundTimer: true, colour: coral, unlockAtFriends: 4 },
  { id: "quickDraw", feature: "O-63", minPlayers: 3, maxPlayers: 8, playModes: ["single_device"], tags: ["drawing", "group"], roundTimer: false, colour: mint },
  { id: "crash", feature: "O-64", minPlayers: 2, maxPlayers: 8, playModes: ["single_device"], tags: ["nerve"], roundTimer: false, colour: amber },
];

export function gameById(id: GameId): GameDefinition {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`unknown game ${id}`);
  return game;
}

export function isGameId(value: string): value is GameId {
  return GAMES.some((g) => g.id === value);
}

export type LockReason =
  | { kind: "needsFriends"; friends: number; missing: number }
  | { kind: "needsPlayers"; min: number; missing: number }
  | { kind: "tooManyPlayers"; max: number };

/** O-48: whether a game with a friends unlock is open for someone who knows `knownPeople` people in the app. */
export function isUnlocked(game: GameDefinition, knownPeople: number): boolean {
  return game.unlockAtFriends === undefined || knownPeople >= game.unlockAtFriends;
}

/**
 * Why Play is blocked for this table (O-48). A game not unlocked yet says how many friends are
 * missing; then the player count: the Moles' "5 players" is its minimum, and the lock says how
 * many players are missing. `knownPeople` left out skips the unlock (already opened once).
 */
export function lockReason(game: GameDefinition, playerCount: number, knownPeople?: number): LockReason | null {
  if (knownPeople !== undefined && !isUnlocked(game, knownPeople)) {
    const friends = game.unlockAtFriends ?? 0;
    return { kind: "needsFriends", friends, missing: friends - knownPeople };
  }
  if (playerCount < game.minPlayers) return { kind: "needsPlayers", min: game.minPlayers, missing: game.minPlayers - playerCount };
  if (playerCount > game.maxPlayers) return { kind: "tooManyPlayers", max: game.maxPlayers };
  return null;
}

export type CatalogueFilter = "all" | PlayMode;

export function filterGames(filter: CatalogueFilter): GameDefinition[] {
  if (filter === "all") return [...GAMES];
  return GAMES.filter((g) => g.playModes.includes(filter));
}

/**
 * Typical length of a game, from the crew's own finished games (anti-slop: a shown number is computed).
 * Needs 3 games; returns whole minutes, at least 1.
 */
export function typicalMinutes(durationsMs: readonly number[]): number | null {
  if (durationsMs.length < 3) return null;
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return Math.max(1, Math.round(median / 60_000));
}
