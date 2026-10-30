import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showFailure } from "@/server/errors";
import { reportDoor, type AgePolicy, type IdCheck, type PlacePage } from "@/server/placeData";
import { StyleSheet, View } from "react-native";
import { Chip, Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

type AgeChoice = AgePolicy | "unknown";
const ID_CHECKS = [
  ["always", "place.idAlways"],
  ["sometimes", "place.idSometimes"],
  ["never", "place.idNever"],
] as const;
const AGE_CHOICES = [
  ["adults", "place.ageAdults"],
  ["allAgesEarly", "place.ageAllAgesEarly"],
  ["unknown", "place.ageUnknown"],
] as const;

/**
 * COM-07: the door as people with a verified visit describe it: how often ID is checked, and the
 * official age policy (18+ only, or all ages early in the evening), each with how many reports
 * back it. It describes the door policy, never who is inside.
 */
export function DoorPanel({ venueId, page, onChanged }: { venueId: string; page: PlacePage; onChanged: () => void }) {
  const i18n = useT();
  const offline = showFailure(i18n);
  const door = page.door;
  const [idCheck, setIdCheck] = useState<IdCheck | null>(door.mine?.idCheck ?? null);
  const [age, setAge] = useState<AgeChoice>(door.mine?.agePolicy ?? "unknown");
  useEffect(() => {
    setIdCheck(door.mine?.idCheck ?? null);
    setAge(door.mine?.agePolicy ?? "unknown");
  }, [door.mine?.idCheck, door.mine?.agePolicy]);

  const doorVerdict = door.reports
    ? door.always >= door.sometimes + door.never
      ? i18n.t("place.doorAlways")
      : door.never > door.always + door.sometimes
        ? i18n.t("place.doorNever")
        : i18n.t("place.doorSometimes")
    : null;
  // The same confidence wording as the ID check: the leading answer and how many reports back it.
  const adults = door.adultsOnly;
  const early = door.allAgesEarly ?? 0;
  const ageVerdict = adults || early ? (adults >= early ? i18n.t("place.ageAdults") : i18n.t("place.ageAllAgesEarly")) : null;

  const send = (nextId: IdCheck, nextAge: AgeChoice) => {
    haptic.select();
    void reportDoor(venueId, nextId, nextAge === "unknown" ? null : nextAge)
      .then(onChanged)
      .catch(offline);
  };

  return (
    <Panel>
      <Text variant="label">{i18n.t("place.door")}</Text>
      <Text>{doorVerdict ? i18n.plural("place.doorVerdict", door.reports, { verdict: doorVerdict }) : i18n.t("place.doorUnknown")}</Text>
      {ageVerdict ? <Text>{i18n.plural("place.ageVerdict", adults + early, { verdict: ageVerdict })}</Text> : null}
      {page.canReview ? (
        <>
          {/* Chips rather than a segmented control: nothing is picked until I answer, and the age labels are long. */}
          <Text variant="small">{i18n.t("place.doorAsk")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={i18n.t("place.doorAsk")}>
            {ID_CHECKS.map(([value, key]) => (
              <Chip
                key={value}
                label={i18n.t(key)}
                selected={idCheck === value}
                onPress={() => {
                  setIdCheck(value);
                  send(value, age);
                }}
              />
            ))}
          </View>
          <Text variant="small">{i18n.t("place.agePolicy")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={i18n.t("place.agePolicy")}>
            {AGE_CHOICES.map(([value, key]) => (
              <Chip
                key={value}
                label={i18n.t(key)}
                selected={age === value}
                onPress={() => {
                  setAge(value);
                  // The server keeps both answers in one report, so the ID check comes first.
                  if (idCheck) send(idCheck, value);
                }}
              />
            ))}
          </View>
          {!idCheck && age !== "unknown" ? <Text variant="small">{i18n.t("place.ageAskFirst")}</Text> : null}
        </>
      ) : null}
      <Text variant="small">{i18n.t("place.doorNote")}</Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
