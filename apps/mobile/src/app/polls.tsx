import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { refreshParties, useCrewData } from "@/server/crewData";
import { closePoll, deletePoll, fetchPolls, fetchUsualNights, saveUsualNights, votePoll, type Poll, type PollAnswer, type UsualNights } from "@/server/pollData";
import { useSession } from "@/server/session";
import { newId, useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function weekdayName(weekday: number, i18n: Translator): string {
  // 2 November 2026 is a Monday.
  return new Intl.DateTimeFormat(i18n.locale, { weekday: "short" }).format(new Date(2026, 10, 1 + weekday));
}

/** N-04, N-05: the crew's outing polls and everyone's usual nights. */
export default function PollsScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const crew = useCrewData((state) => state.crews.find((c) => c.id === crewId));
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [usual, setUsual] = useState<UsualNights | null>(null);
  const offline = showFailure(i18n);

  const load = useCallback(() => {
    void fetchPolls(crewId)
      .then((data) => setPolls(data.polls))
      .catch(() => setPolls([]));
    void fetchUsualNights(crewId)
      .then(setUsual)
      .catch(() => undefined);
  }, [crewId]);
  useFocusEffect(load);

  const nameOf = (id: string) => (id === me ? i18n.t("common.you") : (crew?.members.find((m) => m.id === id)?.displayName ?? "?"));
  const mine = usual?.members.find((m) => m.userId === me)?.weekdays ?? [];
  const toggleDay = (day: number) => {
    const next = mine.includes(day) ? mine.filter((d) => d !== day) : [...mine, day];
    haptic.select();
    setUsual((u) => (u ? { ...u, members: u.members.map((m) => (m.userId === me ? { ...m, weekdays: next } : m)) } : u));
    void saveUsualNights(crewId, next).then(load).catch(offline);
  };
  const when = (slot: { startsAt: number; endsAt: number }) =>
    `${new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(slot.startsAt))}, ${formatClock(slot.startsAt, i18n.language, hourCycle)}`;

  return (
    <Screen
      back
      title={i18n.t("polls.title")}
      withToasts
      onRefresh={async () => load()}
      footer={<Button label={i18n.t("polls.new")} icon="plus" height={56} onPress={() => router.push({ pathname: "/new-poll", params: { crewId } })} />}
    >
      <Text variant="label">{i18n.t("polls.usual")}</Text>
      <View style={styles.chips}>
        {WEEKDAYS.map((day) => (
          <Chip key={day} label={weekdayName(day, i18n)} selected={mine.includes(day)} onPress={() => toggleDay(day)} />
        ))}
      </View>
      <Text variant="small">{i18n.t("polls.usualHint")}</Text>

      {polls === null ? <SkeletonRows /> : null}
      {polls?.length === 0 ? <Text>{i18n.t("polls.empty")}</Text> : null}
      {polls?.map((poll) => {
        const canClose = poll.createdBy === me || crew?.role === "admin";
        const best = [...poll.slots].sort((a, b) => count(b, "yes") - count(a, "yes"))[0];
        return (
          <Panel key={poll.id}>
            <Text variant="h3">{poll.title}</Text>
            {poll.place || poll.plan ? <Text variant="small">{[poll.place, poll.plan].filter(Boolean).join(" · ")}</Text> : null}
            <Text variant="small">{i18n.t("polls.by", { name: nameOf(poll.createdBy) })}</Text>
            {poll.closedAt ? (
              <Text color={theme.ok}>{i18n.t("polls.closed")}</Text>
            ) : (
              poll.slots.map((slot) => {
                const answer = slot.answers.find((a) => a.userId === me)?.answer;
                const yes = slot.answers.filter((a) => a.answer === "yes");
                return (
                  <View key={slot.id} style={[styles.slot, { borderTopColor: theme.line }]}>
                    <Text variant="h3">{when(slot)}</Text>
                    <Text variant="small">
                      {yes.length ? i18n.t("polls.yesList", { names: yes.map((a) => nameOf(a.userId)).join(", ") }) : i18n.t("polls.noYes")}
                      {count(slot, "maybe") ? ` ${i18n.plural("polls.maybeCount", count(slot, "maybe"))}` : ""}
                    </Text>
                    <Segmented<PollAnswer | "none">
                      accessibilityLabel={when(slot)}
                      height={48}
                      value={answer ?? "none"}
                      items={[
                        { value: "yes", label: i18n.t("polls.yes") },
                        { value: "maybe", label: i18n.t("polls.maybe") },
                        { value: "no", label: i18n.t("polls.no") },
                      ]}
                      onChange={(next) => {
                        if (next === "none") return;
                        haptic.select();
                        void votePoll(poll.id, { [slot.id]: next }).then(load).catch(offline);
                      }}
                    />
                    {canClose ? (
                      <Button
                        label={i18n.t("polls.pick")}
                        variant={slot.id === best?.id ? "primary" : "outline"}
                        height={48}
                        onPress={() => {
                          const partyId = newId();
                          void closePoll(poll.id, slot.id, partyId)
                            .then(async () => {
                              haptic.confirmed();
                              await refreshParties().catch(() => undefined);
                              showToast({ message: i18n.t("polls.created", { name: poll.title }) });
                              load();
                            })
                            .catch(offline);
                        }}
                      />
                    ) : null}
                  </View>
                );
              })
            )}
            {canClose && !poll.closedAt ? (
              <Button label={i18n.t("polls.delete")} variant="outline" height={44} onPress={() => void deletePoll(poll.id).then(load).catch(offline)} />
            ) : null}
          </Panel>
        );
      })}
    </Screen>
  );
}

function count(slot: { answers: { answer: PollAnswer }[] }, answer: PollAnswer): number {
  return slot.answers.filter((a) => a.answer === answer).length;
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { gap: 8, paddingTop: 12, borderTopWidth: 1 },
});
