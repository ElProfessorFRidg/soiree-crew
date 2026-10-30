import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { IconButton } from "@/ui/Button";
import { Text } from "@/ui/Text";

/** N-19: a receipt's thumbnail; a tap opens it full screen. The link only works for pool members. */
export function ReceiptThumb({ url, title }: { url: string; title: string }) {
  const i18n = useT();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={i18n.t("money.receiptView")} hitSlop={6} onPress={() => setOpen(true)}>
        <Image source={{ uri: url }} accessibilityIgnoresInvertColors style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.viewer, { backgroundColor: theme.bg }]}>
          <View style={styles.top}>
            <IconButton icon="x" accessibilityLabel={i18n.t("album.close")} onPress={() => setOpen(false)} />
            <Text variant="h3" style={styles.flex} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Image source={{ uri: url }} resizeMode="contain" accessibilityIgnoresInvertColors style={styles.full} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 40, height: 40, borderRadius: radius.tile },
  viewer: { flex: 1, padding: 16, paddingTop: 56, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  full: { flex: 1, width: "100%" },
});
