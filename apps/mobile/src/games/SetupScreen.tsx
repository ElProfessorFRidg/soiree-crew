import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radius, size, space } from "@crew/design-tokens";
import { GAME_LEVELS, gameById, lockReason, type GameId } from "@crew/games";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Segmented, Switch, Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { useGameUi } from "./hooks";
import { useGameT } from "./i18n";
import {
  DEFAULT_SETTINGS,
  addTablePlayer,
  moveTablePlayer,
  removeTablePlayer,
  setGameSettings,
  setNoAlcohol,
  startSession,
  useGamesStore,
  type TimerSeconds,
} from "./store";
import { RuleCards } from "./ui/Rules";

const TIMERS: readonly TimerSeconds[] = [0, 30, 60];

/** Game sheet (Jeux board, screen 2): level, rules as cards, players in order, round timer, then Start. */
export function SetupScreen({ gameId }: { gameId: GameId }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const i18n = useT();
  const g = useGameT();
  const ui = useGameUi();
  const game = gameById(gameId);
  const table = useGamesStore((s) => s.table);
  const settings = { ...DEFAULT_SETTINGS, ...useGamesStore((s) => s.settings[gameId]) };
  const crews = useCrewData((s) => s.crews);
  const [name, setName] = useState("");

  const members = crews.flatMap((crew) => crew.members).filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i);
  const missingMembers = members.filter((m) => !table.some((p) => p.crewMemberId === m.id));

  useEffect(() => {
    // First game on this phone: the table starts from the crew, when there is one (O-49).
    if (table.length === 0 && members.length > 0) for (const m of members) addTablePlayer(m.nickname ?? m.displayName, m.id);
    // Only on first open; later edits of the table are the user's.
  }, []);

  const lock = lockReason(game, table.length);
  const add = () => {
    if (addTablePlayer(name)) {
      haptic.select();
      setName("");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingTop: insets.top + space.screenTop, paddingBottom: 24 }]}>
        <View style={styles.top}>
          <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/games"))} />
          <Text variant="h3" accessibilityRole="header" style={styles.flex} align="center">
            {g.t(`games.${gameId}.name`)}
          </Text>
          <View style={styles.spacer} />
        </View>

        <Segmented
          accessibilityLabel={g.t("levels.label")}
          value={settings.level}
          height={ui.big ? 56 : size.segmentedItem}
          items={GAME_LEVELS.map((level) => ({ value: level, label: g.t(`levels.${level}`) }))}
          onChange={(level) => {
            haptic.select();
            setGameSettings(gameId, { level });
          }}
        />

        <RuleCards gameId={gameId} />

        <Text variant="label">{g.t("setup.playersLabel")}</Text>
        <View>
          {table.map((player, index) => (
            <View key={player.id} style={[styles.player, { borderBottomColor: theme.line }]}>
              <Avatar personId={player.id} name={player.name} size={32} />
              <View style={styles.flex}>
                <Text variant="h3">{player.name}</Text>
                {player.guest ? <Tag label={g.t("setup.guest")} /> : null}
              </View>
              <View style={styles.noAlcohol}>
                <Text variant="tag" muted>
                  {g.t("setup.noAlcohol")}
                </Text>
                <Switch value={player.noAlcohol} onValueChange={(v) => setNoAlcohol(player.id, v)} accessibilityLabel={g.t("setup.noAlcoholFor", { name: player.name })} />
              </View>
              {ui.big ? null : (
                <>
                  <IconButton icon="arrowup" size={36} accessibilityLabel={g.t("setup.moveUp", { name: player.name })} onPress={() => index > 0 && moveTablePlayer(player.id, -1)} />
                  <IconButton icon="arrowdn" size={36} accessibilityLabel={g.t("setup.moveDown", { name: player.name })} onPress={() => index < table.length - 1 && moveTablePlayer(player.id, 1)} />
                </>
              )}
              <IconButton icon="x" size={36} accessibilityLabel={g.t("setup.remove", { name: player.name })} onPress={() => removeTablePlayer(player.id)} />
            </View>
          ))}
        </View>
        {table.some((p) => p.noAlcohol) ? <Text variant="small">{g.t("setup.noAlcoholNote")}</Text> : null}

        <View style={styles.addRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={g.t("setup.addPlaceholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={g.t("setup.addPlayer")}
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={add}
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
          />
          <Button label="" icon="plus" accessibilityLabel={g.t("setup.addPlayer")} style={styles.square} onPress={add} />
        </View>
        {missingMembers.length > 0 ? (
          <>
            <Text variant="label">{g.t("setup.fromCrew")}</Text>
            <View style={styles.chips}>
              {missingMembers.map((m) => (
                <Chip key={m.id} label={m.nickname ?? m.displayName} icon="plus" onPress={() => addTablePlayer(m.nickname ?? m.displayName, m.id)} />
              ))}
            </View>
          </>
        ) : null}

        {game.roundTimer ? (
          <View style={styles.timerRow}>
            <Text style={styles.flex}>{g.t("setup.timer")}</Text>
            <View style={styles.timer}>
              <Segmented
                accessibilityLabel={g.t("setup.timer")}
                value={settings.timerSeconds}
                items={TIMERS.map((seconds) => ({ value: seconds, label: seconds === 0 ? g.t("setup.timerOff") : g.t("setup.seconds", { seconds }) }))}
                onChange={(timerSeconds) => setGameSettings(gameId, { timerSeconds })}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {lock ? (
          <View style={[styles.lock, { backgroundColor: palette.tint.amberBg }]} accessibilityLiveRegion="polite">
            <Text color={palette.tint.amberTextStrong}>
              {lock.kind === "needsPlayers" ? g.plural("lock.needs", lock.missing, { min: lock.min }) : g.t("lock.tooMany", { max: lock.max })}
            </Text>
          </View>
        ) : null}
        <Button
          label={g.plural("setup.start", table.length)}
          height={ui.action}
          disabled={lock !== null}
          onPress={() => {
            startSession(gameId);
            router.push({ pathname: "/games/play/[gameId]", params: { gameId } });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.screenX, gap: space.sectionGap },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  spacer: { width: size.iconButton },
  flex: { flex: 1 },
  player: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 60, borderBottomWidth: 1, paddingVertical: 6 },
  noAlcohol: { alignItems: "center", gap: 2 },
  addRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: size.input, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 16, fontFamily: "Archivo-Medium" },
  square: { width: size.button, paddingHorizontal: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timer: { width: 200 },
  footer: { paddingHorizontal: space.screenX, paddingTop: 10, gap: 10 },
  lock: { borderRadius: radius.tile, padding: 12 },
});
