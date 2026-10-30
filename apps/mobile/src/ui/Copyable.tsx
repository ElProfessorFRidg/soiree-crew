import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useLevelNow } from "@/state/levelNow";
import { useTheme } from "@/theme";
import { Button } from "./Button";
import { Text } from "./Text";

/** Design: the inline "Copied" stays this long (SCREENS.md, pool detail). */
const COPIED_MS = 1_800;

/** QOL-19: copies a value with a haptic and a short inline "Copied". */
export function useCopy(): { copied: boolean; copy: (value: string) => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = (value: string) => {
    void Clipboard.setStringAsync(value).then(() => {
      haptic.confirmed();
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    });
  };
  return { copied, copy };
}

interface Props {
  /** What goes to the clipboard. */
  value: string;
  /** What is shown; the value itself by default. */
  children?: ReactNode;
  /** Small label above, like "IBAN". */
  label?: string;
  /** Say "Long press to copy" under it while nothing is copied, where copying is the point (an IBAN). */
  showHint?: boolean;
}

/**
 * QOL-19: long-press copies. At adaptive levels 2 and 3 nothing important may hide behind a
 * long-press (ADP-02), so a visible Copy button comes instead of the hint.
 */
export function Copyable({ value, children, label, showHint }: Props) {
  const i18n = useT();
  const theme = useTheme();
  const level = useLevelNow((state) => state.level);
  const { copied, copy } = useCopy();
  const big = level >= 2;
  const body = (
    <View style={styles.body}>
      {label ? <Text variant="small">{label}</Text> : null}
      {typeof children === "string" || children === undefined ? <Text selectable>{children ?? value}</Text> : children}
    </View>
  );
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.flex}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}, ${value}` : value}
        accessibilityHint={i18n.t("common.copyHint")}
        onLongPress={() => copy(value)}
      >
        {body}
        {!big ? (
          copied ? (
            <Animated.View entering={FadeIn.duration(duration.toastIn)} exiting={FadeOut.duration(duration.toastIn)}>
              <Text variant="small" color={theme.ok} accessibilityLiveRegion="polite">
                {i18n.t("common.copied")}
              </Text>
            </Animated.View>
          ) : showHint ? (
            <Text variant="small">{i18n.t("common.copyHint")}</Text>
          ) : null
        ) : null}
      </Pressable>
      {big ? (
        <Button label={copied ? i18n.t("common.copied") : i18n.t("common.copy")} icon={copied ? "check" : "link"} variant="secondary" height={56} onPress={() => copy(value)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1, gap: 2 },
  body: { gap: 2 },
});
