import { moodIcons, type MoodIconName } from "@crew/design-tokens";
import type { AnyIconName } from "@/ui/Icon";

/** O-35: the icon of a party mood; a mood this version does not know falls back to the glass. */
export function moodIcon(mood: string | null | undefined): AnyIconName {
  return mood && mood in moodIcons ? `mood:${mood as MoodIconName}` : "glass";
}
