import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { formatMoney } from "@crew/money";
import { logWater } from "@/drinks/actions";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { fetchAlbum, type AlbumPhoto } from "@/photos/uploads";
import { fetchPool, fetchPools } from "@/server/moneyData";
import { fetchRecap, type Recap } from "@/server/recapData";
import { Alibi } from "@/recap/Alibi";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Photos shown on the morning screen; the album has the rest. */
const MORNING_PHOTOS = 12;

interface Debt {
  otherId: string;
  name: string;
  amount: number;
  currency: string;
  iOwe: boolean;
}

/**
 * QOL-20: the morning after. Calm and low contrast on the night theme (PROMPT
 * asks for dark), the recap, the night's photos, who owes what, and a glass of water.
 */
export default function MorningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [poolId, setPoolId] = useState<string | null>(null);
  const [waterDone, setWaterDone] = useState(false);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);

  useEffect(() => {
    void fetchAlbum(id)
      .then((list) => setPhotos([...list].sort((a, b) => a.at - b.at)))
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    void fetchRecap(id)
      .then(async (data) => {
        setRecap(data);
        const { pools } = await fetchPools(data.party.crewId);
        const pool = pools.find((p) => p.partyId === id);
        if (!pool) return;
        setPoolId(pool.id);
        const detail = await fetchPool(pool.id);
        const nameOf = (userId: string) => detail.members.find((m) => m.userId === userId)?.name ?? "?";
        setDebts(
          detail.settlement.flatMap((s) =>
            s.transfers
              .filter((t) => t.fromId === me || t.toId === me)
              .map((t) => {
                const iOwe = t.fromId === me;
                const otherId = iOwe ? t.toId : t.fromId;
                return { otherId, name: nameOf(otherId), amount: t.amount, currency: s.currency, iOwe };
              }),
          ),
        );
      })
      .catch(() => undefined);
  }, [id, me]);

  const now = Date.now();
  const day = new Intl.DateTimeFormat(i18n.locale, { weekday: "long" }).format(new Date(now));
  const money = (amount: number, currency: string) => formatMoney(amount, currency, i18n.locale);

  return (
    <Screen back title={i18n.t("morning.title")}>
      <Text variant="small">
        {day}, {formatClock(now, i18n.language, preferences.hourCycle)}
      </Text>
      <Text variant="h2" color={theme.textMuted}>
        {i18n.t("morning.calm")}
      </Text>

      {recap ? (
        <Row
          title={recap.party.name}
          subtitle={i18n.t("morning.summary", {
            present: `${i18n.number(recap.figures.participants)} ${i18n.plural("recap.present", recap.figures.participants)}`,
            drinks: `${i18n.number(recap.figures.drinks)} ${i18n.plural("recap.drinks", recap.figures.drinks)}`,
          })}
          leading={<Icon name="sparkdot" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.replace({ pathname: "/recap", params: { id } })}
          last
        />
      ) : null}

      {photos.length ? (
        <>
          <Text variant="label">{i18n.plural("morning.photos", photos.length)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {photos.slice(0, MORNING_PHOTOS).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={i18n.t("album.open")}
                onPress={() => router.push({ pathname: "/album", params: { partyId: id } })}
              >
                {/* Dimmed a little: the morning screen stays low contrast. */}
                <Image source={{ uri: p.url }} style={[styles.photo, { backgroundColor: theme.surfaceRaised }]} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
          {photos.length >= 2 ? (
            <Button label={i18n.t("strip.open")} icon="sparkdot" variant="outline" height={44} onPress={() => router.push({ pathname: "/photo-strip", params: { partyId: id } })} />
          ) : null}
        </>
      ) : null}

      <Text variant="label">{i18n.t("morning.accounts")}</Text>
      {debts.length === 0 ? <Text color={theme.textMuted}>{i18n.t("morning.allSquare")}</Text> : null}
      {debts.map((debt) => (
        <View key={`${debt.otherId}-${debt.currency}`} style={[styles.debt, { borderBottomColor: theme.line }]}>
          <Avatar personId={debt.otherId} name={debt.name} size={34} faded />
          <Text style={styles.flex} color={theme.textMuted}>
            {debt.iOwe
              ? i18n.t("money.youPay", { to: debt.name, amount: money(debt.amount, debt.currency) })
              : i18n.t("money.paysYou", { from: debt.name, amount: money(debt.amount, debt.currency) })}
          </Text>
        </View>
      ))}
      {poolId ? <Button label={i18n.t("morning.seePool")} variant="outline" height={44} onPress={() => router.push({ pathname: "/pool", params: { id: poolId } })} /> : null}

      <Alibi names={(recap?.participants ?? []).filter((p) => p.userId !== me).map((p) => p.name)} />

      <Panel tint="water">
        <View style={styles.water}>
          <Icon name="drop" color={theme.textMuted} />
          <Text style={styles.flex} color={theme.textMuted}>
            {i18n.t("morning.water")}
          </Text>
          <Button
            label={i18n.t("morning.waterDone")}
            variant="water"
            height={40}
            disabled={waterDone}
            onPress={() => {
              logWater();
              haptic.water();
              setWaterDone(true);
            }}
          />
        </View>
      </Panel>
      <Button label={i18n.t("morning.later")} variant="outline" height={44} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  debt: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1 },
  water: { flexDirection: "row", alignItems: "center", gap: 12 },
  photos: { gap: 8 },
  photo: { width: 96, height: 128, borderRadius: 10, opacity: 0.85 },
});
