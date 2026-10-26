import type { BodyProfile, UiLevel } from "@crew/bac";
import type { UserPreferences } from "@crew/units";
import type { DrinkKind } from "@/drinks/presets";

/**
 * Optimistic items carry their sync state until the server answers (SYNC-02).
 * `queued` means offline: it will leave once the network is back, and is not a failure.
 */
export type SyncState = "pending" | "queued" | "saved";

export interface DrinkEntry {
  id: string;
  presetId: string;
  kind: DrinkKind;
  volumeMl: number;
  abv: number;
  /** When it was drunk, UTC ms. May be earlier than `loggedAt` for a forgotten drink (O-22). */
  consumedAt: number;
  loggedAt: number;
  withFood: boolean;
  sync: SyncState;
}

export interface WaterEntry {
  id: string;
  at: number;
  sync: SyncState;
}

export interface StoredProfile extends BodyProfile {
  /** "other" is stored as such and computed with the female body model. */
  declaredBody: "male" | "female" | "other";
  healthConsentAt: number;
}

export type Mutation =
  | { kind: "drink.add"; drink: DrinkEntry }
  | { kind: "drink.remove"; drink: DrinkEntry }
  | { kind: "water.add"; water: WaterEntry }
  | { kind: "water.remove"; water: WaterEntry }
  | { kind: "profile.set"; profile: StoredProfile; previous: StoredProfile | null }
  | { kind: "preferences.set"; patch: Partial<UserPreferences>; previous: Partial<UserPreferences> }
  | { kind: "uiLevel.set"; manual: UiLevel | null; previous: UiLevel | null };

/** A mutation waiting for the server. Its id doubles as the idempotency key. */
export interface PendingMutation {
  id: string;
  mutation: Mutation;
  createdAt: number;
  attempts: number;
}

export type RejectionReason = "future_drink" | "invalid" | "party_closed";

export type TransportResult =
  | { status: "accepted"; serverTime: number }
  | { status: "rejected"; reason: RejectionReason }
  | { status: "offline" }
  | { status: "temporary" };

export interface Transport {
  send(pending: PendingMutation): Promise<TransportResult>;
}
