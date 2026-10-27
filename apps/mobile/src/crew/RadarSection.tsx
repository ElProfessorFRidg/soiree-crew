import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { avatarColor } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { callCrew, refreshRadar, replyToCall, setNightStatus, useRadar, type NightStatus } from "@/server/radarData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { Field } from "./Field";
import { useDraft } from "@/state/drafts";

const STATUSES: readonly NightStatus[] = ["going_out", "maybe", "home", "unavailable"];

/** N-01 to N-03 at the top of the Crew tab: tonight's status in one gesture, who is out, and the week. */
export function RadarSection({ crewId }: { crewId: string }) {
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const radar = useRadar((state) => state.byCrew[crewId]);
  const [note, setNote, clearNote] = useDraft(`radar:note:${crewId}`);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    void refreshRadar(crewId).catch(() => undefined);
  }, [crewId]);

  if (!radar || !me) return null;
  const tonight = radar.tonight;
  const mine = radar.statuses.find((s) => s.userId === me && s.night === tonight)?.status ?? null;
  const out = radar.statuses.filter((s) => s.night === tonight && (s.status === "going_out" || s.status === "maybe"));
  const nameOf = (id: string) => radar.members.find((m) => m.userId === id)?.name ?? "";
  const openCalls = radar.calls.filter((c) => !c.partyId);
  const tileColor: Record<NightStatus, string> = { going_out: theme.amber, maybe: theme.water, home: theme.surfaceRaised, unavailable: theme.surfaceRaised };

  return (
    <>
      <Text variant="label">{i18n.t("radar.tonight")}</Text>
      <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel={i18n.t("radar.myStatus")}>
        {STATUSES.map((status) => {
          const on = mine === status;
          return (
            <ScalePressable
              key={status}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={i18n.t(`radar.${status}`)}
              onPress={() => {
                haptic.select();
                setNightStatus(crewId, tonight, status, me).catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
              }}
              style={[styles.tile, { backgroundColor: on ? theme.text : theme.surface2 }]}
            >
              <View style={[styles.dot, { backgroundColor: tileColor[status] }]} />
              <Text variant="tag" color={on ? theme.bg : theme.text}>
                {i18n.t(`radar.${status}`)}
              </Text>
            </ScalePressable>
          );
        })}
      </View>

      {openCalls.map((call) => {
        const ins = call.replies.filter((r) => r.reply === "in");
        const maybes = call.replies.filter((r) => r.reply === "maybe");
        const myReply = call.replies.find((r) => r.userId === me)?.reply;
        return (
          <Panel key={call.id} tint="amber">
            <Text variant="h3">{call.userId === me ? i18n.t("radar.whoIsIn") : i18n.t("radar.callFrom", { name: nameOf(call.userId) })}</Text>
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
                  replyToCall(crewId, call.id, reply).catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
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
              <Avatar personId={s.userId} name={nameOf(s.userId)} ring={s.status === "going_out" ? theme.amber : theme.water} />
              <Text variant="tab" numberOfLines={1}>
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
                .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
                .finally(() => setCalling(false));
            }}
          />
        </Panel>
      ) : null}

      <View>
        <Text variant="label">{i18n.t("radar.week")}</Text>
        <View style={styles.weekHeader}>
          <View style={styles.weekName} />
          {radar.nights.map((night) => (
            <Text key={night} variant="tab" style={styles.weekCell} align="center">
              {new Intl.DateTimeFormat(i18n.locale, { weekday: "narrow" }).format(new Date(`${night}T12:00:00Z`))}
            </Text>
          ))}
        </View>
        {radar.members.map((member) => (
          <View key={member.userId} style={styles.weekRow}>
            <Text variant="small" style={styles.weekName} numberOfLines={1}>
              {member.userId === me ? i18n.t("crew.you") : member.name}
            </Text>
            {radar.nights.map((night) => {
              const status = radar.statuses.find((s) => s.userId === member.userId && s.night === night)?.status;
              return (
                <View key={night} style={styles.weekCell} accessibilityLabel={status ? `${member.name}, ${i18n.t(`radar.${status}`)}` : undefined}>
                  <View
                    style={[
                      styles.weekDot,
                      {
                        backgroundColor: status === "going_out" ? avatarColor(member.userId) : status === "maybe" ? theme.water : "transparent",
                        borderColor: status ? "transparent" : theme.line,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexBasis: "47%", flexGrow: 1, minHeight: 64, borderRadius: 16, padding: 12, gap: 6, justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  outRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  outCell: { width: 56, alignItems: "center", gap: 4 },
  weekHeader: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  weekRow: { flexDirection: "row", alignItems: "center", minHeight: 30 },
  weekName: { width: 72 },
  weekCell: { flex: 1, alignItems: "center" },
  weekDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
});
