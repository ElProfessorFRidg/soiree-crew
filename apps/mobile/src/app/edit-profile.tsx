import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { haptic } from "@/motion/haptics";
import { fetchProfile, PROFILE_SECTIONS, saveProfile, type Audience, type Findable, type ProfileSection, type ProfileView } from "@/server/profileData";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented, Switch } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

const AUDIENCES: Audience[] = ["me", "crews", "friends", "everyone"];

/** PROF-01, PROF-03: presets, an audience per section, and venues hidden one by one. */
export default function EditProfileScreen() {
  const i18n = useT();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const offline = showFailure(i18n);

  useEffect(() => {
    void fetchProfile("me")
      .then((data) => {
        setProfile(data);
        setBio(data.sections.identity?.bio ?? "");
        setCountry(data.sections.identity?.country ?? "");
      })
      .catch(offline);
    // offline only shows a toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile?.audiences) return <Screen back title={i18n.t("people.edit")}>{null}</Screen>;
  const audiences = profile.audiences;
  const venues = profile.sections.venues ?? [];
  const hidden = venues.filter((v) => v.hidden).map((v) => v.venueId);

  const apply = (input: Parameters<typeof saveProfile>[0]) => {
    haptic.select();
    void saveProfile(input)
      .then((res) => {
        setProfile((p) => (p ? { ...p, audiences: res.audiences } : p));
        // PROF-10: the first time anything opens to everyone, show what strangers now see.
        if (Object.values(res.audiences).includes("everyone") && !useAppStore.getState().privacySummarySeen) {
          useAppStore.setState({ privacySummarySeen: true });
          router.push("/privacy-summary");
        }
      })
      .catch(offline);
  };
  const audienceLabel = (a: Audience) =>
    a === "me" ? i18n.t("people.audienceMe") : a === "crews" ? i18n.t("people.audienceCrews") : a === "friends" ? i18n.t("people.audienceFriends") : i18n.t("people.audienceEveryone");

  return (
    <Screen back title={i18n.t("people.edit")} withToasts>
      <Field label={i18n.t("people.bio")} placeholder={i18n.t("people.bioPlaceholder")} value={bio} onChangeText={setBio} maxLength={160} multiline />
      <Field label={i18n.t("people.country")} placeholder={i18n.t("people.countryPlaceholder")} value={country} onChangeText={setCountry} maxLength={60} />
      <Button
        label={i18n.t("common.save")}
        variant="secondary"
        height={48}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void saveProfile({ bio: bio.trim(), country: country.trim() })
            .then(() => showToast({ message: i18n.t("common.saved") }))
            .catch(offline)
            .finally(() => setBusy(false));
        }}
      />

      <Text variant="label">{i18n.t("people.presets")}</Text>
      <View style={styles.chips}>
        <Chip label={i18n.t("people.presetPrivate")} onPress={() => apply({ preset: "private" })} />
        <Chip label={i18n.t("people.presetFriends")} onPress={() => apply({ preset: "friends" })} />
        <Chip label={i18n.t("people.presetPublic")} onPress={() => apply({ preset: "public" })} />
      </View>

      <Text variant="label">{i18n.t("people.audiences")}</Text>
      {PROFILE_SECTIONS.map((section: ProfileSection) => (
        <View key={section} style={styles.section}>
          <Text variant="h3">{i18n.t(`people.section.${section}`)}</Text>
          <Segmented<Audience>
            accessibilityLabel={i18n.t(`people.section.${section}`)}
            value={audiences[section]}
            items={AUDIENCES.map((a) => ({ value: a, label: audienceLabel(a) }))}
            onChange={(a) => apply({ audiences: { [section]: a } })}
          />
        </View>
      ))}
      <Text variant="small">{i18n.t("people.neverStrangers")}</Text>

      <Text variant="label">{i18n.t("people.findable")}</Text>
      <Segmented<Findable>
        accessibilityLabel={i18n.t("people.findable")}
        value={profile.findable ?? "username"}
        items={[
          { value: "search", label: i18n.t("people.findableSearch") },
          { value: "username", label: i18n.t("people.findableUsername") },
          { value: "nobody", label: i18n.t("people.findableNobody") },
        ]}
        onChange={(findable) => {
          setProfile((p) => (p ? { ...p, findable } : p));
          apply({ findable });
        }}
      />
      <Text variant="small">{i18n.t("people.findableHint")}</Text>

      <Text variant="label">{i18n.t("people.meeting")}</Text>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text>{i18n.t("people.regularOptIn")}</Text>
          <Text variant="small">{i18n.t("people.regularOptInHint")}</Text>
        </View>
        <Switch
          value={profile.regularOptIn ?? false}
          accessibilityLabel={i18n.t("people.regularOptIn")}
          onValueChange={(on) => {
            setProfile((p) => (p ? { ...p, regularOptIn: on } : p));
            apply({ regularOptIn: on });
          }}
        />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text>{i18n.t("people.openToMeet")}</Text>
          <Text variant="small">{i18n.t("people.openToMeetHint")}</Text>
        </View>
        <Switch
          value={profile.openToMeet ?? false}
          accessibilityLabel={i18n.t("people.openToMeet")}
          onValueChange={(on) => {
            setProfile((p) => (p ? { ...p, openToMeet: on } : p));
            apply({ openToMeet: on });
          }}
        />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text>{i18n.t("people.inStories")}</Text>
          <Text variant="small">{i18n.t("people.inStoriesHint")}</Text>
        </View>
        <Switch
          value={!(profile.storyOptOut ?? false)}
          accessibilityLabel={i18n.t("people.inStories")}
          onValueChange={(on) => {
            setProfile((p) => (p ? { ...p, storyOptOut: !on } : p));
            apply({ storyOptOut: !on });
          }}
        />
      </View>
      <Text variant="small">{i18n.t("people.requestsFrom")}</Text>
      <Segmented<"nobody" | "friendsOfFriends" | "everyone">
        accessibilityLabel={i18n.t("people.requestsFrom")}
        value={profile.requestsFrom ?? "everyone"}
        items={[
          { value: "everyone", label: i18n.t("people.requestsEveryone") },
          { value: "friendsOfFriends", label: i18n.t("people.requestsFof") },
          { value: "nobody", label: i18n.t("people.requestsNobody") },
        ]}
        onChange={(requestsFrom) => {
          setProfile((p) => (p ? { ...p, requestsFrom } : p));
          apply({ requestsFrom });
        }}
      />

      {venues.length ? (
        <Panel>
          <Text variant="label">{i18n.t("people.venues")}</Text>
          {venues.map((v) => (
            <View key={v.venueId} style={styles.switchRow}>
              <Text style={styles.flex}>{v.name}</Text>
              <Switch
                value={!!v.hidden}
                accessibilityLabel={`${i18n.t("people.hideVenue")}, ${v.name}`}
                onValueChange={(on) => {
                  const next = on ? [...hidden, v.venueId] : hidden.filter((h) => h !== v.venueId);
                  setProfile((p) =>
                    p ? { ...p, sections: { ...p.sections, venues: venues.map((x) => (x.venueId === v.venueId ? { ...x, hidden: on } : x)) } } : p,
                  );
                  apply({ hiddenVenues: next });
                }}
              />
            </View>
          ))}
          <Text variant="small">{i18n.t("people.hideVenue")}</Text>
        </Panel>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  section: { gap: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  flex: { flex: 1 },
});
