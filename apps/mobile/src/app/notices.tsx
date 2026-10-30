import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { reasonKey } from "@/moderation/ReportItem";
import { onLiveHint } from "@/server/liveHints";
import { appealNotice, fetchNotices, markNoticesRead, type ModerationNotice, type NoticesView } from "@/server/profileData";
import { showFailure } from "@/server/errors";
import { Button } from "@/ui/Button";
import { Panel, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * COM-08 (DSA statement of reasons): every decision about what I posted or reported, the rule
 * applied, who decided, my strikes and any posting pause, and how to contest an operator's decision.
 */
export default function NoticesScreen() {
  const i18n = useT();
  const [view, setView] = useState<NoticesView | null>(null);
  const load = useCallback(() => {
    void fetchNotices()
      .then((data) => {
        setView(data);
        if (data.unread) void markNoticesRead().catch(() => undefined);
      })
      .catch(showFailure(i18n));
  }, [i18n]);
  useFocusEffect(load);
  useEffect(() => onLiveHint((hint) => (hint === "moderation.notice" || hint === "open" ? load() : undefined)), [load]);
  const date = (at: number) => new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(at));

  return (
    <Screen back title={i18n.t("people.notices")} withToasts onRefresh={async () => load()}>
      <Text variant="small">{i18n.t("people.noticesIntro")}</Text>
      {!view ? <SkeletonRows /> : null}
      {view?.bannedUntil ? (
        <Panel tint="danger">
          <Text variant="h3">{i18n.t("people.noticeBan", { date: date(view.bannedUntil) })}</Text>
          <Text variant="small">{i18n.t("people.noticeBanScope")}</Text>
        </Panel>
      ) : null}
      {view && view.strikes > 0 ? <Text>{i18n.t("people.noticeStrikes", { count: i18n.number(view.strikes), max: i18n.number(view.strikesForBan) })}</Text> : null}
      {view && !view.notices.length ? <Text>{i18n.t("people.noticesEmpty")}</Text> : null}
      {view?.notices.map((n) => <Notice key={n.id} notice={n} date={date} max={view.strikesForBan} onChanged={load} />)}
    </Screen>
  );
}

function Notice({ notice: n, date, max, onChanged }: { notice: ModerationNotice; date: (at: number) => string; max: number; onChanged: () => void }) {
  const i18n = useT();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = n.kind === "removed" || n.kind === "kept";
  return (
    <Panel tint={n.kind === "removed" ? "danger" : undefined}>
      <View style={styles.head}>
        <Text variant="h3" style={styles.flex}>
          {i18n.t(`people.noticeKind.${n.kind}`)}
        </Text>
        {!n.read ? <Tag label={i18n.plural("people.noticesNew", 1)} tone="amber" /> : null}
      </View>
      <Text variant="small">
        {i18n.t(`people.reportAbout.${n.targetKind}`)}, {date(n.at)}
      </Text>
      {n.excerpt ? <Text>{n.excerpt}</Text> : null}
      <Text variant="small">{i18n.t("people.noticeGround", { ground: i18n.t(reasonKey(n.ground)) })}</Text>
      <Text variant="small">{i18n.t(`people.noticeBy.${n.decidedBy}`)}</Text>
      {mine && n.decidedBy === "operator" && n.strikes > 0 ? <Text variant="small">{i18n.t("people.noticeStrikes", { count: i18n.number(n.strikes), max: i18n.number(max) })}</Text> : null}
      {mine && n.bannedUntil ? <Text variant="small">{i18n.t("people.noticeBan", { date: date(n.bannedUntil) })}</Text> : null}
      {n.appeal ? (
        <Text variant="small">{n.appeal.outcome ? i18n.t(`people.noticeAppealOutcome.${n.appeal.outcome}`) : i18n.t("people.noticeAppealSent")}</Text>
      ) : null}
      {mine && n.decidedBy === "crew" ? <Text variant="small">{i18n.t("people.noticeCrewAppeal")}</Text> : null}
      {n.canAppeal && !writing ? <Button label={i18n.t("people.noticeAppeal")} variant="outline" height={44} onPress={() => setWriting(true)} /> : null}
      {n.canAppeal && writing ? (
        <>
          <Field label={i18n.t("people.noticeAppealField")} value={text} onChangeText={setText} maxLength={500} multiline />
          <Button
            label={i18n.t("people.noticeAppealSend")}
            height={48}
            disabled={text.trim().length < 2}
            loading={busy}
            onPress={() => {
              setBusy(true);
              void appealNotice(n.id, text.trim())
                .then(() => {
                  showToast({ message: i18n.t("people.noticeAppealSent") });
                  setWriting(false);
                  onChanged();
                })
                .catch(showFailure(i18n))
                .finally(() => setBusy(false));
            }}
          />
        </>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
});
