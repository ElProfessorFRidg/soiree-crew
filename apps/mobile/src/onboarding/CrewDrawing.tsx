import { View } from "react-native";
import Svg from "react-native-svg";
import { useReducedMotion } from "react-native-reanimated";
import { useTheme } from "@/theme";
import { DrawnPath, type Line } from "@/profile/VisibilityDrawing";

// O-05: the line drawing of the crew step, on the same 120 grid as the visibility drawings.
// Three people side by side behind a table; the one in the middle is the accent.
const LINES: Line[] = [
  { d: "M10 102 H110" },
  { d: "M16 100 Q16 78 30 78 Q44 78 44 100" },
  { d: "M22 60 A8 8 0 1 0 38 60 A8 8 0 1 0 22 60" },
  { d: "M76 100 Q76 78 90 78 Q104 78 104 100" },
  { d: "M82 60 A8 8 0 1 0 98 60 A8 8 0 1 0 82 60" },
  { d: "M46 100 Q46 68 60 68 Q74 68 74 100" },
  { d: "M52 50 A8 8 0 1 0 68 50 A8 8 0 1 0 52 50", accent: true },
  { d: "M60 22 V34 M54 28 H66", accent: true },
];

/** Decorative: the title next to it says what the step is. Draws itself once; still under Reduce Motion. */
export function CrewDrawing({ size = 132 }: { size?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 120 120" accessible={false} importantForAccessibility="no-hide-descendants">
        {LINES.map((line, index) => (
          <DrawnPath key={line.d} line={line} index={index} still={reduceMotion} stroke={theme.text} accent={theme.amber} />
        ))}
      </Svg>
    </View>
  );
}
