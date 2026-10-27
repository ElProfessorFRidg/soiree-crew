import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { palette, radius } from "@crew/design-tokens";
import { applyDrawingEvent, keepPoint, strokePath, type DrawingTransport, type Stroke, type StrokePoint } from "@crew/games";
import { newId } from "@/state/store";

/** Points closer than this share of the canvas are dropped: smoother lines, lighter events. */
const MIN_STEP = 0.004;

interface Props {
  transport: DrawingTransport;
  colour: string;
  /** Stroke width as a share of the canvas width. */
  width: number;
  enabled: boolean;
  accessibilityLabel: string;
  height: number;
}

/**
 * Quick Draw canvas (MOT-07: smooth, responsive strokes). Every gesture becomes a DrawingEvent sent through
 * the transport, and the picture is rebuilt from the events it hears back: a remote transport can plug in
 * here and other phones would draw the same picture.
 */
export function DrawingCanvas({ transport, colour, width, enabled, accessibilityLabel, height }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const current = useRef<{ id: string; last: StrokePoint } | null>(null);
  const settings = useRef({ colour, width, enabled, size });
  settings.current = { colour, width, enabled, size };

  useEffect(() => transport.subscribe((event) => setStrokes((list) => applyDrawingEvent(list, event))), [transport]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => settings.current.enabled,
        onMoveShouldSetPanResponder: () => settings.current.enabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const { w, h } = settings.current.size;
          const point = { x: event.nativeEvent.locationX / w, y: event.nativeEvent.locationY / h };
          const id = newId();
          current.current = { id, last: point };
          transport.send({ type: "stroke.start", id, colour: settings.current.colour, width: settings.current.width, point });
        },
        onPanResponderMove: (event) => {
          const stroke = current.current;
          if (!stroke) return;
          const { w, h } = settings.current.size;
          const point = { x: Math.min(1, Math.max(0, event.nativeEvent.locationX / w)), y: Math.min(1, Math.max(0, event.nativeEvent.locationY / h)) };
          if (!keepPoint(stroke.last, point, MIN_STEP)) return;
          stroke.last = point;
          transport.send({ type: "stroke.extend", id: stroke.id, points: [point] });
        },
        onPanResponderRelease: () => {
          current.current = null;
        },
        onPanResponderTerminate: () => {
          current.current = null;
        },
      }),
    [transport],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSize({ w: Math.max(1, w), h: Math.max(1, h) });
  };

  return (
    <View
      style={[styles.canvas, { height, backgroundColor: palette.dark.text }]}
      onLayout={onLayout}
      accessible
      accessibilityLabel={accessibilityLabel}
      {...responder.panHandlers}
    >
      <Svg width={size.w} height={size.h} pointerEvents="none">
        {strokes.map((stroke) => (
          <Path
            key={stroke.id}
            d={strokePath(stroke.points, size.w, size.h)}
            stroke={stroke.colour}
            strokeWidth={stroke.width * size.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { borderRadius: radius.card + 2, overflow: "hidden" },
});
