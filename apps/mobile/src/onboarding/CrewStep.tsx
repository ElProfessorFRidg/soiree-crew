import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { duration, palette, scaled } from "@crew/design-tokens";
import { Field } from "@/crew/Field";
import { crewErrorMessage, inviteCodeFrom } from "@/crew/invite";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { acceptInvite, createCrew, createInvite, CREW_KINDS, type CrewKind } from "@/server/crewData";
import { usePendingInvite } from "@/server/pendingInvite";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** O-05: create the first crew (the name updates the invite card as it is typed) or join one. */
export function FirstCrew({ onCreated, onDone, doneLabel }: { onCreated: () => void; onDone: () => void; doneLabel: string }) {
  const i18n = useT();
  const theme = useTheme();
  // QOL-05: an invite opened before the account existed is ready to accept here.
  const sessionUrl = useSession((state) => state.session?.url);
  const pending = usePendingInvite((state) => state.invite);
  const pendingCode = pending && pending.server === sessionUrl ? pending.code : null;
  const [mode, setMode] = useState<"create" | "join">(pendingCode ? "join" : "create");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CrewKind>("friends");
  const [invite, setInvite] = useState<{ url: string; code: string } | null>(null);
  const [code, setCode] = useState(pendingCode ?? "");
  const [busy, setBusy] = useState(false);
  const fail = (error: unknown) => {
    haptic.error();
    showToast({ tone: "danger", message: crewErrorMessage(error, i18n) });
  };
  const shown = name.trim() || i18n.t("onboarding.crewNamePlaceholder");

  return (
    <>
      <Text variant="h1">{i18n.t("onboarding.crewTitle")}</Text>
      <Segmented
        accessibilityLabel={i18n.t("onboarding.crewTitle")}
        value={mode}
        items={[
          { value: "create", label: i18n.t("onboarding.crewCreate") },
          { value: "join", label: i18n.t("onboarding.crewJoin") },
        ]}
        onChange={setMode}
      />
      {mode === "create" ? (
        <Animated.View key="create" entering={FadeIn.duration(duration.enter)} style={styles.step}>
          {invite ? null : (
            <>
              <Field label={i18n.t("crew.crewName")} placeholder={i18n.t("onboarding.crewNamePlaceholder")} value={name} onChangeText={setName} maxLength={40} />
              <View style={styles.chips}>
                {CREW_KINDS.map((k) => (
                  <Chip key={k} label={i18n.t(`crew.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
                ))}
              </View>
            </>
          )}
          <Panel style={styles.inviteCard}>
            <Text variant="h2" align="center">
              {shown}
            </Text>
            <View style={[styles.qr, { backgroundColor: theme.text }]}>
              {invite ? (
                <Animated.View entering={FadeIn.duration(duration.enter)}>
                  <QRCode value={invite.url} size={168} backgroundColor={palette.dark.text} color={palette.accent.onAccent} />
                </Animated.View>
              ) : (
                <Icon name="x:scan" size={56} color={palette.accent.onAccent} />
              )}
            </View>
            <Text variant="small" align="center">
              {i18n.t("onboarding.crewShare")}
            </Text>
            {invite ? (
              <View style={styles.inviteActions}>
                <Button
                  label={i18n.t("onboarding.copyLink")}
                  icon="link"
                  variant="secondary"
                  height={48}
                  onPress={() =>
                    void Clipboard.setStringAsync(invite.url).then(() => {
                      haptic.confirmed();
                      showToast({ message: i18n.t("onboarding.copied") });
                    })
                  }
                />
                <Button label={i18n.t("crew.invite")} icon="share" variant="outline" height={48} onPress={() => void Share.share({ message: i18n.t("crew.inviteShare", { crew: shown, url: invite.url }) })} />
                <Text variant="small" align="center">
                  {i18n.t("onboarding.linkHint")}
                </Text>
              </View>
            ) : null}
          </Panel>
          {invite ? (
            <Button label={doneLabel} height={56} onPress={onDone} />
          ) : (
            <Button
              label={i18n.t("crew.create")}
              height={56}
              disabled={!name.trim()}
              loading={busy}
              onPress={() => {
                setBusy(true);
                createCrew(name.trim(), kind)
                  .then((id) => createInvite(id))
                  .then((created) => {
                    haptic.confirmed();
                    setInvite(created);
                    onCreated();
                  })
                  .catch(fail)
                  .finally(() => setBusy(false));
              }}
            />
          )}
        </Animated.View>
      ) : (
        <Animated.View key="join" entering={FadeIn.duration(duration.enter)} style={styles.step}>
          <Field
            label={i18n.t("crew.inviteCode")}
            value={code}
            onChangeText={(text) => setCode(inviteCodeFrom(text) ?? text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={60}
          />
          <Button
            label={i18n.t("onboarding.pasteLink")}
            icon="link"
            variant="outline"
            height={44}
            onPress={() =>
              void Clipboard.getStringAsync().then((text) => {
                const found = inviteCodeFrom(text);
                if (found) setCode(found);
                else showToast({ message: i18n.t("crew.pasteNothing") });
              })
            }
          />
          <Button
            label={i18n.t("crew.join")}
            height={56}
            disabled={code.trim().length !== 8}
            loading={busy}
            onPress={() => {
              setBusy(true);
              acceptInvite(code)
                .then(() => {
                  haptic.confirmed();
                  if (pendingCode) usePendingInvite.setState({ invite: null });
                  onDone();
                })
                .catch(fail)
                .finally(() => setBusy(false));
            }}
          />
        </Animated.View>
      )}
    </>
  );
}

/**
 * Signed out, the crew step is a short invite: what an account adds, one button to make it.
 * Nothing is lost by waiting: the Crew tab asks again when it is opened.
 */
export function CrewWaiting({ onCreateAccount }: { onCreateAccount: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const names = i18n.t("onboarding.cardCrewNames").split(",").map((n) => n.trim());
  return (
    <>
      <View style={styles.faces} accessible={false}>
        {names.map((name, index) => (
          <Animated.View
            key={name}
            entering={ZoomIn.delay(scaled(duration.enter + index * 120)).duration(duration.pop).easing(easings.out)}
            style={index ? styles.overlap : undefined}
          >
            <Avatar personId={`sample-${index}`} name={name} size={52} ring={theme.bg} />
          </Animated.View>
        ))}
      </View>
      <Text variant="h1">{i18n.t("onboarding.waitingTitle")}</Text>
      <Text>{i18n.t("onboarding.waitingBody")}</Text>
      <Text variant="small">{i18n.t("onboarding.waitingHint")}</Text>
      <Button label={i18n.t("onboarding.waitingCta")} height={56} onPress={onCreateAccount} />
    </>
  );
}

const styles = StyleSheet.create({
  step: { gap: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8 },
  inviteCard: { alignItems: "center", gap: 12 },
  qr: { width: 192, height: 192, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  inviteActions: { alignSelf: "stretch", gap: 8 },
  faces: { flexDirection: "row", marginTop: 24 },
  overlap: { marginLeft: -14 },
});
