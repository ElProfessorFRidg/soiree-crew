import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useT, type Translator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { currentFix, refreshVenues, useVenueData, type VenueSummary } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

interface Vote {
  venueId: string;
  count: number;
  mine: boolean;
}

const EARTH_M = 6_371_000;
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

function distanceText(m: number, imperial: boolean, i18n: Translator): string {
  if (imperial) return i18n.t("whereTo.miles", { n: i18n.number(m / 1609.344, 1) });
  return m < 1000 ? i18n.t("whereTo.meters", { n: i18n.number(Math.round(m / 10) * 10) }) : i18n.t("whereTo.kilometers", { n: i18n.number(m / 1000, 1) });
}

/** N-11: vote on the next venue, or let a roulette decide. */
export default function WhereToScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const party = useCrewData((state) => state.parties.find((p) => p.id === id));
  const crewId = party?.crewId;
  const venues = useVenueData((state) => (crewId ? state.byCrew[crewId]?.venues : undefined)) ?? [];
  const imperial = useAppStore((state) => state.preferences.unitSystem !== "metric");
  const [votes, setVotes] = useState<Vote[]>([]);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(() => {
    void api<{ votes: Vote[] }>(`/v1/parties/${id}/where-to`)
      .then((data) => setVotes(data.votes))
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    load();
    if (crewId) void refreshVenues(crewId).catch(() => undefined);
    // Distance only if location is already allowed: this screen never asks on its own.
    void Location.getForegroundPermissionsAsync()
      .then((p) => (p.granted ? currentFix() : null))
      .then((result) => {
        if (result?.ok) setHere({ lat: result.fix.lat, lng: result.fix.lng });
      })
      .catch(() => undefined);
    return () => timers.current.forEach(clearTimeout);
  }, [load, crewId]);

  const countOf = (venueId: string) => votes.find((v) => v.venueId === venueId)?.count ?? 0;
  const mine = votes.find((v) => v.mine)?.venueId;
  const places = venues.filter((v) => v.kind !== "home");
  const sorted = [...places].sort(
    (a, b) => countOf(b.id) - countOf(a.id) || (here ? distanceM(here, a) - distanceM(here, b) : a.name.localeCompare(b.name, i18n.locale)),
  );

  const vote = (venueId: string) => {
    haptic.select();
    void api(`/v1/parties/${id}/where-to`, { method: "PUT", body: { venueId: mine === venueId ? null : venueId } })
      .then(load)
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
  };

  const spin = () => {
    const voted = places.filter((v) => countOf(v.id) > 0);
    const pool = voted.length > 1 ? voted : places;
    if (!pool.length) return;
    const winner = pool[Math.floor(Math.random() * pool.length)]!;
    setPicked(null);
    if (reduceMotion || pool.length === 1) {
      setPicked(winner.id);
      haptic.heavy();
      return;
    }
    // MOT-07: real deceleration, one click per step, the last steps slow down.
    const steps = 14 + pool.indexOf(winner);
    let delay = 0;
    for (let i = 0; i <= steps; i++) {
      delay += 50 + i * i * 2.2;
      const venue = pool[i % pool.length]!;
      const last = i === steps;
      timers.current.push(
        setTimeout(() => {
          setSpinning(last ? null : venue.id);
          if (last) {
            setPicked(winner.id);
            haptic.heavy();
          } else haptic.select();
        }, delay),
      );
    }
  };

  const row = (venue: VenueSummary) => {
    const count = countOf(venue.id);
    const lit = spinning === venue.id || picked === venue.id;
    return (
      <Panel key={venue.id} tint={lit ? "amber" : undefined}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="h3">{venue.name}</Text>
            <View style={styles.tags}>
              {here ? <Text variant="small">{distanceText(distanceM(here, venue), imperial, i18n)}</Text> : null}
              {venue.hereNow > 0 ? <Tag label={i18n.plural("bars.hereNow", venue.hereNow)} tone="ok" /> : null}
              {!venue.explored ? <Tag label={i18n.t("whereTo.notVisited")} /> : null}
              {count > 0 ? <Tag label={i18n.plural("whereTo.votes", count)} tone="amber" /> : null}
            </View>
          </View>
          <Button label={mine === venue.id ? i18n.t("whereTo.voted") : i18n.t("whereTo.vote")} variant={mine === venue.id ? "secondary" : "outline"} height={40} onPress={() => vote(venue.id)} />
        </View>
      </Panel>
    );
  };

  const winner = places.find((v) => v.id === picked);
  return (
    <Screen back title={i18n.t("whereTo.title")} withToasts>
      {places.length === 0 ? <Text>{i18n.t("whereTo.noVenue")}</Text> : null}
      {places.length > 1 ? (
        <Panel>
          <Text variant="h3">{i18n.t("whereTo.roulette")}</Text>
          <Text variant="small">{i18n.t("whereTo.rouletteHint")}</Text>
          <Button label={i18n.t("whereTo.spin")} icon="dice" height={52} disabled={spinning !== null} onPress={spin} />
          {winner ? (
            <Text variant="h2" color={theme.amber} accessibilityLiveRegion="polite">
              {i18n.t("whereTo.result", { venue: winner.name })}
            </Text>
          ) : null}
        </Panel>
      ) : null}
      {sorted.map(row)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 },
});
