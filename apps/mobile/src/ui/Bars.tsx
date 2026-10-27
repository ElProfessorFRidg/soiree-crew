import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";

const BAR_HEIGHT = 80;

/** Simple bars, tallest = full height, labels under each. Data stays readable as text too. */
export function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={styles.bars} accessible accessibilityLabel={labels.map((l, i) => `${l} ${values[i]}`).join(", ")}>
      {values.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <Text variant="small">{v > 0 ? String(v) : ""}</Text>
          <View style={[styles.bar, { height: Math.max(2, (v / max) * BAR_HEIGHT), backgroundColor: v > 0 ? theme.amber : theme.surfaceRaised }]} />
          <Text variant="tab" align="center">
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  bar: { width: "100%", borderRadius: 4 },
});
