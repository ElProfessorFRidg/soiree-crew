import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { duration, palette, radius, scaled, spring } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { swipeDecision, swipeLabelOpacity, swipeTilt, type SwipeSide } from "@/motion/math/swipe";
import { Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { useGameT } from "../i18n";

export interface SwipeAction {
  label: string;
  onCommit: () => void;
}

interface Props {
  /** Changes when the next card is on the table: the card comes back to the middle. */
  cardKey: string | number;
  left?: SwipeAction;
  right?: SwipeAction;
  /** One action for both directions (next card). */
  either?: SwipeAction;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Shown under the first swipeable card until a card has been swiped once in this run of the app. */
let swipedOnce = false;

/**
 * MOT-06: a card swiped off the table. The card follows the finger with a slight tilt, shows the action
 * it is about to take, and on release either leaves (past a third of its width or on a fling) or comes
 * back with `spring.snap`. The buttons under the card stay the accessible path: at UI levels 2 and 3
 * nothing needs a precise swipe, so the gesture is off. Reduce Motion: no tilt, the card fades instead
 * of flying away.
 */
export function SwipeCard({ cardKey, left, right, either, children, style }: Props) {
  const ui = useGameUi();
  const g = useGameT();
  const reduceMotion = useReducedMotion();
  const leftAction = left ?? either;
  const rightAction = right ?? either;
  const canLeft = !!leftAction;
  const canRight = !!rightAction;
  const enabled = !ui.big && (canLeft || canRight);
  const [hint, setHint] = useState(!swipedOnce);

  const x = useSharedValue(0);
  const fade = useSharedValue(1);
  const width = useSharedValue(0);
  const busy = useSharedValue(false);
  const committedKey = useRef<string | number | null>(null);
  const keyNow = useRef(cardKey);
  keyNow.current = cardKey;

  // Read on the JS thread (MOTION.md): worklets get plain numbers.
  const leaveMs = duration.enter;
  const fadeMs = duration.toggle;
  const snap = spring.snap;

  useLayoutEffect(() => {
    const swiped = busy.value;
    busy.value = false;
    x.value = 0;
    // The card that replaces a swiped one fades in where the old one left from.
    if (swiped) {
      fade.value = 0;
      fade.value = withTiming(1, { duration: fadeMs, easing: easings.out });
    } else fade.value = 1;
  }, [cardKey, busy, x, fade, fadeMs]);

  const commit = (side: SwipeSide) => {
    const action = side === "left" ? leftAction : rightAction;
    haptic.select();
    swipedOnce = true;
    setHint(false);
    committedKey.current = keyNow.current;
    action?.onCommit();
    // An action that did not move to another card: bring this one back rather than leave a gap.
    setTimeout(() => {
      if (committedKey.current !== keyNow.current) return;
      busy.value = false;
      x.value = 0;
      fade.value = withTiming(1, { duration: fadeMs, easing: easings.out });
    }, scaled(120));
  };

  const pan = usePanGesture({
    enabled,
    activeOffsetX: [-12, 12],
    failOffsetY: [-18, 18],
    onUpdate: (event) => {
      "worklet";
      if (busy.value) return;
      // A direction without an action resists, so the card says "not this way".
      const t = event.translationX;
      x.value = (t < 0 && !canLeft) || (t > 0 && !canRight) ? t * 0.15 : t;
    },
    onDeactivate: (event) => {
      "worklet";
      if (busy.value) return;
      const side = swipeDecision(x.value, event.velocityX, width.value);
      if (side && (side === "left" ? canLeft : canRight)) {
        busy.value = true;
        const done = (finished?: boolean) => {
          "worklet";
          if (finished) runOnJS(commit)(side);
        };
        if (reduceMotion) fade.value = withTiming(0, { duration: fadeMs }, done);
        else x.value = withTiming((side === "left" ? -1 : 1) * width.value * 1.3, { duration: leaveMs, easing: easings.out }, done);
      } else x.value = withSpring(0, snap);
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: x.value }, { rotate: `${reduceMotion ? 0 : swipeTilt(x.value, width.value)}deg` }],
  }));
  const leftLabel = useAnimatedStyle(() => ({ opacity: x.value < 0 && canLeft ? swipeLabelOpacity(x.value, width.value) : 0 }));
  const rightLabel = useAnimatedStyle(() => ({ opacity: x.value > 0 && canRight ? swipeLabelOpacity(x.value, width.value) : 0 }));

  return (
    <View style={style}>
      <GestureDetector gesture={pan}>
        <Animated.View collapsable={false} onLayout={(e: LayoutChangeEvent) => (width.value = e.nativeEvent.layout.width)} style={cardStyle}>
          {children}
          {leftAction ? (
            <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampRight, leftLabel]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text variant="tag" color={palette.dark.text}>
                {leftAction.label}
              </Text>
            </Animated.View>
          ) : null}
          {rightAction ? (
            <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampLeft, rightLabel]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text variant="tag" color={palette.dark.text}>
                {rightAction.label}
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      {enabled && hint ? (
        <Text variant="small" align="center" style={styles.hint}>
          {g.t("shell.swipeHint")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: { position: "absolute", top: 18, paddingHorizontal: 12, minHeight: 30, justifyContent: "center", borderRadius: radius.pill, backgroundColor: palette.dark.bg },
  // Dragged right, the label sits on the side the card leaves from.
  stampLeft: { left: 18 },
  stampRight: { right: 18 },
  hint: { marginTop: 8 },
});
