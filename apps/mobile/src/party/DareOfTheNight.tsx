import { useEffect } from "react";
import { contentFor } from "@crew/games";
import { nightKey } from "@crew/units";
import { refreshCrewCards, useCrewCards } from "@/games/crewCards";
import { deckLanguage } from "@/games/i18n";
import { useT } from "@/i18n";
import { useLiveParty } from "@/server/crewData";
import { useAppStore } from "@/state/store";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** Same night, same dare: a stable pick from the night's date, so the whole crew sees one. */
function pick<T>(items: readonly T[], seed: string): T | undefined {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return items[hash % Math.max(1, items.length)];
}

/** Cards naming {player} or {other} need the game to fill them in: left out here. */
const standalone = (text: string) => !text.includes("{");

/**
 * JOY-12: a light dare on the Party screen during a party, Normal level only. The crew's own
 * approved dares come first when it has some (N-33); the app's deck otherwise.
 */
export function DareOfTheNight({ now }: { now: number }) {
  const i18n = useT();
  const live = useLiveParty();
  const boundary = useAppStore((state) => state.preferences.dayBoundaryHour);
  const crewId = live?.party.crewId;
  const cards = useCrewCards((state) => (crewId ? state.byCrew[crewId] : undefined));
  useEffect(() => {
    if (crewId) void refreshCrewCards(crewId).catch(() => undefined);
  }, [crewId]);
  if (!live) return null;
  const own = (cards ?? []).filter((c) => c.status === "approved" && c.kind === "dare" && c.level === "normal" && standalone(c.text)).map((c) => c.text);
  const dares = own.length ? own : contentFor(deckLanguage(i18n.language)).truthDare.dare.normal.filter(standalone);
  const night = nightKey(now, -new Date(now).getTimezoneOffset(), boundary);
  const dare = pick(dares, `${live.party.id}:${night}`);
  if (!dare) return null;
  return (
    <Panel>
      <Text variant="label">{i18n.t("party.dareTitle")}</Text>
      <Text variant="h3">{dare}</Text>
      <Text variant="small">{own.length ? i18n.t("party.dareCrewHint") : i18n.t("party.dareHint")}</Text>
    </Panel>
  );
}
