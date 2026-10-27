import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, size, space } from "@crew/design-tokens";
import type { GameId, PenaltyLedger } from "@crew/games";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Row } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { ToastHost } from "@/ui/Toast";
import { useGameUi } from "../hooks";
import { useGameT } from "../i18n";
import { addTablePlayer, useGamesStore, type TablePlayer } from "../store";
import { DrinkFab } from "./DrinkFab";
import { RulesList } from "./Rules";
import { Sheet } from "./Sheet";

interface Props {
  gameId: GameId;
  /** Round or turn line under the title. */
  status?: string;
  /** Live timed phases (fuse, curve): the "?" is hidden so nobody stalls (research/games.md §2.0). */
  helpHidden?: boolean;
  /** Where the add-drink button sits, away from the main tap zone of the game. */
  fab?: "top" | "bottom" | "none";
  /** Everyone who sat at the table this game. */
  players: readonly TablePlayer[];
  /** Ids still playing. */
  activeIds: ReadonlySet<string>;
  ledger: PenaltyLedger;
  onRemovePlayer?: (id: string) => void;
  onAddPlayer?: (player: TablePlayer) => void;
  onStop: () => void;
  /** Pinned under the content, above the home indicator. */
  footer?: ReactNode;
  /** Off while a gesture owns the screen (drawing), so the page never scrolls under the finger. */
  scroll?: boolean;
  /** Full-bleed games (fingers on the screen) manage their own layout. */
  bleed?: boolean;
  children: ReactNode;
}

/** Frame of every game: header with back and "?", players sheet, add-drink button, toasts, and the level-3 way home. */
export function GameShell({ gameId, status, helpHidden, fab = "bottom", players, activeIds, ledger, onRemovePlayer, onAddPlayer, onStop, footer, scroll = true, bleed = false, children }: Props) {
  useKeepAwake();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const i18n = useT();
  const g = useGameT();
  const ui = useGameUi();
  const [sheet, setSheet] = useState<"rules" | "players" | null>(null);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/games"))} />
      <View style={styles.title}>
        <Text variant="h3" numberOfLines={1} accessibilityRole="header">
          {g.t(`games.${gameId}.name`)}
        </Text>
        {status ? <Text variant="small">{status}</Text> : null}
      </View>
      {ui.level === 3 ? (
        <Button label={g.t("shell.headHome")} icon="home" height={44} variant="secondary" onPress={() => router.replace("/(tabs)")} />
      ) : null}
      <IconButton icon="users" accessibilityLabel={g.t("shell.showPlayers")} onPress={() => setSheet("players")} />
      {helpHidden ? null : (
        <ScalePressable accessibilityLabel={g.t("shell.showRules")} onPress={() => setSheet("rules")} style={[styles.help, { backgroundColor: theme.surface2 }]}>
          <Text variant="h3">?</Text>
        </ScalePressable>
      )}
    </View>
  );

  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (footer ? 16 : insets.bottom + 24) + (fab === "bottom" ? 72 : 0) }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, !bleed && styles.content]}>{children}</View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {header}
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
      {fab === "none" ? null : (
        <DrinkFab style={fab === "top" ? [styles.fabTop, { top: insets.top + 64 }] : [styles.fabBottom, { bottom: (footer ? 96 : 24) + insets.bottom + (ui.big ? 24 : 0) }]} />
      )}
      <ToastHost bottomOffset={insets.bottom + 16} large={ui.big} />
      <Sheet
        visible={sheet === "rules"}
        title={g.t("shell.rules")}
        onClose={() => setSheet(null)}
        footer={<Button label={g.t("shell.resume")} height={ui.secondary} onPress={() => setSheet(null)} />}
      >
        <RulesList gameId={gameId} />
      </Sheet>
      <PlayersSheet
        visible={sheet === "players"}
        onClose={() => setSheet(null)}
        players={players}
        activeIds={activeIds}
        ledger={ledger}
        onRemovePlayer={onRemovePlayer}
        onAddPlayer={onAddPlayer}
        onStop={() => {
          setSheet(null);
          onStop();
        }}
      />
    </View>
  );
}

function PlayersSheet({
  visible,
  onClose,
  players,
  activeIds,
  ledger,
  onRemovePlayer,
  onAddPlayer,
  onStop,
}: {
  visible: boolean;
  onClose: () => void;
  players: readonly TablePlayer[];
  activeIds: ReadonlySet<string>;
  ledger: PenaltyLedger;
  onRemovePlayer?: (id: string) => void;
  onAddPlayer?: (player: TablePlayer) => void;
  onStop: () => void;
}) {
  const theme = useTheme();
  const g = useGameT();
  const ui = useGameUi();
  const table = useGamesStore((s) => s.table);
  const [name, setName] = useState("");
  const playing = players.filter((p) => activeIds.has(p.id));
  // People at the table who are not in this game: those who left it, and anyone on the saved list.
  const bench = [...players.filter((p) => !activeIds.has(p.id)), ...table.filter((t) => !players.some((p) => p.id === t.id))];

  const addNew = () => {
    const player = addTablePlayer(name);
    if (!player || !onAddPlayer) return;
    haptic.select();
    onAddPlayer(player);
    setName("");
  };

  return (
    <Sheet visible={visible} title={g.t("shell.players")} onClose={onClose} footer={<Button label={g.t("shell.stop")} variant="secondary" height={ui.secondary} onPress={onStop} />}>
      {playing.map((player, index) => (
        <Row
          key={player.id}
          title={player.name}
          subtitle={g.plural("shell.penalties", ledger[player.id] ?? 0)}
          leading={<Avatar personId={player.id} name={player.name} />}
          trailing={
            onRemovePlayer ? (
              <IconButton
                icon="x"
                accessibilityLabel={g.t("shell.removeFromGame", { name: player.name })}
                onPress={() => {
                  haptic.select();
                  onRemovePlayer(player.id);
                }}
              />
            ) : null
          }
          last={index === playing.length - 1 && bench.length === 0}
        />
      ))}
      {onAddPlayer ? (
        <>
          {bench.map((player) => (
            <Row
              key={player.id}
              title={player.name}
              subtitle={ledger[player.id] ? g.plural("shell.penalties", ledger[player.id] ?? 0) : undefined}
              leading={<Avatar personId={player.id} name={player.name} faded />}
              trailing={<IconButton icon="plus" accessibilityLabel={`${g.t("shell.addToGame")}, ${player.name}`} onPress={() => onAddPlayer(player)} />}
            />
          ))}
          <View style={styles.addRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={g.t("setup.addPlaceholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={g.t("setup.addPlayer")}
              autoComplete="name"
              returnKeyType="done"
              onSubmitEditing={addNew}
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
            />
            <IconButton icon="plus" tone="amber" accessibilityLabel={g.t("setup.addPlayer")} onPress={addNew} />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.screenX, paddingBottom: 8 },
  title: { flex: 1, minWidth: 0 },
  help: { width: size.iconButton, height: size.iconButton, borderRadius: radius.iconButton, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: space.screenX, paddingTop: 8, gap: space.sectionGap },
  footer: { paddingHorizontal: space.screenX, paddingTop: 10, gap: 10 },
  fabBottom: { position: "absolute", right: 16 },
  fabTop: { position: "absolute", right: 16 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, minHeight: size.input, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 16, fontFamily: "Archivo-Medium" },
});
