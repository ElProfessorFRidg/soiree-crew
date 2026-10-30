import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Alert, Image, StyleSheet, TextInput, View } from "react-native";
import { radius, type } from "@crew/design-tokens";
import { convertAmount, formatMoney, parseAmount, parseRate, type Split } from "@crew/money";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { haptic } from "@/motion/haptics";
import { checkBudget } from "@/money/budgetAlert";
import { pickReceipt } from "@/photos/uploads";
import { useCrewData } from "@/server/crewData";
import { addExpense, fetchPool, uploadReceipt, type NewExpense, type PoolDetail } from "@/server/moneyData";
import { useSession } from "@/server/session";
import { refreshVenues, useVenueData } from "@/server/venueData";
import { showPermissionDenied } from "@/system/permissions";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { BIG_EXPENSE, guarded } from "@/vault/vault";
import { useDraft } from "@/state/drafts";
import { showFailure, failureMessage } from "@/server/errors";

type Mode = Split["kind"];
/** N-19: how many of the crew's latest parties and venues are offered as chips. */
const RECENT_PARTIES = 6;
const RECENT_VENUES = 12;

/** O-70: one expense, four ways to split it. Amounts are entered as money, shares and percent as plain numbers. */
export default function NewExpenseScreen() {
  const { poolId } = useLocalSearchParams<{ poolId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const crewName = useCrewNames();
  const [detail, setDetail] = useState<PoolDetail | null>(null);
  const [description, setDescription, clearDescription] = useDraft(`expense:${poolId}:description`);
  const [amountText, setAmountText, clearAmount] = useDraft(`expense:${poolId}:amount`);
  const [payer, setPayer] = useState<string | undefined>(me);
  const [mode, setMode] = useState<Mode>("equal");
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  // N-19: the receipt's currency, the rate the person typed, what the expense is tied to, the photo.
  const [currencyText, setCurrencyText] = useState<string | null>(null);
  const [rateText, setRateText] = useState("");
  const [partyId, setPartyId] = useState<string | null | undefined>(undefined);
  const [venueId, setVenueId] = useState<string | null | undefined>(undefined);
  const [receipt, setReceipt] = useState<{ uri: string; data: string } | null>(null);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    void fetchPool(poolId)
      .then((data) => {
        setDetail(data);
        setIncluded(new Set(data.members.map((m) => m.userId)));
      })
      .catch(showFailure(i18n));
  }, [poolId, i18n]);

  const crewId = detail?.pool.crewId;
  const allParties = useCrewData((state) => state.parties);
  const venueState = useVenueData((state) => (crewId ? state.byCrew[crewId] : undefined));
  const openCheckIn = useVenueData((state) => state.openCheckIn);
  useEffect(() => {
    if (crewId && !venueState) void refreshVenues(crewId).catch(() => undefined);
  }, [crewId, venueState]);
  const parties = useMemo(
    () =>
      allParties
        .filter((p) => p.crewId === crewId && p.startsAt <= Date.now() + 86_400_000)
        .sort((a, b) => b.startsAt - a.startsAt)
        .slice(0, RECENT_PARTIES),
    [allParties, crewId],
  );
  const venues = useMemo(() => (venueState?.venues ?? []).filter((v) => v.kind !== "home").slice(0, RECENT_VENUES), [venueState]);
  // Defaults: the pool's own party (or the one in progress), and the bar I'm checked in at.
  const chosenParty = partyId === undefined ? (detail?.pool.partyId ?? parties.find((p) => p.live)?.id ?? null) : partyId;
  const chosenVenue = venueId === undefined ? (venues.find((v) => v.id === openCheckIn?.venueId)?.id ?? null) : venueId;

  const poolCurrency = detail?.pool.currency ?? "EUR";
  const typedCurrency = (currencyText ?? poolCurrency).trim().toUpperCase();
  const currencyValid = /^[A-Z]{3}$/.test(typedCurrency);
  const currency = currencyValid ? typedCurrency : poolCurrency;
  const foreign = currencyValid && currency !== poolCurrency;
  const rate = foreign ? parseRate(rateText) : null;
  const amount = parseAmount(amountText);
  const converted = foreign && rate !== null && amount !== null ? convertAmount(amount, rate) : null;
  const money = (value: number, code = currency) => formatMoney(value, code, i18n.locale);

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

  const ready =
    !!detail &&
    !!payer &&
    amount !== null &&
    description.trim().length > 0 &&
    split.split !== null &&
    currencyValid &&
    (!foreign || (converted !== null && converted > 0));

  const submit = () => {
    if (!ready || !split.split || amount === null || !payer) return;
    const expense: NewExpense = {
      payerId: payer,
      amount,
      currency,
      description: description.trim(),
      split: split.split,
      ...(foreign && rate ? { rate } : {}),
      ...(chosenParty ? { partyId: chosenParty } : {}),
      ...(chosenVenue ? { venueId: chosenVenue } : {}),
    };
    // QOL-19: a big expense is big for what it weighs in the pool, whatever the receipt's currency.
    if ((converted ?? amount) >= BIG_EXPENSE && !guarded({ kind: "bigExpense", poolId, expense }, () => undefined)) {
      showToast({ message: i18n.t("vault.queued") });
      clearDescription();
      clearAmount();
      router.back();
      return;
    }
    setSending(true);
    void addExpense(poolId, expense)
      .then(async (expenseId) => {
        // The expense is saved either way: a receipt that does not go through says so, nothing more.
        if (receipt) await uploadReceipt(poolId, expenseId, receipt.data).catch(() => showToast({ tone: "danger", message: i18n.t("money.receiptFailed") }));
        haptic.confirmed();
        clearDescription();
        clearAmount();
        // N-20: my share of tonight just changed.
        void checkBudget();
        router.back();
      })
      .catch((error: unknown) => {
        setSending(false);
        showToast({ tone: "danger", message: failureMessage(error, i18n) });
      });
  };

  const attach = (source: "camera" | "library") =>
    void pickReceipt(source)
      .then((picked) => {
        if (picked === -1 || picked === -2) showPermissionDenied(i18n, i18n.t("album.denied"), picked === -1);
        else if (picked) {
          haptic.select();
          setReceipt(picked);
        }
      })
      .catch(showFailure(i18n));
  const askReceipt = () =>
    Alert.alert(i18n.t("money.receipt"), undefined, [
      { text: i18n.t("money.receiptCamera"), onPress: () => attach("camera") },
      { text: i18n.t("money.receiptLibrary"), onPress: () => attach("library") },
      { text: i18n.t("money.cancel"), style: "cancel" },
    ]);

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
      <View style={styles.inline}>
        <View style={styles.flex}>
          <Field
            ref={amountRef}
            label={i18n.t("money.amount")}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder={money(2400)}
            error={amountText.trim() && amount === null ? i18n.t("money.amountInvalid") : null}
          />
        </View>
        <View style={styles.currency}>
          <Field
            label={i18n.t("money.currency")}
            value={currencyText ?? poolCurrency}
            onChangeText={(text) => setCurrencyText(text.replace(/[^a-zA-Z]/g, "").toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            error={currencyValid ? null : i18n.t("money.currencyInvalid")}
          />
        </View>
      </View>
      {foreign ? (
        <>
          <Field
            label={i18n.t("money.rate", { from: currency, to: poolCurrency })}
            hint={i18n.t("money.rateHint", { to: poolCurrency })}
            value={rateText}
            onChangeText={setRateText}
            keyboardType="decimal-pad"
            placeholder={i18n.number(0.0061, 4)}
            error={rateText.trim() && rate === null ? i18n.t("money.rateInvalid") : null}
          />
          {converted !== null ? <Text variant="h3">{i18n.t("money.inPool", { amount: money(converted, poolCurrency) })}</Text> : null}
        </>
      ) : null}

      <Text variant="label">{i18n.t("money.payer")}</Text>
      <View style={styles.chips}>
        {detail?.members.map((m) => (
          <Chip key={m.userId} label={m.userId === me ? i18n.t("common.you") : crewName(m.userId, m.name)} selected={payer === m.userId} onPress={() => setPayer(m.userId)} />
        ))}
      </View>

      {parties.length ? (
        <>
          <Text variant="label">{i18n.t("money.tiedParty")}</Text>
          <View style={styles.chips}>
            <Chip label={i18n.t("money.tiedNoParty")} selected={!chosenParty} onPress={() => setPartyId(null)} />
            {parties.map((p) => (
              <Chip
                key={p.id}
                icon={p.kind === "trip" ? "bus" : "glass"}
                label={p.kind === "trip" ? i18n.t("money.tripName", { name: p.name }) : p.name}
                selected={chosenParty === p.id}
                onPress={() => setPartyId(p.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {venues.length ? (
        <>
          <Text variant="label">{i18n.t("money.tiedVenue")}</Text>
          <View style={styles.chips}>
            <Chip label={i18n.t("money.tiedNoVenue")} selected={!chosenVenue} onPress={() => setVenueId(null)} />
            {venues.map((v) => (
              <Chip key={v.id} icon="pin" label={v.name} selected={chosenVenue === v.id} onPress={() => setVenueId(v.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Text variant="label">{i18n.t("money.receipt")}</Text>
      {receipt ? (
        <View style={styles.receipt}>
          <Image source={{ uri: receipt.uri }} accessibilityIgnoresInvertColors style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]} />
          <Text style={styles.flex}>{i18n.t("money.receiptAttached")}</Text>
          <Chip label={i18n.t("money.receiptRemove")} icon="x" onPress={() => setReceipt(null)} />
        </View>
      ) : (
        <View style={styles.chips}>
          <Chip label={i18n.t("money.receiptAdd")} icon="camera" onPress={askReceipt} />
        </View>
      )}

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
              label={m.userId === me ? i18n.t("common.you") : crewName(m.userId, m.name)}
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
              <Text style={styles.flex}>{m.userId === me ? i18n.t("common.you") : crewName(m.userId, m.name)}</Text>
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
  inline: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  currency: { width: 96 },
  receipt: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius.tile },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1 },
  flex: { flex: 1 },
  input: { width: 110, height: 44, borderRadius: radius.input, borderWidth: 1, paddingHorizontal: 12, textAlign: "right" },
});
