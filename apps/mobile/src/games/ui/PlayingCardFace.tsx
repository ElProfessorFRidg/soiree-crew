import { StyleSheet, View } from "react-native";
import { palette } from "@crew/design-tokens";
import { isRed, type PlayingCard } from "@crew/games";
import { useTheme } from "@/theme";
import { Numeral, Text } from "@/ui/Text";
import type { GameTranslator } from "../i18n";

// Suit glyphs with the text presentation selector, so iOS never swaps them for emoji.
const SUIT_GLYPH = { hearts: "♥︎", diamonds: "♦︎", spades: "♠︎", clubs: "♣︎" } as const;
/** Red suits in a deep red that reads on the cream card (design-c.md A-DESIGNC-10). */
const RED_SUIT = "#C2412E";

export function rankLabel(rank: number, g: GameTranslator): string {
  if (rank === 14) return g.t("cards.ace");
  if (rank === 13) return g.t("cards.king");
  if (rank === 12) return g.t("cards.queen");
  if (rank === 11) return g.t("cards.jack");
  return String(rank);
}

function rankName(rank: number, g: GameTranslator): string {
  if (rank === 14) return g.t("cards.aceName");
  if (rank === 13) return g.t("cards.kingName");
  if (rank === 12) return g.t("cards.queenName");
  if (rank === 11) return g.t("cards.jackName");
  return String(rank);
}

/** Spoken name of a card, for screen readers and prompts: « Dame de cœur », "Queen of hearts". */
export function cardName(card: PlayingCard, g: GameTranslator, template: (rank: string, suit: string) => string): string {
  return template(rankName(card.rank, g), g.t(`cards.${card.suit}`));
}

export function PlayingCardFace({ card, g, label, size = 80 }: { card: PlayingCard; g: GameTranslator; label: string; size?: number }) {
  const colour = isRed(card) ? RED_SUIT : palette.accent.onAccent;
  return (
    <View style={[styles.face, { backgroundColor: palette.dark.text }]} accessible accessibilityLabel={label}>
      <Numeral size={size} color={colour}>
        {rankLabel(card.rank, g)}
      </Numeral>
      <Text style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }} color={colour}>
        {SUIT_GLYPH[card.suit]}
      </Text>
    </View>
  );
}

export function CardBack({ label, glyph = "?" }: { label: string; glyph?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.face, { backgroundColor: theme.surfaceRaised }]} accessible accessibilityLabel={label}>
      <Numeral size={64} color={theme.textSoft}>
        {glyph}
      </Numeral>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 4 },
});
