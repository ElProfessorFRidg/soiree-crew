import { useEffect } from "react";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, space } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { Button } from "./Button";
import { answerConfirmation, cancelConfirmations, useCurrentConfirmation } from "./confirm";
import { Text } from "./Text";

/**
 * A native-feeling bottom sheet on phones and a restrained dialog on desktop/iPad.
 * Uses the approved slate-and-amber tokens and replaces every browser confirmation.
 */
export function ConfirmDialogHost() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const active = useCurrentConfirmation();
  const phone = width < 700;

  useEffect(() => () => cancelConfirmations(), []);
  useEffect(() => {
    if (active) AccessibilityInfo.announceForAccessibility(active.title);
  }, [active?.id]);

  const answer = (accepted: boolean) => {
    if (active) answerConfirmation(active.id, accepted);
  };

  return (
    <Modal
      transparent
      visible={!!active}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={() => answer(false)}
    >
      {active ? (
        <View style={[styles.overlay, phone ? styles.phoneOverlay : styles.wideOverlay, { backgroundColor: theme.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => answer(false)} />
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              phone ? styles.sheet : styles.centered,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                paddingBottom: phone ? Math.max(24, insets.bottom + 16) : space.cardPadding,
              },
            ]}
          >
            {phone ? <View style={[styles.handle, { backgroundColor: theme.handle }]} /> : null}
            <Text variant="h2" accessibilityRole="header">{active.title}</Text>
            {active.body ? <Text variant="body">{active.body}</Text> : null}
            <View style={[styles.actions, width < 380 && styles.stacked]}>
              <Button
                label={active.cancelLabel}
                variant="outline"
                height={48}
                style={width < 380 ? undefined : styles.action}
                onPress={() => answer(false)}
              />
              <Button
                label={active.confirmLabel}
                variant={active.destructive === false ? "primary" : "danger"}
                height={48}
                style={width < 380 ? undefined : styles.action}
                onPress={() => answer(true)}
              />
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center" },
  phoneOverlay: { justifyContent: "flex-end" },
  wideOverlay: { justifyContent: "center", padding: 24 },
  dialog: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.cardPadding,
    gap: space.sectionGap,
    maxHeight: "90%",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  centered: {
    width: "100%",
    maxWidth: 480,
    borderRadius: radius.card,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 4,
  },
  actions: { flexDirection: "row", gap: space.blockGap },
  stacked: { flexDirection: "column" },
  action: { flex: 1 },
});
