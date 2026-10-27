import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { setPartyStatus, useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * N-36: "not feeling well", told quietly to the crew of the live party. Mine shows how to say it's
 * better or to call for help; someone else's shows who, and the way to them.
 */
export function UnwellBanner() {
  const i18n = useT();
  const live = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const members = live?.live?.members ?? [];
  const mine = members.find((m) => m.userId === me);
  const others = members.filter((m) => m.userId !== me && m.unwellAt && !m.homeSafeAt);
  if (!live) return null;
  const offline = () => showToast({ tone: "danger", message: i18n.t("crew.offline") });

  return (
    <>
      {mine?.unwellAt ? (
        <Panel tint="amber" style={styles.panel}>
          <Text variant="h3">{i18n.t("unwell.mine")}</Text>
          <View style={styles.row}>
            <Button
              label={i18n.t("unwell.better")}
              variant="secondary"
              height={52}
              style={styles.flex}
              onPress={() => {
                haptic.confirmed();
                void setPartyStatus(live.party.id, { unwell: false }).catch(offline);
              }}
            />
            <Button label={i18n.t("party.sos")} icon="alert" variant="danger" height={52} style={styles.flex} onPress={() => router.push("/sos")} />
          </View>
        </Panel>
      ) : null}
      {others.map((m) => (
        <Panel key={m.userId} tint="amber" style={styles.panel}>
          <Text variant="h3" accessibilityLiveRegion="polite">
            {i18n.t("unwell.other", { name: m.displayName })}
          </Text>
          <Button label={i18n.t("unwell.see")} icon="pin" height={52} onPress={() => router.push("/live")} />
        </Panel>
      ))}
    </>
  );
}

/** The quiet button, for the SOS screen: no alarm, just the crew knowing. */
export function UnwellButton() {
  const i18n = useT();
  const live = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const mine = live?.live?.members.find((m) => m.userId === me);
  if (!live || mine?.unwellAt) return null;
  return (
    <Button
      label={i18n.t("unwell.tell")}
      variant="secondary"
      height={64}
      onPress={() => {
        haptic.confirmed();
        void setPartyStatus(live.party.id, { unwell: true })
          .then(() => showToast({ message: i18n.t("unwell.told") }))
          .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
      }}
    />
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
