import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatMoney, parseAmount } from "@crew/money";
import { Field } from "@/crew/Field";
import { drinkLabel } from "@/drinks/display";
import { presetsFor, type DrinkKind } from "@/drinks/presets";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip, Panel, Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

interface Price {
  kind: string;
  currency: string;
  amount: number;
  reports: number;
  /** N-09: the last time the noted price moved, flagged by the server while recent. */
  change?: { from: number; to: number; at: number; recent: boolean } | null;
  /** Newest first. */
  history?: { amount: number; at: number }[];
}

const DAY_MS = 86_400_000;

/** N-09: what drinks cost at this bar, as the crew noted it. */
export function VenuePrices({ venueId }: { venueId: string }) {
  const i18n = useT();
  const preferences = useAppStore((state) => state.preferences);
  const kinds = [...new Set(presetsFor(preferences.unitSystem).map((p) => p.kind))];
  const [prices, setPrices] = useState<Price[]>([]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<DrinkKind>(kinds[0] ?? "pint");
  const [amountText, setAmountText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
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
      {prices.map((p) => {
        const key = `${p.kind}-${p.currency}`;
        const label = drinkLabel({ kind: p.kind as DrinkKind }, i18n);
        const money = (amount: number) => formatMoney(amount, p.currency, i18n.locale);
        const daysAgo = p.change ? Math.max(0, Math.floor((Date.now() - p.change.at) / DAY_MS)) : 0;
        return (
          <View key={key}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === key }}
              accessibilityHint={i18n.t("prices.historyHint")}
              disabled={(p.history?.length ?? 0) < 2}
              onPress={() => setOpen(open === key ? null : key)}
              style={styles.line}
            >
              <Text style={styles.flex}>{label}</Text>
              {p.change?.recent ? <Tag label={i18n.t("prices.changed")} tone="amber" /> : null}
              <Text variant="h3">{money(p.amount)}</Text>
              <Text variant="small">{i18n.plural("prices.reports", p.reports)}</Text>
            </Pressable>
            {p.change?.recent ? (
              <Text variant="small">
                {daysAgo === 0
                  ? i18n.t("prices.changeToday", { drink: label, from: money(p.change.from), to: money(p.change.to) })
                  : i18n.plural("prices.changeDays", daysAgo, { drink: label, from: money(p.change.from), to: money(p.change.to) })}
              </Text>
            ) : null}
            {open === key
              ? p.history?.map((h, i) => (
                  <View key={`${h.at}-${i}`} style={styles.history}>
                    <Text variant="small" style={styles.flex}>
                      {new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(h.at))}
                    </Text>
                    <Text variant="small">{money(h.amount)}</Text>
                  </View>
                ))
              : null}
          </View>
        );
      })}
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
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  history: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28, paddingLeft: 12 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
