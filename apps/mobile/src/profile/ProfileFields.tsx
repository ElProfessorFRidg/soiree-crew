import { StyleSheet, View } from "react-native";
import { PROFILE_BOUNDS } from "@crew/bac";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";

export interface ProfileDraft {
  weightKg: number;
  declaredBody: "male" | "female" | "other";
  heightCm: number | null;
}

/** O-04: 30 to 250 kg, the bounds the formula takes (the prototype stopped at 35). */
export const WEIGHT_BOUNDS = { min: PROFILE_BOUNDS.weightKg.min, max: PROFILE_BOUNDS.weightKg.max };
const DEFAULT_HEIGHT = 175;

/** One panel, fields split by hairlines: the prototype never stacks a card per field. */
/** `reasons`: one line under each label saying why it is asked (the arrival flow shows them). */
export function ProfileFields({ draft, onChange, reasons }: { draft: ProfileDraft; onChange: (next: ProfileDraft) => void; reasons?: { weight: string; body: string; height: string } }) {
  const i18n = useT();
  const theme = useTheme();
  const divider = [styles.divider, { backgroundColor: theme.line }];
  return (
    <Panel>
      <Text variant="label">{i18n.t("profile.weight")}</Text>
      {reasons ? <Text variant="small">{reasons.weight}</Text> : null}
      <Stepper
        value={draft.weightKg}
        min={WEIGHT_BOUNDS.min}
        max={WEIGHT_BOUNDS.max}
        unit={i18n.t("profile.weightUnit")}
        onChange={(weightKg) => onChange({ ...draft, weightKg })}
        decreaseLabel={i18n.t("profile.lessWeight")}
        increaseLabel={i18n.t("profile.moreWeight")}
        boundMessage={i18n.t("profile.bound", { min: WEIGHT_BOUNDS.min, max: WEIGHT_BOUNDS.max, unit: i18n.t("profile.weightUnit") })}
      />
      <View style={divider} />
      <Text variant="label">{i18n.t("profile.bodyModel")}</Text>
      {reasons ? <Text variant="small">{reasons.body}</Text> : null}
      <Segmented
        accessibilityLabel={i18n.t("profile.bodyModel")}
        value={draft.declaredBody}
        items={[
          { value: "female", label: i18n.t("profile.female") },
          { value: "male", label: i18n.t("profile.male") },
          { value: "other", label: i18n.t("profile.other") },
        ]}
        onChange={(declaredBody) => onChange({ ...draft, declaredBody })}
      />
      {draft.declaredBody === "other" ? <Text variant="small">{i18n.t("profile.otherHint")}</Text> : null}
      <View style={divider} />
      <Text variant="label">{i18n.t("profile.height")}</Text>
      {reasons ? <Text variant="small">{reasons.height}</Text> : null}
      {draft.heightCm === null ? (
        <View style={styles.heightOff}>
          <Text variant="small" style={styles.flex}>
            {i18n.t("profile.heightHint")}
          </Text>
          <Button label={i18n.t("profile.heightAdd")} variant="secondary" icon="plus" height={44} onPress={() => onChange({ ...draft, heightCm: DEFAULT_HEIGHT })} />
        </View>
      ) : (
        <Stepper
          value={draft.heightCm}
          min={PROFILE_BOUNDS.heightCm.min}
          max={PROFILE_BOUNDS.heightCm.max}
          unit={i18n.t("profile.heightUnit")}
          onChange={(heightCm) => onChange({ ...draft, heightCm })}
          decreaseLabel={i18n.t("profile.lessHeight")}
          increaseLabel={i18n.t("profile.moreHeight")}
          boundMessage={i18n.t("profile.bound", {
            min: PROFILE_BOUNDS.heightCm.min,
            max: PROFILE_BOUNDS.heightCm.max,
            unit: i18n.t("profile.heightUnit"),
          })}
        />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  heightOff: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
