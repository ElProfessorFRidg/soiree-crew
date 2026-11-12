import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { variantKey } from "@/i18n/variants";
import { easings } from "@/motion/easing";
import { choicesFor, opensTo, type Audience, type VisibilityKey } from "@/onboarding/visibility";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { ProfilePreview } from "./ProfilePreview";
import { VisibilityDrawing } from "./VisibilityDrawing";

// PROF-01, PROF-02: one choice of who sees one part of a profile. The arrival flow and Settings both
// draw it from here, so the drawing, the wording and the four buttons are the same in both.

const UNLOCK = {
  venues: "journey.unlockVenues",
  titles: "journey.unlockTitles",
  badges: "journey.unlockBadges",
  find: "journey.unlockFind",
  presence: "journey.unlockPresence",
} as const;

interface Props {
  item: VisibilityKey;
  /** Undefined until answered: nothing is pre-ticked. */
  value: Audience | undefined;
  onChange: (audience: Audience) => void;
  /** "flow" adds the push (what going public unlocks) and the two previews; "settings" is the compact row. */
  mode: "flow" | "settings";
  name?: string;
  personId?: string;
  busy?: boolean;
}

/** The four audience buttons, same size, the private one never hidden. */
export function AudienceChoices({ item, value, onChange, mode, busy }: Pick<Props, "item" | "value" | "onChange" | "mode" | "busy">) {
  const i18n = useT();
  const label = (audience: Audience) =>
    audience === "me"
      ? mode === "flow"
        ? i18n.t("journey.notNow")
        : i18n.t("people.audienceMe")
      : audience === "crews"
        ? i18n.t("people.audienceCrews")
        : audience === "friends"
          ? i18n.t("people.audienceFriends")
          : i18n.t("people.audienceEveryone");
  const height = mode === "flow" ? 52 : 44;
  const choices = choicesFor(item);
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={i18n.t(`journey.title.${item}`)}>
      {choices.map((audience) => {
        const selected = value === audience;
        // Before any answer the widest choice is the highlighted one; after it, the chosen one is.
        const highlighted = value === undefined ? audience === choices[0] : selected;
        return (
          <Button
            key={audience}
            label={label(audience)}
            variant={highlighted ? "primary" : "secondary"}
            icon={selected ? "check" : undefined}
            iconSize={18}
            height={height}
            disabled={busy}
            accessibilityLabel={selected ? `${label(audience)}, ${i18n.t("journey.selected")}` : label(audience)}
            style={styles.choice}
            onPress={() => onChange(audience)}
          />
        );
      })}
    </View>
  );
}

export function VisibilityPicker({ item, value, onChange, mode, name = "", personId = "me", busy }: Props) {
  const i18n = useT();
  if (mode === "settings") {
    return (
      <View style={styles.settings}>
        <View style={styles.settingsHead}>
          <VisibilityDrawing kind={item} size={64} />
          <View style={styles.flex}>
            <Text variant="h3">{i18n.t(`journey.title.${item}`)}</Text>
            <Text variant="small">{i18n.t(`journey.see.${item}`)}</Text>
          </View>
        </View>
        <AudienceChoices item={item} value={value} onChange={onChange} mode={mode} busy={busy} />
      </View>
    );
  }
  const shownName = name || i18n.t("journey.previewYou");
  return (
    <View style={styles.flow}>
      <View style={styles.art}>
        <VisibilityDrawing kind={item} />
      </View>
      <Text variant="h1">{i18n.t(`journey.title.${item}`)}</Text>
      <Text muted>{i18n.t(`journey.see.${item}`)}</Text>
      <Animated.View entering={FadeIn.duration(duration.enter).delay(duration.enter).easing(easings.out)}>
        <Text>{i18n.t(variantKey(UNLOCK[item], item))}</Text>
      </Animated.View>
      <View style={styles.previews}>
        <ProfilePreview focus={item} open={false} name={shownName} personId={personId} caption={i18n.t("journey.previewOff")} selected={value !== undefined && !opensTo(value, "everyone")} />
        <ProfilePreview focus={item} open name={shownName} personId={personId} caption={i18n.t("journey.previewOn")} selected={opensTo(value, "everyone")} />
      </View>
      <AudienceChoices item={item} value={value} onChange={onChange} mode={mode} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { gap: 14 },
  art: { alignItems: "center", paddingVertical: 4 },
  previews: { flexDirection: "row", gap: 10 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: { flexBasis: "47%", flexGrow: 1 },
  settings: { gap: 10 },
  settingsHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
