import { View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { showFailure } from "@/server/errors";
import { useVenueData } from "@/server/venueData";
import { pruneDrinkPhotos } from "@/drinks/drinkPhotos";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Row } from "@/ui/controls";
import { confirmAction } from "@/ui/confirm";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useTheme } from "@/theme";
import { exportMyData } from "./exportData";

/** N-17: what can be erased one kind at a time (the server's list). Shared expenses are not in it. */
export const DATA_CATEGORIES = ["drinks", "water", "customDrinks", "checkIns", "nightStatuses", "reviews", "photos", "receipts", "recapReactions"] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

/** This phone's copy goes too, with anything of that kind still waiting to be sent. */
function forgetLocally(category: DataCategory): void {
  const pending = (prefix: string) => (item: { mutation: { kind: string } }) => !item.mutation.kind.startsWith(prefix);
  if (category === "drinks") useAppStore.setState((s) => ({ drinks: [], drinkVenues: {}, learnedSpellings: {}, levelState: null, outbox: s.outbox.filter(pending("drink.")) }));
  if (category === "water") useAppStore.setState((s) => ({ water: [], outbox: s.outbox.filter(pending("water.")) }));
  if (category === "customDrinks") {
    useAppStore.setState((s) => ({ customDrinks: [], outbox: s.outbox.filter(pending("customDrink.")) }));
    // Their photos only ever lived here.
    pruneDrinkPhotos();
  }
  if (category === "checkIns") {
    useVenueData.setState({ openCheckIn: null });
    // Which bar each drink was logged at is check-in history too.
    useAppStore.setState({ drinkVenues: {} });
  }
}

/** N-17, SEC-08: export (JSON or CSV) and erasing one kind of my data, each erase confirmed first. */
export function DataControls() {
  const i18n = useT();
  const theme = useTheme();

  const exportAs = (format: "json" | "csv") =>
    void exportMyData(format)
      .then(() => showToast({ message: i18n.t("account.exportReady") }))
      .catch(showFailure(i18n));

  const erase = (category: DataCategory) =>
    void confirmAction({
      title: i18n.t("account.eraseConfirmTitle", { what: i18n.t(`account.eraseCategory.${category}`) }),
      body: i18n.t("account.eraseConfirmBody"),
      confirmLabel: i18n.t("account.eraseConfirm"),
      cancelLabel: i18n.t("account.deleteKeep"),
    }).then((ok) => {
      if (!ok) return;
      void api(`/v1/me/data/${category}`, { method: "DELETE" })
        .then(() => {
          forgetLocally(category);
          haptic.confirmed();
          showToast({ message: i18n.t("account.erased", { what: i18n.t(`account.eraseCategory.${category}`) }) });
        })
        .catch(showFailure(i18n));
    });

  return (
    <View style={{ gap: 8 }}>
      <Button label={i18n.t("account.export")} variant="outline" height={44} accessibilityHint={i18n.t("account.exportHint")} onPress={() => exportAs("json")} />
      <Button label={i18n.t("account.exportCsv")} variant="outline" height={44} accessibilityHint={i18n.t("account.exportCsvHint")} onPress={() => exportAs("csv")} />
      <Text variant="label">{i18n.t("account.eraseTitle")}</Text>
      <Text variant="small">{i18n.t("account.eraseHint")}</Text>
      <View>
        {DATA_CATEGORIES.map((category, index) => (
          <Row
            key={category}
            title={i18n.t(`account.eraseCategory.${category}`)}
            accessibilityLabel={i18n.t("account.eraseConfirmTitle", { what: i18n.t(`account.eraseCategory.${category}`) })}
            trailing={<Icon name="trash" color={theme.textMuted} />}
            onPress={() => erase(category)}
            last={index === DATA_CATEGORIES.length - 1}
          />
        ))}
      </View>
    </View>
  );
}
