import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { refreshLiveParty, setGoingHome, setPartyStatus, useCrewData, type HomeMode, type LiveMember } from "@/server/crewData";
import { useSession } from "@/server/session";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { openRide, RIDE_APPS } from "@/party/rides";
import { showFailure } from "@/server/errors";

const MODES: HomeMode[] = ["walk", "car", "ride", "transit"];

/** N-27: who goes home with whom, offers to walk someone home, and a ride in one tap. */
export default function GoingHomeScreen() {
  const lastHomeTap = useRef(0);
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const live = useCrewData((state) => state.live[id]);
  const rideApp = useAppStore((state) => state.preferences.rideApp);

  useEffect(() => {
    void refreshLiveParty(id).catch(() => undefined);
  }, [id]);

  const going = (live?.members ?? []).filter((m) => m.response === "going");
  const mine = going.find((m) => m.userId === me);
  const home = going.filter((m) => m.homeSafeAt !== null).length;
  const driver = going.find((m) => m.designatedDriver);
  const nameOf = (userId: string | null) => (userId === me ? i18n.t("common.you") : (going.find((m) => m.userId === userId)?.displayName ?? "?"));
  const offline = showFailure(i18n);
  const act = (input: Parameters<typeof setGoingHome>[1]) => {
    haptic.select();
    void setGoingHome(id, input).catch(offline);
  };

  // Groups: everyone sharing a leader. People without one are listed apart.
  const groups = new Map<string, LiveMember[]>();
  for (const m of going) if (m.homeWith && m.homeSafeAt === null) groups.set(m.homeWith, [...(groups.get(m.homeWith) ?? []), m]);
  const alone = going.filter((m) => !m.homeWith && m.homeSafeAt === null && m.userId !== me);
  const offerFrom = mine?.homeOfferFrom ?? null;
  const preferred = RIDE_APPS.find((a) => a.id === rideApp);

  return (
    <Screen back title={i18n.t("goingHome.title")} withToasts>
      <Panel>
        <Text variant="h3">{i18n.t("goingHome.allHome")}</Text>
        <Text>{i18n.t("goingHome.homeCount", { home, total: going.length })}</Text>
        <View style={styles.row}>
          {going.map((m) => (
            <Avatar key={m.userId} personId={m.userId} name={m.displayName} size={34} faded={m.homeSafeAt === null} />
          ))}
        </View>
        {mine ? (
          <Button
            label={mine.homeSafeAt ? i18n.t("live.imNotHome") : i18n.t("live.imHome")}
            variant={mine.homeSafeAt ? "outline" : "primary"}
            height={52}
            onPress={() => {
              // A double tap must not mark me home and straight back out (ADP-09).
              const now = Date.now();
              if (now - lastHomeTap.current < 1_500) return;
              lastHomeTap.current = now;
              haptic.confirmed();
              void setPartyStatus(id, { homeSafe: !mine.homeSafeAt }).catch(offline);
            }}
          />
        ) : null}
      </Panel>

      <Text variant="small">{driver ? i18n.t("goingHome.driver", { name: nameOf(driver.userId) }) : i18n.t("goingHome.noDriver")}</Text>

      {offerFrom ? (
        <Panel tint="amber">
          <Text variant="h3">{i18n.t("goingHome.offerFrom", { name: nameOf(offerFrom) })}</Text>
          <View style={styles.actions}>
            <Button label={i18n.t("goingHome.decline")} variant="outline" height={44} style={styles.flex} onPress={() => act({ answerOffer: false })} />
            <Button label={i18n.t("goingHome.accept")} variant="secondary" height={44} style={styles.flex} onPress={() => act({ answerOffer: true })} />
          </View>
        </Panel>
      ) : null}

      <Text variant="label">{i18n.t("goingHome.groups")}</Text>
      {groups.size === 0 ? <Text variant="small">{i18n.t("goingHome.nobody")}</Text> : null}
      {[...groups].map(([leader, members]) => {
        const mode = members.find((m) => m.homeMode)?.homeMode;
        const inIt = members.some((m) => m.userId === me);
        return (
          <Panel key={leader}>
            <View style={styles.row}>
              {members.map((m) => (
                <Avatar key={m.userId} personId={m.userId} name={m.displayName} size={34} />
              ))}
            </View>
            <Text variant="h3">{members.map((m) => nameOf(m.userId)).join(", ")}</Text>
            {mode ? <Tag label={i18n.t(`goingHome.${mode}`)} /> : null}
            {inIt ? (
              <Button label={i18n.t("goingHome.leave")} variant="outline" height={40} onPress={() => act({ withUserId: null })} />
            ) : (
              <Button label={i18n.t("goingHome.joinWith", { name: nameOf(leader) })} variant="secondary" height={40} onPress={() => act({ withUserId: leader })} />
            )}
          </Panel>
        );
      })}
      {alone.map((m) => (
        <View key={m.userId} style={[styles.alone, { borderBottomColor: theme.line }]}>
          <Avatar personId={m.userId} name={m.displayName} size={34} />
          <Text style={styles.flex}>{i18n.t("goingHome.alone", { name: m.displayName })}</Text>
          {m.homeOfferFrom === me ? (
            <Tag label={i18n.t("goingHome.offered")} tone="ok" />
          ) : (
            <Button
              label={i18n.t("goingHome.offer")}
              variant="outline"
              height={36}
              onPress={() => {
                act({ offerTo: m.userId });
                showToast({ message: i18n.t("goingHome.offered") });
              }}
            />
          )}
        </View>
      ))}

      {mine && mine.homeSafeAt === null ? (
        <>
          <Text variant="label">{i18n.t("goingHome.myMode")}</Text>
          <Segmented<HomeMode | "none">
            accessibilityLabel={i18n.t("goingHome.myMode")}
            value={mine.homeMode ?? "none"}
            items={MODES.map((mode) => ({ value: mode, label: i18n.t(`goingHome.${mode}`) }))}
            onChange={(mode) => act({ mode: mode === "none" ? null : mode })}
          />
          {mine.homeMode === "ride" ? (
            <Panel>
              {preferred ? (
                <Button label={i18n.t("goingHome.rideWith", { app: preferred.name })} icon="car" height={56} onPress={() => void openRide(preferred).catch(offline)} />
              ) : null}
              <View style={styles.row}>
                {RIDE_APPS.map((app) => (
                  <Chip
                    key={app.id}
                    label={app.name}
                    selected={app.id === rideApp}
                    onPress={() => {
                      setPreferences({ rideApp: app.id });
                      void openRide(app).catch(offline);
                    }}
                  />
                ))}
              </View>
              <Text variant="small">{i18n.t("goingHome.rideHint")}</Text>
            </Panel>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  alone: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1 },
});
