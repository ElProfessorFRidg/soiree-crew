import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatMoney, parseAmount, shares } from "@crew/money";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData, useLiveParty } from "@/server/crewData";
import { createPool, fetchPool, fetchPools, fetchRounds, type PoolSummary, type RoundsState } from "@/server/moneyData";
import { useSession } from "@/server/session";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useDraft } from "@/state/drafts";

/** N-20: tonight's spending is my share of the party pool's expenses. */
function useTonightSpent(partyPoolId: string | undefined, me: string | undefined): number | null {
  const [spent, setSpent] = useState<number | null>(null);
  useEffect(() => {
    if (!partyPoolId || !me) return;
    void fetchPool(partyPoolId)
      .then((detail) => {
        let total = 0;
        for (const expense of detail.expenses) total += shares(expense)[me] ?? 0;
        setSpent(total);
      })
      .catch(() => undefined);
  }, [partyPoolId, me]);
  return spent;
}

export default function MoneyScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { crewId } = useLocalSearchParams<{ crewId?: string }>();
  const crews = useCrewData((state) => state.crews);
  const live = useLiveParty();
  const crew = crews.find((c) => c.id === (crewId ?? live?.party.crewId)) ?? crews[0];
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [rounds, setRounds] = useState<RoundsState | null>(null);
  const [poolName, setPoolName, clearPoolName] = useDraft("money:pool-name");
  const [budgetInput, setBudgetInput] = useState("");

  // Keyed on ids: useLiveParty builds a new object on every render.
  const crewKey = crew?.id;
  const partyKey = live?.party.id;
  const load = useCallback(() => {
    if (crewKey) void fetchPools(crewKey).then((data) => setPools(data.pools)).catch(() => undefined);
    if (partyKey) void fetchRounds(partyKey).then(setRounds).catch(() => undefined);
  }, [crewKey, partyKey]);
  useFocusEffect(load);

  const partyPool = live ? pools.find((p) => p.partyId === live.party.id) : undefined;
  const spent = useTonightSpent(partyPool?.id, me);
  const money = (amount: number, currency = preferences.currency) => formatMoney(amount, currency, i18n.locale);
  const budget = preferences.partyBudget;
  const ratio = budget && spent !== null ? spent / budget : 0;
  const nextName = rounds?.present.find((p) => p.userId === rounds.nextPayerId)?.name;

  return (
    <Screen back title={i18n.t("money.title")} withToasts onRefresh={async () => load()}>
      <Panel>
        <Text variant="h3">{i18n.t("money.round")}</Text>
        {live && rounds ? (
          <>
            <Text>{rounds.nextPayerId === me ? i18n.t("money.nextPayerMe") : nextName ? i18n.t("money.nextPayer", { name: nextName }) : ""}</Text>
            <Button label={i18n.t("money.logRound")} icon="glass" height={56} onPress={() => router.push({ pathname: "/round", params: { partyId: live.party.id } })} />
          </>
        ) : (
          <Text variant="small">{i18n.t("money.roundNoParty")}</Text>
        )}
      </Panel>

      <Panel>
        <Text variant="h3">{i18n.t("money.budget")}</Text>
        {budget ? (
          <>
            <Text>{i18n.t("money.budgetSpent", { spent: money(spent ?? 0), budget: money(budget) })}</Text>
            {/* Budget bar colours from DESIGN.md §4: ok under 70 %, amber to 90 %, danger beyond. */}
            <View style={[styles.bar, { backgroundColor: theme.surfaceRaised }]}>
              <View
                style={{
                  width: `${Math.min(100, ratio * 100)}%`,
                  height: "100%",
                  backgroundColor: ratio >= 0.9 ? theme.danger : ratio >= 0.7 ? theme.amber : theme.ok,
                }}
              />
            </View>
            {ratio >= 1 ? <Text color={theme.danger}>{i18n.t("money.budgetOver")}</Text> : ratio >= 0.9 ? <Text color={theme.amberText}>{i18n.t("money.budgetNear")}</Text> : null}
            <Button label={i18n.t("money.budgetRemove")} variant="outline" height={40} onPress={() => setPreferences({ partyBudget: null })} />
          </>
        ) : (
          <View style={styles.inline}>
            <Field
              label={i18n.t("money.amount")}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="decimal-pad"
              placeholder={money(5000)}
              style={styles.flex}
            />
            <Button
              label={i18n.t("money.budgetSet")}
              variant="secondary"
              height={52}
              onPress={() => {
                const amount = parseAmount(budgetInput);
                if (!amount) {
                  showToast({ tone: "danger", message: i18n.t("money.amountInvalid") });
                  return;
                }
                haptic.select();
                setPreferences({ partyBudget: amount });
                setBudgetInput("");
              }}
            />
          </View>
        )}
      </Panel>

      <Text variant="label">{i18n.t("money.pools")}</Text>
      {pools.length === 0 ? <Text>{i18n.t("money.noPool")}</Text> : null}
      <View>
        {pools.map((pool, index) => (
          <Row
            key={pool.id}
            title={pool.name}
            subtitle={
              pool.myBalance > 0
                ? i18n.t("money.owedToYou", { amount: money(pool.myBalance, pool.currency) })
                : pool.myBalance < 0
                  ? i18n.t("money.youOwe", { amount: money(-pool.myBalance, pool.currency) })
                  : i18n.t("money.settled")
            }
            trailing={<Icon name="chev" color={theme.textMuted} />}
            onPress={() => router.push({ pathname: "/pool", params: { id: pool.id } })}
            last={index === pools.length - 1}
          />
        ))}
      </View>

      {crew ? (
        <Panel>
          <Field label={i18n.t("money.newPool")} placeholder={i18n.t("money.poolName")} value={poolName} onChangeText={setPoolName} maxLength={60} />
          <Button
            label={i18n.t("money.create")}
            variant="secondary"
            height={44}
            disabled={!poolName.trim()}
            onPress={() =>
              void createPool(crew.id, poolName.trim(), preferences.currency, crew.members.map((m) => m.id))
                .then((id) => {
                  clearPoolName();
                  router.push({ pathname: "/pool", params: { id } });
                })
                .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
            }
          />
        </Panel>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 14, borderRadius: 7, overflow: "hidden" },
  inline: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  flex: { flex: 1 },
});
