import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { moodIcon } from "@/crew/moods";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { cancelJoinRequest, fetchOpenParties, requestToJoin, setPartyOpen, type OpenParty } from "@/server/socialData";
import { refreshVenues, useVenueData } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel, Row, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * COM-05, for the hosts (creator or crew admin): open the party at one of the crew's bars, so
 * people on that bar's page can ask to join. Each request is approved or refused in the Crew tab.
 */
export function OpenPartyPanel({ partyId }: { partyId: string }) {
  const i18n = useT();
  const party = useCrewData((state) => state.parties.find((p) => p.id === partyId));
  const venues = useVenueData((state) => (party ? state.byCrew[party.crewId]?.venues : undefined));
  const [busy, setBusy] = useState(false);
  const crewId = party?.crewId;
  useEffect(() => {
    if (crewId && !venues) void refreshVenues(crewId).catch(() => undefined);
  }, [crewId, venues]);
  // The server checks it again: this only keeps the panel away from the others.
  if (!party?.host || party.guest || party.closedAt !== null || party.endsAt < Date.now()) return null;
  const bars = (venues ?? []).filter((v) => v.kind !== "home");
  const openAt = bars.find((v) => v.id === party.openVenueId);
  const set = (venueId: string | null) => {
    setBusy(true);
    setPartyOpen(partyId, venueId)
      .then(() => {
        haptic.confirmed();
        showToast({ message: venueId ? i18n.t("crew.openPartyDone") : i18n.t("crew.openPartyClosed") });
      })
      .catch(showFailure(i18n))
      .finally(() => setBusy(false));
  };
  return (
    <Panel>
      <Text variant="h3">{i18n.t("crew.openPartyTitle")}</Text>
      <Text variant="small">{openAt ? i18n.t("crew.openPartyAt", { venue: openAt.name }) : i18n.t("crew.openPartyHint")}</Text>
      {bars.length === 0 ? <Text variant="small">{i18n.t("crew.openPartyNoVenue")}</Text> : null}
      <View style={styles.chips}>
        {bars.map((v) => (
          <Chip key={v.id} label={v.name} icon="pin" selected={v.id === party.openVenueId} onPress={() => (busy ? undefined : set(v.id === party.openVenueId ? null : v.id))} />
        ))}
      </View>
      {openAt ? <Button label={i18n.t("crew.openPartyClose")} variant="outline" height={44} loading={busy} onPress={() => set(null)} /> : null}
    </Panel>
  );
}

/** COM-05: open parties at a place, on its public page: ask to join, see where the request stands. */
export function OpenPartiesSection({ venueId }: { venueId: string }) {
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [parties, setParties] = useState<OpenParty[]>([]);
  const load = useCallback(
    () =>
      fetchOpenParties(venueId)
        .then((data) => setParties(data.parties))
        .catch(() => undefined),
    [venueId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (!parties.length) return null;
  const when = (at: number) => `${new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;
  const act = (party: OpenParty) => {
    haptic.select();
    const call = party.mine === "pending" ? cancelJoinRequest(party.id) : requestToJoin(party.id);
    void call
      .then(() => {
        if (party.mine !== "pending") showToast({ message: i18n.t("place.requestSent") });
        return load();
      })
      .catch(showFailure(i18n));
  };
  return (
    <Panel>
      <Text variant="label">{i18n.t("place.openParties")}</Text>
      {parties.map((party, index) => (
        <Row
          key={party.id}
          title={party.name || i18n.t(`newParty.moods.${party.mood}`)}
          subtitle={`${when(party.startsAt)}, ${i18n.t("place.hostedBy", { name: party.host })}, ${i18n.plural("place.going", party.going)}`}
          leading={<Icon name={moodIcon(party.mood)} color={theme.amber} />}
          trailing={
            party.mine === "member" || party.mine === "approved" ? (
              <Tag label={i18n.t("place.requestApproved")} tone="ok" />
            ) : party.mine === "refused" ? (
              <Tag label={i18n.t("place.requestRefused")} />
            ) : (
              <Button
                label={party.mine === "pending" ? i18n.t("place.requestCancel") : i18n.t("place.askToJoin")}
                variant={party.mine === "pending" ? "outline" : "secondary"}
                height={40}
                onPress={() => act(party)}
              />
            )
          }
          onPress={party.mine === "member" || party.mine === "approved" ? () => router.push({ pathname: "/live", params: { id: party.id } }) : undefined}
          last={index === parties.length - 1}
        />
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
