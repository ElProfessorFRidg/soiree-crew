import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import { avatarColor, duration, radius } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import type { Recap } from "@/server/recapData";
import { useTheme } from "@/theme";
import { Chip } from "@/ui/controls";
import { Text } from "@/ui/Text";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const HEIGHT = 220;
const PAD = { top: 10, right: 8, bottom: 8, left: 8 };
const MIN_SPAN_MS = 60 * 60_000;

type Participant = Recap["participants"][number];

function lengthOf(points: { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return total;
}

function DrawnLine({ d, length, color, faded, progress }: { d: string; length: number; color: string; faded: boolean; progress: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeOpacity={faded ? 0.18 : 1}
      strokeWidth={faded ? 2 : 3}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[length, length]}
      animatedProps={props}
    />
  );
}

interface Props {
  participants: Participant[];
  from: number;
  legalLimit: number;
  /** Bumped by "Rejouer" so the curves draw again. */
  replay: number;
  meId: string | undefined;
  formatX: (at: number) => string;
  labels: { range: (from: string, to: string) => string; hint: string; legal: string; rangeEnd: string; you: string };
}

/** O-41, MOT-08: everyone's curves overlaid, drawing themselves, with a time-range slider. */
export function RecapCurves({ participants, from, legalLimit, replay, meId, formatX, labels }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [isolated, setIsolated] = useState<string | null>(null);
  const withCurves = participants.filter((p) => p.curve.length > 1);
  const lastAt = Math.max(from + MIN_SPAN_MS, ...withCurves.map((p) => p.curve[p.curve.length - 1]![0]));
  const [endFraction, setEndFraction] = useState(1);
  const to = from + Math.max(MIN_SPAN_MS, (lastAt - from) * endFraction);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: duration.enter * 4, easing: easings.out });
  }, [replay, reduceMotion, progress]);

  const lines = useMemo(() => {
    if (width === 0) return [];
    const max = Math.max(0.6, legalLimit * 1.3, ...withCurves.flatMap((p) => p.curve.filter(([at]) => at <= to).map(([, v]) => v * 1.15)));
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (at: number) => PAD.left + ((at - from) / (to - from)) * innerW;
    const y = (v: number) => PAD.top + innerH - (Math.min(v, max) / max) * innerH;
    return withCurves.map((p) => {
      const xy = p.curve.filter(([at]) => at >= from && at <= to).map(([at, v]) => ({ x: x(at), y: y(v) }));
      return {
        userId: p.userId,
        d: xy.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" "),
        length: Math.max(1, lengthOf(xy)),
        legalY: y(legalLimit),
      };
    });
  }, [width, withCurves, from, to, legalLimit]);

  const setEnd = (event: GestureResponderEvent) => {
    if (width === 0) return;
    const next = Math.min(1, Math.max(0.15, event.nativeEvent.locationX / width));
    if (Math.abs(next - endFraction) > 0.02) {
      setEndFraction(next);
      if (next === 1) haptic.select();
    }
  };

  const legalY = lines[0]?.legalY;
  return (
    <View style={styles.gap}>
      <Text variant="small">{labels.range(formatX(from), formatX(to))}</Text>
      <View style={[styles.chart, { backgroundColor: theme.surfaceRaised }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {legalLimit > 0 && legalY !== undefined ? (
              <Line x1={PAD.left} x2={width - PAD.right} y1={legalY} y2={legalY} stroke={theme.danger} strokeDasharray="5 6" strokeWidth={1.5} />
            ) : null}
            {lines.map((line) => (
              <DrawnLine
                key={`${line.userId}-${replay}`}
                d={line.d}
                length={line.length}
                color={avatarColor(line.userId)}
                faded={isolated !== null && isolated !== line.userId}
                progress={progress}
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={labels.rangeEnd}
        accessibilityValue={{ text: formatX(to) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => setEndFraction((f) => Math.min(1, Math.max(0.15, f + (event.nativeEvent.actionName === "increment" ? 0.1 : -0.1))))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={setEnd}
        onResponderMove={setEnd}
        style={styles.sliderHit}
      >
        <View style={[styles.track, { backgroundColor: theme.surfaceRaised }]}>
          <View style={[styles.fill, { width: `${endFraction * 100}%`, backgroundColor: theme.amber }]} />
        </View>
        <View style={[styles.thumb, { left: `${endFraction * 100}%`, backgroundColor: theme.text }]} />
      </View>
      <View style={styles.chips}>
        {withCurves.map((p) => (
          <Chip
            key={p.userId}
            label={p.userId === meId ? labels.you : p.name}
            selected={isolated === p.userId}
            onPress={() => setIsolated((current) => (current === p.userId ? null : p.userId))}
          />
        ))}
      </View>
      <Text variant="small">{labels.hint}</Text>
      {legalLimit > 0 ? <Text variant="small">{labels.legal}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  chart: { height: HEIGHT, borderRadius: radius.card, overflow: "hidden" },
  sliderHit: { height: 36, justifyContent: "center" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%" },
  thumb: { position: "absolute", width: 22, height: 22, borderRadius: 11, marginLeft: -11, top: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
