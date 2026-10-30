import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedProps, useAnimatedReaction, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { duration, palette, radius, spring } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { clampWindow, FULL_WINDOW, isZoomed, pinchWindow, screenAt, visibleRange, type ChartWindow } from "@/motion/math/zoom";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
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
  /** O-24: the button that shows the whole period again, and the line that says how to zoom. */
  zoomLabels?: { reset: string; hint: string };
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

export function BacChart({ series, now, legalLimit, personalLimit, formatValue, formatX, legalLabel, personalLabel, accessibilityLabel, onScrub, zoomLabels }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const lastHapticIndex = useRef<number | null>(null);
  const draw = useSharedValue(1);

  // O-24: pinch to zoom, two fingers to pan, double tap to see it all again. The window lives in
  // shared values so a release can spring back inside the bounds; React mirrors it to redraw.
  const zoom = useSharedValue(FULL_WINDOW.zoom);
  const offset = useSharedValue(FULL_WINDOW.offset);
  const [view, setView] = useState<ChartWindow>(FULL_WINDOW);
  useAnimatedReaction(
    () => ({ zoom: zoom.value, offset: offset.value }),
    (next, previous) => {
      if (!previous || next.zoom !== previous.zoom || next.offset !== previous.offset) runOnJS(setView)(next);
    },
  );
  const pinchStart = useRef<{ window: ChartWindow; focal: number } | null>(null);

  const { points } = series;
  const first = points[0];
  const last = points[points.length - 1];

  const geometry = useMemo(() => {
    if (!first || !last || width === 0) return null;
    const maxValue = Math.max(0.6, ...points.map((p) => p.value * 1.15), legalLimit * 1.3, (personalLimit ?? 0) * 1.1);
    const span = Math.max(1, last.at - first.at);
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (at: number) => PAD.left + screenAt(view, (at - first.at) / span) * innerW;
    const y = (value: number) => PAD.top + innerH - (Math.min(value, maxValue) / maxValue) * innerH;
    const xy = points.map((p) => ({ x: x(p.at), y: y(p.value), at: p.at }));
    const past = series.kind === "timeline" ? xy.filter((p) => p.at <= now) : xy;
    const future = series.kind === "timeline" ? xy.filter((p, i) => p.at >= now || xy[i + 1]?.at === undefined) : [];
    // Join the projection to the last past point so the line has no gap.
    if (future.length && past.length) future.unshift(past[past.length - 1]!);
    return { x, y, xy, past, future, maxValue, innerW };
  }, [points, first, last, width, legalLimit, personalLimit, series.kind, now, view]);

  const pastLength = geometry ? lengthOf(geometry.past) : 0;

  // One finger scrubs and the trace follows it; two fingers zoom and pan; a double tap resets.
  const scrubRef = useRef<(touchX: number) => void>(() => undefined);
  const pinching = useRef(false);
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const settle = (target: ChartWindow) => {
    if (reduceMotion) {
      zoom.value = target.zoom;
      offset.value = target.offset;
      return;
    }
    zoom.value = withSpring(target.zoom, spring.snap);
    offset.value = withSpring(target.offset, spring.snap);
  };
  const scrubGesture = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    onBegin: (event) => {
      if (!pinching.current) scrubRef.current(event.x);
    },
    onUpdate: (event) => {
      if (!pinching.current && event.numberOfPointers <= 1) scrubRef.current(event.x);
    },
  });
  const pinchGesture = usePinchGesture({
    runOnJS: true,
    onActivate: (event) => {
      pinching.current = true;
      pinchStart.current = { window: { zoom: zoom.value, offset: offset.value }, focal: (event.focalX - PAD.left) / innerW };
    },
    onUpdate: (event) => {
      const start = pinchStart.current;
      if (!start) return;
      const next = pinchWindow(start.window, event.scale, start.focal, (event.focalX - PAD.left) / innerW);
      zoom.value = next.zoom;
      offset.value = next.offset;
    },
    onFinalize: () => {
      pinching.current = false;
      pinchStart.current = null;
      const target = clampWindow({ zoom: zoom.value, offset: offset.value });
      if (target.zoom !== zoom.value || target.offset !== offset.value) settle(target);
    },
  });
  const resetGesture = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    onActivate: () => {
      if (!isZoomed({ zoom: zoom.value, offset: offset.value })) return;
      haptic.select();
      settle(FULL_WINDOW);
    },
  });
  const gesture = useSimultaneousGestures(scrubGesture, pinchGesture, resetGesture);

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

  // Hour labels follow the visible part only, still spaced so they never overlap.
  const shown = visibleRange(view, first!.at, last!.at);
  const labelCount = Math.max(2, Math.min(6, Math.floor(geometry.innerW / LABEL_SPACING)));
  const ticks = Array.from({ length: labelCount }, (_, i) => {
    const at = shown.from + ((shown.to - shown.from) * i) / (labelCount - 1);
    return { at, x: x(at) };
  });
  const zoomed = isZoomed(view);

  scrubRef.current = (touchX: number) => {
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
      <GestureDetector gesture={gesture}>
      <View collapsable={false} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <ClipPath id="plot">
              <Rect x={PAD.left - 6} y={0} width={Math.max(0, width - PAD.left - PAD.right + 12)} height={HEIGHT - PAD.bottom + 4} />
            </ClipPath>
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

          <G clipPath="url(#plot)">
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
          </G>

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
      </GestureDetector>
      {zoomLabels ? (
        <View style={styles.zoomRow}>
          <Text variant="small" style={styles.flex}>
            {zoomLabels.hint}
          </Text>
          {zoomed ? (
            <Button
              label={zoomLabels.reset}
              icon="undo"
              iconSize={18}
              variant="secondary"
              height={40}
              onPress={() => {
                haptic.select();
                settle(FULL_WINDOW);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: HEIGHT + 30, borderRadius: radius.card, gap: 4 },
  zoomRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, paddingHorizontal: 4 },
  flex: { flex: 1 },
  scrubRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4 },
});
