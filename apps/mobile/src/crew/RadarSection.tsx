import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { haptic } from "@/motion/haptics";
import { refreshBirthdays, useBirthdays, type Birthday } from "@/server/calendarData";
import { callCrew, clearNightStatus, refreshRadar, replyToCall, setNightStatus, useRadar, type NightStatus } from "@/server/radarData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { RelativeTime } from "@/ui/RelativeTime";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { Field } from "./Field";
import { StatusDetails } from "./StatusDetails";
import { nightDay, nightLabel, statusLook, WeekBoard } from "./WeekBoard";
import { useDraft } from "@/state/drafts";
import { showFailure } from "@/server/errors";

const STATUSES: readonly NightStatus[] = ["going_out", "maybe", "home", "unavailable"];
/** QOL-21: the crew tab mentions a birthday from this many days before. */
const BIRTHDAY_CARD_DAYS = 6;

/** QOL-21: "Jade's birthday on Thursday", and a party already filled in one tap away. */
function BirthdayCard({ birthday, crewId }: { birthday: Birthday; crewId: string }) {
  const i18n = useT();
  const weekday = new Intl.DateTimeFormat(i18n.locale, { weekday: "long" }).format(nightDay(birthday.date));
  const title =
    birthday.inDays === 0
      ? i18n.t("radar.birthdayToday", { name: birthday.name })
      : birthday.inDays === 1
        ? i18n.t("radar.birthdayTomorrow", { name: birthday.name })
        : i18n.t("radar.birthdaySoon", { name: birthday.name, weekday });
  return (
    <Panel style={styles.birthday}>
      <Icon name="cal" />
      <View style={styles.flex}>
        <Text variant="h3">{title}</Text>
        <Text variant="small">{i18n.t("radar.birthdayPlanQuestion")}</Text>
      </View>
      <Button
        label={i18n.t("radar.birthdayPlan")}
        variant="secondary"
        height={40}
        onPress={() =>
          router.push({
            pathname: "/new-party",
            params: { crewId, mood: "birthday", date: birthday.date, name: i18n.t("radar.birthdayPartyName", { name: birthday.name }) },
          })
        }
      />
    </Panel>
  );
}

/** N-01 to N-03 at the top of the Crew tab: a night's status in one gesture, who is out, and the week. */
export function RadarSection({ crewId }: { crewId: string }) {
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const radar = useRadar((state) => state.byCrew[crewId]);
  const crewName = useCrewNames(crewId);
  const birthdays = useBirthdays((state) => state.byCrew[crewId]);
  const [note, setNote, clearNote] = useDraft(`radar:note:${crewId}`);
  const [calling, setCalling] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    void refreshRadar(crewId).catch(() => undefined);
    void refreshBirthdays(crewId).catch(() => undefined);
  }, [crewId]);

  if (!radar || !me) return null;
  const tonight = radar.tonight;
  // N-01: tonight unless another night of the week was picked; a past pick falls back to tonight.
  const night = picked && radar.nights.includes(picked) ? picked : tonight;
  const mineEntry = radar.statuses.find((s) => s.userId === me && s.night === night);
  const mine = mineEntry?.status ?? null;
  const out = radar.statuses.filter((s) => s.night === tonight && (s.status === "going_out" || s.status === "maybe"));
  const nameOf = (id: string) => crewName(id, radar.members.find((m) => m.userId === id)?.name ?? "");
  const openCalls = radar.calls.filter((c) => !c.partyId);
  const soon = (birthdays ?? []).filter((b) => b.inDays <= BIRTHDAY_CARD_DAYS);

  return (
    <>
      <Text variant="label">{nightLabel(night, radar, i18n)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nightRow} contentContainerStyle={styles.nightChips} accessibilityLabel={i18n.t("radar.pickNight")}>
        {radar.nights.map((n) => (
          <Chip key={n} label={nightLabel(n, radar, i18n)} selected={n === night} onPress={() => setPicked(n)} />
        ))}
      </ScrollView>
      <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel={`${i18n.t("radar.myStatus")}, ${nightLabel(night, radar, i18n)}`}>
        {STATUSES.map((status) => {
          const on = mine === status;
          const look = statusLook(status, theme);
          return (
            <ScalePressable
              key={status}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={i18n.t(`radar.${status}`)}
              onPress={() => {
                haptic.select();
                // A second tap on the chosen tile takes the status back.
                if (on) clearNightStatus(crewId, night, me).catch(showFailure(i18n));
                else setNightStatus(crewId, night, status, me, mineEntry ?? undefined).catch(showFailure(i18n));
              }}
              style={[styles.tile, { backgroundColor: on ? theme.text : theme.surface2 }]}
            >
              <View style={[styles.dot, { backgroundColor: look.bg, borderColor: look.border }]}>{look.icon ? <Icon name={look.icon} size={12} color={look.fg} /> : null}</View>
              <Text variant="tag" color={on ? theme.bg : theme.text}>
                {i18n.t(`radar.${status}`)}
              </Text>
            </ScalePressable>
          );
        })}
      </View>
      {mineEntry && (mine === "going_out" || mine === "maybe") ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.details}>
          <StatusDetails crewId={crewId} night={night} me={me} status={mineEntry.status} details={mineEntry} />
        </Animated.View>
      ) : null}

      {soon.map((b) => (
        <BirthdayCard key={b.userId} birthday={b} crewId={crewId} />
      ))}

      {openCalls.map((call) => {
        const ins = call.replies.filter((r) => r.reply === "in");
        const maybes = call.replies.filter((r) => r.reply === "maybe");
        const myReply = call.replies.find((r) => r.userId === me)?.reply;
        return (
          <Panel key={call.id} tint="amber">
            <Text variant="h3">{call.userId === me ? i18n.t("radar.whoIsIn") : i18n.t("radar.callFrom", { name: nameOf(call.userId) })}</Text>
            <RelativeTime at={call.at} />
            {call.note ? <Text>{call.note}</Text> : null}
            <Text variant="small">{i18n.t("radar.replies", { in: ins.length, maybe: maybes.length })}</Text>
            {call.userId === me ? (
              <Button
                label={i18n.t("radar.makeParty", { count: ins.length + 1 })}
                icon="plus"
                height={48}
                onPress={() => router.push({ pathname: "/new-party", params: { outCallId: call.id, crewId } })}
              />
            ) : (
              <Segmented<"in" | "maybe" | "no" | "none">
                accessibilityLabel={i18n.t("radar.callFrom", { name: nameOf(call.userId) })}
                value={myReply ?? "none"}
                items={[
                  { value: "in", label: i18n.t("radar.in") },
                  { value: "maybe", label: i18n.t("radar.replyMaybe") },
                  { value: "no", label: i18n.t("radar.no") },
                ]}
                onChange={(reply) => {
                  if (reply === "none") return;
                  haptic.select();
                  replyToCall(crewId, call.id, reply).catch(showFailure(i18n));
                }}
              />
            )}
          </Panel>
        );
      })}

      <View>
        <Text variant="label">{i18n.t("radar.whoIsOut")}</Text>
        {out.length === 0 ? <Text variant="small">{i18n.t("radar.nobody")}</Text> : null}
        <View style={styles.outRow}>
          {out.map((s) => (
            <View key={s.userId} style={styles.outCell}>
              <Avatar personId={s.userId} name={nameOf(s.userId)} ring={s.status === "going_out" ? theme.amber : theme.ok} />
              <Text variant="tab" numberOfLines={2}>
                {s.userId === me ? i18n.t("crew.you") : nameOf(s.userId)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {!openCalls.some((c) => c.userId === me) ? (
        <Panel>
          <Field label={i18n.t("radar.callNote")} value={note} onChangeText={setNote} maxLength={80} />
          <Button
            label={i18n.t("radar.whoIsIn")}
            icon="send"
            height={52}
            loading={calling}
            onPress={() => {
              setCalling(true);
              callCrew(crewId, note.trim())
                .then(() => {
                  haptic.confirmed();
                  clearNote();
                  showToast({ message: i18n.t("radar.sent") });
                })
                .catch(showFailure(i18n))
                .finally(() => setCalling(false));
            }}
          />
        </Panel>
      ) : null}

      <WeekBoard radar={radar} me={me} selected={night} onPick={setPicked} />
    </>
  );
}

const styles = StyleSheet.create({
  nightRow: { marginHorizontal: -space.screenX },
  nightChips: { gap: 8, paddingHorizontal: space.screenX, paddingVertical: 4 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexBasis: "47%", flexGrow: 1, minHeight: 64, borderRadius: 16, padding: 12, gap: 6, justifyContent: "center" },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  details: { gap: 10 },
  birthday: { flexDirection: "row", alignItems: "center", gap: 12 },
  outRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  outCell: { width: 56, alignItems: "center", gap: 4 },
  flex: { flex: 1 },
});
