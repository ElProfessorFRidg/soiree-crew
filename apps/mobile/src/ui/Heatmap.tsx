import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";

const COLUMNS = 13;

/** Profil board: one square per week, darker to amber with the number of nights out. */
export function Heatmap({ values, accessibilityLabel }: { values: readonly number[]; accessibilityLabel: string }) {
  const theme = useTheme();
  const shade = (n: number) => (n <= 0 ? theme.surfaceRaised : n === 1 ? `${theme.amber}55` : n === 2 ? `${theme.amber}AA` : theme.amber);
  return (
    <View style={styles.grid} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {values.map((n, i) => (
        <View key={i} style={[styles.cell, { backgroundColor: shade(n) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cell: { width: `${100 / COLUMNS - 1}%`, aspectRatio: 1, borderRadius: 3 },
});
