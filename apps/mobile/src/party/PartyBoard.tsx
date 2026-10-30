import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { useEcoInterval } from "@/power/eco";
import { useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import { fetchLeaderboard, type LeaderboardRow } from "@/server/venueData";
import { useTheme } from "@/theme";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";

const REFRESH_MS = 60_000;
const SHOWN = 3;

/**
 * HUB-01: the live party leaderboard on the Party screen itself, top three and me, verified drinks
 * only (RANK-06). Follows the party: refreshes when a drink lands anywhere in it.
 */
export function PartyBoard() {
  const i18n = useT();
  const theme = useTheme();
  const current = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const refreshMs = useEcoInterval(REFRESH_MS);
  const crewId = current?.party.crewId;
  const partyId = current?.party.id;
  // Any drink in the party changes the live view: the board follows it.
  const drinksTonight = current?.live?.members.reduce((sum, m) => sum + m.drinks, 0) ?? 0;

  useEffect(() => {
    if (!crewId || !partyId) return;
    const load = () =>
      void fetchLeaderboard(crewId, "party", "drinks", partyId)
        .then((board) => setRows(board.disabled ? [] : board.rows))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, refreshMs);
    return () => clearInterval(timer);
  }, [crewId, partyId, refreshMs, drinksTonight]);

  if (!current || !rows || rows.every((r) => r.value === 0)) return null;
  const top = rows.slice(0, SHOWN);
  const mine = rows.find((r) => r.userId === me);
  const shown = mine && !top.includes(mine) ? [...top, mine] : top;

  return (
    <ScalePressable
      pressedScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={i18n.t("ranking.title")}
      onPress={() => router.push({ pathname: "/leaderboard", params: { crewId: current.party.crewId } })}
      style={styles.block}
    >
      <View style={styles.head}>
        <Icon name="trophy" color={theme.textMuted} />
        <Text variant="label" style={styles.flex}>
          {i18n.t("ranking.tonight")}
        </Text>
        <Icon name="chev" color={theme.textMuted} />
      </View>
      {shown.map((row) => (
        <View key={row.userId} style={[styles.row, { borderBottomColor: theme.line }]}>
          <Numeral size={22} color={row.rank === 1 ? theme.amber : theme.text} style={styles.rank}>
            {String(row.rank)}
          </Numeral>
          <Text variant="h3" style={styles.flex}>
            {row.userId === me ? i18n.t("crew.you") : row.name}
          </Text>
          <Text variant="small">{i18n.plural("party.drinks", row.value)}</Text>
        </View>
      ))}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, borderBottomWidth: 1 },
  rank: { minWidth: 24 },
  flex: { flex: 1 },
});
