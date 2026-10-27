import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { duration, palette, radius } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";
import type { CurvePoint, CurveSeries } from "./series";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const HEIGHT = 210;
const PAD = { top: 14, right: 10, bottom: 26, left: 8 };
/** One x label per this many pixels at most, so hour labels never overlap (O-24). */
const LABEL_SPACING = 64;
const HIGH_BAND = 1.2;

interface Props {
  series: CurveSeries;
  now: number;
  /** g/L of blood. 0 for zero tolerance. */
  legalLimit: number;
  personalLimit: number | null;
  formatValue: (gPerL: number) => string;
  formatX: (at: number) => string;
  legalLabel: string;
  personalLabel: string;
  accessibilityLabel: string;
  /** Second line under the scrub value, e.g. the friend being compared later. */
  onScrub?: (point: CurvePoint | null) => void;
}

function pathFor(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function lengthOf(points: { x: number; y: number }[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return length;
}

export function BacChart({ series, now, legalLimit, personalLimit, formatValue, formatX, legalLabel, personalLabel, accessibilityLabel, onScrub }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const lastHapticIndex = useRef<number | null>(null);
  const draw = useSharedValue(1);

  const { points } = series;
  const first = points[0];
  const last = points[points.length - 1];

  const geometry = useMemo(() => {
    if (!first || !last || width === 0) return null;
    const maxValue = Math.max(0.6, ...points.map((p) => p.value * 1.15), legalLimit * 1.3, (personalLimit ?? 0) * 1.1);
    const span = Math.max(1, last.at - first.at);
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (at: number) => PAD.left + ((at - first.at) / span) * innerW;
    const y = (value: number) => PAD.top + innerH - (Math.min(value, maxValue) / maxValue) * innerH;
    const xy = points.map((p) => ({ x: x(p.at), y: y(p.value), at: p.at }));
    const past = series.kind === "timeline" ? xy.filter((p) => p.at <= now) : xy;
    const future = series.kind === "timeline" ? xy.filter((p, i) => p.at >= now || xy[i + 1]?.at === undefined) : [];
    // Join the projection to the last past point so the line has no gap.
    if (future.length && past.length) future.unshift(past[past.length - 1]!);
    return { x, y, xy, past, future, maxValue, innerW };
  }, [points, first, last, width, legalLimit, personalLimit, series.kind, now]);

  const pastLength = geometry ? lengthOf(geometry.past) : 0;

  useEffect(() => {
    // MOT-04: the trace draws itself on every period change.
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, { duration: duration.enter * 2, easing: easings.out });
  }, [series, reduceMotion, draw]);

  const drawProps = useAnimatedProps(() => ({ strokeDashoffset: pastLength * (1 - draw.value) }));

  if (!geometry) {
    return <View style={styles.box} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} />;
  }

  const { x, y, xy, past, future, maxValue } = geometry;
  // Colour by absolute threshold: the low band stops at the user's own limit when it is lower.
  const lowTop = Math.min(0.5, legalLimit > 0 ? legalLimit : 0.005);
  const stop = (value: number) => Math.min(1, Math.max(0, value / maxValue));
  const scrubbed = scrubIndex !== null ? xy[scrubIndex] : undefined;

  const labelCount = Math.max(2, Math.min(6, Math.floor(geometry.innerW / LABEL_SPACING)));
  const ticks = Array.from({ length: labelCount }, (_, i) => {
    const at = first!.at + ((last!.at - first!.at) * i) / (labelCount - 1);
    return { at, x: x(at) };
  });

  const scrubAt = (event: GestureResponderEvent) => {
    const touchX = event.nativeEvent.locationX;
    let best = 0;
    for (let i = 1; i < xy.length; i++) {
      if (Math.abs(xy[i]!.x - touchX) < Math.abs(xy[best]!.x - touchX)) best = i;
    }
    if (lastHapticIndex.current !== best && points[best] && series.peak && points[best]!.at === series.peak.at) haptic.select();
    lastHapticIndex.current = best;
    setScrubIndex(best);
    onScrub?.(points[best] ?? null);
  };

  return (
    <View style={styles.box} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.scrubRow}>
        <Text variant="small">{scrubbed ? formatX(scrubbed.at) : series.peak ? formatX(series.peak.at) : " "}</Text>
        <Text variant="h3" color={theme.amber}>
          {scrubbed ? formatValue(points[scrubIndex!]!.value) : series.peak ? formatValue(series.peak.value) : formatValue(0)}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={scrubAt}
        onResponderMove={scrubAt}
      >
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="threshold" x1="0" y1={y(0)} x2="0" y2={y(maxValue)} gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor={palette.bacThreshold.low} />
              <Stop offset={stop(lowTop)} stopColor={palette.bacThreshold.low} />
              <Stop offset={stop(lowTop)} stopColor={palette.bacThreshold.mid} />
              <Stop offset={stop(HIGH_BAND)} stopColor={palette.bacThreshold.mid} />
              <Stop offset={stop(HIGH_BAND)} stopColor={palette.bacThreshold.high} />
              <Stop offset={1} stopColor={palette.bacThreshold.high} />
            </LinearGradient>
          </Defs>

          {legalLimit > 0 && legalLimit < maxValue ? (
            <>
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(legalLimit)} y2={y(legalLimit)} stroke={theme.danger} strokeWidth={1} strokeDasharray="5 5" opacity={0.8} />
              <SvgText x={width - PAD.right} y={y(legalLimit) - 5} fill={palette.tint.dangerText} fontSize={11} fontFamily="Archivo-Semibold" textAnchor="end">
                {legalLabel}
              </SvgText>
            </>
          ) : null}
          {personalLimit !== null && personalLimit < maxValue ? (
            <>
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(personalLimit)} y2={y(personalLimit)} stroke={theme.amber} strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
              <SvgText x={PAD.left} y={y(personalLimit) - 5} fill={palette.tint.amberText} fontSize={11} fontFamily="Archivo-Semibold">
                {personalLabel}
              </SvgText>
            </>
          ) : null}

          {future.length > 1 ? (
            <Path d={pathFor(future)} stroke="url(#threshold)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="1 7" opacity={0.7} />
          ) : null}
          {past.length > 1 ? (
            <AnimatedPath
              d={pathFor(past)}
              stroke="url(#threshold)"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${pastLength} ${pastLength}`}
              animatedProps={drawProps}
            />
          ) : null}

          {series.peak ? (
            <Circle cx={x(series.peak.at)} cy={y(series.peak.value)} r={5} fill={theme.bg} stroke={theme.text} strokeWidth={2} />
          ) : null}

          {scrubbed ? (
            <>
              <Line x1={scrubbed.x} x2={scrubbed.x} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke={theme.text} strokeWidth={1} opacity={0.6} />
              <Circle cx={scrubbed.x} cy={scrubbed.y} r={6} fill={theme.amber} />
            </>
          ) : null}

          {ticks.map((tick, i) => (
            <SvgText
              key={tick.at}
              x={tick.x}
              y={HEIGHT - 8}
              fill={theme.textMuted}
              fontSize={11}
              fontFamily="Archivo-Semibold"
              textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
            >
              {formatX(tick.at)}
            </SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: HEIGHT + 30, borderRadius: radius.card, gap: 4 },
  scrubRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4 },
});
