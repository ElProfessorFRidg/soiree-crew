import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatMoney, parseAmount } from "@crew/money";
import { Field } from "@/crew/Field";
import { drinkLabel } from "@/drinks/display";
import { presetsFor, type DrinkKind } from "@/drinks/presets";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

interface Price {
  kind: string;
  currency: string;
  amount: number;
  reports: number;
}

/** N-09: what drinks cost at this bar, as the crew noted it. */
export function VenuePrices({ venueId }: { venueId: string }) {
  const i18n = useT();
  const preferences = useAppStore((state) => state.preferences);
  const kinds = [...new Set(presetsFor(preferences.unitSystem).map((p) => p.kind))];
  const [prices, setPrices] = useState<Price[]>([]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<DrinkKind>(kinds[0] ?? "pint");
  const [amountText, setAmountText] = useState("");
  const load = useCallback(() => {
    void api<{ prices: Price[] }>(`/v1/venues/${venueId}/prices`)
      .then((data) => setPrices(data.prices))
      .catch(() => undefined);
  }, [venueId]);
  useEffect(load, [load]);
  const amount = parseAmount(amountText);

  return (
    <Panel>
      <Text variant="label">{i18n.t("prices.title")}</Text>
      {prices.length === 0 ? <Text variant="small">{i18n.t("prices.empty")}</Text> : null}
      {prices.map((p) => (
        <View key={`${p.kind}-${p.currency}`} style={styles.line}>
          <Text style={styles.flex}>{drinkLabel({ kind: p.kind as DrinkKind }, i18n)}</Text>
          <Text variant="h3">{formatMoney(p.amount, p.currency, i18n.locale)}</Text>
          <Text variant="small">{i18n.plural("prices.reports", p.reports)}</Text>
        </View>
      ))}
      {adding ? (
        <>
          <View style={styles.chips}>
            {kinds.map((k) => (
              <Chip key={k} label={drinkLabel({ kind: k }, i18n)} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          <Field label={i18n.t("money.amount")} value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder={formatMoney(700, preferences.currency, i18n.locale)} />
          <Button
            label={i18n.t("prices.save")}
            variant="secondary"
            height={44}
            disabled={amount === null}
            onPress={() =>
              void api(`/v1/venues/${venueId}/prices`, { method: "PUT", body: { kind, amount, currency: preferences.currency } })
                .then(() => {
                  haptic.confirmed();
                  showToast({ message: i18n.t("prices.saved") });
                  setAdding(false);
                  setAmountText("");
                  load();
                })
                .catch(showFailure(i18n))
            }
          />
        </>
      ) : (
        <Button label={i18n.t("prices.add")} icon="euro" variant="outline" height={40} onPress={() => setAdding(true)} />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
