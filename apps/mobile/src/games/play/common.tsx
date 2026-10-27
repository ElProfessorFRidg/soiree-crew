import { useCallback, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { palette, radius } from "@crew/design-tokens";
import type { GameContent, Player } from "@crew/games";
import { Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { toEnginePlayer, type GameSession, type TablePlayer } from "../store";

export interface GameScreenProps {
  session: GameSession;
  content: GameContent;
  /** Same game, same table, fresh state. */
  onAgain: () => void;
}

/** Everyone who sat at the table this game, including players added mid-game (O-47). */
export function useTable(session: GameSession) {
  const [added, setAdded] = useState<TablePlayer[]>([]);
  const all = useMemo(() => [...session.players, ...added.filter((a) => !session.players.some((p) => p.id === a.id))], [session.players, added]);
  const add = useCallback((player: TablePlayer): Player => {
    setAdded((list) => (list.some((p) => p.id === player.id) ? list : [...list, player]));
    return toEnginePlayer(player);
  }, []);
  const nameOf = useCallback((id: string | null | undefined) => all.find((p) => p.id === id)?.name ?? "", [all]);
  return { all, add, nameOf };
}

export const ids = (players: readonly { id: string }[]): ReadonlySet<string> => new Set(players.map((p) => p.id));

/** The cream game card of the prototype: light face, dark text, flat colour tag. */
export function GameCard({ children, style, minHeight = 320 }: { children: ReactNode; style?: StyleProp<ViewStyle>; minHeight?: number }) {
  return <View style={[styles.card, { minHeight, backgroundColor: palette.dark.text }, style]}>{children}</View>;
}

export function CardTag({ label, colour }: { label: string; colour: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: colour }]}>
      <Text variant="tag" color={palette.accent.onAccent}>
        {label}
      </Text>
    </View>
  );
}

/** Card text: big at every level, bigger at levels 2 and 3. */
export function CardText({ children }: { children: string }) {
  const ui = useGameUi();
  return (
    <Text color={palette.accent.onAccent} style={[styles.cardText, ui.big && styles.cardTextBig]}>
      {children}
    </Text>
  );
}

export const cardColours = {
  amber: palette.accent.amber,
  water: palette.semantic.water,
  mint: palette.semantic.ok,
  lavender: palette.avatar[4] ?? "#D6C8F2",
  coral: palette.avatar[5] ?? "#FF9C8A",
  peach: palette.avatar[3] ?? "#F2C6A0",
  muted: palette.light.textMuted,
} as const;

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 22, justifyContent: "space-between", gap: 14 },
  tag: { alignSelf: "flex-start", minHeight: 24, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center" },
  cardText: { fontSize: 25, lineHeight: 31, fontFamily: "Archivo-Heading" },
  cardTextBig: { fontSize: 29, lineHeight: 36 },
});
