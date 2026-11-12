import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { breathRatio, countryRules, drivingLimit, formatBacValue } from "@crew/units";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { RegionRules } from "@/profile/RegionRules";
import { VisibilityPicker } from "@/profile/VisibilityPicker";
import { showFailure } from "@/server/errors";
import { saveProfile } from "@/server/profileData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { findableFor, VISIBILITY_ITEMS, type Audience, type VisibilityKey } from "./visibility";

// PREF-02, PROF-01, PROF-02: the region summary, the five visibility screens and the closing card.

/** PREF-02: what was read from the phone, as a summary the person can correct on the spot. */
export function RegionStep() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const [editing, setEditing] = useState(false);
  const rules = countryRules(preferences.legalCountry);
  const limit = `${formatBacValue(drivingLimit(rules, preferences.driverCategory), preferences.bacUnit, breathRatio(rules), i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  return (
    <>
      <Text variant="h1">{i18n.t("journey.regionTitle")}</Text>
      <Text muted>{i18n.t("journey.regionWhy")}</Text>
      <Panel>
        <Row title={i18n.t("journey.regionCountry")} subtitle={i18n.t(`countries.${preferences.legalCountry}` as "countries.FR")} leading={<Icon name="flag" color={theme.textMuted} />} />
        <Row title={i18n.t("journey.regionLanguage")} subtitle={i18n.t(`languages.${preferences.language}`)} leading={<Icon name="chat" color={theme.textMuted} />} />
        <Row title={i18n.t("journey.regionLimit")} subtitle={limit} leading={<Icon name="car" color={theme.textMuted} />} />
        <Row title={i18n.t("journey.regionCurrency")} subtitle={preferences.currency} leading={<Icon name="euro" color={theme.textMuted} />} last />
      </Panel>
      <Button
        label={editing ? i18n.t("journey.regionClose") : i18n.t("journey.regionChange")}
        variant="outline"
        icon={editing ? "x" : "edit"}
        height={48}
        onPress={() => {
          haptic.select();
          setEditing(!editing);
        }}
      />
      {editing ? <RegionRules /> : null}
    </>
  );
}

/**
 * One visibility screen. The choice is kept in the draft and sent to the server as soon as it is
 * tapped, so a closed app has already stored it. The server enforces it on every read.
 */
export function VisibilityStep({
  item,
  value,
  onChange,
  name,
  personId,
  note,
}: {
  item: VisibilityKey;
  value: Audience | undefined;
  onChange: (audience: Audience | undefined) => void;
  name: string;
  personId: string;
  note: boolean;
}) {
  const i18n = useT();
  const [busy, setBusy] = useState(false);
  const failed = showFailure(i18n);
  const section = VISIBILITY_ITEMS.find((i) => i.key === item)!.section;
  const choose = (audience: Audience) => {
    if (busy) return;
    haptic.select();
    const previous = value;
    onChange(audience);
    setBusy(true);
    const findable = item === "find" ? findableFor(audience) : undefined;
    void saveProfile({ audiences: { [section]: audience }, ...(findable ? { findable } : {}) })
      .catch((error) => {
        onChange(previous);
        failed(error);
      })
      .finally(() => setBusy(false));
  };
  return (
    <>
      <VisibilityPicker item={item} value={value} onChange={choose} mode="flow" name={name} personId={personId} busy={busy} />
      {note ? <Text variant="small">{i18n.t("journey.privateNote")}</Text> : null}
    </>
  );
}

/** The permission step that has no switches: what it is for, what it is not for, then the buttons in the footer. */
export function LocationStep() {
  const i18n = useT();
  const theme = useTheme();
  return (
    <>
      <View style={[styles.badge, { backgroundColor: theme.surfaceRaised }]}>
        <Icon name="pin" size={32} color={theme.amber} />
      </View>
      <Text variant="h1">{i18n.t("journey.locTitle")}</Text>
      <Text muted>{i18n.t("journey.locBody")}</Text>
    </>
  );
}

/** The finished profile, as the card the person leaves with. Only what was answered is on it. */
export function ClosingStep({
  name,
  username,
  personId,
  photo,
  age,
  visibility,
}: {
  name: string;
  username: string | null;
  personId: string;
  photo: string | null;
  age: number | null;
  visibility: Partial<Record<VisibilityKey, Audience>>;
}) {
  const i18n = useT();
  const theme = useTheme();
  const label = (audience: Audience) =>
    audience === "me" ? i18n.t("people.audienceMe") : audience === "crews" ? i18n.t("people.audienceCrews") : audience === "friends" ? i18n.t("people.audienceFriends") : i18n.t("people.audienceEveryone");
  const answered = VISIBILITY_ITEMS.filter((item) => visibility[item.key] !== undefined);
  return (
    <>
      <Text variant="h1">{i18n.t("journey.closingTitle", { name })}</Text>
      <Text muted>{i18n.t("journey.closingBody")}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.head}>
          {photo ? <Image source={{ uri: photo }} style={[styles.photo, { borderColor: theme.amber }]} accessibilityIgnoresInvertColors /> : <Avatar personId={personId} name={name} size={64} ring={theme.amber} />}
          <View style={styles.flex}>
            <Text variant="h2">{name}</Text>
            {username ? <Text variant="small">@{username}</Text> : null}
            {age !== null ? <Text variant="small">{i18n.t("journey.cardAge", { age })}</Text> : null}
          </View>
        </View>
        {answered.map((item) => (
          <View key={item.key} style={[styles.line, { borderTopColor: theme.line }]}>
            <Icon name={item.icon} size={18} color={theme.textMuted} />
            <Text variant="small" style={styles.flex}>
              {i18n.t(`journey.short.${item.key}`)}
            </Text>
            <Text variant="small" color={visibility[item.key] === "me" ? theme.textMuted : theme.amber}>
              {label(visibility[item.key]!)}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  card: { gap: 12, padding: 16, borderRadius: radius.card, borderWidth: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 64, height: 64, borderRadius: radius.pill, borderWidth: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
