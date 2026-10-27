import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { FadeOut, SlideInDown } from "react-native-reanimated";
import { create } from "zustand";
import { duration, radius, scaled } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Button } from "./Button";
import { Text } from "./Text";

export interface ToastSpec {
  message: string;
  tone?: "info" | "danger";
  action?: { label: string; onPress: () => void };
  /** Undo toasts stay 5 s (ADP-04); errors stay until dismissed or replaced by the next one. */
  durationMs?: number;
}

interface QueuedToast extends ToastSpec {
  id: number;
}

interface ToastState {
  queue: QueuedToast[];
}

const useToastStore = create<ToastState>(() => ({ queue: [] }));
let nextId = 1;

/** One queue for the whole app (SYNC-07): toasts wait their turn instead of stacking. */
export function showToast(spec: ToastSpec): number {
  const id = nextId++;
  useToastStore.setState((state) => ({ queue: [...state.queue, { ...spec, id }] }));
  AccessibilityInfo.announceForAccessibility(spec.message);
  return id;
}

export function dismissToast(id: number): void {
  useToastStore.setState((state) => ({ queue: state.queue.filter((toast) => toast.id !== id) }));
}

export function ToastHost({ bottomOffset, large }: { bottomOffset: number; large?: boolean }) {
  const theme = useTheme();
  const current = useToastStore((state) => state.queue[0]);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismissToast(current.id), current.durationMs ?? 5_000);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  const danger = current.tone === "danger";
  return (
    <Animated.View
      key={current.id}
      entering={SlideInDown.duration(duration.toastIn).easing(easings.out)}
      exiting={FadeOut.duration(scaled(160))}
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        { bottom: bottomOffset, backgroundColor: danger ? theme.danger : theme.text },
        large && styles.large,
      ]}
    >
      <View style={styles.message}>
        <Text variant="h3" color={theme.onAccent} style={large ? { fontSize: 19, lineHeight: 24 } : { fontSize: 14 }}>
          {current.message}
        </Text>
      </View>
      {current.action ? (
        <Button
          label={current.action.label}
          variant="secondary"
          height={large ? 64 : 40}
          style={{ backgroundColor: theme.bg }}
          onPress={() => {
            current.action?.onPress();
            dismissToast(current.id);
          }}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: radius.toast,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  large: {
    paddingVertical: 18,
  },
  message: {
    flex: 1,
  },
});
