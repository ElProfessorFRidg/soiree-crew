import { StyleSheet, View } from "react-native";
import { formatMoney } from "@crew/money";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { deleteAccount, withdrawHealthConsent } from "@/profile/AccountSection";
import { deleteCrew, leaveCrew } from "@/server/crewData";
import { dropUploads, releaseUploads } from "@/photos/uploads";
import { addExpense } from "@/server/moneyData";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { dropVaultItem, dueVaultItems, type VaultItem } from "./vault";
import { failureMessage } from "@/server/errors";

function describe(item: VaultItem, i18n: Translator): string {
  switch (item.kind) {
    case "leaveCrew":
      return i18n.t("vault.leaveCrew", { crew: item.crewName });
    case "deleteAccount":
      return i18n.t("vault.deleteAccount");
    case "bigExpense":
      return i18n.t("vault.bigExpense", { name: item.expense.description, amount: formatMoney(item.expense.amount, item.expense.currency, i18n.locale) });
    case "deleteCrew":
      return i18n.t("vault.deleteCrew", { crew: item.crewName });
    case "albumPost":
      return i18n.plural("vault.albumPost", item.photoIds.length);
    case "deleteHistory":
      return i18n.t("vault.deleteHistory");
  }
}

function confirmLabel(item: VaultItem, i18n: Translator): string {
  switch (item.kind) {
    case "leaveCrew":
      return i18n.t("vault.confirmLeave");
    case "deleteAccount":
      return i18n.t("vault.confirmDelete");
    case "deleteCrew":
      return i18n.t("vault.confirmDeleteCrew");
    case "deleteHistory":
      return i18n.t("vault.confirmErase");
    case "bigExpense":
      return i18n.t("vault.confirmExpense");
    case "albumPost":
      return i18n.t("vault.confirmPost");
  }
}

/** Forgetting an album post also drops the photos it held on the phone. */
function forget(item: VaultItem): void {
  dropVaultItem(item.id);
  if (item.kind === "albumPost") dropUploads(item.photoIds);
}

async function run(item: VaultItem, i18n: Translator): Promise<void> {
  switch (item.kind) {
    case "leaveCrew":
      await leaveCrew(item.crewId);
      return;
    case "deleteAccount":
      await deleteAccount(i18n);
      return;
    case "bigExpense":
      await addExpense(item.poolId, item.expense);
      return;
    case "deleteCrew":
      await deleteCrew(item.crewId);
      return;
    case "albumPost":
      releaseUploads(item.photoIds);
      return;
    case "deleteHistory":
      await withdrawHealthConsent(i18n);
      return;
  }
}

/** ADP-06: the morning after, each action put aside last night is asked once more. */
export function VaultPrompt() {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  // Re-render when the vault changes; the due list itself depends on the time and the BAC.
  useAppStore((state) => state.vault.length);
  const due = dueVaultItems();
  if (!due.length) return null;
  return (
    <View style={styles.list}>
      {due.map((item) => (
        <Panel key={item.id} tint="amber">
          <Text variant="label">{i18n.t("vault.title", { time: formatClock(item.at, i18n.language, hourCycle) })}</Text>
          <Text variant="h3">{describe(item, i18n)}</Text>
          <Text variant="small">{i18n.t("vault.still")}</Text>
          <View style={styles.actions}>
            <Button label={i18n.t("vault.forget")} variant="outline" height={44} style={styles.flex} onPress={() => forget(item)} />
            <Button
              label={confirmLabel(item, i18n)}
              variant="secondary"
              height={44}
              style={styles.flex}
              onPress={() => {
                dropVaultItem(item.id);
                void run(item, i18n).catch((error: unknown) => {
                  useAppStore.setState((state) => ({ vault: [...state.vault, item] }));
                  showToast({ tone: "danger", message: failureMessage(error, i18n) });
                });
              }}
            />
          </View>
        </Panel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
