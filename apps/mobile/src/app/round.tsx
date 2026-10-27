import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatMoney, parseAmount } from "@crew/money";
import { Field } from "@/crew/Field";
import { sortedCustomDrinks } from "@/drinks/customDrinks";
import { drinkLabel } from "@/drinks/display";
import { defaultPreset, presetFromCustom, presetsFor, type DrinkPreset } from "@/drinks/presets";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { pull } from "@/server/connection";
import { fetchRounds, logRound, type RoundsState } from "@/server/moneyData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** N-18: one tap logs a drink for everyone in the round and the expense in the party pool. */
export default function RoundScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const customDrinks = sortedCustomDrinks(useAppStore((state) => state.customDrinks));
  const presets: DrinkPreset[] = [...customDrinks.map(presetFromCustom), ...presetsFor(preferences.unitSystem).filter((p) => p.kind !== "soft")];
  const [state, setState] = useState<RoundsState | null>(null);
  const [payer, setPayer] = useState<string | undefined>(undefined);
  const [who, setWho] = useState<Set<string>>(new Set());
  const [drink, setDrink] = useState<DrinkPreset>(defaultPreset(preferences.unitSystem));
  const [amountText, setAmountText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void fetchRounds(partyId)
      .then((data) => {
        setState(data);
        setPayer(data.nextPayerId ?? me);
        setWho(new Set(data.present.map((p) => p.userId)));
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
  }, [partyId, me, i18n]);

  const amount = amountText.trim() ? parseAmount(amountText) : 0;
  const nameOf = (userId: string) => (userId === me ? i18n.t("common.you") : (state?.present.find((p) => p.userId === userId)?.name ?? "?"));
  const ready = !!state && !!payer && who.size > 0 && amount !== null;

  const submit = () => {
    if (!ready || amount === null || !payer) return;
    setSending(true);
    void logRound(partyId, {
      payerId: payer,
      memberIds: [...who],
      drink: { presetId: drink.id, kind: drink.kind, volumeMl: drink.volumeMl, abv: drink.abv, ...(drink.name ? { name: drink.name } : {}) },
      amount,
      currency: preferences.currency,
      description: `${i18n.t("money.round")} · ${drinkLabel(drink, i18n)}`,
    })
      .then(() => {
        haptic.cheers();
        void pull().catch(() => undefined);
        showToast({ tone: "info", message: i18n.t("money.roundLogged") });
        router.back();
      })
      .catch(() => {
        setSending(false);
        showToast({ tone: "danger", message: i18n.t("crew.offline") });
      });
  };

  return (
    <Screen
      back
      title={i18n.t("money.logRound")}
      withToasts
      footer={<Button label={i18n.t("money.logRound")} icon="glass" height={60} disabled={!ready} loading={sending} onPress={submit} />}
    >
      <Text variant="label">{i18n.t("money.payer")}</Text>
      <View style={styles.chips}>
        {state?.present.map((p) => (
          <Chip key={p.userId} label={nameOf(p.userId)} selected={payer === p.userId} onPress={() => setPayer(p.userId)} icon={p.userId === state.nextPayerId ? "crown" : undefined} />
        ))}
      </View>

      <Text variant="label">{i18n.t("money.roundWho")}</Text>
      <View style={styles.chips}>
        {state?.present.map((p) => (
          <Chip
            key={p.userId}
            label={nameOf(p.userId)}
            selected={who.has(p.userId)}
            onPress={() =>
              setWho((current) => {
                const next = new Set(current);
                if (next.has(p.userId)) next.delete(p.userId);
                else next.add(p.userId);
                return next;
              })
            }
          />
        ))}
      </View>

      <Text variant="label">{i18n.t("money.roundDrink")}</Text>
      <View style={styles.chips}>
        {presets.map((preset) => (
          <Chip key={preset.id} label={drinkLabel(preset, i18n)} icon={`glass:${preset.icon}`} selected={drink.id === preset.id} onPress={() => setDrink(preset)} />
        ))}
      </View>

      <Field
        label={i18n.t("money.roundAmount")}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder={formatMoney(who.size * 700, preferences.currency, i18n.locale)}
        error={amount === null ? i18n.t("money.amountInvalid") : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
