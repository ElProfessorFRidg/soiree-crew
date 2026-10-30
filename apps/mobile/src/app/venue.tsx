import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { formatMoney } from "@crew/money";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import {
  confirmCheckIn,
  fetchVenuePage,
  fetchVenuePhotos,
  overturnCheckIn,
  refreshVenues,
  saveVenueHours,
  setCrewParticipation,
  updateVenue,
  type VenuePage,
  type VenuePhoto,
} from "@/server/venueData";
import { Copyable } from "@/ui/Copyable";
import { ScalePressable } from "@/ui/Pressable";
import { DirectionsButton } from "@/venues/DirectionsButton";
import type { WeekSchedule } from "@/venues/hours";
import { HoursPanel, OpenTags } from "@/venues/HoursPanel";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Switch, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { ReportPanel } from "@/moderation/ReportPanel";
import { WorkplacePanel } from "@/crew/WorkplacePanel";
import { fetchVenueStats, type VenueStats } from "@/server/statsData";
import { VenuePrices } from "@/crew/VenuePrices";
import { loyaltyTier, nextTier } from "@/crew/loyalty";
import { showFailure } from "@/server/errors";

/** N-12: what this bar is to the crew. */
function VenueNumbers({ venueId }: { venueId: string }) {
  const i18n = useT();
  const [stats, setStats] = useState<VenueStats | null>(null);
  useEffect(() => {
    void fetchVenueStats(venueId).then(setStats).catch(() => undefined);
  }, [venueId]);
  if (!stats || stats.visits === 0) return null;
  const date = (night: string) => new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(`${night}T12:00:00`));
  return (
    <Panel>
      <Text variant="label">{i18n.t("crewStats.venueTitle")}</Text>
      <Text>
        {[i18n.plural("crewStats.venueVisits", stats.visits), i18n.plural("crewStats.venueNights", stats.nights), i18n.plural("crewStats.venuePeople", stats.people)].join(", ")}
      </Text>
      {stats.averageDrinks !== null ? <Text variant="small">{i18n.t("crewStats.venueAverage", { value: i18n.number(stats.averageDrinks, 1) })}</Text> : null}
      {stats.averageSpend ? (
        <Text variant="small">{i18n.t("crewStats.venueSpend", { amount: formatMoney(stats.averageSpend.amount, stats.averageSpend.currency, i18n.locale) })}</Text>
      ) : null}
      {stats.bestNights.length ? <Text variant="label">{i18n.t("crewStats.bestNights")}</Text> : null}
      {stats.bestNights.map((n) => (
        <Text key={n.night} variant="small">
          {i18n.plural("crewStats.bestNight", n.people, { date: date(n.night) })}
        </Text>
      ))}
    </Panel>
  );
}

/** N-08, QOL-19: the address, copyable; one can be typed for a venue added without it. */
function AddressRow({ venueId, address, onSaved }: { venueId: string; address: string; onSaved: () => void }) {
  const i18n = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (address && !editing) return <Copyable value={address} label={i18n.t("venue.address")} />;
  if (!editing) return <Button label={i18n.t("venue.addAddress")} icon="edit" variant="outline" height={44} onPress={() => setEditing(true)} />;
  return (
    <View style={styles.address}>
      <Field label={i18n.t("venue.address")} placeholder={i18n.t("addVenue.addressPlaceholder")} value={text} onChangeText={setText} maxLength={120} autoFocus />
      <Button
        label={i18n.t("common.save")}
        height={44}
        loading={busy}
        disabled={!text.trim()}
        onPress={() => {
          setBusy(true);
          void updateVenue(venueId, { address: text.trim() })
            .then(() => {
              haptic.confirmed();
              setEditing(false);
              onSaved();
            })
            .catch(showFailure(i18n))
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

/** TER-05: album photos of our nights here; the server only returns those I was going to. */
function VenuePhotos({ venueId }: { venueId: string }) {
  const i18n = useT();
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  useEffect(() => {
    void fetchVenuePhotos(venueId)
      .then((res) => setPhotos(res.photos))
      .catch(() => undefined);
  }, [venueId]);
  if (!photos.length) return null;
  return (
    <View>
      <Text variant="label">{i18n.t("venue.photos")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {photos.map((p) => (
          <ScalePressable
            key={p.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={i18n.t("venue.photoA11y", { date: new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(p.at)) })}
            onPress={() => router.push({ pathname: "/album", params: { partyId: p.partyId } })}
          >
            <Image source={{ uri: p.url }} style={styles.photo} />
          </ScalePressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function VenueScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((state) => state.session?.userId);
  const crews = useCrewData((state) => state.crews);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [page, setPage] = useState<VenuePage | null>(null);
  const territoryOut = crews.find((c) => c.id === page?.venue.crewId)?.me.territoryOptOut ?? false;

  const load = useCallback(() => {
    if (!id) return;
    void fetchVenuePage(id)
      .then(setPage)
      .catch(showFailure(i18n));
  }, [id, i18n]);
  useEffect(load, [load]);

  if (!page) return <Screen back withToasts>{null}</Screen>;
  const isAdmin = crews.find((c) => c.id === page.venue.crewId)?.role === "admin";
  const myChallenger = page.bossId === me ? page.challengers[0] : undefined;
  const bossPoints = page.top[0]?.points ?? 0;

  return (
    <Screen back title={page.venue.name} withToasts>
      <Text variant="small">{i18n.t("venue.season", { season: page.season })}</Text>
      {page.venue.isHq || page.facts ? (
        <View style={styles.tags}>
          {page.venue.isHq ? <Tag tone="amber" icon="home" label={i18n.t("venue.hq")} /> : null}
          {page.facts ? <OpenTags openNow={page.facts.openNow} happyNow={page.facts.happyNow} /> : null}
        </View>
      ) : null}
      <AddressRow venueId={page.venue.id} address={page.venue.address} onSaved={load} />
      {page.variant && page.variant !== "none" ? <Tag tone="amber" label={i18n.t(`venue.variant.${page.variant}`)} /> : null}
      {page.validated === false ? (
        <Panel tint="amber">
          <Text variant="small">{i18n.t("venue.notValidated")}</Text>
        </Panel>
      ) : null}

      {myChallenger ? (
        <Panel tint="amber">
          <Text variant="h3">{i18n.plural("venue.challenger", bossPoints - myChallenger.points, { name: myChallenger.name, venue: page.venue.name })}</Text>
        </Panel>
      ) : null}

      <View>
        <Text variant="label">{i18n.t("venue.top")}</Text>
        {page.top.length === 0 ? <Text>{i18n.t("bars.noBoss")}</Text> : null}
        {page.top.map((row, index) => (
          <Row
            key={row.userId}
            title={row.userId === me ? `${row.name} (${i18n.t("crew.you")})` : row.name}
            subtitle={i18n.plural("venue.nights", row.nights)}
            leading={
              <View style={styles.rank}>
                {row.userId === page.bossId ? <Icon name="crown" size={18} color={theme.amber} /> : <Text variant="h3">{index + 1}</Text>}
                <Avatar personId={row.userId} name={row.name} size={34} />
              </View>
            }
            trailing={<Numeral size={26}>{i18n.t("venue.pointsShort", { count: row.points })}</Numeral>}
            last={index === page.top.length - 1}
          />
        ))}
      </View>

      {page.venue.kind !== "home" ? (
        <Button label={i18n.t("place.open")} icon="eye" variant="outline" height={48} onPress={() => router.push({ pathname: "/place", params: { venueId: page.venue.id } })} />
      ) : null}
      <Button
        label={i18n.t("bars.checkIn")}
        icon="pin"
        height={56}
        onPress={() => router.push({ pathname: "/checkin", params: { venueId: page.venue.id, crewId: page.venue.crewId } })}
      />
      <DirectionsButton lat={page.venue.lat} lng={page.venue.lng} label={page.venue.address || page.venue.name} />
      {page.facts ? (
        <HoursPanel
          facts={page.facts}
          {...(page.facts.canEdit ? { onSave: (schedule: WeekSchedule) => saveVenueHours(page.venue.id, schedule).then(load) } : {})}
        />
      ) : null}

      {typeof page.myNights === "number" && page.myNights > 0 ? (
        <View style={styles.cheat}>
          {loyaltyTier(page.myNights) ? <Tag label={i18n.t(`loyalty.${loyaltyTier(page.myNights)!}`)} tone="amber" icon="star" /> : null}
          <Text variant="small" style={styles.flex}>
            {nextTier(page.myNights)
              ? i18n.plural("loyalty.next", nextTier(page.myNights)!.missing, { tier: i18n.t(`loyalty.short.${nextTier(page.myNights)!.tier}`) })
              : i18n.t("loyalty.top")}
          </Text>
        </View>
      ) : null}

      {page.rivalry ? (
        <Panel tint={page.rivalry.myRank === 1 ? "amber" : undefined}>
          <Text variant="label">{i18n.t("venue.rivalryTitle")}</Text>
          <Text variant="h3">{i18n.t("venue.rivalryRank", { rank: page.rivalry.myRank, crews: page.rivalry.crews })}</Text>
          <Text variant="small">
            {page.rivalry.myRank === 1
              ? i18n.t("venue.rivalryLead", { points: page.rivalry.myPoints })
              : i18n.t("venue.rivalryBehind", { gap: page.rivalry.leaderPoints - page.rivalry.myPoints })}
          </Text>
        </Panel>
      ) : null}

      {page.toConfirm?.length ? (
        <Panel>
          <Text variant="label">{i18n.t("venue.toConfirm")}</Text>
          <Text variant="small">{i18n.t("venue.toConfirmHint")}</Text>
          {page.toConfirm.map((c) => (
            <View key={c.id} style={styles.cheat}>
              <Avatar personId={c.userId} name={c.name} size={32} />
              <Text style={styles.flex}>{c.name}</Text>
              <Button
                label={i18n.t("venue.confirmHere")}
                accessibilityLabel={i18n.t("venue.confirmHereA11y", { name: c.name })}
                height={44}
                onPress={() =>
                  void confirmCheckIn(c.id)
                    .then(() => {
                      haptic.confirmed();
                      showToast({ message: i18n.t("venue.confirmedHere", { name: c.name }) });
                      load();
                    })
                    .catch(showFailure(i18n))
                }
              />
            </View>
          ))}
        </Panel>
      ) : null}

      {page.pastMayors.length ? (
        <View>
          <Text variant="label">{i18n.t("venue.pastMayors")}</Text>
          {page.pastMayors.map((mayor, index) => (
            <Row key={mayor.season} title={mayor.name} subtitle={mayor.season} leading={<Icon name="crown" color={theme.textMuted} />} last={index === page.pastMayors.length - 1} />
          ))}
        </View>
      ) : null}

      {page.latestNights.length ? (
        <View>
          <Text variant="label">{i18n.t("venue.latestNights")}</Text>
          {page.latestNights.map((night, index) => (
            <Row
              key={night.partyId}
              title={night.name}
              subtitle={`${new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(night.startsAt))}, ${formatClock(night.startsAt, i18n.language, hourCycle)}`}
              trailing={<Text variant="small">{i18n.plural("crew.members", night.members)}</Text>}
              last={index === page.latestNights.length - 1}
            />
          ))}
        </View>
      ) : null}

      {page.cheatAttempts.length ? (
        <Panel>
          <Text variant="label">{i18n.t("venue.cheats")}</Text>
          {page.cheatAttempts.map((attempt) => (
            <View key={attempt.id} style={styles.cheat}>
              <Text style={styles.flex}>{attempt.name}</Text>
              {attempt.overturned ? (
                <Tag label={i18n.t("venue.overturned")} tone="ok" />
              ) : isAdmin ? (
                <Button
                  label={i18n.t("venue.overturn")}
                  variant="secondary"
                  height={40}
                  onPress={() => void overturnCheckIn(attempt.id).then(load).catch(() => undefined)}
                />
              ) : (
                <Tag label={i18n.t("checkin.rejected")} tone="danger" />
              )}
            </View>
          ))}
        </Panel>
      ) : null}

      <Panel>
        {page.canSetHq ? (
          <View style={styles.switchRow}>
            <Text style={styles.flex}>{i18n.t("venue.hqSwitch")}</Text>
            <Switch
              value={page.venue.isHq ?? false}
              onValueChange={(on) => {
                haptic.select();
                void updateVenue(page.venue.id, { isHq: on })
                  .then(() => {
                    load();
                    void refreshVenues(page.venue.crewId).catch(() => undefined);
                  })
                  .catch(showFailure(i18n));
              }}
              accessibilityLabel={i18n.t("venue.hqSwitch")}
            />
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={styles.flex}>{i18n.t("venue.territoryOut")}</Text>
          <Switch
            value={territoryOut}
            onValueChange={(on) => {
              haptic.select();
              void setCrewParticipation(page.venue.crewId, { territoryOptOut: on }).then(load).catch(() => undefined);
            }}
            accessibilityLabel={i18n.t("venue.territoryOut")}
          />
        </View>
        <WorkplacePanel venueId={page.venue.id} onChanged={load} />
      </Panel>
      <VenueNumbers venueId={page.venue.id} />
      <VenuePhotos venueId={page.venue.id} />
      <VenuePrices venueId={page.venue.id} />
      <ReportPanel targetKind="venue" targetId={page.venue.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  photos: { gap: 8 },
  photo: { width: 112, height: 112, borderRadius: radius.tile },
  address: { gap: 8 },
  rank:{ flexDirection: "row", alignItems: "center", gap: 8, width: 64 },
  cheat: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  flex: { flex: 1 },
});
