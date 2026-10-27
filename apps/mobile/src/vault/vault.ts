import { estimateBac, UI_LEVEL_ENTRY } from "@crew/bac";
import type { Split } from "@crew/money";
import { nightKey } from "@crew/units";
import { newId, useAppStore } from "@/state/store";

/**
 * ADP-06, the next-morning vault. From UI level 2 (0.8 g/L of blood, research/bac.md §2.5)
 * the actions below are not run: they wait, and the next day the app asks once more.
 */
export const VAULT_FROM_G_PER_L = UI_LEVEL_ENTRY[2];

export type VaultItem =
  | { id: string; at: number; night: string; kind: "leaveCrew"; crewId: string; crewName: string }
  | { id: string; at: number; night: string; kind: "deleteAccount" }
  | {
      id: string;
      at: number;
      night: string;
      kind: "bigExpense";
      poolId: string;
      expense: { payerId: string; amount: number; currency: string; description: string; split: Split };
    };

type NewItem = VaultItem extends infer T ? (T extends VaultItem ? Omit<T, "id" | "at" | "night"> : never) : never;

/** An expense this big (minor units) waits for the morning when the vault is closed. */
export const BIG_EXPENSE = 5_000;

function night(at: number): string {
  const { dayBoundaryHour } = useAppStore.getState().preferences;
  return nightKey(at, -new Date(at).getTimezoneOffset(), dayBoundaryHour);
}

export function vaultClosed(now = Date.now()): boolean {
  const { profile, drinks, levelState, manualLevel } = useAppStore.getState();
  if ((levelState?.level ?? 0) >= 2 || (manualLevel ?? 0) >= 2) return true;
  if (!profile) return false;
  const intakes = drinks
    .filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood }));
  return estimateBac(intakes, profile, now).bac >= VAULT_FROM_G_PER_L;
}

/** Runs `action` now, or puts it in the vault and returns false. */
export function guarded(item: NewItem, action: () => void): boolean {
  const now = Date.now();
  if (!vaultClosed(now)) {
    action();
    return true;
  }
  const entry = { ...item, id: newId(), at: now, night: night(now) } as VaultItem;
  useAppStore.setState((state) => ({ vault: [...state.vault, entry] }));
  return false;
}

/** Items that may be confirmed now: from an earlier night, with the vault open. */
export function dueVaultItems(now = Date.now()): VaultItem[] {
  const { vault } = useAppStore.getState();
  if (!vault.length || vaultClosed(now)) return [];
  const tonight = night(now);
  return vault.filter((item) => item.night !== tonight);
}

export function dropVaultItem(id: string): void {
  useAppStore.setState((state) => ({ vault: state.vault.filter((item) => item.id !== id) }));
}
