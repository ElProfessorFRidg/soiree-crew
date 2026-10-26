import { View } from "react-native";
import { PROFILE_BOUNDS } from "@crew/bac";
import { useT } from "@/i18n";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";

export interface ProfileDraft {
  weightKg: number;
  declaredBody: "male" | "female" | "other";
  heightCm: number | null;
}

/** The prototype bounds the weight to 35 to 250 kg (Arrivee board, screen 4). */
export const WEIGHT_BOUNDS = { min: 35, max: PROFILE_BOUNDS.weightKg.max };
const DEFAULT_HEIGHT = 175;

export function ProfileFields({ draft, onChange }: { draft: ProfileDraft; onChange: (next: ProfileDraft) => void }) {
  const i18n = useT();
  return (
    <>
      <Panel>
        <Text variant="label">{i18n.t("profile.weight")}</Text>
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
      </Panel>
      <Panel>
        <Text variant="label">{i18n.t("profile.bodyModel")}</Text>
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
      </Panel>
      <Panel>
        <Text variant="label">{i18n.t("profile.height")}</Text>
        {draft.heightCm === null ? (
          <View style={{ gap: 8 }}>
            <Text variant="small">{i18n.t("profile.heightHint")}</Text>
            <Button
              label={i18n.t("profile.height")}
              variant="secondary"
              icon="plus"
              height={44}
              onPress={() => onChange({ ...draft, heightCm: DEFAULT_HEIGHT })}
            />
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
    </>
  );
}
