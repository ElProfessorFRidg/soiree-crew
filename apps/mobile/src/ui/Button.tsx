import { type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, size, type } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { Icon, type AnyIconName } from "./Icon";
import { ScalePressable } from "./Pressable";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "water";

interface Props {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: ButtonVariant;
  icon?: AnyIconName;
  iconSize?: number;
  /** Minimum height in px. 52 default, 40 small, 64 hero; adaptive levels go up to 104. */
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  loading?: boolean;
  /** Stack the icon above the label, for the big grid buttons of level 2. */
  vertical?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Rendered under the label and icon, clipped to the button: the add-drink fill lives here. */
  underlay?: ReactNode;
}

export function Button({
  label,
  onPress,
  onLongPress,
  variant = "primary",
  icon,
  iconSize = 22,
  height = size.button,
  fontSize,
  disabled,
  loading,
  vertical,
  accessibilityLabel,
  accessibilityHint,
  style,
  underlay,
}: Props) {
  const theme = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.amber, fg: theme.onAccent },
    secondary: { bg: theme.surfaceRaised, fg: theme.text },
    outline: { bg: "transparent", fg: theme.text, border: theme.handle },
    danger: { bg: theme.danger, fg: theme.onAccent },
    water: { bg: theme.water, fg: theme.onAccent },
  };
  const colors = palette[variant];
  const small = height <= size.buttonSmall;
  const textStyle = small ? type.buttonSmall : type.button;

  return (
    <ScalePressable
      onPress={disabled || loading ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.base,
        {
          minHeight: height,
          borderRadius: small ? radius.buttonSmall : radius.button,
          backgroundColor: colors.bg,
          opacity: disabled ? 0.4 : 1,
          paddingHorizontal: small ? 14 : 18,
        },
        colors.border ? { borderWidth: 1.5, borderColor: colors.border } : null,
        style,
      ]}
    >
      {underlay ? <View style={StyleSheet.absoluteFill}>{underlay}</View> : null}
      <View style={[styles.content, vertical && styles.vertical]}>
        {loading ? <ActivityIndicator color={colors.fg} /> : icon ? <Icon name={icon} size={iconSize} color={colors.fg} /> : null}
        {label ? (
          <Text
            style={[textStyle, fontSize ? { fontSize, lineHeight: Math.round(fontSize * 1.2) } : null]}
            color={colors.fg}
            align="center"
          >
            {label}
          </Text>
        ) : null}
      </View>
    </ScalePressable>
  );
}

interface IconButtonProps {
  icon: AnyIconName;
  accessibilityLabel: string;
  onPress?: () => void;
  tone?: "default" | "amber";
  size?: number;
}

export function IconButton({ icon, accessibilityLabel, onPress, tone = "default", size: box = size.iconButton }: IconButtonProps) {
  const theme = useTheme();
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={box < 44 ? (44 - box) / 2 : 0}
      style={[styles.iconButton, { width: box, height: box, backgroundColor: theme.surface2 }]}
    >
      <Icon name={icon} color={tone === "amber" ? theme.amber : theme.text} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  vertical: {
    flexDirection: "column",
    gap: 10,
  },
  iconButton: {
    borderRadius: radius.iconButton,
    alignItems: "center",
    justifyContent: "center",
  },
});
