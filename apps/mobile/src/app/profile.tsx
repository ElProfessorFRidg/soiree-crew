import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { drinkLabel } from "@/drinks/display";
import type { DrinkKind } from "@/drinks/presets";
import { useT } from "@/i18n";
import { HeroTarget } from "@/motion/hero";
import { loyaltyTier } from "@/crew/loyalty";
import { haptic } from "@/motion/haptics";
import { ReportPanel } from "@/moderation/ReportPanel";
import { befriend, block, fetchProfile, mute, unfriend, unmute, type ProfileView } from "@/server/profileData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Segmented, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { SkeletonRows } from "@/ui/Skeleton";
import { formatClock } from "@/i18n/format";
import { MemberCard } from "@/profile/MemberCard";

type ViewAs = "me" | "stranger" | "friend" | "crew";

/** O-39, PROF-02, PROF-07: a profile as the server lets the viewer see it. */
export default function ProfileScreen() {
  const params = useLocalSearchParams<{ id?: string; as?: ViewAs }>();
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const id = !params.id || params.id === "me" ? "me" : params.id;
  const mine = id === "me" || id === me;
  const [viewAs, setViewAs] = useState<ViewAs>(mine && params.as ? params.as : "me");
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [gone, setGone] = useState(false);
  const offline = () => showToast({ tone: "danger", message: i18n.t("crew.offline") });

  const load = useCallback(() => {
    void fetchProfile(mine ? "me" : id, mine && viewAs !== "me" ? viewAs : undefined)
      .then(setProfile)
      .catch(() => setGone(true));
  }, [id, mine, viewAs]);
  useEffect(load, [load]);

  if (gone) {
    return (
      <Screen back>
        <Text>{i18n.t("people.nothing")}</Text>
      </Screen>
    );
  }
  if (!profile)
    return (
      <Screen back>
        <SkeletonRows rows={3} />
      </Screen>
    );

  const s = profile.sections;
  const name = s.identity?.displayName ?? "";
  const ratio = breathRatio(countryRules(preferences.legalCountry));
  const date = (at: number) => new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(at));
  const titleLabel = (t: NonNullable<typeof s.titles>[number]) => (t.kind === "mayor" ? i18n.t("ranking.mayor", { venue: t.venueName ?? "" }) : i18n.t(`ranking.${t.kind}`));
  const empty = Object.keys(s).length === 0;
  const whenLong = (at: number) => `${new Intl.DateTimeFormat(i18n.locale, { weekday: "long" }).format(new Date(at))} ${formatClock(at, i18n.language, preferences.hourCycle)}`;

  const friendButton = () => {
    if (mine) return null;
    const label =
      profile.friendship === "friends"
        ? i18n.t("people.removeFriend")
        : profile.friendship === "requested"
          ? i18n.t("people.requested")
          : profile.friendship === "incoming"
            ? i18n.t("people.accept")
            : i18n.t("people.addFriend");
    return (
      <Button
        label={label}
        icon={profile.friendship === "friends" ? undefined : "plus"}
        variant={profile.friendship === "friends" || profile.friendship === "requested" ? "outline" : "primary"}
        height={52}
        disabled={profile.friendship === "requested"}
        onPress={() => {
          haptic.select();
          const call = profile.friendship === "friends" ? unfriend(profile.userId) : befriend(profile.userId);
          void call.then(load).catch(offline);
        }}
      />
    );
  };

  return (
    <Screen back withToasts>
      <View style={styles.head}>
        <HeroTarget heroKey={`avatar:${profile.userId}`}>
          <Avatar personId={profile.userId} name={name || "?"} size={72} />
        </HeroTarget>
        <View style={styles.flex}>
          {name ? <Text variant="h1">{name}</Text> : null}
          {s.identity ? <Text variant="small">@{s.identity.username}</Text> : null}
          {profile.mutualFriends ? <Text variant="small">{i18n.plural("people.mutual", profile.mutualFriends)}</Text> : null}
          <View style={styles.tags}>
            {profile.relation.friend ? <Tag label={i18n.t("people.friends")} tone="ok" /> : null}
            {profile.cheat ? <Tag label={i18n.t("people.cheatTag")} tone="danger" icon="alert" /> : null}
          </View>
        </View>
      </View>
      {profile.cheat ? (
        <Panel tint="danger">
          <Text variant="small">
            {i18n.t("people.cheatLine", { venue: profile.cheat.venue, date: whenLong(profile.cheat.at) })}
            {profile.cheat.count > 1 ? ` ${i18n.plural("people.cheatRepeat", profile.cheat.count)}` : ""}
          </Text>
        </Panel>
      ) : null}
      {s.identity?.bio ? <Text>{s.identity.bio}</Text> : null}
      {s.identity?.country ? <Text variant="small">{s.identity.country}</Text> : null}

      {mine ? (
        <>
          <Text variant="label">{i18n.t("people.viewAs")}</Text>
          <Segmented<ViewAs>
            accessibilityLabel={i18n.t("people.viewAs")}
            value={viewAs}
            onChange={setViewAs}
            items={[
              { value: "me", label: i18n.t("people.asMe") },
              { value: "stranger", label: i18n.t("people.asStranger") },
              { value: "friend", label: i18n.t("people.asFriend") },
              { value: "crew", label: i18n.t("people.asCrew") },
            ]}
          />
          <Button label={i18n.t("people.edit")} icon="edit" variant="secondary" height={48} onPress={() => router.push("/edit-profile")} />
          <Button label={i18n.t("privacySummary.open")} icon="eye" variant="outline" height={48} onPress={() => router.push("/privacy-summary")} />
        </>
      ) : (
        friendButton()
      )}

      {empty ? <Text variant="small">{i18n.t("people.nothing")}</Text> : null}

      {s.crews?.length ? (
        <Panel>
          <Text variant="label">{i18n.t("people.crews")}</Text>
          {s.crews.map((crew) => (
            <Text key={crew.name}>
              {crew.name}, {i18n.plural("crew.members", crew.members)}
            </Text>
          ))}
        </Panel>
      ) : null}

      {s.titles?.length ? (
        <Panel>
          <Text variant="label">{i18n.t("people.titles")}</Text>
          <View style={styles.tags}>
            {s.titles.map((t, i) => (
              <Tag key={`${t.kind}-${i}`} label={titleLabel(t)} tone={t.kind === "mayor" ? "amber" : "neutral"} icon={t.kind === "mayor" ? "crown" : undefined} />
            ))}
          </View>
        </Panel>
      ) : null}

      {s.venues?.length ? (
        <Panel>
          <Text variant="label">{i18n.t("people.venues")}</Text>
          {s.venues.map((v) => (
            <View key={v.venueId} style={styles.venue}>
              <View style={styles.flex}>
                <Text variant="h3">{v.name}</Text>
                <Text variant="small">
                  {i18n.plural("people.visits", v.visits)}
                  {v.lastAt ? `, ${i18n.t("people.lastVisit", { date: date(v.lastAt) })}` : ""}
                </Text>
              </View>
              {v.nights && loyaltyTier(v.nights) ? <Tag label={i18n.t(`loyalty.${loyaltyTier(v.nights)!}`)} icon="star" /> : null}
              {v.ruled ? <Tag label={i18n.t("people.ruled")} tone="amber" icon="crown" /> : null}
              {v.hidden ? <Tag label={i18n.t("people.hiddenTag")} /> : null}
            </View>
          ))}
        </Panel>
      ) : null}

      {s.drinks ? (
        <Panel>
          <Text variant="label">{i18n.t("people.drinks")}</Text>
          <Text>{i18n.plural("people.drinksTotal", s.drinks.total)}</Text>
          {s.drinks.favourites.length ? (
            <Text variant="small">
              {i18n.t("people.favourites", { list: s.drinks.favourites.map((f) => drinkLabel({ kind: f.kind as DrinkKind }, i18n)).join(", ") })}
            </Text>
          ) : null}
          {s.drinks.usualFirstDrink !== null ? (
            <Text variant="small">
              {i18n.t("people.usualFirst", { time: formatClock(new Date(2026, 0, 1, 12, s.drinks.usualFirstDrink).getTime(), i18n.language, preferences.hourCycle) })}
            </Text>
          ) : null}
          {s.drinks.usualPacePerHour !== null ? <Text variant="small">{i18n.t("people.usualPace", { value: i18n.number(s.drinks.usualPacePerHour, 1) })}</Text> : null}
        </Panel>
      ) : null}

      {s.nights ? (
        <Panel>
          <Text variant="label">{i18n.t("people.nights")}</Text>
          <Text>
            {i18n.plural("people.nightsTotal", s.nights.total)}, {i18n.plural("people.nightsRecent", s.nights.last30Days)}
          </Text>
        </Panel>
      ) : null}

      {s.records ? (
        // PROF-06: plain text, no colour, no animation, no badge.
        <Panel>
          <Text variant="label">{i18n.t("people.records")}</Text>
          {s.records.highestBac !== null ? (
            <Text>
              {i18n.t("people.highestBac", { value: `${formatBacValue(s.records.highestBac, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}` })}
            </Text>
          ) : null}
          <Text>{i18n.plural("people.biggestNight", s.records.biggestNight)}</Text>
        </Panel>
      ) : null}

      {mine && viewAs === "me" ? <MemberCard /> : null}
      {mine ? <Text variant="small">{i18n.t("people.neverStrangers")}</Text> : null}

      {!mine ? (
        <Button
          label={profile.muted ? i18n.t("people.unmute") : i18n.t("people.mute")}
          variant="outline"
          height={44}
          onPress={() => void (profile.muted ? unmute(profile.userId) : mute(profile.userId)).then(load).catch(offline)}
        />
      ) : null}
      {!mine ? <ReportPanel targetKind="profile" targetId={profile.userId} /> : null}
      {!mine ? (
        <Button
          label={i18n.t("people.block")}
          variant="outline"
          height={44}
          onPress={() =>
            Alert.alert(i18n.t("people.blockConfirm", { name }), undefined, [
              { text: i18n.t("people.blockKeep"), style: "cancel" },
              {
                text: i18n.t("people.block"),
                style: "destructive",
                onPress: () =>
                  void block(profile.userId)
                    .then(() => {
                      showToast({ message: i18n.t("people.blocked", { name }) });
                      router.back();
                    })
                    .catch(offline),
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 16 },
  flex: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  venue: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
});
