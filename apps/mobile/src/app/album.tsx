import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { addPhotos, deletePhoto, dropUpload, fetchAlbum, retryUpload, useUploads, type AlbumPhoto } from "@/photos/uploads";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";
import { confirmAction } from "@/ui/confirm";
import { showPermissionDenied } from "@/system/permissions";

const COLUMNS = 3;
const GAP = 6;

/** N-21, O-84: the party's photos, private to the people who came. */
export default function AlbumScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const me = useSession((state) => state.session?.userId);
  const queue = useUploads((state) => state.queue);
  const pending = queue.filter((p) => p.partyId === partyId);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [open, setOpen] = useState<AlbumPhoto | null>(null);
  const tile = Math.floor((Math.min(width, 560) - 40 - GAP * (COLUMNS - 1)) / COLUMNS);

  const load = useCallback(() => {
    void fetchAlbum(partyId).then(setPhotos).catch(() => undefined);
  }, [partyId]);
  useEffect(load, [load]);
  // Reload when the queue empties: the server now has the photos.
  useEffect(() => {
    if (pending.length === 0) load();
  }, [pending.length, load]);

  const add = (source: "camera" | "library") =>
    void addPhotos(partyId, source)
      .then((n) => {
        if (n < 0) showPermissionDenied(i18n, i18n.t("album.denied"), n === -1);
        else if (n > 0) haptic.confirmed();
      })
      .catch(showFailure(i18n));

  return (
    <Screen back title={i18n.t("album.title")} withToasts>
      <Text variant="small">{i18n.t("album.private")}</Text>
      <View style={styles.actions}>
        <Button label={i18n.t("album.take")} icon="camera" height={52} style={styles.flex} onPress={() => add("camera")} />
        <Button label={i18n.t("album.pick")} icon="image" variant="secondary" height={52} style={styles.flex} onPress={() => add("library")} />
      </View>
      {photos.length >= 2 ? (
        <Button label={i18n.t("strip.open")} icon="sparkdot" variant="outline" height={48} onPress={() => router.push({ pathname: "/photo-strip", params: { partyId } })} />
      ) : null}
      {photos.length ? <Text variant="label">{i18n.plural("album.count", photos.length)}</Text> : null}
      {!photos.length && !pending.length ? <Text>{i18n.t("album.empty")}</Text> : null}

      <View style={styles.grid}>
        {pending.map((p) => (
          <View key={p.id} style={{ width: tile, height: tile }}>
            <Image source={{ uri: p.data ? `data:image/jpeg;base64,${p.data}` : p.uri }} style={[styles.image, styles.faded]} />
            <View style={styles.overlay}>
              {p.status === "failed" ? (
                <>
                  <Tag label={i18n.t("album.failed")} tone="danger" />
                  <Button label={i18n.t("album.retry")} variant="secondary" height={32} onPress={() => retryUpload(p.id)} />
                  <Button label={i18n.t("album.remove")} variant="outline" height={32} onPress={() => dropUpload(p.id)} />
                </>
              ) : (
                <Tag label={i18n.t("album.sending")} />
              )}
            </View>
          </View>
        ))}
        {photos.map((p) => (
          <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel={i18n.t("album.by", { name: p.name })} onPress={() => setOpen(p)}>
            <Image source={{ uri: p.url }} style={[styles.image, { width: tile, height: tile, backgroundColor: theme.surfaceRaised }]} />
          </Pressable>
        ))}
      </View>

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={[styles.viewer, { backgroundColor: theme.bg }]}>
          <View style={styles.viewerTop}>
            <IconButton icon="x" accessibilityLabel={i18n.t("album.close")} onPress={() => setOpen(null)} />
            {open ? <Text variant="small">{i18n.t("album.by", { name: open.userId === me ? i18n.t("common.you") : open.name })}</Text> : null}
          </View>
          {open ? <Image source={{ uri: open.url }} resizeMode="contain" style={styles.full} /> : null}
          {open && open.userId === me ? (
            <Button
              label={i18n.t("album.delete")}
              icon="trash"
              variant="outline"
              height={48}
              onPress={() =>
                void confirmAction({ title: i18n.t("album.deleteConfirm"), confirmLabel: i18n.t("album.delete"), cancelLabel: i18n.t("album.keep") }).then((ok) => {
                  if (!ok) return;
                  void deletePhoto(open.id)
                    .then(() => {
                      setOpen(null);
                      load();
                    })
                    .catch(showFailure(i18n));
                })
              }
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  image: { width: "100%", height: "100%", borderRadius: radius.tile },
  faded: { opacity: 0.5 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 4, padding: 4 },
  viewer: { flex: 1, padding: 16, paddingTop: 56, gap: 12 },
  viewerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  full: { flex: 1, width: "100%" },
});
