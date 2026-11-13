import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { useSession } from "@/server/session";
import { fetchVenuePage, fetchVenuePhotos, type VenuePage, type VenuePhoto } from "@/server/venueData";
import { Avatar } from "@/ui/Avatar";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";

/**
 * The bar you tapped on the map, without leaving it: who leads here, my own nights, and the photos of
 * the nights I was part of. Each part shows only once it has loaded; a failure leaves the panel as it was.
 */
export function VenuePreview({ venueId }: { venueId: string }) {
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const [page, setPage] = useState<VenuePage | null>(null);
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);

  useEffect(() => {
    let current = true;
    setPage(null);
    setPhotos([]);
    void fetchVenuePage(venueId)
      .then((data) => current && setPage(data))
      .catch(() => undefined);
    void fetchVenuePhotos(venueId)
      .then((data) => current && setPhotos(data.photos))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [venueId]);

  const top = page?.top.slice(0, 3) ?? [];
  const nights = page?.myNights ?? 0;
  return (
    <View style={styles.box}>
      {top.length ? (
        <View>
          <Text variant="label">{i18n.t("bars.topHere")}</Text>
          {top.map((row, index) => (
            <ScalePressable
              key={row.userId}
              accessibilityRole="button"
              accessibilityLabel={i18n.t("bars.rankLine", { rank: index + 1, name: row.name, points: row.points })}
              onPress={() => router.push({ pathname: "/profile", params: { id: row.userId } })}
              style={styles.rankRow}
            >
              <Avatar personId={row.userId} name={row.name} size={30} />
              <Text variant="small" style={[styles.rankText, row.userId === me ? styles.me : undefined]}>
                {i18n.t("bars.rankLine", { rank: index + 1, name: row.name, points: row.points })}
              </Text>
            </ScalePressable>
          ))}
        </View>
      ) : null}
      {nights > 0 ? <Text variant="small">{i18n.plural("bars.myNightsHere", nights)}</Text> : null}
      {photos.length ? (
        <View>
          <Text variant="label">{i18n.t("bars.photosHere")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {photos.map((photo) => (
              <ScalePressable
                key={photo.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={i18n.t("venue.photoA11y", { date: new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(photo.at)) })}
                onPress={() => router.push({ pathname: "/album", params: { partyId: photo.partyId } })}
              >
                <Image source={{ uri: photo.url }} style={styles.photo} />
              </ScalePressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  me: { fontFamily: "Archivo-Semibold" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
  rankText: { flex: 1 },
  photos: { gap: 8 },
  photo: { width: 64, height: 64, borderRadius: 12 },
});
