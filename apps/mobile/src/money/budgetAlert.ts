import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { formatMoney } from "@crew/money";
import { createTranslator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { fetchPartySpend } from "@/server/moneyData";
import { useAppStore } from "@/state/store";
import { showToast } from "@/ui/Toast";

/** N-20: the two steps the budget warns at, once each per party. */
export const BUDGET_STEPS = [0.9, 1] as const;
/** Enough history to never warn twice for the same party, without growing forever. */
const KEEP = 30;

interface BudgetAlertState {
  /** Highest step already announced, per party id. */
  warned: Record<string, number>;
}

export const useBudgetAlerts = create<BudgetAlertState>()(
  persist((): BudgetAlertState => ({ warned: {} }), { name: "crew-budget-alerts", storage: createJSONStorage(() => AsyncStorage) }),
);

/** The step reached for this spend, 0 when under 90 %. */
export function budgetStep(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  const ratio = spent / budget;
  return [...BUDGET_STEPS].reverse().find((step) => ratio >= step) ?? 0;
}

let checking: Promise<void> | null = null;

/**
 * N-20: compares tonight's spend (my share of the party's expenses, from the server) with my
 * budget, and says so once when it crosses 90 %, then once more at 100 %. Called when the crew's
 * money changes (live hint), when I add an expense and when the money screen opens.
 */
export function checkBudget(): Promise<void> {
  checking ??= run().finally(() => {
    checking = null;
  });
  return checking;
}

async function run(): Promise<void> {
  const { preferences } = useAppStore.getState();
  const budget = preferences.partyBudget;
  if (!budget) return;
  const now = Date.now();
  const party = useCrewData.getState().parties.find((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt <= now && p.endsAt >= now);
  if (!party) return;
  const { spent } = await fetchPartySpend(party.id).catch(() => ({ spent: [] }));
  // The budget is in my own currency: only what was spent in it counts against it.
  const amount = spent.find((s) => s.currency === preferences.currency)?.amount ?? 0;
  const step = budgetStep(amount, budget);
  const already = useBudgetAlerts.getState().warned[party.id] ?? 0;
  if (step <= already) return;
  useBudgetAlerts.setState((state) => ({
    warned: Object.fromEntries([...Object.entries(state.warned), [party.id, step] as const].slice(-KEEP)),
  }));
  const i18n = createTranslator(preferences.language);
  const values = { spent: formatMoney(amount, preferences.currency, i18n.locale), budget: formatMoney(budget, preferences.currency, i18n.locale) };
  haptic.error();
  showToast({
    tone: step >= 1 ? "danger" : "info",
    message: step >= 1 ? i18n.t("money.budgetAlertOver", values) : i18n.t("money.budgetAlertNear", values),
    durationMs: 8_000,
  });
}
