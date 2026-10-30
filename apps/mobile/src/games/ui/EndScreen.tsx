import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { palette, radius } from "@crew/design-tokens";
import {
  standings,
  type EndReason,
  type GameId,
  type PenaltyLedger,
} from "@crew/games";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData, useLiveParty } from "@/server/crewData";
import { reportGameResult } from "@/server/gameData";
import { postGameWin } from "@/server/profileData";
import { useSession } from "@/server/session";
import { newId } from "@/state/store";
import { canShareImages } from "@/system/share";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Numeral, Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { useGameT, type GamePluralKey } from "../i18n";
import { buildGameResult } from "../results";
import {
  recordDuration,
  recordResult,
  toEnginePlayer,
  type TablePlayer,
} from "../store";
import { FadeInAfter } from "./motion";

export interface GameRecord {
  key: GamePluralKey;
  playerId: string;
  count: number;
}

/** The best (highest) value of a per-player tally, for the record line. */
export function topOf(
  tally: Readonly<Record<string, number>>,
  key: GamePluralKey,
): GameRecord | null {
  let best: GameRecord | null = null;
  for (const [playerId, count] of Object.entries(tally))
    if (count > 0 && (!best || count > best.count))
      best = { key, playerId, count };
  return best;
}

interface Props {
  gameId: GameId;
  players: readonly TablePlayer[];
  ledger: PenaltyLedger;
  endReason: EndReason | null;
  startedAt: number;
  record: GameRecord | null;
  onAgain: () => void;
}

/** Players shown on the shared image: the podium and a little more, never a long list. */
const CARD_ROWS = 6;

/**
 * O-47 result: penalties per player, the game's record, a picture to share (text where images
 * cannot be made), and the result sent to the crew (TER-02, N-24) without ever making anyone wait.
 */
export function EndScreen({
  gameId,
  players,
  ledger,
  endReason,
  startedAt,
  record,
  onAgain,
}: Props) {
  const theme = useTheme();
  const i18n = useT();
  const g = useGameT();
  const ui = useGameUi();
  const crews = useCrewData((s) => s.crews);
  const live = useLiveParty();
  const card = useRef<ComponentRef<typeof View>>(null);
  const resultId = useRef(newId());
  const [sharing, setSharing] = useState(false);
  const [takeoverBy, setTakeoverBy] = useState<string | null>(null);
  const userId = useSession((s) => s.session?.userId ?? null);
  const ranking = standings(players.map(toEnginePlayer), ledger);
  const recordName = record
    ? players.find((p) => p.id === record.playerId)?.name
    : undefined;
  const recordLine =
    record && recordName
      ? g.plural(record.key, record.count, { name: recordName })
      : null;
  const [first, second] = ranking;
  const winner =
    first && second && first.penalties < second.penalties ? first.player : null;
  const finished = endReason === "completed" && players.length >= 2;

  useEffect(() => {
    let mounted = true;
    haptic.confirmed();
    // A finished game feeds the computed "usually N min" line of the catalogue.
    if (endReason !== "notEnoughPlayers")
      recordDuration(gameId, Date.now() - startedAt);
    if (finished) {
      const holder = record
        ? players.find((p) => p.id === record.playerId)?.name
        : undefined;
      recordResult(
        gameId,
        ranking,
        record && holder
          ? { key: record.key, name: holder, count: record.count }
          : null,
      );
      const result = buildGameResult({
        id: resultId.current,
        gameId,
        playedAt: Date.now(),
        players,
        penalties: new Map(ranking.map((r) => [r.player.id, r.penalties])),
        record,
        crews,
        liveParty: live
          ? { id: live.party.id, crewId: live.party.crewId }
          : null,
      });
      if (result) {
        reportGameResult(result, (answer) => {
          // TER-02: the crown moved because of this game.
          if (!mounted || !answer.takeover?.bossId) return;
          const boss = players.find(
            (p) => p.crewMemberId === answer.takeover?.bossId,
          );
          if (boss) {
            haptic.heavy();
            setTakeoverBy(boss.name);
          }
        });
      }
      // PROF-02 games: a win by an account holder at the table goes to the server for profiles.
      const [first, second] = ranking;
      const winner =
        first && second && first.penalties < second.penalties
          ? players.find((p) => p.id === first.player.id)
          : undefined;
      const accountIds = [
        ...new Set(
          players
            .map((p) => p.crewMemberId)
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      if (
        winner?.crewMemberId &&
        userId &&
        accountIds.includes(userId) &&
        accountIds.length >= 2
      ) {
        void postGameWin({
          id: newId(),
          gameId,
          winnerId: winner.crewMemberId,
          accountIds,
          players: players.length,
        }).catch(() => undefined);
      }
    }
    return () => {
      mounted = false;
    };
  }, [endReason, gameId, startedAt]);

  const shareText = () => {
    const lines = ranking.map(({ player, penalties }) =>
      g.t("end.shareLine", {
        name: player.name,
        penalties: g.plural("shell.penalties", penalties),
      }),
    );
    const message = [
      g.t("end.shareTitle", { game: g.t(`games.${gameId}.name`) }),
      ...lines,
      recordLine,
    ]
      .filter(Boolean)
      .join("\n");
    void Share.share({ message });
  };

  const share = async () => {
    if (!canShareImages || !card.current) {
      shareText();
      return;
    }
    setSharing(true);
    try {
      const uri = await captureRef(card, {
        format: "png",
        quality: 1,
        width: 1080,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
      });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: g.t("end.share"),
        });
      else shareText();
    } catch {
      shareText();
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="h1" accessibilityRole="header">
        {g.t("end.title")}
      </Text>
      {endReason === "notEnoughPlayers" ? (
        <Text>{g.t("end.notEnough")}</Text>
      ) : null}
      {finished ? (
        <Text variant="h3">
          {winner
            ? g.t("end.winner", { name: winner.name })
            : g.t("end.noWinner")}
        </Text>
      ) : null}
      {takeoverBy ? (
        <FadeInAfter delayMs={0}>
          <View
            style={[styles.record, { backgroundColor: palette.tint.amberBg }]}
            accessibilityLiveRegion="polite"
          >
            <Text variant="h3" color={palette.tint.amberTextStrong}>
              {g.t("end.takeover", { name: takeoverBy })}
            </Text>
          </View>
        </FadeInAfter>
      ) : null}
      {recordLine ? (
        <View
          style={[styles.record, { backgroundColor: palette.tint.amberBg }]}
        >
          <Text variant="h3" color={palette.tint.amberTextStrong}>
            {recordLine}
          </Text>
        </View>
      ) : null}
      <Text variant="label">{g.t("end.standings")}</Text>
      <View>
        {ranking.map(({ player, penalties }, index) => (
          <FadeInAfter key={player.id} delayMs={index * 80}>
            <View style={[styles.row, { borderBottomColor: theme.line }]}>
              <Avatar
                personId={player.id}
                name={player.name}
                size={ui.big ? 48 : 38}
              />
              <Text variant="h3" style={styles.name}>
                {player.name}
              </Text>
              <Numeral size={ui.big ? 40 : 30}>{String(penalties)}</Numeral>
            </View>
          </FadeInAfter>
        ))}
      </View>
      <Button
        label={g.t("end.share")}
        icon="share"
        variant="secondary"
        height={ui.secondary}
        loading={sharing}
        onPress={() => void share()}
      />
      <Button label={g.t("end.again")} height={ui.action} onPress={onAgain} />
      <Button
        label={g.t("end.otherGames")}
        variant="outline"
        height={ui.secondary}
        onPress={() => router.replace("/(tabs)/games")}
      />

      {/* O-47: the picture that gets shared, drawn off screen at 4:5 and captured at 1080 px wide. */}
      {canShareImages ? (
        <View
          style={styles.offscreen}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            ref={card}
            collapsable={false}
            style={[styles.card, { backgroundColor: palette.dark.bg }]}
          >
            <Text variant="label" color={palette.dark.textMuted}>
              {g.t("end.title")}
            </Text>
            <Numeral size={44} color={palette.accent.amber}>
              {g.t(`games.${gameId}.name`)}
            </Numeral>
            {winner ? (
              <Text variant="h2" color={palette.dark.text}>
                {g.t("end.winner", { name: winner.name })}
              </Text>
            ) : null}
            <View style={styles.cardRows}>
              {ranking
                .slice(0, CARD_ROWS)
                .map(({ player, penalties }, index) => (
                  <View
                    key={player.id}
                    style={[
                      styles.cardRow,
                      { borderBottomColor: palette.dark.line },
                    ]}
                  >
                    <Text
                      variant="h3"
                      color={
                        index === 0 && winner
                          ? palette.accent.amber
                          : palette.dark.textMuted
                      }
                      style={styles.cardRank}
                    >
                      {String(index + 1)}
                    </Text>
                    <Avatar personId={player.id} name={player.name} size={40} />
                    <Text
                      variant="h3"
                      color={palette.dark.text}
                      style={styles.name}
                    >
                      {player.name}
                    </Text>
                    <Numeral size={30} color={palette.dark.text}>
                      {String(penalties)}
                    </Numeral>
                  </View>
                ))}
            </View>
            {recordLine ? (
              <View
                style={[
                  styles.record,
                  { backgroundColor: palette.tint.amberBg },
                ]}
              >
                <Text variant="h3" color={palette.tint.amberTextStrong}>
                  {recordLine}
                </Text>
              </View>
            ) : null}
            <Text
              variant="small"
              color={palette.dark.textMuted}
              style={styles.footer}
            >
              {i18n.t("recap.storyFooter")}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const CARD_WIDTH = 360;

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  record: { borderRadius: radius.card, padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    borderBottomWidth: 1,
  },
  name: { flex: 1 },
  offscreen: { position: "absolute", left: -10_000, top: 0 },
  card: {
    width: CARD_WIDTH,
    height: (CARD_WIDTH * 5) / 4,
    padding: 24,
    gap: 12,
    borderRadius: radius.card,
  },
  cardRows: { flex: 1 },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    borderBottomWidth: 1,
  },
  cardRank: { width: 20 },
  footer: { alignSelf: "flex-end" },
});
