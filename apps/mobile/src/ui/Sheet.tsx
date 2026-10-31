import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { IconButton } from "./Button";
import { Text } from "./Text";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The system page sheet on iOS: slides up over the screen, swipes down to close, and keeps the
 * screen behind it (and its state) untouched. Content scrolls and stays clear of the keyboard.
 */
export function Sheet({ visible, title, onClose, children }: Props) {
  const theme = useTheme();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.fill, { backgroundColor: theme.bg }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            // A page sheet starts under the status bar on iOS; elsewhere the modal is full screen.
            { paddingTop: Platform.OS === "ios" ? 20 : insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={styles.head}>
            <Text variant="h2" accessibilityRole="header" style={styles.fill}>
              {title}
            </Text>
            <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={onClose} />
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.screenX, gap: space.sectionGap },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
});
