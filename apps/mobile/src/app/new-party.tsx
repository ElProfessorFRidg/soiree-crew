import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { moodIcon } from "@/crew/moods";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { createParty, useCrewData, type PartyMood } from "@/server/crewData";
import { linkCallToParty } from "@/server/radarData";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useDraft } from "@/state/drafts";
import { failureMessage } from "@/server/errors";

const MOODS: readonly PartyMood[] = ["party", "birthday", "champagne", "sunset", "costume", "wine", "fire", "night", "home", "tropical"];
const STEP_MIN = 30;
const DAY_MS = 86_400_000;

function atMinutes(dayStart: Date, minutes: number): number {
  const date = new Date(dayStart);
  date.setHours(0, minutes, 0, 0);
  return date.getTime();
}

export default function NewPartyScreen() {
  const i18n = useT();
  const crews = useCrewData((state) => state.crews);
  // QOL-21: a birthday reminder opens this screen with the name, the mood and the day filled in.
  const params = useLocalSearchParams<{ outCallId?: string; crewId?: string; name?: string; mood?: string; date?: string }>();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const boundary = useAppStore((state) => state.preferences.dayBoundaryHour);
  // QOL-02: before the day boundary, "tonight" is the night already under way.
  const [nightBase] = useState(() => {
    const d = new Date();
    if (d.getHours() < boundary) d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const minutesNow = Math.floor((Date.now() - nightBase) / 60_000);
  const [crewId, setCrewId] = useState(params.crewId ?? crews[0]?.id ?? "");
  const [mood, setMood] = useState<PartyMood>(() => ((MOODS as readonly string[]).includes(params.mood ?? "") ? (params.mood as PartyMood) : "party"));
  const [name, setName, clearName] = useDraft("new-party:name", params.name ?? "");
  const [kind, setKind] = useState<"party" | "trip">("party");
  const [dayOffset, setDayOffset] = useState(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.date ?? "");
    if (!match) return 0;
    const offset = Math.round((new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() - nightBase) / DAY_MS);
    // Only the seven days the picker offers.
    return Math.min(6, Math.max(0, offset));
  });
  // Minutes after midnight of the start day; the end may run past midnight.
  // A party created during the night starts now, rounded down to the half hour.
  const [start, setStart] = useState(() => (minutesNow > 21 * 60 ? Math.floor(minutesNow / STEP_MIN) * STEP_MIN : 21 * 60));
  const [end, setEnd] = useState(() => Math.max(27 * 60, Math.ceil((minutesNow + 3 * 60) / STEP_MIN) * STEP_MIN));
  const [tripDays, setTripDays] = useState(2);
  const [busy, setBusy] = useState(false);

  const day = useMemo(() => {
    const d = new Date(nightBase);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset, nightBase]);

  const weekday = new Intl.DateTimeFormat(i18n.locale, { weekday: "long" }).format(day);
  const autoName = i18n.t("newParty.autoName", { weekday });
  const startsAt = atMinutes(day, start);
  const endsAt = kind === "trip" ? atMinutes(new Date(day.getTime() + tripDays * DAY_MS), end - 24 * 60) : atMinutes(day, end);
  const dayChips = Array.from({ length: 7 }, (_, offset) => {
    if (offset === 0) return i18n.t("newParty.today");
    if (offset === 1) return i18n.t("newParty.tomorrow");
    const d = new Date(day.getTime() + (offset - dayOffset) * DAY_MS);
    return new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric" }).format(d);
  });

  if (!crews.length) {
    return (
      <Screen back title={i18n.t("newParty.title")}>
        <Text>{i18n.t("newParty.noCrew")}</Text>
      </Screen>
    );
  }

  const clock = (minutes: number) => formatClock(atMinutes(day, minutes), i18n.language, hourCycle);

  return (
    <Screen
      back
      title={i18n.t("newParty.title")}
      withToasts
      footer={
        <Button
          label={i18n.t("newParty.create")}
          height={56}
          loading={busy}
          onPress={() => {
            setBusy(true);
            createParty({ crewId, name: name.trim() || autoName, mood, kind, startsAt, endsAt })
              .then(async (party) => {
                // N-03: the call becomes the party, and everyone who said "in" is going.
                if (params.outCallId) await linkCallToParty(params.outCallId, party.id).catch(() => undefined);
                haptic.confirmed();
                clearName();
                router.replace({ pathname: "/live", params: { id: party.id } });
              })
              .catch((error: unknown) => {
                haptic.error();
                showToast({
                  tone: "danger",
                  message:
                    failureMessage(error, i18n),
                });
              })
              .finally(() => setBusy(false));
          }}
        />
      }
    >
      {crews.length > 1 ? (
        <Panel>
          <Text variant="label">{i18n.t("newParty.crew")}</Text>
          <View style={styles.chips}>
            {crews.map((crew) => (
              <Chip key={crew.id} label={crew.name} selected={crew.id === crewId} onPress={() => setCrewId(crew.id)} />
            ))}
          </View>
        </Panel>
      ) : null}

      <Panel>
        <Text variant="label">{i18n.t("newParty.mood")}</Text>
        <View style={styles.chips}>
          {MOODS.map((value) => (
            <Chip
              key={value}
              label={i18n.t(`newParty.moods.${value}`)}
              icon={moodIcon(value)}
              selected={value === mood}
              onPress={() => {
                haptic.select();
                setMood(value);
              }}
            />
          ))}
        </View>
      </Panel>

      <Field label={i18n.t("newParty.name")} placeholder={autoName} value={name} onChangeText={setName} maxLength={60} returnKeyType="done" />

      <Segmented<"party" | "trip">
        accessibilityLabel={i18n.t("newParty.kind")}
        value={kind}
        items={[
          { value: "party", label: i18n.t("newParty.party") },
          { value: "trip", label: i18n.t("newParty.trip") },
        ]}
        onChange={setKind}
      />

      <Panel>
        <Text variant="label">{i18n.t("newParty.day")}</Text>
        <View style={styles.chips}>
          {dayChips.map((label, offset) => (
            <Chip key={label} label={label} selected={offset === dayOffset} onPress={() => setDayOffset(offset)} />
          ))}
        </View>
      </Panel>

      <Panel>
        <Text variant="label">{i18n.t("newParty.start")}</Text>
        <Stepper
          value={start}
          min={12 * 60}
          max={Math.min(end - STEP_MIN, 30 * 60)}
          step={STEP_MIN}
          format={clock}
          onChange={setStart}
          decreaseLabel={i18n.t("newParty.earlier")}
          increaseLabel={i18n.t("newParty.later")}
        />
        {kind === "trip" ? (
          <>
            <Text variant="label">{i18n.t("newParty.endDay")}</Text>
            <Stepper
              value={tripDays}
              min={1}
              max={9}
              format={(days) => new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric" }).format(new Date(day.getTime() + days * DAY_MS))}
              onChange={setTripDays}
              decreaseLabel={i18n.t("newParty.earlier")}
              increaseLabel={i18n.t("newParty.later")}
            />
          </>
        ) : null}
        <Text variant="label">{i18n.t("newParty.end")}</Text>
        <Stepper
          value={end}
          min={start + STEP_MIN}
          max={start + 16 * 60}
          step={STEP_MIN}
          format={clock}
          onChange={setEnd}
          decreaseLabel={i18n.t("newParty.earlier")}
          increaseLabel={i18n.t("newParty.later")}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
