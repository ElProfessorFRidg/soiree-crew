import { router } from "expo-router";
import { useEffect } from "react";
import { useT } from "@/i18n";
import { useCrewData, type Crew } from "@/server/crewData";
import { refreshVenues, useVenueData } from "@/server/venueData";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** At this many members in one bar with no party running, the app offers to start one there. */
const GATHERING = 3;
/** One shared empty list: a fresh [] in a selector re-renders forever before the venues arrive. */
const NO_VENUES: never[] = [];

/** QOL-17: a suggestion that saves taps, never an action taken for the crew. */
export function StartHereBanner({ crew }: { crew: Crew }) {
  const i18n = useT();
  const venues = useVenueData((state) => state.byCrew[crew.id]?.venues ?? NO_VENUES);
  const live = useCrewData((state) => {
    const now = Date.now();
    return state.parties.some((p) => p.crewId === crew.id && p.closedAt === null && p.startsAt <= now && p.endsAt >= now);
  });
  useEffect(() => {
    void refreshVenues(crew.id).catch(() => undefined);
  }, [crew.id]);
  const spot = venues.filter((v) => v.kind !== "home" && v.hereNow >= GATHERING).sort((a, b) => b.hereNow - a.hereNow)[0];
  if (live || !spot) return null;
  return (
    <Panel tint="amber">
      <Text variant="h3">{i18n.t("suggest.title", { count: spot.hereNow })}</Text>
      <Text>{i18n.t("suggest.body", { venue: spot.name })}</Text>
      <Button
        label={i18n.t("suggest.start")}
        icon="glass"
        height={48}
        onPress={() => router.push({ pathname: "/new-party", params: { crewId: crew.id, name: spot.name } })}
      />
    </Panel>
  );
}
