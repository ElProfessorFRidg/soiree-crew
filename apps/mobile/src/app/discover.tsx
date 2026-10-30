import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatMoney } from "@crew/money";
import { useT } from "@/i18n";
import { currentFix } from "@/server/venueData";
import { fetchNearby, VIBE_TAGS, type NearbyPlace, type VibeTag } from "@/server/placeData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Chip, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";

const PINT_CAPS = [500, 700] as const;

/** COM-10: places around me, best first, filtered by price, door and vibe. */
export default function DiscoverScreen() {
  const i18n = useT();
  const theme = useTheme();
  const currency = useAppStore((state) => state.preferences.currency);
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [maxPint, setMaxPint] = useState<number | undefined>(undefined);
  const [strict, setStrict] = useState(false);
  const [tag, setTag] = useState<VibeTag | undefined>(undefined);
  const [openNow, setOpenNow] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const fix = await currentFix();
    if (!fix.ok) {
      setFailed(true);
      setPlaces([]);
      return;
    }
    const res = await fetchNearby(fix.fix.lat, fix.fix.lng, { ...(maxPint ? { maxPint } : {}), strict, ...(tag ? { tag } : {}), openNow }).catch(() => null);
    setPlaces(res?.places ?? []);
  }, [maxPint, strict, tag, openNow]);
  useEffect(() => {
    void load();
  }, [load]);

  const distance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${i18n.number(m / 1000, 1)} km`);
  return (
    <Screen back title={i18n.t("discover.title")} onRefresh={load}>
      <View style={styles.chips}>
        <Chip label={i18n.t("discover.openNow")} selected={openNow} onPress={() => setOpenNow(!openNow)} />
        {PINT_CAPS.map((cap) => (
          <Chip
            key={cap}
            label={i18n.t("discover.pintUnder", { price: formatMoney(cap, currency, i18n.locale) })}
            selected={maxPint === cap}
            onPress={() => setMaxPint(maxPint === cap ? undefined : cap)}
          />
        ))}
        <Chip label={i18n.t("discover.strict")} selected={strict} onPress={() => setStrict(!strict)} />
      </View>
      <View style={styles.chips}>
        {VIBE_TAGS.map((t) => (
          <Chip key={t} label={i18n.t(`place.tags.${t}`)} selected={tag === t} onPress={() => setTag(tag === t ? undefined : t)} />
        ))}
      </View>
      {places === null ? <SkeletonRows /> : null}
      {failed ? <Text>{i18n.t("discover.noLocation")}</Text> : null}
      {places && !failed && places.length === 0 ? <Text>{i18n.t("discover.none")}</Text> : null}
      <View>
        {places?.map((p, index) => (
          <Row
            key={p.venueId}
            title={p.name}
            subtitle={[
              distance(p.distanceM),
              p.openNow === true ? i18n.t("venue.hours.openNow") : p.openNow === false ? i18n.t("venue.hours.closedNow") : null,
              p.happyNow ? i18n.t("venue.hours.happyNow") : null,
              p.rating !== null ? i18n.t("discover.rating", { rating: i18n.number(p.rating, 1) }) : null,
              p.pint !== null ? i18n.t("discover.pint", { price: formatMoney(p.pint, currency, i18n.locale) }) : null,
              p.strict ? i18n.t("discover.strictShort") : null,
            ]
              .filter(Boolean)
              .join(", ")}
            leading={<Icon name="pin" color={theme.textMuted} />}
            trailing={<Icon name="chev" color={theme.textMuted} />}
            onPress={() => router.push({ pathname: "/place", params: { venueId: p.venueId } })}
            last={index === places.length - 1}
          />
        ))}
      </View>
      <Text variant="small">{i18n.t("discover.note")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
