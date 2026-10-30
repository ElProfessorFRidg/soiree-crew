import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { scaled } from "@crew/design-tokens";
import { formatMoney } from "@crew/money";
import { useT, type Translator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { currentFix, fetchWhereTo, type WhereToOption, type WhereToReason, type WhereToResult } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel, Tag } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showFailure } from "@/server/errors";
import { DirectionsButton } from "@/venues/DirectionsButton";
import { OpenTags } from "@/venues/HoursPanel";

interface Vote {
  venueId: string;
  count: number;
  mine: boolean;
}

/** Budget chips, in minor units of the user's currency (a pint, or the average drink when no pint is known). */
const BUDGETS = [500, 600, 700] as const;

function distanceText(m: number, imperial: boolean, i18n: Translator): string {
  if (imperial) return i18n.t("whereTo.miles", { n: i18n.number(m / 1609.344, 1) });
  return m < 1000 ? i18n.t("whereTo.meters", { n: i18n.number(Math.round(m / 10) * 10) }) : i18n.t("whereTo.kilometers", { n: i18n.number(m / 1000, 1) });
}

/** The pick's reason line: its two strongest reasons, said plainly. */
function reasonLine(option: WhereToOption, i18n: Translator, imperial: boolean): string {
  const say = (reason: WhereToReason): string => {
    switch (reason) {
      case "close":
        return i18n.t("whereTo.reasons.close", { distance: option.distanceM !== null ? distanceText(option.distanceM, imperial, i18n) : "" });
      case "cheap":
        return option.pint !== null && option.currency
          ? i18n.t("whereTo.reasons.cheapPint", { price: formatMoney(option.pint, option.currency, i18n.locale) })
          : i18n.t("whereTo.reasons.cheap");
      case "friendsHere":
        return i18n.plural("whereTo.reasons.friendsHere", option.hereNow);
      default:
        return i18n.t(`whereTo.reasons.${reason}`);
    }
  };
  return i18n.t("whereTo.why", { reasons: option.reasons.slice(0, 2).map(say).join(", ") });
}

/**
 * N-11: where to go tonight, for the crew, during a party or not. Filters (open now, happy hour,
 * budget), a ranked pick with its reasons, a venue to conquer (TER-08), the want-to-go list
 * (COM-10), a vote when there is a party, and the roulette.
 */
export default function WhereToScreen() {
  const params = useLocalSearchParams<{ id?: string; crewId?: string }>();
  const i18n = useT();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const party = useCrewData((state) => (params.id ? state.parties.find((p) => p.id === params.id) : undefined));
  const firstCrew = useCrewData((state) => state.crews[0]?.id);
  const crewId = party?.crewId ?? params.crewId ?? firstCrew;
  const partyId = party?.id ?? null;
  const currency = useAppStore((state) => state.preferences.currency);
  const imperial = useAppStore((state) => state.preferences.unitSystem !== "metric");
  const [openNow, setOpenNow] = useState(false);
  const [happyNow, setHappyNow] = useState(false);
  const [budget, setBudget] = useState<number | null>(null);
  const [result, setResult] = useState<WhereToResult | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const offline = showFailure(i18n);

  const loadVotes = useCallback(() => {
    if (!partyId) return;
    void api<{ votes: Vote[] }>(`/v1/parties/${partyId}/where-to`)
      .then((data) => setVotes(data.votes))
      .catch(() => undefined);
  }, [partyId]);

  const load = useCallback(async () => {
    if (!crewId) return;
    const data = await fetchWhereTo(crewId, { here, openNow, happyNow, ...(budget ? { maxPrice: budget } : {}), currency }).catch(() => null);
    if (data) setResult(data);
    loadVotes();
  }, [crewId, here, openNow, happyNow, budget, currency, loadVotes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Distance only if location is already allowed: this screen never asks on its own.
    void Location.getForegroundPermissionsAsync()
      .then((p) => (p.granted ? currentFix() : null))
      .then((fix) => {
        if (fix?.ok) setHere({ lat: fix.fix.lat, lng: fix.fix.lng });
      })
      .catch(() => undefined);
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const options = result?.options ?? [];
  const countOf = (venueId: string) => votes.find((v) => v.venueId === venueId)?.count ?? 0;
  const mine = votes.find((v) => v.mine)?.venueId;
  const suggestion = options.find((o) => o.venueId === result?.suggestion) ?? null;
  const conquest = options.find((o) => o.venueId === result?.conquest && o.venueId !== result?.suggestion) ?? null;

  const vote = (venueId: string) => {
    if (!partyId) return;
    haptic.select();
    void api(`/v1/parties/${partyId}/where-to`, { method: "PUT", body: { venueId: mine === venueId ? null : venueId } })
      .then(loadVotes)
      .catch(offline);
  };

  const spin = () => {
    // Never a place known to be closed; among the voted ones when there are votes.
    const pool0 = options.filter((o) => o.openNow !== false);
    const voted = pool0.filter((o) => countOf(o.venueId) > 0);
    const pool = voted.length > 1 ? voted : pool0;
    if (!pool.length) return;
    const winner = pool[Math.floor(Math.random() * pool.length)]!;
    setPicked(null);
    if (reduceMotion || pool.length === 1) {
      setPicked(winner.venueId);
      haptic.heavy();
      return;
    }
    // MOT-07: real deceleration, one click per step, the last steps slow down.
    const steps = 14 + pool.indexOf(winner);
    let delay = 0;
    for (let i = 0; i <= steps; i++) {
      delay += 50 + i * i * 2.2;
      const option = pool[i % pool.length]!;
      const last = i === steps;
      timers.current.push(
        setTimeout(() => {
          setSpinning(last ? null : option.venueId);
          if (last) {
            setPicked(winner.venueId);
            haptic.heavy();
          } else haptic.select();
        }, scaled(delay)),
      );
    }
  };

  const openOption = (o: WhereToOption) =>
    o.crewVenue ? router.push({ pathname: "/venue", params: { id: o.venueId } }) : router.push({ pathname: "/place", params: { venueId: o.venueId } });

  const row = (o: WhereToOption) => {
    const count = countOf(o.venueId);
    const lit = spinning === o.venueId || picked === o.venueId;
    const price = o.pint ?? o.average;
    return (
      <Panel key={o.venueId} tint={lit ? "amber" : undefined}>
        <View style={styles.row}>
          <ScalePressable style={styles.flex} accessibilityRole="button" accessibilityHint={i18n.t("whereTo.openHint")} onPress={() => openOption(o)}>
            <Text variant="h3">{o.name}</Text>
            <View style={styles.tags}>
              {o.distanceM !== null ? <Text variant="small">{distanceText(o.distanceM, imperial, i18n)}</Text> : null}
              <OpenTags openNow={o.openNow} happyNow={o.happyNow} />
              {price !== null && o.currency ? (
                <Text variant="small">{i18n.t(o.pint !== null ? "whereTo.pint" : "whereTo.average", { price: formatMoney(price, o.currency, i18n.locale) })}</Text>
              ) : null}
              {o.hereNow > 0 ? <Tag label={i18n.plural("bars.hereNow", o.hereNow)} tone="ok" /> : null}
              {o.wanted ? <Tag label={i18n.t("whereTo.wanted")} icon="star" /> : null}
              {!o.explored ? <Tag label={i18n.t("whereTo.notVisited")} /> : null}
              {count > 0 ? <Tag label={i18n.plural("whereTo.votes", count)} tone="amber" /> : null}
            </View>
          </ScalePressable>
          {partyId && o.crewVenue ? (
            <Button
              label={mine === o.venueId ? i18n.t("whereTo.voted") : i18n.t("whereTo.vote")}
              variant={mine === o.venueId ? "secondary" : "outline"}
              height={44}
              onPress={() => vote(o.venueId)}
            />
          ) : null}
        </View>
      </Panel>
    );
  };

  const winner = options.find((o) => o.venueId === picked);
  const filtered = openNow || happyNow || budget !== null;
  return (
    <Screen back title={i18n.t("whereTo.title")} withToasts onRefresh={load}>
      <View style={styles.chips}>
        <Chip label={i18n.t("whereTo.openNow")} selected={openNow} onPress={() => setOpenNow(!openNow)} />
        <Chip label={i18n.t("whereTo.happyNow")} selected={happyNow} onPress={() => setHappyNow(!happyNow)} />
        {BUDGETS.map((cap) => (
          <Chip
            key={cap}
            label={i18n.t("whereTo.under", { price: formatMoney(cap, currency, i18n.locale) })}
            selected={budget === cap}
            onPress={() => setBudget(budget === cap ? null : cap)}
          />
        ))}
      </View>
      {!crewId ? <Text>{i18n.t("bars.needCrew")}</Text> : null}
      {crewId && !result ? <SkeletonRows /> : null}
      {result && result.total === 0 ? <Text>{i18n.t("whereTo.noVenue")}</Text> : null}
      {result && result.total > 0 && options.length === 0 ? (
        <Text>{filtered ? i18n.t("whereTo.noneFiltered") : i18n.t("whereTo.noVenue")}</Text>
      ) : null}

      {suggestion ? (
        <Panel tint="amber">
          <Text variant="label">{i18n.t("whereTo.suggestion")}</Text>
          <Text variant="h2" accessibilityLiveRegion="polite">
            {suggestion.name}
          </Text>
          <Text>{reasonLine(suggestion, i18n, imperial)}</Text>
          <View style={styles.actions}>
            <Button label={i18n.t("whereTo.see")} variant="secondary" height={48} style={styles.flex} onPress={() => openOption(suggestion)} />
            {partyId && suggestion.crewVenue ? (
              <Button
                label={mine === suggestion.venueId ? i18n.t("whereTo.voted") : i18n.t("whereTo.vote")}
                height={48}
                style={styles.flex}
                onPress={() => vote(suggestion.venueId)}
              />
            ) : null}
          </View>
          <DirectionsButton lat={suggestion.lat} lng={suggestion.lng} label={suggestion.address || suggestion.name} />
        </Panel>
      ) : null}

      {conquest ? (
        <Panel>
          <Text variant="label">{i18n.t("whereTo.conquestTitle")}</Text>
          <Text variant="h3">{conquest.name}</Text>
          <Text variant="small">{i18n.t("whereTo.conquestHint")}</Text>
          <Button label={i18n.t("whereTo.see")} variant="outline" height={44} onPress={() => openOption(conquest)} />
        </Panel>
      ) : null}

      {options.length > 1 ? (
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
      {options.map(row)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 },
});
