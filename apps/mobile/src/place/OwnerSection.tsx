import { useEffect, useState } from "react";
import { palette } from "@crew/design-tokens";
import { View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { claimPlace, fetchClaim, replyToReview, savePlaceInfo, type PlacePage } from "@/server/placeData";
import { Button } from "@/ui/Button";
import { Panel, Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** COM-11: the "managed by the venue" label, its hours, and for the owner the editor; else the claim form. */
export function OwnerSection({ page, onChanged }: { page: PlacePage; onChanged: () => void }) {
  const i18n = useT();
  const venueId = page.place.venueId;
  const [claim, setClaim] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [role, setRole] = useState("");
  const [contact, setContact] = useState("");
  const [hours, setHours] = useState(page.info?.hours ?? "");
  const [happyHours, setHappyHours] = useState(page.info?.happyHours ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!page.claimed) void fetchClaim(venueId).then((c) => setClaim(c.status)).catch(() => undefined);
  }, [venueId, page.claimed]);

  const failed = () => showToast({ tone: "danger", message: i18n.t("crew.offline") });

  return (
    <>
      {page.claimed ? <Tag tone="ok" icon="check" label={i18n.t("place.claimed")} /> : null}
      {page.info && !page.isOwner ? (
        <Panel>
          {page.info.hours ? <Text>{i18n.t("place.hoursLine", { hours: page.info.hours })}</Text> : null}
          {page.info.happyHours ? <Text>{i18n.t("place.happyLine", { hours: page.info.happyHours })}</Text> : null}
        </Panel>
      ) : null}

      {page.isOwner ? (
        <Panel>
          <Text variant="label">{i18n.t("place.ownerTitle")}</Text>
          <Field label={i18n.t("place.hoursField")} value={hours} onChangeText={setHours} maxLength={300} placeholder={i18n.t("place.hoursPlaceholder")} />
          <Field label={i18n.t("place.happyField")} value={happyHours} onChangeText={setHappyHours} maxLength={200} />
          <Button
            label={i18n.t("common.save")}
            height={44}
            loading={busy}
            onPress={() => {
              setBusy(true);
              void savePlaceInfo(venueId, { hours: hours.trim(), happyHours: happyHours.trim() })
                .then(() => {
                  haptic.confirmed();
                  onChanged();
                })
                .catch(failed)
                .finally(() => setBusy(false));
            }}
          />
          <Text variant="small">{i18n.t("place.ownerRules")}</Text>
        </Panel>
      ) : null}

      {!page.claimed && claim === "pending" ? <Text variant="small">{i18n.t("place.claimPending")}</Text> : null}
      {!page.claimed && claim !== "pending" ? (
        claiming ? (
          <Panel>
            <Text variant="label">{i18n.t("place.claimTitle")}</Text>
            <Text variant="small">{i18n.t("place.claimBody")}</Text>
            <Field label={i18n.t("place.claimRole")} value={role} onChangeText={setRole} maxLength={80} />
            <Field label={i18n.t("place.claimContact")} hint={i18n.t("place.claimContactHint")} value={contact} onChangeText={setContact} maxLength={200} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label={i18n.t("chat.cancel")} variant="outline" height={44} style={{ flex: 1 }} onPress={() => setClaiming(false)} />
              <Button
                label={i18n.t("place.claimSend")}
                height={44}
                style={{ flex: 1 }}
                disabled={role.trim().length < 2 || contact.trim().length < 4}
                loading={busy}
                onPress={() => {
                  setBusy(true);
                  void claimPlace(venueId, { role: role.trim(), contact: contact.trim() })
                    .then(() => {
                      setClaim("pending");
                      setClaiming(false);
                      showToast({ message: i18n.t("place.claimPending") });
                    })
                    .catch(failed)
                    .finally(() => setBusy(false));
                }}
              />
            </View>
          </Panel>
        ) : (
          <Button label={i18n.t("place.claimOpen")} variant="outline" height={44} onPress={() => setClaiming(true)} />
        )
      ) : null}
    </>
  );
}

/** COM-11: the owner's public answer under a review; the owner writes or changes it here. */
export function ReviewReply({ review, isOwner, onChanged }: { review: PlacePage["reviews"][number]; isOwner: boolean; onChanged: () => void }) {
  const i18n = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? "");
  const canReply = isOwner && (review.audience === "public" || review.audience === "anonymous");
  return (
    <>
      {review.reply && !editing ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: palette.semantic.ok, paddingLeft: 10, gap: 2 }}>
          <Text variant="label">{i18n.t("place.replyFrom")}</Text>
          <Text variant="small">{review.reply.text}</Text>
        </View>
      ) : null}
      {canReply && editing ? (
        <>
          <Field label={i18n.t("place.replyField")} value={text} onChangeText={setText} maxLength={600} multiline />
          <Button
            label={i18n.t("place.replySend")}
            height={40}
            disabled={!text.trim()}
            onPress={() =>
              void replyToReview(review.id, text.trim())
                .then(() => {
                  setEditing(false);
                  onChanged();
                })
                .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
            }
          />
        </>
      ) : canReply ? (
        <Button label={review.reply ? i18n.t("place.replyEdit") : i18n.t("place.replyOpen")} variant="secondary" height={40} onPress={() => setEditing(true)} />
      ) : null}
    </>
  );
}
