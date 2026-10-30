import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { Avatar } from "@/ui/Avatar";
import { Tag } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";

/** HUB-01 "the crew live": avatar, BAC and one status tag per member, tap for the full dashboard. */
export function CrewStrip({ big }: { big?: boolean }) {
  const i18n = useT();
  const current = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const nameOf = useCrewNames(current?.party.crewId);
  if (!current?.live) return null;
  const rules = countryRules(preferences.legalCountry);
  const others = current.live.members.filter((m) => m.userId !== me && m.response === "going");
  if (!others.length) return null;
  const size = big ? 52 : 38;

  return (
    <View style={styles.block}>
      <Text variant="label" style={big ? { fontSize: 15 } : undefined}>
        {i18n.t("live.crewTonight")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
        {others.map((member) => {
          const tag = member.homeSafeAt
            ? { label: i18n.t("live.homeSafe"), tone: "ok" as const }
            : member.batteryLow
              ? { label: i18n.t("live.battery"), tone: "danger" as const }
              : member.designatedDriver
                ? { label: i18n.t("live.driver"), tone: "water" as const }
                : member.quiet
                  ? { label: i18n.t("live.quiet", { minutes: member.lastActivityAt ? Math.round((Date.now() - member.lastActivityAt) / 60_000) : 0 }), tone: "amber" as const }
                  : null;
          return (
            <ScalePressable
              key={member.userId}
              accessibilityLabel={nameOf(member.userId, member.displayName)}
              onPress={() => router.push({ pathname: "/live", params: { id: current.party.id } })}
              style={[styles.cell, { minWidth: big ? 72 : 66 }]}
            >
              <Avatar personId={member.userId} name={nameOf(member.userId, member.displayName)} size={size} faded={member.homeSafeAt !== null} />
              <Text variant="h3" style={{ fontSize: 13 }} numberOfLines={2}>
                {nameOf(member.userId, member.displayName)}
              </Text>
              {!big && member.bac !== null ? (
                <Text variant="small" style={{ fontSize: 12 }}>
                  {formatBacValue(member.bac, preferences.bacUnit, breathRatio(rules), i18n.locale)}
                </Text>
              ) : null}
              {tag && !big ? <Tag label={tag.label} tone={tag.tone} /> : null}
              {/* HUB-01: where each one is right now. */}
              {member.venue && !member.homeSafeAt ? (
                <Text variant="tab" align="center" style={styles.venue}>
                  {member.venue.name}
                </Text>
              ) : null}
            </ScalePressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  scroller: { marginHorizontal: -space.screenX },
  row: { gap: 12, paddingHorizontal: space.screenX },
  cell: { alignItems: "center", gap: 4 },
  venue: { maxWidth: 96 },
});
