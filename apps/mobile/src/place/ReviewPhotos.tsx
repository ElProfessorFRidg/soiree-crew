import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { ReportPanel } from "@/moderation/ReportPanel";
import { addReviewPhotos, dropUpload, retryUpload, useUploads } from "@/photos/uploads";
import { showFailure } from "@/server/errors";
import { deleteReviewPhoto } from "@/server/placeData";
import { showPermissionDenied } from "@/system/permissions";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";

const MAX_PHOTOS = 3;
const TILE = 88;

/**
 * COM-02, QOL-09: the photos of one review. Everyone who sees the review sees them (and can report
 * one); on my own review I add up to three, through the album's queue that retries on bad signal.
 */
export function ReviewPhotos({
  venueId,
  photos,
  mine,
  onChanged,
}: {
  venueId: string;
  photos: { id: string; url: string }[];
  mine: boolean;
  onChanged: () => void;
}) {
  const i18n = useT();
  const theme = useTheme();
  const [open, setOpen] = useState<{ id: string; url: string } | null>(null);
  const queue = useUploads((state) => state.queue);
  const pending = mine ? queue.filter((p) => p.reviewVenueId === venueId) : [];
  // The server has them once the queue empties: refetch the place.
  const before = useRef(pending.length);
  useEffect(() => {
    if (before.current > 0 && pending.length === 0) onChanged();
    before.current = pending.length;
  }, [pending.length, onChanged]);
  const room = MAX_PHOTOS - photos.length - pending.length;

  const add = (source: "camera" | "library") =>
    void addReviewPhotos(venueId, source, room)
      .then((n) => {
        if (n < 0) showPermissionDenied(i18n, i18n.t("album.denied"), n === -1);
        else if (n > 0) haptic.confirmed();
      })
      .catch(showFailure(i18n));

  if (!photos.length && !mine) return null;
  return (
    <View style={styles.wrap}>
      {photos.length || pending.length ? (
        <View style={styles.row}>
          {photos.map((p) => (
            <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel={i18n.t("place.reviewPhoto")} onPress={() => setOpen(p)}>
              <Image source={{ uri: p.url }} style={[styles.tile, { backgroundColor: theme.surfaceRaised }]} />
            </Pressable>
          ))}
          {pending.map((p) => (
            <View key={p.id} style={styles.tile}>
              <Image source={{ uri: p.data ? `data:image/jpeg;base64,${p.data}` : p.uri }} style={[styles.tile, styles.faded]} />
              <View style={styles.overlay}>
                {p.status === "failed" ? (
                  <>
                    <Button label={i18n.t("album.retry")} variant="secondary" height={28} onPress={() => retryUpload(p.id)} />
                    <Button label={i18n.t("album.remove")} variant="outline" height={28} onPress={() => dropUpload(p.id)} />
                  </>
                ) : (
                  <Tag label={i18n.t("album.sending")} />
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {mine && room > 0 ? (
        <>
          <View style={styles.row}>
            <Button label={i18n.t("album.take")} icon="camera" variant="outline" height={40} style={styles.flex} onPress={() => add("camera")} />
            <Button label={i18n.t("place.addPhoto")} icon="image" variant="outline" height={40} style={styles.flex} onPress={() => add("library")} />
          </View>
          <Text variant="small">{i18n.t("place.photoLimit")}</Text>
        </>
      ) : null}

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={[styles.viewer, { backgroundColor: theme.bg }]}>
          <IconButton icon="x" accessibilityLabel={i18n.t("album.close")} onPress={() => setOpen(null)} />
          {open ? <Image source={{ uri: open.url }} resizeMode="contain" style={styles.full} /> : null}
          {open && mine ? (
            <Button
              label={i18n.t("album.delete")}
              icon="trash"
              variant="outline"
              height={48}
              onPress={() =>
                void deleteReviewPhoto(open.id)
                  .then(() => {
                    setOpen(null);
                    onChanged();
                  })
                  .catch(showFailure(i18n))
              }
            />
          ) : null}
          {open && !mine ? <ReportPanel targetKind="photo" targetId={open.id} /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flex: { flex: 1 },
  tile: { width: TILE, height: TILE, borderRadius: radius.tile },
  faded: { opacity: 0.5 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 4, padding: 4 },
  viewer: { flex: 1, padding: 16, paddingTop: 56, gap: 12 },
  full: { flex: 1, width: "100%" },
});
