import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { createPoll, fetchUsualNights, type UsualNights } from "@/server/pollData";
import { newId, useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const MAX_SLOTS = 10;
const STARTS = [19, 20, 21, 22] as const;
/** A night out lasts until 2 am unless the poll says otherwise. */
const LENGTH_HOURS = 6;

/** N-04: propose a few nights; N-05 shows how many usually go out on each. */
export default function NewPollScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [usual, setUsual] = useState<UsualNights | null>(null);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [plan, setPlan] = useState("");
  const [start, setStart] = useState<(typeof STARTS)[number]>(21);
  const [nights, setNights] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchUsualNights(crewId)
      .then(setUsual)
      .catch(() => undefined);
  }, [crewId]);

  const toggle = (night: string) => {
    haptic.select();
    setNights((list) => (list.includes(night) ? list.filter((n) => n !== night) : list.length >= MAX_SLOTS ? list : [...list, night].sort()));
  };
  const label = (night: string, usually: number) => {
    const date = new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric" }).format(new Date(`${night}T12:00:00`));
    return usually ? `${date} (${usually})` : date;
  };
  const ready = title.trim().length > 0 && nights.length > 0;

  const submit = () => {
    setBusy(true);
    const slots = nights.map((night) => {
      const startsAt = new Date(`${night}T${String(start).padStart(2, "0")}:00:00`).getTime();
      return { id: newId(), startsAt, endsAt: startsAt + LENGTH_HOURS * 3_600_000 };
    });
    void createPoll(crewId, { id: newId(), title: title.trim(), place: place.trim(), plan: plan.trim(), slots })
      .then(() => {
        haptic.confirmed();
        router.back();
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
      .finally(() => setBusy(false));
  };

  return (
    <Screen
      back
      title={i18n.t("polls.new")}
      withToasts
      footer={<Button label={i18n.t("polls.send")} height={56} disabled={!ready} loading={busy} onPress={submit} />}
    >
      <Field label={i18n.t("polls.titleLabel")} placeholder={i18n.t("polls.titlePlaceholder")} value={title} onChangeText={setTitle} maxLength={60} />
      <Field label={i18n.t("polls.place")} value={place} onChangeText={setPlace} maxLength={80} />
      <Field label={i18n.t("polls.plan")} value={plan} onChangeText={setPlan} maxLength={200} />

      <Text variant="label">{i18n.t("polls.nights")}</Text>
      <Text variant="small">{i18n.t("polls.nightsHint")}</Text>
      <View style={styles.chips}>
        {(usual?.nights ?? []).map((n) => (
          <Chip key={n.night} label={label(n.night, n.usually.length)} selected={nights.includes(n.night)} onPress={() => toggle(n.night)} />
        ))}
      </View>

      <Text variant="label">{i18n.t("polls.startAt")}</Text>
      <Segmented<(typeof STARTS)[number]>
        accessibilityLabel={i18n.t("polls.startAt")}
        value={start}
        items={STARTS.map((h) => ({ value: h, label: formatClock(new Date(2026, 0, 1, h).getTime(), i18n.language, hourCycle) }))}
        onChange={setStart}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
