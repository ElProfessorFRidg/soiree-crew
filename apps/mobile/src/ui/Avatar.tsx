import { View } from "react-native";
import { avatarColor, palette } from "@crew/design-tokens";
import { Text } from "./Text";

/** First letter of the first two words, emoji and accents included (QOL-11). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toLocaleUpperCase() || "?";
}

interface Props {
  personId: string;
  name: string;
  size?: number;
  /** Faded when the person is absent or home (DESIGN.md §4). */
  faded?: boolean;
  ring?: string;
}

/** Initials on a colour that stays the same for a person across the whole app. */
export function Avatar({ personId, name, size = 38, faded, ring }: Props) {
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(personId),
        alignItems: "center",
        justifyContent: "center",
        opacity: faded ? 0.4 : 1,
        borderWidth: ring ? 2 : 0,
        borderColor: ring ?? "transparent",
      }}
    >
      <Text variant="h3" color={palette.accent.onAccent} style={{ fontSize: Math.round(size * 0.37), lineHeight: Math.round(size * 0.45) }}>
        {initials(name)}
      </Text>
    </View>
  );
}
