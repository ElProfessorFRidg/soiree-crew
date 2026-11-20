import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { radius, space } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { Button } from "./Button";
import { answerConfirmation, cancelConfirmations, useCurrentConfirmation } from "./confirm";
import { Text } from "./Text";

/** One modal for the whole app: no browser confirm/alert, even inside an embedded preview. */
export function ConfirmDialogHost() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const active = useCurrentConfirmation();

  useEffect(() => () => cancelConfirmations(), []);

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
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessible={false}
            onPress={() => answer(false)}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              {
                width: Math.min(480, Math.max(280, width - 32)),
                backgroundColor: theme.surface,
                borderColor: theme.line,
              },
            ]}
          >
            <Text variant="h2" accessibilityRole="header">{active.title}</Text>
            {active.body ? <Text variant="body">{active.body}</Text> : null}
            <View style={[styles.actions, width < 420 && styles.stacked]}>
              <Button
                label={active.cancelLabel}
                variant="outline"
                height={48}
                style={styles.action}
                onPress={() => answer(false)}
              />
              <Button
                label={active.confirmLabel}
                variant={active.destructive === false ? "primary" : "danger"}
                height={48}
                style={styles.action}
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
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(10,14,13,.65)",
  },
  dialog: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.cardPadding,
    gap: space.sectionGap,
    maxHeight: "90%",
  },
  actions: {
    flexDirection: "row",
    gap: space.blockGap,
  },
  stacked: { flexDirection: "column" },
  action: { flex: 1 },
});
