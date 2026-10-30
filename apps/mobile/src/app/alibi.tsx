import { useLocalSearchParams } from "expo-router";
import { useCrewLabels } from "@/crew/names";
import { useT } from "@/i18n";
import { Alibi } from "@/recap/Alibi";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import { Screen } from "@/ui/Screen";

/**
 * O-76: the alibi generator on its own screen, reachable from the Bar and the Me tab as well as the
 * morning after. Someone from the last night out (or from the crew) stars in it when possible.
 */
export default function AlibiScreen() {
  const { partyId } = useLocalSearchParams<{ partyId?: string }>();
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const parties = useCrewData((state) => state.parties);
  const crews = useCrewData((state) => state.crews);
  const now = Date.now();
  // The night asked for, else the last one I went to that has started.
  const party =
    parties.find((p) => p.id === partyId) ??
    [...parties].filter((p) => p.myResponse === "going" && p.startsAt <= now).sort((a, b) => b.startsAt - a.startsAt)[0];
  const crewId = party?.crewId ?? crews[0]?.id;
  const labels = useCrewLabels(crewId);
  const live = useCrewData((state) => (party ? state.live[party.id] : undefined));
  const going = live?.members.filter((m) => m.response === "going" && m.userId !== me).map((m) => labels.get(m.userId) ?? m.displayName);
  const names = going?.length ? going : [...labels.entries()].filter(([id]) => id !== me).map(([, label]) => label);

  return (
    <Screen back title={i18n.t("morning.alibi")}>
      <Alibi names={names} />
    </Screen>
  );
}
