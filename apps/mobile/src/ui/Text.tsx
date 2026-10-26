import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { numeral, type } from "@crew/design-tokens";
import { useTheme } from "@/theme";

type Variant = keyof typeof type;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  align?: TextStyle["textAlign"];
}

export function Text({ variant = "body", color, muted, align, style, ...rest }: Props) {
  const theme = useTheme();
  const base = type[variant];
  const mutedByDefault = variant === "small" || variant === "label" || variant === "disclaimer";
  const resolved = color ?? (muted || mutedByDefault ? theme.textMuted : theme.text);
  return (
    <RNText
      {...rest}
      style={[base, { color: resolved, textAlign: align }, style]}
      // Key information wraps instead of being truncated (O-11).
      numberOfLines={rest.numberOfLines}
    />
  );
}

interface NumeralProps extends TextProps {
  size: number;
  color?: string;
}

/** Key figures: Archivo 62 % width, weight 900, tabular figures (DESIGN.md §1). */
export function Numeral({ size, color, style, ...rest }: NumeralProps) {
  const theme = useTheme();
  return (
    <RNText
      {...rest}
      style={[numeral(size), { color: color ?? theme.text, fontVariant: ["tabular-nums"] }, style]}
    />
  );
}
