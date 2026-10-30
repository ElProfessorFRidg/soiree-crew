import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showFailure } from "@/server/errors";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel, Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { describeRanges, type VenueFacts, type WeekSchedule } from "./hours";
import { HoursEditor } from "./HoursEditor";

/** Open now, happy hour now: one line each, the same on the map, the bar page and Where to? */
export function OpenTags({ openNow, happyNow }: { openNow: boolean | null; happyNow: boolean }) {
  const i18n = useT();
  return (
    <>
      {openNow === true ? <Tag label={i18n.t("venue.hours.openNow")} tone="ok" /> : null}
      {openNow === false ? <Tag label={i18n.t("venue.hours.closedNow")} /> : null}
      {happyNow ? <Tag label={i18n.t("venue.hours.happyNow")} tone="amber" icon="glass" /> : null}
    </>
  );
}

/**
 * N-08, COM-01: a venue's hours and happy hour, with where they come from. The owner's win once the
 * place is claimed (COM-11); before that the crew can write them (`onSave`).
 */
export function HoursPanel({ facts, onSave }: { facts: VenueFacts; onSave?: (schedule: WeekSchedule) => Promise<unknown> }) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const schedule = facts.schedule;
  const known = Boolean(schedule?.open.length || schedule?.happy.length || facts.hoursText || facts.happyText);

  if (editing && onSave) {
    return (
      <Panel>
        <Text variant="label">{i18n.t("venue.hours.title")}</Text>
        <HoursEditor
          initial={schedule}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            setBusy(true);
            void onSave(next)
              .then(() => {
                haptic.confirmed();
                setEditing(false);
              })
              .catch(showFailure(i18n))
              .finally(() => setBusy(false));
          }}
        />
      </Panel>
    );
  }

  if (!known && !onSave) return null;
  return (
    <Panel>
      <Text variant="label">{i18n.t("venue.hours.title")}</Text>
      {known ? (
        <View style={styles.tags}>
          <OpenTags openNow={facts.openNow} happyNow={facts.happyNow} />
        </View>
      ) : (
        <Text variant="small">{i18n.t("venue.hours.unknown")}</Text>
      )}
      {schedule?.open.length ? <Text>{i18n.t("place.hoursLine", { hours: describeRanges(schedule.open, i18n, hourCycle) })}</Text> : null}
      {facts.hoursText ? <Text>{i18n.t("place.hoursLine", { hours: facts.hoursText })}</Text> : null}
      {schedule?.happy.length ? <Text>{i18n.t("place.happyLine", { hours: describeRanges(schedule.happy, i18n, hourCycle) })}</Text> : null}
      {facts.happyText ? <Text>{i18n.t("place.happyLine", { hours: facts.happyText })}</Text> : null}
      {known && facts.source ? <Text variant="small">{i18n.t(facts.source === "owner" ? "venue.hours.byOwner" : "venue.hours.byUsers")}</Text> : null}
      {onSave ? (
        <Button label={known ? i18n.t("venue.hours.edit") : i18n.t("venue.hours.add")} icon="clock" variant="outline" height={44} onPress={() => setEditing(true)} />
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
