import { useEffect } from "react";
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { duration, iconStroke } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import type { VisibilityKey } from "@/onboarding/visibility";

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Longer than any stroke below, so one dash covers a whole path. */
const DASH = 600;
const STAGGER = 130;

interface Line {
  d: string;
  /** The one accent stroke of the drawing, in amber. */
  accent?: boolean;
}

// PROF-02: one original line drawing per thing a profile can open, on a 120 grid.
const DRAWINGS: Record<VisibilityKey, Line[]> = {
  // A bar front with its awning, and a flag planted on the roof: the territory.
  venues: [
    { d: "M14 100 H106" },
    { d: "M28 56 V100 M92 56 V100" },
    { d: "M20 56 H100 L92 38 H28 Z" },
    { d: "M20 56 Q29 66 38 56 Q47 66 56 56 Q65 66 74 56 Q83 66 92 56 Q96 60 100 56" },
    { d: "M50 100 V76 H70 V100" },
    { d: "M60 38 V12" },
    { d: "M60 12 L82 19 L60 27", accent: true },
  ],
  // A podium with a crown over the first place.
  titles: [
    { d: "M10 102 H110" },
    { d: "M16 102 V84 H42 V102" },
    { d: "M42 102 V66 H78 V102" },
    { d: "M78 102 V88 H104 V102" },
    { d: "M60 74 V94 M54 80 H66" },
    { d: "M47 56 V38 L55 46 L60 32 L65 46 L73 38 V56 Z", accent: true },
  ],
  // A medal on its ribbon, with a star inside.
  badges: [
    { d: "M42 12 L55 46 M78 12 L65 46" },
    { d: "M36 74 A24 24 0 1 0 84 74 A24 24 0 1 0 36 74" },
    { d: "M45 74 A15 15 0 1 0 75 74 A15 15 0 1 0 45 74" },
    { d: "M60 62 L64 70 L73 71 L66.5 77 L68.5 86 L60 81.500 L51.500 86 L53.500 77 L47 71 L56 70 Z", accent: true },
  ],
  // A magnifier with a person in the lens.
  find: [
    { d: "M20 52 A28 28 0 1 0 76 52 A28 28 0 1 0 20 52" },
    { d: "M68 73 L100 105" },
    { d: "M34 70 Q34 56 48 56 Q62 56 62 70" },
    { d: "M41 42 A7 7 0 1 0 55 42 A7 7 0 1 0 41 42", accent: true },
  ],
  // A moon over a door left ajar, its light on the pavement.
  presence: [
    { d: "M10 102 H110" },
    { d: "M24 102 V66 H52 V102" },
    { d: "M52 66 L66 72 V98 L52 102" },
    { d: "M52 76 L84 102", accent: true },
    { d: "M96 14 A26 26 0 1 0 108 56 A20 20 0 0 1 96 14 Z" },
    { d: "M74 22 V32 M69 27 H79", accent: true },
  ],
};

function DrawnPath({ line, index, still, stroke, accent }: { line: Line; index: number; still: boolean; stroke: string; accent: string }) {
  const draw = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      draw.value = 1;
      return;
    }
    draw.value = withDelay(index * STAGGER, withTiming(1, { duration: duration.rise, easing: easings.out }));
  }, [still, index, draw]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: DASH * (1 - draw.value) }));
  return (
    <AnimatedPath
      d={line.d}
      stroke={line.accent ? accent : stroke}
      strokeWidth={iconStroke.width + 0.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={DASH}
      animatedProps={props}
    />
  );
}

/**
 * The drawing of one visibility choice. The stroke draws itself once on entry, line after line;
 * under Reduce Motion it is simply there. Decorative: the title next to it says what it is.
 */
export function VisibilityDrawing({ kind, size = 132 }: { kind: VisibilityKey; size?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessible={false} importantForAccessibility="no-hide-descendants">
      {DRAWINGS[kind].map((line, index) => (
        <DrawnPath key={line.d} line={line} index={index} still={reduceMotion} stroke={theme.text} accent={theme.amber} />
      ))}
    </Svg>
  );
}
