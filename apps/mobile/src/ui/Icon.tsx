import Svg, { Path } from "react-native-svg";
import { extraIcons, glassIcons, icons, iconStroke, moodIcons, type ExtraIconName, type GlassIconName, type IconName, type MoodIconName } from "@crew/design-tokens";
import { useTheme } from "@/theme";

export type AnyIconName = IconName | `glass:${GlassIconName}` | `x:${ExtraIconName}` | `mood:${MoodIconName}`;

interface Props {
  name: AnyIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Custom stroke icons on a 24 grid (DESIGN.md §7). Decorative by default: the parent carries the label. */
export function Icon({ name, size = 22, color, strokeWidth = iconStroke.width }: Props) {
  const theme = useTheme();
  const d = name.startsWith("glass:")
    ? glassIcons[name.slice(6) as GlassIconName]
    : name.startsWith("x:")
      ? extraIcons[name.slice(2) as ExtraIconName]
      : name.startsWith("mood:")
        ? moodIcons[name.slice(5) as MoodIconName]
        : icons[name as IconName];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={d}
        stroke={color ?? theme.text}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
