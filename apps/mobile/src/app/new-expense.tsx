import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { radius, type } from "@crew/design-tokens";
import { formatMoney, parseAmount, type Split } from "@crew/money";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { addExpense, fetchPool, type PoolDetail } from "@/server/moneyData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { BIG_EXPENSE, guarded } from "@/vault/vault";
import { useDraft } from "@/state/drafts";

type Mode = Split["kind"];

/** O-70: one expense, four ways to split it. Amounts are entered as money, shares and percent as plain numbers. */
export default function NewExpenseScreen() {
  const { poolId } = useLocalSearchParams<{ poolId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const [detail, setDetail] = useState<PoolDetail | null>(null);
  const [description, setDescription, clearDescription] = useDraft(`expense:${poolId}:description`);
  const [amountText, setAmountText, clearAmount] = useDraft(`expense:${poolId}:amount`);
  const [payer, setPayer] = useState<string | undefined>(me);
  const [mode, setMode] = useState<Mode>("equal");
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    void fetchPool(poolId)
      .then((data) => {
        setDetail(data);
        setIncluded(new Set(data.members.map((m) => m.userId)));
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
  }, [poolId, i18n]);

  const currency = detail?.pool.currency ?? "EUR";
  const amount = parseAmount(amountText);
  const money = (value: number) => formatMoney(value, currency, i18n.locale);

  const split = useMemo((): { split: Split | null; left: string | null } => {
    if (!detail) return { split: null, left: null };
    const ids = detail.members.map((m) => m.userId);
    if (mode === "equal") {
      const members = ids.filter((id) => included.has(id));
      return { split: members.length ? { kind: "equal", members } : null, left: null };
    }
    const parsed: Record<string, number> = {};
    for (const id of ids) {
      // An empty share field reads as its placeholder: one share each by default.
      const raw = values[id]?.trim() || (mode === "shares" ? "1" : "");
      if (!raw) continue;
      const value = mode === "amounts" ? parseAmount(raw) : Number(raw.replace(",", "."));
      if (value === null || !Number.isFinite(value) || value < 0) return { split: null, left: null };
      if (value > 0) parsed[id] = value;
    }
    if (!Object.keys(parsed).length) return { split: null, left: null };
    const total = Object.values(parsed).reduce((s, v) => s + v, 0);
    if (mode === "amounts") {
      if (amount === null || total === amount) return { split: { kind: "amounts", amounts: parsed }, left: null };
      return { split: null, left: money(amount - total) };
    }
    if (mode === "percent") {
      if (Math.abs(total - 100) < 0.001) return { split: { kind: "percent", percent: parsed }, left: null };
      return { split: null, left: `${i18n.number(100 - total)} %` };
    }
    return { split: { kind: "shares", shares: parsed }, left: null };
    // money() only depends on currency and locale, both covered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, mode, included, values, amount, currency, i18n]);

  const ready = !!detail && !!payer && amount !== null && description.trim().length > 0 && split.split !== null;

  const submit = () => {
    if (!ready || !split.split || amount === null || !payer) return;
    const expense = { payerId: payer, amount, currency, description: description.trim(), split: split.split };
    if (amount >= BIG_EXPENSE && !guarded({ kind: "bigExpense", poolId, expense }, () => undefined)) {
      showToast({ message: i18n.t("vault.queued") });
      clearDescription();
      clearAmount();
      router.back();
      return;
    }
    setSending(true);
    void addExpense(poolId, { payerId: payer, amount, currency, description: description.trim(), split: split.split })
      .then(() => {
        haptic.confirmed();
        clearDescription();
        clearAmount();
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
      title={i18n.t("money.newExpense")}
      withToasts
      footer={<Button label={i18n.t("money.addExpense")} height={60} disabled={!ready} loading={sending} onPress={submit} />}
    >
      <Field
        label={i18n.t("money.description")}
        placeholder={i18n.t("money.descriptionPlaceholder")}
        value={description}
        onChangeText={setDescription}
        maxLength={80}
        returnKeyType="next"
        onSubmitEditing={() => amountRef.current?.focus()}
      />
      <Field
        ref={amountRef}
        label={i18n.t("money.amount")}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder={money(2400)}
        error={amountText.trim() && amount === null ? i18n.t("money.amountInvalid") : null}
      />

      <Text variant="label">{i18n.t("money.payer")}</Text>
      <View style={styles.chips}>
        {detail?.members.map((m) => (
          <Chip key={m.userId} label={m.userId === me ? i18n.t("common.you") : m.name} selected={payer === m.userId} onPress={() => setPayer(m.userId)} />
        ))}
      </View>

      <Text variant="label">{i18n.t("money.split")}</Text>
      <Segmented<Mode>
        accessibilityLabel={i18n.t("money.split")}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setValues({});
        }}
        items={[
          { value: "equal", label: i18n.t("money.equal") },
          { value: "shares", label: i18n.t("money.shares") },
          { value: "amounts", label: i18n.t("money.amounts") },
          { value: "percent", label: i18n.t("money.percent") },
        ]}
      />

      {mode === "equal" ? (
        <View style={styles.chips}>
          {detail?.members.map((m) => (
            <Chip
              key={m.userId}
              label={m.userId === me ? i18n.t("common.you") : m.name}
              selected={included.has(m.userId)}
              onPress={() =>
                setIncluded((current) => {
                  const next = new Set(current);
                  if (next.has(m.userId)) next.delete(m.userId);
                  else next.add(m.userId);
                  return next;
                })
              }
            />
          ))}
        </View>
      ) : (
        <View>
          {detail?.members.map((m) => (
            <View key={m.userId} style={[styles.memberRow, { borderBottomColor: theme.line }]}>
              <Text style={styles.flex}>{m.userId === me ? i18n.t("common.you") : m.name}</Text>
              <TextInput
                accessibilityLabel={m.name}
                value={values[m.userId] ?? ""}
                onChangeText={(text) => setValues((current) => ({ ...current, [m.userId]: text }))}
                keyboardType="decimal-pad"
                placeholder={mode === "shares" ? "1" : "0"}
                placeholderTextColor={theme.textMuted}
                style={[styles.input, type.body, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              />
            </View>
          ))}
          {split.left ? (
            <Text variant="small" color={theme.danger}>
              {i18n.t("money.splitMismatch", { left: split.left })}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1 },
  flex: { flex: 1 },
  input: { width: 110, height: 44, borderRadius: radius.input, borderWidth: 1, paddingHorizontal: 12, textAlign: "right" },
});
