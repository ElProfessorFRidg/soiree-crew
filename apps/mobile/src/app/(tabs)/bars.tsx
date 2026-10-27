import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { avatarColor, duration, palette } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { fitRegion, TileMap, type LatLng } from "@/map/TileMap";
import { useCrewData, useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import { refreshVenues, useVenueData, type VenueSummary } from "@/server/venueData";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Panel, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { fetchFriendLocations, type FriendLocation } from "@/location/liveShare";
import { useEcoInterval } from "@/power/eco";
import { Avatar } from "@/ui/Avatar";

type Filter = "all" | "friends" | "fog";
const MAP_HEIGHT_RATIO = 0.46;

function VenuePin({ venue, selected, onPress }: { venue: VenueSummary; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = venue.bossId ? avatarColor(venue.bossId) : theme.surfaceRaised;
  const size = selected ? 40 : 30;
  return (
    <ScalePressable accessibilityLabel={venue.name} onPress={onPress} style={{ alignItems: "center" }}>
      {venue.bossId ? (
        <Animated.View entering={ZoomIn.duration(duration.crownDrop).easing(easings.overshoot)}>
          <Icon name="crown" size={16} color={theme.amber} />
        </Animated.View>
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: selected ? 3 : 2,
          borderColor: selected ? theme.text : theme.bg,
          // TER-08 fog of war: never-visited venues are faded.
          opacity: venue.explored ? 1 : 0.45,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={venue.kind === "club" ? "star" : venue.kind === "home" ? "home" : "glass"} size={selected ? 20 : 15} color={palette.accent.onAccent} />
      </View>
      {venue.hereNow > 0 ? (
        <View style={[styles.hereBadge, { backgroundColor: theme.ok }]}>
          <Text variant="tab" color={palette.accent.onAccent}>
            {venue.hereNow}
          </Text>
        </View>
      ) : null}
    </ScalePressable>
  );
}

export default function BarsScreen() {
  const i18n = useT();
  const { width, height } = useWindowDimensions();
  const session = useSession((state) => state.session);
  const crews = useCrewData((state) => state.crews);
  const [crewId, setCrewId] = useState<string | null>(crews[0]?.id ?? null);
  const data = useVenueData((state) => (crewId ? state.byCrew[crewId] : undefined));
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState<{ center: LatLng; zoom: number } | null>(null);
  const mapHeight = Math.round(height * MAP_HEIGHT_RATIO);
  const live = useLiveParty();
  const livePartyId = live && live.party.crewId === crewId ? live.party.id : null;
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const me = session?.userId;
  const pollMs = useEcoInterval(60_000);

  // N-07: friends who share their position tonight show on the map, refreshed every minute.
  useEffect(() => {
    if (!livePartyId) {
      setFriends([]);
      return;
    }
    const load = () => void fetchFriendLocations(livePartyId).then((list) => setFriends(list.filter((f) => f.userId !== me))).catch(() => undefined);
    load();
    const timer = setInterval(load, pollMs);
    return () => clearInterval(timer);
  }, [livePartyId, me, pollMs]);

  useEffect(() => {
    if (!crewId && crews[0]) setCrewId(crews[0].id);
  }, [crews, crewId]);

  useEffect(() => {
    if (!crewId || !session) return;
    void refreshVenues(crewId).catch(() => undefined);
  }, [crewId, session]);

  const venues = useMemo(() => {
    const all = data?.venues ?? [];
    if (filter === "friends") return all.filter((v) => v.hereNow > 0);
    if (filter === "fog") return all.filter((v) => !v.explored && v.kind !== "home");
    return all;
  }, [data, filter]);

  useEffect(() => {
    if (!region && data?.venues.length) setRegion(fitRegion(data.venues, width - 40, mapHeight));
  }, [data, region, width, mapHeight]);

  if (!session || !crews.length || !crewId) {
    return (
      <Screen title={i18n.t("bars.title")}>
        <Text>{i18n.t("bars.needCrew")}</Text>
      </Screen>
    );
  }

  const selected = venues.find((v) => v.id === selectedId) ?? null;
  const view = region ?? fitRegion([], width - 40, mapHeight);

  return (
    <Screen
      title={i18n.t("bars.title")}
      trailing={
        <View style={styles.headerButtons}>
          <IconButton icon="search" accessibilityLabel={i18n.t("discover.title")} onPress={() => router.push("/discover")} />
          <Button label={i18n.t("bars.leaderboard")} icon="trophy" variant="secondary" height={40} onPress={() => router.push({ pathname: "/leaderboard", params: { crewId } })} />
        </View>
      }
    >
      {crews.length > 1 ? (
        <View style={styles.chips}>
          {crews.map((crew) => (
            <Chip key={crew.id} label={crew.name} selected={crew.id === crewId} onPress={() => setCrewId(crew.id)} />
          ))}
        </View>
      ) : null}

      <TileMap
        center={view.center}
        zoom={view.zoom}
        height={mapHeight}
        onRegionChange={(center, zoom) => setRegion({ center, zoom })}
        accessibilityLabel={i18n.t("bars.mapA11y")}
        markers={[
          ...venues.map((venue) => ({
            id: venue.id,
            lat: venue.lat,
            lng: venue.lng,
            render: () => <VenuePin venue={venue} selected={venue.id === selectedId} onPress={() => setSelectedId(venue.id)} />,
          })),
          ...friends.map((f) => ({
            id: `friend-${f.userId}`,
            lat: f.lat,
            lng: f.lng,
            render: () => <Avatar personId={f.userId} name={f.name} size={30} ring={palette.accent.amber} />,
          })),
        ]}
      />

      <View style={styles.chips}>
        {(
          [
            ["all", "bars.all"],
            ["friends", "bars.friendsHere"],
            ["fog", "bars.toConquer"],
          ] as const
        ).map(([value, key]) => (
          <Chip key={value} label={i18n.t(key)} selected={filter === value} onPress={() => setFilter(value)} />
        ))}
      </View>

      {selected ? (
        <Animated.View key={selected.id} entering={FadeIn.duration(duration.enter)}>
          <Panel>
            <Text variant="h2">{selected.name}</Text>
            <View style={styles.tags}>
              {selected.bossName ? <Tag label={i18n.t("bars.boss", { name: selected.bossName })} tone="amber" icon="crown" /> : <Tag label={i18n.t("bars.noBoss")} />}
              {!selected.explored ? <Tag label={i18n.t("bars.fog")} /> : null}
              {selected.hereNow > 0 ? <Tag label={i18n.plural("bars.hereNow", selected.hereNow)} tone="ok" /> : null}
            </View>
            <Text variant="small">{i18n.plural("bars.myPoints", selected.myPoints)}</Text>
            <View style={styles.actions}>
              <Button
                label={i18n.t("bars.checkIn")}
                icon="pin"
                height={52}
                style={styles.flex}
                onPress={() => router.push({ pathname: "/checkin", params: { venueId: selected.id, crewId } })}
              />
              <Button
                label={i18n.t("bars.open")}
                variant="secondary"
                height={52}
                style={styles.flex}
                onPress={() => router.push({ pathname: "/venue", params: { id: selected.id } })}
              />
            </View>
          </Panel>
        </Animated.View>
      ) : !data?.venues.length ? (
        <Text>{i18n.t("bars.empty")}</Text>
      ) : null}

      <Button label={i18n.t("bars.addHere")} icon="plus" variant="outline" height={48} onPress={() => router.push({ pathname: "/add-venue", params: { crewId } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  hereBadge: { position: "absolute", right: -8, top: 8, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
