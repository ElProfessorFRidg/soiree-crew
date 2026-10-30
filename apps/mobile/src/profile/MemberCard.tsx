import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { radius } from "@crew/design-tokens";
import { drinkLabel } from "@/drinks/display";
import type { DrinkKind } from "@/drinks/presets";
import { useT } from "@/i18n";
import { fetchProfile, type ProfileView } from "@/server/profileData";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { canShareImages } from "@/system/share";

/**
 * JOY-11: a card to share. It is built from the profile as a stranger sees it,
 * so sharing never shows a section the user keeps for friends or crews.
 */
export function MemberCard() {
  const i18n = useT();
  const theme = useTheme();
  const [view, setView] = useState<ProfileView | null>(null);
  const [busy, setBusy] = useState(false);
  const card = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    void fetchProfile("me", "stranger").then(setView).catch(() => undefined);
  }, []);
  if (!view) return null;
  if (!view.sections.identity) return <Text variant="small">{i18n.t("people.cardEmpty")}</Text>;
  const s = view.sections;
  const held = (s.titles ?? []).filter((t) => t.kind === "mayor").length;
  const favourite = s.drinks?.favourites[0];

  const share = async () => {
    if (!card.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: "png", quality: 1, result: Platform.OS === "web" ? "data-uri" : "tmpfile" });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/png" });
      else throw new Error("unavailable");
    } catch {
      showToast({ tone: "danger", message: i18n.t("recap.shareFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View ref={card} collapsable={false} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.head}>
          <Avatar personId={view.userId} name={s.identity?.displayName ?? "?"} size={56} ring={theme.amber} />
          <View style={styles.flex}>
            {s.identity ? <Text variant="h2">{s.identity.displayName}</Text> : null}
            {s.identity ? <Text variant="small">@{s.identity.username}</Text> : null}
          </View>
        </View>
        {s.titles?.length ? (
          <View style={styles.tags}>
            {s.titles.slice(0, 4).map((t, i) => (
              <Tag key={`${t.kind}-${i}`} label={t.kind === "mayor" ? i18n.t("ranking.mayor", { venue: t.venueName ?? "" }) : i18n.t(`ranking.${t.kind}`)} tone="amber" />
            ))}
          </View>
        ) : null}
        {held ? <Text>{i18n.plural("people.cardBars", held)}</Text> : null}
        {s.nights && s.nights.total > 0 ? <Text>{i18n.plural("people.cardNights", s.nights.total)}</Text> : null}
        {favourite ? <Text variant="small">{i18n.t("people.favourites", { list: drinkLabel({ kind: favourite.kind as DrinkKind }, i18n) })}</Text> : null}
        {s.crews?.length ? <Text variant="small">{s.crews.map((c) => c.name).join(", ")}</Text> : null}
        <Text variant="label" align="center">
          {i18n.t("recap.storyFooter")}
        </Text>
      </View>
      {/* Outside the captured card: why nights out are missing, when the profile keeps them for the crew. */}
      {!s.nights ? <Text variant="small">{i18n.t("people.cardNightsHidden")}</Text> : null}
      {canShareImages ? <Button label={i18n.t("people.shareCard")} icon="share" variant="secondary" height={48} loading={busy} onPress={() => void share()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 18, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  flex: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
