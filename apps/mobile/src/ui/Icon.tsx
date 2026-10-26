import Svg, { Path } from "react-native-svg";
import { glassIcons, icons, iconStroke, type GlassIconName, type IconName } from "@crew/design-tokens";
import { useTheme } from "@/theme";

export type AnyIconName = IconName | `glass:${GlassIconName}`;

interface Props {
  name: AnyIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Custom stroke icons on a 24 grid (DESIGN.md §7). Decorative by default: the parent carries the label. */
export function Icon({ name, size = 22, color, strokeWidth = iconStroke.width }: Props) {
  const theme = useTheme();
  const d = name.startsWith("glass:") ? glassIcons[name.slice(6) as GlassIconName] : icons[name];
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
