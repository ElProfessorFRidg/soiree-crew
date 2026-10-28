import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { pickFrames } from "@/photos/strip";
import { fetchAlbum, type AlbumPhoto } from "@/photos/uploads";
import { useCrewData } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { canShareImages } from "@/system/share";

const FRAMES = 4;

/** JOY-09: the night's photo strip, built from the shared album, ready for a story. */
export default function PhotoStripScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const party = useCrewData((state) => state.parties.find((p) => p.id === partyId));
  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(null);
  const [shift, setShift] = useState(0);
  const [sharing, setSharing] = useState(false);
  const strip = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    void fetchAlbum(partyId)
      .then((list) => setPhotos(list.filter((p) => p.storyOk !== false)))
      .catch(() => setPhotos([]));
  }, [partyId]);

  if (!photos) {
    return (
      <Screen back title={i18n.t("strip.title")}>
        <SkeletonRows />
      </Screen>
    );
  }
  // "Another mix" rotates which photos fill the strip, keeping them in the night's order.
  const pool = photos.length > FRAMES ? [...photos.slice(shift % photos.length), ...photos.slice(0, shift % photos.length)] : photos;
  const frames = pickFrames(pool).sort((a, b) => a.at - b.at);
  const date = party ? new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(party.startsAt)) : "";

  const share = async () => {
    if (!strip.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(strip, { format: "jpg", quality: 0.92, result: Platform.OS === "web" ? "data-uri" : "tmpfile" });
      haptic.confirmed();
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: i18n.t("strip.share") });
      else throw new Error("unavailable");
    } catch {
      showToast({ tone: "danger", message: i18n.t("recap.shareFailed") });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen
      back
      title={i18n.t("strip.title")}
      withToasts
      footer={canShareImages && frames.length ? <Button label={i18n.t("strip.share")} icon="share" height={56} loading={sharing} onPress={() => void share()} /> : undefined}
    >
      {frames.length === 0 ? <Text>{i18n.t("strip.empty")}</Text> : null}
      {frames.length ? (
        <View ref={strip} collapsable={false} style={[styles.strip, { backgroundColor: theme.text }]}>
          {frames.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={[styles.frame, { backgroundColor: theme.surfaceRaised }]} resizeMode="cover" />
          ))}
          <Text variant="h3" align="center" color={theme.bg}>
            {party?.name ?? ""}
          </Text>
          <Text variant="small" align="center" color={theme.bg}>
            {date}
          </Text>
        </View>
      ) : null}
      {photos.length > FRAMES ? (
        <Button
          label={i18n.t("strip.another")}
          variant="secondary"
          height={48}
          onPress={() => {
            haptic.select();
            setShift((s) => s + 1);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { alignSelf: "center", width: 220, padding: 10, gap: 8, borderRadius: radius.tile },
  frame: { width: 200, height: 150, borderRadius: 4 },
});
