import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { showFailure } from "@/server/errors";
import { setNightStatus, type NightStatus, type StatusDetails as Details } from "@/server/radarData";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Field } from "./Field";

const STEP_MIN = 30;
/** Noon to 6 am the next morning for the start; the end may run to 10 am. */
const FROM_MIN = 12 * 60;
const FROM_MAX = 30 * 60;
const TO_MAX = 34 * 60;
const DEFAULT_FROM = 21 * 60;

/** Wall-clock time of `minutes` after midnight of a night key, local. */
export function atNightMinute(night: string, minutes: number): number {
  const [y, m, d] = night.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, minutes).getTime();
}

/** N-01: optional time window and place, as chips under the status when going out (Radar prototype). */
export function StatusDetails({ crewId, night, me, status, details }: { crewId: string; night: string; me: string; status: NightStatus; details: Details }) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [open, setOpen] = useState<"from" | "until" | "place" | null>(null);
  const [from, setFrom] = useState(details.fromMinute ?? DEFAULT_FROM);
  const [until, setUntil] = useState(details.toMinute ?? (details.fromMinute ?? DEFAULT_FROM) + 3 * 60);
  const [place, setPlace] = useState(details.place);

  // Another night picked, or the server's answer: the editor starts from what is stored.
  useEffect(() => {
    setFrom(details.fromMinute ?? DEFAULT_FROM);
    setUntil(details.toMinute ?? (details.fromMinute ?? DEFAULT_FROM) + 3 * 60);
    setPlace(details.place);
  }, [night, details.fromMinute, details.toMinute, details.place]);
  useEffect(() => setOpen(null), [night]);

  const clock = (minutes: number) => formatClock(atNightMinute(night, minutes), i18n.language, hourCycle);
  const save = (next: Details) => {
    haptic.select();
    setOpen(null);
    setNightStatus(crewId, night, status, me, next).catch(showFailure(i18n));
  };
  const toggle = (which: "from" | "until" | "place") => setOpen((current) => (current === which ? null : which));

  return (
    <>
      <View style={styles.chips}>
        <Chip
          icon="clock"
          selected={open === "from"}
          label={details.fromMinute === null ? i18n.t("radar.pickTime") : i18n.t("radar.from", { time: clock(details.fromMinute) })}
          onPress={() => toggle("from")}
        />
        {details.fromMinute !== null ? (
          <Chip
            selected={open === "until"}
            label={details.toMinute === null ? i18n.t("radar.pickEnd") : i18n.t("radar.until", { time: clock(details.toMinute) })}
            onPress={() => toggle("until")}
          />
        ) : null}
        <Chip icon="pin" selected={open === "place"} label={details.place || i18n.t("radar.pickPlace")} onPress={() => toggle("place")} />
      </View>

      {open ? (
        <Animated.View entering={FadeIn.duration(duration.enter)}>
          <Panel>
            {open === "from" ? (
              <>
                <Stepper
                  value={from}
                  min={FROM_MIN}
                  max={FROM_MAX}
                  step={STEP_MIN}
                  onChange={setFrom}
                  format={clock}
                  decreaseLabel={i18n.t("radar.earlier")}
                  increaseLabel={i18n.t("radar.later")}
                />
                <View style={styles.actions}>
                  {details.fromMinute !== null ? (
                    <Button label={i18n.t("radar.noTime")} variant="outline" height={44} style={styles.flex} onPress={() => save({ ...details, fromMinute: null, toMinute: null })} />
                  ) : null}
                  <Button
                    label={i18n.t("common.save")}
                    variant="secondary"
                    height={44}
                    style={styles.flex}
                    // An end that no longer follows the start is dropped rather than refused.
                    onPress={() => save({ ...details, fromMinute: from, toMinute: details.toMinute !== null && details.toMinute > from ? details.toMinute : null })}
                  />
                </View>
              </>
            ) : null}
            {open === "until" && details.fromMinute !== null ? (
              <>
                <Stepper
                  value={Math.max(until, details.fromMinute + STEP_MIN)}
                  min={details.fromMinute + STEP_MIN}
                  max={TO_MAX}
                  step={STEP_MIN}
                  onChange={setUntil}
                  format={clock}
                  decreaseLabel={i18n.t("radar.earlier")}
                  increaseLabel={i18n.t("radar.later")}
                />
                <View style={styles.actions}>
                  {details.toMinute !== null ? (
                    <Button label={i18n.t("radar.noEnd")} variant="outline" height={44} style={styles.flex} onPress={() => save({ ...details, toMinute: null })} />
                  ) : null}
                  <Button
                    label={i18n.t("common.save")}
                    variant="secondary"
                    height={44}
                    style={styles.flex}
                    onPress={() => save({ ...details, toMinute: Math.max(until, details.fromMinute! + STEP_MIN) })}
                  />
                </View>
              </>
            ) : null}
            {open === "place" ? (
              <>
                <Field label={i18n.t("radar.placeLabel")} placeholder={i18n.t("radar.placePlaceholder")} value={place} onChangeText={setPlace} maxLength={60} returnKeyType="done" onSubmitEditing={() => save({ ...details, place: place.trim() })} />
                <Button label={i18n.t("common.save")} variant="secondary" height={44} onPress={() => save({ ...details, place: place.trim() })} />
              </>
            ) : null}
          </Panel>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
